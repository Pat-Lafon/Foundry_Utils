// Auto-generated — do not edit. Source: macros/src/
(() => {
  // lib/containers.js
  function getPackableItems(items) {
    return items.filter((i) => {
      if (!i.system.weight?.value) return false;
      if (i.type === "container") return false;
      if (i.system.equipped) return false;
      if (i.system.container) return false;
      if (isPotion(i)) return false;
      return true;
    }).map((i) => ({
      id: i._id,
      name: i.name,
      totalWeight: i.system.weight.value * (i.system.quantity ?? 1)
    }));
  }
  function isPotion(item) {
    return item.system.type?.value === "potion";
  }
  var COINS_PER_POUND = 50;
  function coinWeight(currency) {
    let total = 0;
    for (const denom of Object.keys(currency)) total += currency[denom] ?? 0;
    return total / COINS_PER_POUND;
  }
  function getContainersWithCapacity(items) {
    const containers = items.filter(
      (i) => i.type === "container" && i.system.capacity?.weight?.value > 0
    );
    const contentWeight = /* @__PURE__ */ new Map();
    for (const item of items) {
      const cid = item.system.container;
      if (!cid) continue;
      const w = (item.system.weight?.value ?? 0) * (item.system.quantity ?? 1);
      contentWeight.set(cid, (contentWeight.get(cid) ?? 0) + w);
    }
    return containers.map((c) => {
      const maxWeight = c.system.capacity.weight.value;
      const itemWeight = contentWeight.get(c._id) ?? 0;
      const cWeight = c.system.currency ? coinWeight(c.system.currency) : 0;
      const currentWeight = itemWeight + cWeight;
      return {
        id: c._id,
        name: c.name,
        maxWeight,
        currentWeight,
        remainingWeight: maxWeight - currentWeight
      };
    });
  }
  function planPacking(packableItems, containers) {
    const sorted = [...packableItems].sort((a, b) => b.totalWeight - a.totalWeight);
    const remaining = containers.map((c) => ({ ...c }));
    const assignments = [];
    const overflow = [];
    for (const item of sorted) {
      const target = remaining.find((c) => c.remainingWeight >= item.totalWeight);
      if (target) {
        assignments.push({
          itemId: item.id,
          itemName: item.name,
          containerId: target.id,
          containerName: target.name
        });
        target.remainingWeight -= item.totalWeight;
      } else {
        overflow.push({ id: item.id, name: item.name, totalWeight: item.totalWeight });
      }
    }
    return { assignments, overflow };
  }
  function getContainerItemIds(items) {
    return items.filter((i) => i.system.container).map((i) => ({ id: i._id, name: i.name }));
  }
  function planCoinPacking(actorCurrency, items, containers) {
    const pool = { ...actorCurrency };
    const containerUpdates = [];
    let totalMoved = 0;
    const currencyById = new Map(
      items.filter((i) => i.type === "container" && i.system.currency).map((i) => [i._id, i.system.currency])
    );
    for (const container of containers) {
      let spaceCoins = Math.floor(container.remainingWeight * COINS_PER_POUND);
      if (spaceCoins <= 0) continue;
      const existing = currencyById.get(container.id);
      const updated = existing ? { ...existing } : { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
      let changed = false;
      for (const denom of Object.keys(actorCurrency)) {
        if (pool[denom] <= 0 || spaceCoins <= 0) continue;
        const move = Math.min(pool[denom], spaceCoins);
        updated[denom] += move;
        pool[denom] -= move;
        spaceCoins -= move;
        totalMoved += move;
        changed = true;
      }
      if (changed) {
        containerUpdates.push({ id: container.id, currency: updated });
      }
    }
    return { containerUpdates, remainingCurrency: pool, totalMoved };
  }
  function collectContainerCurrency(items, containers) {
    const containerIds = new Set(containers.map((c) => c.id));
    const collected = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    const containerUpdates = [];
    let totalCollected = 0;
    for (const item of items) {
      if (item.type !== "container" || !containerIds.has(item._id)) continue;
      const currency = item.system.currency;
      if (!currency) continue;
      let hasCoins = false;
      for (const denom of Object.keys(currency)) {
        if (currency[denom] > 0) {
          collected[denom] += currency[denom];
          totalCollected += currency[denom];
          hasCoins = true;
        }
      }
      if (hasCoins) {
        containerUpdates.push({
          id: item._id,
          currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }
        });
      }
    }
    return { collected, containerUpdates, totalCollected };
  }
  function getPackablePotions(items) {
    return items.filter((i) => isPotion(i) && !i.system.equipped && !i.system.container).map((i) => ({ id: i._id, name: i.name }));
  }
  function getPotionBelts(items) {
    const potionBelts = items.filter(
      (i) => i.type === "container" && i.name === "Potion Belt"
    );
    const contentCount = /* @__PURE__ */ new Map();
    for (const item of items) {
      const cid = item.system.container;
      if (!cid) continue;
      contentCount.set(cid, (contentCount.get(cid) ?? 0) + 1);
    }
    return potionBelts.filter((b) => b.system.capacity?.count > 0).map((b) => {
      const maxCount = b.system.capacity.count;
      const currentCount = contentCount.get(b._id) ?? 0;
      return {
        id: b._id,
        name: b.name,
        maxCount,
        currentCount,
        remainingCount: maxCount - currentCount
      };
    });
  }
  function planPotionPacking(potions, potionBelts) {
    const remaining = potionBelts.map((b) => ({ ...b }));
    const assignments = [];
    const overflow = [];
    for (const potion of potions) {
      const target = remaining.find((b) => b.remainingCount > 0);
      if (target) {
        assignments.push({
          itemId: potion.id,
          itemName: potion.name,
          containerId: target.id,
          containerName: target.name
        });
        target.remainingCount--;
      } else {
        overflow.push({ id: potion.id, name: potion.name });
      }
    }
    return { assignments, overflow };
  }

  // macros/src/shared.js
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
        title: "Select Character",
        content: `<form>${radioHtml}</form>`,
        buttons: {
          confirm: {
            label: "Continue",
            callback: (html) => {
              const id = html.find("input[name='actor']:checked").val();
              resolve(id ? game.actors.get(id) : null);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "confirm"
      }).render(true);
    });
  }

  // macros/src/containers.js
  function getAllItems(actor) {
    return actor.items.map((i) => ({
      _id: i.id,
      name: i.name,
      type: i.type,
      system: i.system
    }));
  }
  async function applyAssignments(actor, assignments) {
    for (const a of assignments) {
      const item = actor.items.get(a.itemId);
      await item.update({ "system.container": a.containerId });
    }
  }
  async function doPack(actor) {
    let allItems = getAllItems(actor);
    let containers = getContainersWithCapacity(allItems);
    const messages = [];
    let hasWarning = false;
    if (containers.length) {
      const { containerUpdates, remainingCurrency, totalMoved } = planCoinPacking(actor.system.currency, allItems, containers);
      if (totalMoved > 0) {
        for (const cu of containerUpdates) {
          const container = actor.items.get(cu.id);
          await container.update({ "system.currency": cu.currency });
        }
        await actor.update({ "system.currency": remainingCurrency });
        messages.push(`${totalMoved} coin(s) \u2192 containers`);
        allItems = getAllItems(actor);
        containers = getContainersWithCapacity(allItems);
      }
    }
    const potions = getPackablePotions(allItems);
    const potionBelts = getPotionBelts(allItems);
    if (potions.length && potionBelts.length) {
      const { assignments, overflow } = planPotionPacking(potions, potionBelts);
      await applyAssignments(actor, assignments);
      if (assignments.length) {
        messages.push(`${assignments.length} potion(s) \u2192 belt`);
      }
      if (overflow.length) {
        hasWarning = true;
        messages.push(`${overflow.length} potion(s) didn't fit`);
      }
    }
    const packable = getPackableItems(allItems);
    if (packable.length) {
      if (!containers.length) {
        hasWarning = true;
        messages.push(`${packable.length} item(s) have nowhere to go (no bags)`);
      } else {
        const { assignments, overflow } = planPacking(packable, containers);
        await applyAssignments(actor, assignments);
        if (assignments.length) {
          messages.push(`${assignments.length} item(s) \u2192 bags`);
        }
        if (overflow.length) {
          hasWarning = true;
          const names = overflow.map((o) => o.name).join(", ");
          messages.push(`${overflow.length} item(s) didn't fit: ${names}`);
        }
      }
    }
    if (!messages.length) {
      ui.notifications.info("Nothing to pack.");
      return;
    }
    const summary = `Packed: ${messages.join(". ")}.`;
    if (hasWarning) {
      ui.notifications.warn(summary);
    } else {
      ui.notifications.info(summary);
    }
  }
  async function doUnpack(actor) {
    const allItems = getAllItems(actor);
    const containers = getContainersWithCapacity(allItems);
    const messages = [];
    if (containers.length) {
      const { collected, containerUpdates, totalCollected } = collectContainerCurrency(allItems, containers);
      if (totalCollected > 0) {
        const actorCurrency = actor.system.currency;
        const newCurrency = {};
        for (const denom of Object.keys(collected)) {
          newCurrency[denom] = actorCurrency[denom] + collected[denom];
        }
        await actor.update({ "system.currency": newCurrency });
        for (const cu of containerUpdates) {
          const container = actor.items.get(cu.id);
          await container.update({ "system.currency": cu.currency });
        }
        messages.push(`${totalCollected} coin(s) from containers`);
      }
    }
    const contained = getContainerItemIds(allItems);
    if (contained.length) {
      for (const c of contained) {
        const item = actor.items.get(c.id);
        await item.update({ "system.container": null });
      }
      messages.push(`${contained.length} item(s) from containers`);
    }
    if (!messages.length) {
      ui.notifications.info("Nothing to unpack.");
      return;
    }
    ui.notifications.info(`Unpacked: ${messages.join(". ")}.`);
  }
  (async () => {
    const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
    if (!actor) {
      const picked = await pickActor();
      if (!picked) return;
      return showDialog(picked);
    }
    showDialog(actor);
  })();
  function showDialog(actor) {
    new Dialog({
      title: `Containers \u2014 ${actor.name}`,
      content: "<p>Pack loose items into containers or unpack everything.</p>",
      buttons: {
        pack: {
          label: "Pack",
          callback: () => doPack(actor)
        },
        unpack: {
          label: "Unpack",
          callback: () => doUnpack(actor)
        },
        cancel: { label: "Cancel" }
      },
      default: "pack"
    }).render(true);
  }
})();
