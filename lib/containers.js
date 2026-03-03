/**
 * Get items eligible for weight-based packing: has weight, not equipped,
 * not already in a container, not a container itself, and not a potion
 * (potions are routed to potion belts separately).
 *
 * @param {object[]} items - Actor items (each must have _id, name, type, system)
 * @returns {{id: string, name: string, totalWeight: number}[]}
 */
export function getPackableItems(items) {
    return items
        .filter(i => {
            if (!i.system.weight?.value) return false;
            if (i.type === "container") return false;
            if (i.system.equipped) return false;
            if (i.system.container) return false;
            if (isPotion(i)) return false;
            return true;
        })
        .map(i => ({
            id: i._id,
            name: i.name,
            totalWeight: i.system.weight.value * (i.system.quantity ?? 1),
        }));
}

/**
 * @param {object} item
 * @returns {boolean}
 */
function isPotion(item) {
    return item.system.type?.value === "potion";
}

/** Coins per pound (PHB: 50 coins = 1 lb). */
export const COINS_PER_POUND = 50;

/**
 * Compute the weight of currency in pounds.
 * @param {{pp: number, gp: number, ep: number, sp: number, cp: number}} currency
 * @returns {number}
 */
export function coinWeight(currency) {
    let total = 0;
    for (const denom of Object.keys(currency)) total += currency[denom] ?? 0;
    return total / COINS_PER_POUND;
}

/**
 * Find containers that have a weight-based capacity and compute their
 * remaining capacity by subtracting the total weight of items and coins
 * already inside.
 *
 * @param {object[]} items - All actor items
 * @returns {{id: string, name: string, maxWeight: number, currentWeight: number, remainingWeight: number}[]}
 */
export function getContainersWithCapacity(items) {
    const containers = items.filter(
        i => i.type === "container" && i.system.capacity?.weight?.value > 0
    );

    // Build a map of containerId → total weight of contents
    const contentWeight = new Map();
    for (const item of items) {
        const cid = item.system.container;
        if (!cid) continue;
        const w = (item.system.weight?.value ?? 0) * (item.system.quantity ?? 1);
        contentWeight.set(cid, (contentWeight.get(cid) ?? 0) + w);
    }

    return containers.map(c => {
        const maxWeight = c.system.capacity.weight.value;
        const itemWeight = contentWeight.get(c._id) ?? 0;
        const cWeight = c.system.currency ? coinWeight(c.system.currency) : 0;
        const currentWeight = itemWeight + cWeight;
        return {
            id: c._id,
            name: c.name,
            maxWeight,
            currentWeight,
            remainingWeight: maxWeight - currentWeight,
        };
    });
}

/**
 * First-fit decreasing bin packing: sort items heaviest-first and place each
 * into the first container with enough remaining capacity.
 *
 * @param {{id: string, name: string, totalWeight: number}[]} packableItems
 * @param {{id: string, name: string, maxWeight: number, currentWeight: number, remainingWeight: number}[]} containers
 * @returns {{assignments: {itemId: string, itemName: string, containerId: string, containerName: string}[], overflow: {id: string, name: string, totalWeight: number}[]}}
 */
export function planPacking(packableItems, containers) {
    const sorted = [...packableItems].sort((a, b) => b.totalWeight - a.totalWeight);
    const remaining = containers.map(c => ({ ...c }));

    const assignments = [];
    const overflow = [];

    for (const item of sorted) {
        const target = remaining.find(c => c.remainingWeight >= item.totalWeight);
        if (target) {
            assignments.push({
                itemId: item.id,
                itemName: item.name,
                containerId: target.id,
                containerName: target.name,
            });
            target.remainingWeight -= item.totalWeight;
        } else {
            overflow.push({ id: item.id, name: item.name, totalWeight: item.totalWeight });
        }
    }

    return { assignments, overflow };
}

/**
 * Find all items that are currently inside a container.
 *
 * @param {object[]} items - All actor items
 * @returns {{id: string, name: string}[]}
 */
