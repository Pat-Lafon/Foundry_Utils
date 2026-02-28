// Auto-generated — do not edit. Source: macros/src/
(() => {
  // lib/medium-rest.js
  function getChoicesAllowed(rations) {
    return Math.max(rations - 1, 0);
  }
  function getCasterLevel(classes) {
    let total = 0;
    for (const cls of classes) {
      const levels = cls.system.levels ?? 0;
      const progression = cls.system.spellcasting?.progression;
      if (!progression || progression === "none") continue;
      if (progression === "pact") continue;
      if (progression === "full") total += levels;
      if (progression === "half") total += Math.floor(levels / 2);
      if (progression === "third") total += Math.floor(levels / 3);
    }
    return total;
  }
  function getRecoveryBudget(casterLevel) {
    return Math.ceil(casterLevel / 2);
  }
  var MAX_RECOVERY_SLOT_LEVEL = 5;
  function calcHitDiceRecovery(spent, max) {
    const recover = Math.min(Math.ceil(max / 2), spent);
    const newSpent = spent - recover;
    return { recover, newSpent };
  }
  function getMissingSpellSlots(spells, maxLevel = MAX_RECOVERY_SLOT_LEVEL) {
    const result = [];
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const slot = spells[`spell${lvl}`];
      if (!slot?.max) continue;
      const missing = slot.max - slot.value;
      if (missing > 0) {
        result.push({ lvl, current: slot.value, max: slot.max, missing });
      }
    }
    return result;
  }
  function validateSlotRecovery(spellLevels, selections, budget) {
    let totalUsed = 0;
    const updates = {};
    for (const sp of spellLevels) {
      const val = selections[sp.lvl] ?? 0;
      if (val <= 0 || val > sp.missing) continue;
      totalUsed += val * sp.lvl;
      updates[`system.spells.spell${sp.lvl}.value`] = sp.current + val;
    }
    return { valid: totalUsed <= budget, totalUsed, updates };
  }
  function filterLongRestFeatures(items) {
    return items.filter((i) => {
      const uses = i.system.uses;
      return uses?.max && Array.isArray(uses.recovery) && uses.recovery.some((r) => r.period === "lr");
    });
  }

  // macros/src/medium-rest.js
  var actor = game.actors.getName("Ravos");
  if (!actor) {
    ui.notifications.error("Ravos not found.");
    throw new Error("Ravos not found.");
  }
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
          await actor.shortRest();
          if (choicesAllowed <= 0) {
            return ui.notifications.info("Medium Rest complete (Short Rest only).");
          }
          showMediumOptions(choicesAllowed);
        }
      },
      cancel: { label: "Cancel" }
    }
  }).render(true);
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
      return new Promise((resolve) => {
        new Dialog({
          title: `Medium Rest \u2014 Choose up to ${choicesAllowed}`,
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
  async function recoverHalfHitDice() {
    const classes = actor.items.filter((i) => i.type === "class");
    for (let cls of classes) {
      const hd = cls.system.hd;
      if (!hd?.max || !hd.spent) continue;
      const { newSpent } = calcHitDiceRecovery(hd.spent, hd.max);
      await cls.update({ "system.hd.spent": newSpent });
    }
  }
  async function arcaneRecoverySlotPicker() {
    const classes = actor.items.filter((i) => i.type === "class");
    const casterLevel = getCasterLevel(classes);
    if (!casterLevel) return ui.notifications.warn("This character has no caster levels.");
    const budget = getRecoveryBudget(casterLevel);
    const spellLevels = getMissingSpellSlots(actor.system.spells);
    if (!spellLevels.length) {
      return ui.notifications.info("No spell slots are missing.");
    }
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
      return new Promise((resolve) => {
        new Dialog({
          title: "Medium Rest \u2014 Restore Spell Slots",
          content,
          buttons: {
            confirm: {
              label: "Restore",
              callback: async (html) => {
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
    await renderDialog();
  }
  async function chooseLongRestFeatures() {
    const items = filterLongRestFeatures(actor.items);
    if (!items.length) {
      return ui.notifications.info("No long-rest features available to restore.");
    }
    let content = `<form>`;
    for (let item of items) {
      const uses = item.system.uses;
      const available = uses.max - uses.spent;
      const type = item.system.type?.value || item.type;
      content += `
      <div>
        <input type="checkbox" name="feat" value="${item.id}"/>
        ${item.name} (${type}) \u2014 ${available}/${uses.max} uses remaining
      </div>`;
    }
    content += `</form>`;
    return new Promise((resolve) => {
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
})();
