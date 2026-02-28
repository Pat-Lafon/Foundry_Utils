// ============================
// MEDIUM REST MACRO (DEV VERSION)
// ============================

import {
    getChoicesAllowed,
    getCasterLevel,
    getRecoveryBudget,
    calcHitDiceRecovery,
    getMissingSpellSlots,
    validateSlotRecovery,
    filterLongRestFeatures,
} from "../../lib/medium-rest.js";

// Look up the custom-dnd5e counter ID for "Wound Clears" by label (max = @attributes.prof)
const WOUND_CLEARS_FLAG = (() => {
    const counters = JSON.parse(game.settings.get("custom-dnd5e", "character-counters"));
    const entry = Object.entries(counters).find(([, v]) => v.label === "Wound Clears");
    return entry?.[0];
})();

const actor = game.actors.getName("Ravos");
if (!actor) {
    ui.notifications.error("Ravos not found.");
    throw new Error("Ravos not found.");
}

// ----------------------------
// Step 1: Ask for rations
// ----------------------------
new Dialog({
    title: "Medium Rest",
    content: `
    <form>
      <div class="form-group">
        <label>Rations consumed today:</label>
        <input type="number" name="rations" value="1" min="0"/>
      </div>
    </form>
  `,
    buttons: {
        confirm: {
            label: "Take Medium Rest",
            callback: async (html) => {
                const rations = Number(html.find("[name='rations']").val());
                const choicesAllowed = getChoicesAllowed(rations);

                // Apply normal short rest first
                await actor.shortRest();

                // Try to reset wound clears counter
                if (WOUND_CLEARS_FLAG) {
                    await actor.update({
                        [`flags.custom-dnd5e.${WOUND_CLEARS_FLAG}`]: actor.system.attributes.prof,
                    });
                }

                if (choicesAllowed <= 0) {
                    return ui.notifications.info("Medium Rest complete (Short Rest only).");
                }

                showMediumOptions(choicesAllowed);
            }
        },
        cancel: { label: "Cancel" }
    }
}).render(true);

