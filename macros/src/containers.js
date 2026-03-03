import {
    getPackableItems,
    getContainersWithCapacity,
    planPacking,
    getContainerItemIds,
    planCoinPacking,
    collectContainerCurrency,
    getPackablePotions,
    getPotionBelts,
    planPotionPacking,
} from "../../lib/containers.js";
import { pickActor } from "./shared.js";

function getAllItems(actor) {
    return actor.items.map(i => ({
        _id: i.id,
        name: i.name,
        type: i.type,
        system: i.system,
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

    // 1. Coins → containers (by weight)
    if (containers.length) {
        const { containerUpdates, remainingCurrency, totalMoved } = planCoinPacking(actor.system.currency, allItems, containers);
        if (totalMoved > 0) {
            for (const cu of containerUpdates) {
                const container = actor.items.get(cu.id);
                await container.update({ "system.currency": cu.currency });
            }
            await actor.update({ "system.currency": remainingCurrency });
            messages.push(`${totalMoved} coin(s) → containers`);
            // Refresh — coin packing changed container remaining weights
            allItems = getAllItems(actor);
            containers = getContainersWithCapacity(allItems);
        }
    }

    // 2. Potions → potion belt
    const potions = getPackablePotions(allItems);
    const potionBelts = getPotionBelts(allItems);
    if (potions.length && potionBelts.length) {
        const { assignments, overflow } = planPotionPacking(potions, potionBelts);
        await applyAssignments(actor, assignments);
        if (assignments.length) {
            messages.push(`${assignments.length} potion(s) → belt`);
        }
        if (overflow.length) {
            hasWarning = true;
            messages.push(`${overflow.length} potion(s) didn't fit`);
        }
    }

    // 3. Remaining items → weight-based containers
    const packable = getPackableItems(allItems);
    if (packable.length) {
        if (!containers.length) {
            hasWarning = true;
            messages.push(`${packable.length} item(s) have nowhere to go (no bags)`);
        } else {
            const { assignments, overflow } = planPacking(packable, containers);
            await applyAssignments(actor, assignments);
            if (assignments.length) {
                messages.push(`${assignments.length} item(s) → bags`);
            }
            if (overflow.length) {
                hasWarning = true;
                const names = overflow.map(o => o.name).join(", ");
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

    // 1. Coins from containers → actor
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

    // 2. All items from containers
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
        title: `Containers — ${actor.name}`,
        content: "<p>Pack loose items into containers or unpack everything.</p>",
        buttons: {
            pack: {
                label: "Pack",
                callback: () => doPack(actor),
            },
            unpack: {
                label: "Unpack",
                callback: () => doUnpack(actor),
            },
            cancel: { label: "Cancel" },
        },
        default: "pack",
    }).render(true);
}
