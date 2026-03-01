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
      else if (progression === "half") total += Math.floor(levels / 2);
      else if (progression === "third") total += Math.floor(levels / 3);
      else throw new Error(`Unknown spellcasting progression "${progression}" on class "${cls.name}"`);
    }
    return total;
  }
  function getRecoveryBudget(casterLevel) {
    return Math.ceil(casterLevel / 2);
  }
  var MAX_RECOVERY_SLOT_LEVEL = 5;
  function getHitDiceBudget(totalMaxHD) {
    return Math.max(Math.floor(totalMaxHD / 2), 1);
  }
  function getSpentHitDice(classes) {
    if (!classes.length) throw new Error("No classes provided");
    const result = [];
    for (const cls of classes) {
      const hd = cls.system.hd;
      if (!hd) throw new Error(`Class "${cls.name}" is missing hit dice data`);
      if (!hd.max || !hd.spent) continue;
      result.push({
        name: cls.name,
        denomination: hd.denomination,
        max: hd.max,
        spent: hd.spent
      });
    }
    return result;
  }
  function validateHitDiceRecovery(spentHitDice, selections, budget) {
    let totalUsed = 0;
    const updates = [];
    for (const cls of spentHitDice) {
      const val = selections[cls.name] ?? 0;
      if (val <= 0) continue;
      if (val > cls.spent) return { valid: false, totalUsed, updates };
      totalUsed += val;
      updates.push({ name: cls.name, newSpent: cls.spent - val });
    }
    return { valid: totalUsed <= budget, totalUsed, updates };
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
      if (val <= 0) continue;
      if (val > sp.missing) return { valid: false, totalUsed, updates };
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
  var WOUND_CLEARS_FLAG = (() => {
    const counters = game.settings.get("custom-dnd5e", "character-counters");
    const entry = Object.entries(counters).find(([, v]) => v.label === "Wound Clears");
    return entry?.[0];
  })();
  async function pickActor() {
    const owned = game.actors.filter((a) => a.isOwner && a.type === "character");
    if (!owned.length) {
      ui.notifications.error("No owned characters found.");
      return null;
    }
    if (owned.length === 1) return owned[0];
    const defaultId = game.user.character?.id;
    let radioHtml = "";
    for (const a of owned) {
      const checked = a.id === defaultId ? "checked" : "";
      radioHtml += `<div><label><input type="radio" name="actor" value="${a.id}" ${checked}/> ${a.name}</label></div>`;
    }
    return new Promise((resolve) => {
      new Dialog({
        title: "Medium Rest \u2014 Select Character",
        content: `<form>${radioHtml}</form>`,
        buttons: {
          confirm: {
            label: "Continue",
            callback: (html) => {
              const id = html.find("input[name='actor']:checked").val();
              resolve(id ? game.actors.get(id) : null);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => resolve(null)
          }
        }
      }).render(true);
    });
  }
  (async () => {
    const actor = await pickActor();
    if (!actor) return;
    new Dialog({
      title: "Medium Rest",
      content: `
        <p>A medium rest grants all benefits of a short rest, resets wound clears, and additionally grants <strong>N\u22121</strong> of the options below (where N = rations consumed):</p>
        <ul style="margin-top:0">
          <li>Half your hit dice</li>
          <li>An "arcane recovery" worth of spell slots (using total caster level)</li>
          <li>All charges of all long rest features (except spell slots)</li>
        </ul>
        <form>
          <div class="form-group">
            <label>Rations consumed:</label>
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
            const summaryParts = [];
            if (WOUND_CLEARS_FLAG) {
              await actor.update({
                [`flags.custom-dnd5e.${WOUND_CLEARS_FLAG}`]: actor.system.attributes.prof
              });
              summaryParts.push("Wound clears reset");
            }
            if (choicesAllowed <= 0) {
              const msg = summaryParts.length ? `Medium Rest complete (Short Rest only): ${summaryParts.join(", ")}` : "Medium Rest complete (Short Rest only).";
              return ui.notifications.info(msg);
            }
            showMediumOptions(choicesAllowed, summaryParts);
          }
        },
        cancel: { label: "Cancel" }
      }
    }).render(true);
    async function showMediumOptions(choicesAllowed, summaryParts = []) {
      const classes = actor.items.filter((i) => i.type === "class");
      const casterLevel = getCasterLevel(classes);
      const spentDice = classes.length ? getSpentHitDice(classes) : [];
      const lrFeatures = filterLongRestFeatures(actor.items);
      const hasSpentHD = spentDice.length > 0;
      const hasCasterLevels = casterLevel > 0;
      const hasMissingSlots = hasCasterLevels && getMissingSpellSlots(actor.system.spells).length > 0;
      const hasSpentFeatures = lrFeatures.some((i) => i.system.uses.spent > 0);
      const options = [
        {
          id: "hitdice",
          label: "Recover Half Hit Dice",
          enabled: hasSpentHD,
          reason: !classes.length ? "no classes" : "no hit dice spent"
        },
        {
          id: "arcane",
          label: "Recover Spell Slots (Arcane Recovery Style)",
          enabled: hasCasterLevels && hasMissingSlots,
          reason: !hasCasterLevels ? "no caster levels" : "no spell slots missing"
        },
        {
          id: "features",
          label: "Restore All Long Rest Features",
          enabled: hasSpentFeatures,
          reason: !lrFeatures.length ? "no long rest features" : "all features at full charges"
        }
      ];
      let content = `<form>`;
      for (let opt of options) {
        const disabled = opt.enabled ? "" : "disabled";
        const reasonText = opt.enabled ? "" : ` <i style="opacity:0.6">(${opt.reason})</i>`;
        content += `
          <div>
            <input type="checkbox" name="opt" value="${opt.id}" ${disabled}/>
            ${opt.label}${reasonText}
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
                    let result = null;
                    if (choice === "hitdice") result = await recoverHalfHitDice();
                    else if (choice === "arcane") result = await arcaneRecoverySlotPicker();
                    else if (choice === "features") result = await restoreAllLongRestFeatures();
                    if (result) summaryParts.push(result);
                  }
                  const msg = summaryParts.length ? `Medium Rest complete: ${summaryParts.join(", ")}` : "Medium Rest complete.";
                  ui.notifications.info(msg);
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
      if (!classes.length) {
        ui.notifications.warn("This character has no classes.");
        return null;
      }
      const totalMax = classes.reduce((sum, cls) => sum + (cls.system.hd?.max ?? 0), 0);
      const budget = getHitDiceBudget(totalMax);
      const spentDice = getSpentHitDice(classes);
      if (!spentDice.length) {
        ui.notifications.info("No hit dice spent \u2014 nothing to recover.");
        return null;
      }
      if (spentDice.length === 1) {
        const cls = classes.find((c) => c.name === spentDice[0].name);
        const recover = Math.min(budget, spentDice[0].spent);
        await cls.update({ "system.hd.spent": spentDice[0].spent - recover });
        return recover > 0 ? `Recovered ${recover} hit dice` : null;
      }
      return hitDicePicker(classes, spentDice, budget);
    }
    async function hitDicePicker(classes, spentDice, budget) {
      let summary = null;
      async function renderDialog() {
        let content = `<form>
          <p>Recovery budget: <strong>${budget}</strong> dice (half of total HD, minimum 1)</p>
          <table style="width:100%">
            <tr><th>Class</th><th>Die</th><th>Spent</th><th>Recover</th></tr>`;
        for (const sd of spentDice) {
          content += `
            <tr>
              <td>${sd.name}</td>
              <td>d${sd.denomination}</td>
              <td>${sd.spent}</td>
              <td><input type="number" name="hd_${sd.name}" min="0" max="${sd.spent}" value="0"/></td>
            </tr>`;
        }
        content += `</table></form>`;
        return new Promise((resolve) => {
          new Dialog({
            title: "Medium Rest \u2014 Recover Hit Dice",
            content,
            buttons: {
              confirm: {
                label: "Recover",
                callback: async (html) => {
                  const selections = {};
                  for (const sd of spentDice) {
                    selections[sd.name] = Number(html.find(`[name="hd_${sd.name}"]`).val());
                  }
                  const result = validateHitDiceRecovery(spentDice, selections, budget);
                  if (!result.valid) {
                    ui.notifications.warn(`You exceeded the recovery budget of ${budget} dice. Please adjust.`);
                    await renderDialog();
                    resolve();
                  } else {
                    const updates = result.updates.map((u) => {
                      const cls = classes.find((c) => c.name === u.name);
                      return cls.update({ "system.hd.spent": u.newSpent });
                    });
                    await Promise.all(updates);
                    if (result.totalUsed > 0) summary = `Recovered ${result.totalUsed} hit dice`;
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
      return summary;
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
      let summary = null;
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
                    const totalLevels = Object.entries(selections).reduce((sum, [lvl, n]) => sum + Number(lvl) * n, 0);
                    if (totalLevels > 0) summary = `Restored ${totalLevels} spell slot levels`;
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
      return summary;
    }
    async function restoreAllLongRestFeatures() {
      const items = filterLongRestFeatures(actor.items);
      if (!items.length) {
        ui.notifications.info("No long-rest features available to restore.");
        return null;
      }
      const names = [];
      const updates = [];
      for (const item of items) {
        if (!item.system.uses.spent) continue;
        updates.push(item.update({ "system.uses.spent": 0 }));
        names.push(item.name);
      }
      if (!updates.length) {
        ui.notifications.info("All long-rest features already at full charges.");
        return null;
      }
      await Promise.all(updates);
      return `Restored ${names.join(", ")}`;
    }
  })();
})();