// ----------------------------
// Step 2: Medium Rest Options
// ----------------------------
async function showMediumOptions(choicesAllowed) {

    const options = [
        { id: "hitdice", label: "Recover Half Hit Dice" },
        { id: "arcane", label: "Recover Spell Slots (Arcane Recovery Style)" },
        { id: "features", label: "Restore Long Rest Features" }
        // TODO: Be more specific that this only does one feature
        // TODO: Can we test this with other long rest features
        // TODO: What about at first dawn related items/features?
        // TODO: Can we disable short rests from restoring at first dawn things?
        // TODO: What other edge cases could I be missing?
        // TODO: Can we remove the hardcoded actor, but somehow gate it so that
        // we don't accidentally medium rest someone else's character?
    ];

    let content = `<form>`;
    for (let opt of options) {
        content += `
      <div>
        <input type="checkbox" name="opt" value="${opt.id}"/>
        ${opt.label}
      </div>`;
    }
    content += `</form>`;

    async function renderDialog() {
        return new Promise(resolve => {
            new Dialog({
                title: `Medium Rest — Choose up to ${choicesAllowed}`,
                content,
                buttons: {
                    confirm: {
                        label: "Apply",
                        callback: async (html) => {

                            const selected = html.find("input[name='opt']:checked");

                            if (selected.length > choicesAllowed) {
                                ui.notifications.warn(`Choose up to ${choicesAllowed}`);
                                await renderDialog();
                                resolve();
                                return;
                            }

                            for (let i = 0; i < selected.length; i++) {
                                const choice = selected[i].value;

                                if (choice === "hitdice") await recoverHalfHitDice();
                                if (choice === "arcane") await arcaneRecoverySlotPicker();
                                if (choice === "features") await chooseLongRestFeatures();
                            }

                            ui.notifications.info("Medium Rest complete.");
                            resolve();
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve()
                    }
                }
            }).render(true);
        });
    }

    await renderDialog();
}

// ============================
// Recover Half Hit Dice
// TODO: Over-recovers for multi-class — see lib/medium-rest.js
// ============================
async function recoverHalfHitDice() {
    const classes = actor.items.filter(i => i.type === "class");

    for (let cls of classes) {
        const hd = cls.system.hd;
        if (!hd?.max || !hd.spent) continue;

        const { newSpent } = calcHitDiceRecovery(hd.spent, hd.max);
        await cls.update({ "system.hd.spent": newSpent });
    }
}

// ============================
// Arcane Recovery-Style Spell Picker
// Ref: https://2014.5e.tools/classes.html#wizard_phb,state:feature=s0-0
// Budget = ceil(casterLevel / 2), no slots 6th level or higher.
// ============================
async function arcaneRecoverySlotPicker() {
    const classes = actor.items.filter(i => i.type === "class");
    const casterLevel = getCasterLevel(classes);
    if (!casterLevel) return ui.notifications.warn("This character has no caster levels.");
    const budget = getRecoveryBudget(casterLevel);

    const spellLevels = getMissingSpellSlots(actor.system.spells);

    if (!spellLevels.length) {
        return ui.notifications.info("No spell slots are missing.");
    }

    // Function to render the dialog
    async function renderDialog() {
        let content = `<form>
      <p>Total recovery budget: <span id="budget">${budget}</span> levels</p>
      <table style="width:100%">
        <tr><th>Level</th><th>Missing Slots</th><th>Restore</th></tr>`;

        for (const sp of spellLevels) {
            content += `
        <tr>
          <td>${sp.lvl}</td>
          <td>${sp.missing}</td>
          <td><input type="number" name="lvl${sp.lvl}" min="0" max="${sp.missing}" value="0"/></td>
        </tr>`;
        }
        content += `</table></form>`;

        return new Promise(resolve => {
            new Dialog({
                title: "Medium Rest — Restore Spell Slots",
                content,
                buttons: {
                    confirm: {
                        label: "Restore",
                        callback: async (html) => {
                            /** @type {Record<number, number>} */
                            const selections = {};
                            for (const sp of spellLevels) {
                                selections[sp.lvl] = Number(html.find(`[name=lvl${sp.lvl}]`).val());
                            }

                            const result = validateSlotRecovery(spellLevels, selections, budget);

                            if (!result.valid) {
                                ui.notifications.warn(`You exceeded your recovery budget of ${budget} levels. Please adjust.`);
                                await renderDialog();
                                resolve();
                            } else {
                                await actor.update(result.updates);
                                ui.notifications.info("Spell slots recovered!");
                                resolve();
                            }
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve()
                    }
                },
                default: "confirm"
            }).render(true);
        });
    }

    // Start the first dialog
    await renderDialog();
}

// ============================
// Choose Long-Rest Features to Restore
// ============================
async function chooseLongRestFeatures() {

    const items = filterLongRestFeatures(actor.items);

    if (!items.length) {
        return ui.notifications.info("No long-rest features available to restore.");
    }

    // Build checkbox dialog
    let content = `<form>`;
    for (let item of items) {
        const uses = item.system.uses;
        const available = uses.max - uses.spent;
        const type = item.system.type?.value || item.type;
        content += `
      <div>
        <input type="checkbox" name="feat" value="${item.id}"/>
        ${item.name} (${type}) — ${available}/${uses.max} uses remaining
      </div>`;
    }
    content += `</form>`;

    return new Promise(resolve => {
        new Dialog({
            title: "Select Long-Rest Features to Restore",
            content,
            buttons: {
                confirm: {
                    label: "Restore Selected",
                    callback: async (html) => {
                        const selected = html.find("input[name='feat']:checked");
                        for (let i = 0; i < selected.length; i++) {
                            const itemId = selected[i].value;
                            const item = actor.items.get(itemId);
                            if (!item) continue;
                            await item.update({ "system.uses.spent": 0 });
                        }
                        ui.notifications.info("Selected features restored!");
                        resolve();
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => resolve()
                }
            }
        }).render(true);
    });
}