export function getContainerItemIds(items) {
    return items
        .filter(i => i.system.container)
        .map(i => ({ id: i._id, name: i.name }));
}

// ── Coin packing ──

/**
 * Plan how to distribute actor currency into containers by weight.
 * Each coin weighs 1/50 lb. Fills containers in order using their remaining
 * weight capacity. Only returns updates for containers that actually change.
 *
 * @param {{pp: number, gp: number, ep: number, sp: number, cp: number}} actorCurrency
 * @param {object[]} items - All actor items (to read container currency)
 * @param {{id: string, name: string, remainingWeight: number}[]} containers - From getContainersWithCapacity
 * @returns {{containerUpdates: {id: string, currency: {pp: number, gp: number, ep: number, sp: number, cp: number}}[], remainingCurrency: {pp: number, gp: number, ep: number, sp: number, cp: number}, totalMoved: number}}
 */
export function planCoinPacking(actorCurrency, items, containers) {
    const pool = { ...actorCurrency };
    const containerUpdates = [];
    let totalMoved = 0;

    const currencyById = new Map(
        items
            .filter(i => i.type === "container" && i.system.currency)
            .map(i => [i._id, i.system.currency])
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

/**
 * Collect all currency from containers for unpacking back to the actor.
 *
 * @param {object[]} items - All actor items
 * @param {{id: string}[]} containers - From getContainersWithCapacity
 * @returns {{collected: {pp: number, gp: number, ep: number, sp: number, cp: number}, containerUpdates: {id: string, currency: {pp: number, gp: number, ep: number, sp: number, cp: number}}[], totalCollected: number}}
 */
export function collectContainerCurrency(items, containers) {
    const containerIds = new Set(containers.map(c => c.id));
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
                currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
            });
        }
    }

    return { collected, containerUpdates, totalCollected };
}

// ── Potion belt packing ──

/**
 * Find loose potions eligible for packing into a potion belt.
 *
 * @param {object[]} items - All actor items
 * @returns {{id: string, name: string}[]}
 */
export function getPackablePotions(items) {
    return items
        .filter(i => isPotion(i) && !i.system.equipped && !i.system.container)
        .map(i => ({ id: i._id, name: i.name }));
}

/**
 * Find potion belt containers.
 *
 * @param {object[]} items - All actor items
 * @returns {{id: string, name: string, maxCount: number, currentCount: number, remainingCount: number}[]}
 */
export function getPotionBelts(items) {
    const potionBelts = items.filter(
        i => i.type === "container" && i.name === "Potion Belt"
    );

    // Count items currently in each potion belt
    const contentCount = new Map();
    for (const item of items) {
        const cid = item.system.container;
        if (!cid) continue;
        contentCount.set(cid, (contentCount.get(cid) ?? 0) + 1);
    }

    return potionBelts
        .filter(b => b.system.capacity?.count > 0)
        .map(b => {
            const maxCount = b.system.capacity.count;
            const currentCount = contentCount.get(b._id) ?? 0;
            return {
                id: b._id,
                name: b.name,
                maxCount,
                currentCount,
                remainingCount: maxCount - currentCount,
            };
        });
}

/**
 * Plan packing of potions into potion belts by count (first-fit).
 *
 * @param {{id: string, name: string}[]} potions
 * @param {{id: string, name: string, maxCount: number, currentCount: number, remainingCount: number}[]} potionBelts
 * @returns {{assignments: {itemId: string, itemName: string, containerId: string, containerName: string}[], overflow: {id: string, name: string}[]}}
 */
export function planPotionPacking(potions, potionBelts) {
    const remaining = potionBelts.map(b => ({ ...b }));
    const assignments = [];
    const overflow = [];

    for (const potion of potions) {
        const target = remaining.find(b => b.remainingCount > 0);
        if (target) {
            assignments.push({
                itemId: potion.id,
                itemName: potion.name,
                containerId: target.id,
                containerName: target.name,
            });
            target.remainingCount--;
        } else {
            overflow.push({ id: potion.id, name: potion.name });
        }
    }

    return { assignments, overflow };
}
