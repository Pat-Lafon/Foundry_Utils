import { describe, it, expect } from "vitest";
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
} from "../lib/containers.js";

// ── helpers ──

function makeItem(overrides = {}) {
    return {
        _id: overrides._id ?? "item1",
        name: overrides.name ?? "Test Item",
        type: overrides.type ?? "loot",
        system: {
            weight: { value: overrides.weight ?? 1, units: "lb" },
            quantity: overrides.quantity ?? 1,
            equipped: overrides.equipped ?? false,
            container: overrides.container ?? null,
            ...overrides.system,
        },
    };
}

function makePotion(overrides = {}) {
    return {
        _id: overrides._id ?? "pot1",
        name: overrides.name ?? "Healing Potion",
        type: "consumable",
        system: {
            weight: { value: overrides.weight ?? 0, units: "lb" },
            quantity: overrides.quantity ?? 1,
            equipped: overrides.equipped ?? false,
            container: overrides.container ?? null,
            type: { value: "potion", subtype: "" },
            ...overrides.system,
        },
    };
}

function makePotionBelt(overrides = {}) {
    return {
        _id: overrides._id ?? "ptb1",
        name: "Potion Belt",
        type: "container",
        system: {
            weight: { value: 0, units: "lb" },
            quantity: 1,
            equipped: false,
            container: overrides.container ?? null,
            capacity: {
                weight: { value: null, units: "lb" },
                volume: { units: "cubicFoot", value: null },
                count: overrides.maxCount ?? 5,
            },
            currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
        },
    };
}

function makeContainer(overrides = {}) {
    return {
        _id: overrides._id ?? "cont1",
        name: overrides.name ?? "Backpack",
        type: "container",
        system: {
            weight: { value: overrides.ownWeight ?? 0, units: "lb" },
            quantity: 1,
            equipped: false,
            container: overrides.container ?? null,
            capacity: {
                weight: { value: overrides.maxWeight ?? 30, units: "lb" },
                volume: { units: "cubicFoot", value: null },
                count: null,
            },
            currency: overrides.currency ?? { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
            ...overrides.system,
        },
    };
}

// ── getPackableItems ──

describe("getPackableItems", () => {
    it("returns loose physical items", () => {
        const items = [makeItem({ _id: "a", name: "Torch", type: "loot" })];
        const result = getPackableItems(items);
        expect(result).toEqual([{ id: "a", name: "Torch", totalWeight: 1 }]);
    });

    it("filters out equipped items", () => {
        const items = [makeItem({ equipped: true })];
        expect(getPackableItems(items)).toEqual([]);
    });

    it("filters out items already in a container", () => {
        const items = [makeItem({ container: "cont1" })];
        expect(getPackableItems(items)).toEqual([]);
    });

    it("filters out containers themselves", () => {
        const items = [makeContainer()];
        expect(getPackableItems(items)).toEqual([]);
    });

    it("computes totalWeight as weight * quantity", () => {
        const items = [makeItem({ _id: "r", name: "Ration", weight: 2, quantity: 10 })];
        const result = getPackableItems(items);
        expect(result).toEqual([{ id: "r", name: "Ration", totalWeight: 20 }]);
    });

    it("filters out items without weight", () => {
        const items = [
            makeItem({ _id: "a", weight: 0 }),
            { _id: "b", name: "Trinket", type: "loot", system: { quantity: 1, equipped: false, container: null } },
        ];
        expect(getPackableItems(items)).toEqual([]);
    });

    it("excludes potions (consumable with type.value potion)", () => {
        const items = [makePotion({ _id: "p1", name: "Healing Potion" })];
        expect(getPackableItems(items)).toEqual([]);
    });

    it("returns empty array when no items qualify", () => {
        expect(getPackableItems([])).toEqual([]);
    });
});

// ── getContainersWithCapacity ──

describe("getContainersWithCapacity", () => {
    it("finds containers with weight capacity", () => {
        const items = [makeContainer({ _id: "c1", name: "Bag", maxWeight: 30 })];
        const result = getContainersWithCapacity(items);
        expect(result).toEqual([{
            id: "c1", name: "Bag", maxWeight: 30, currentWeight: 0, remainingWeight: 30,
        }]);
    });

    it("computes remaining capacity from contents", () => {
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30 }),
            makeItem({ _id: "i1", container: "c1", weight: 5, quantity: 2 }),
            makeItem({ _id: "i2", container: "c1", weight: 3, quantity: 1 }),
        ];
        const result = getContainersWithCapacity(items);
        expect(result[0].currentWeight).toBe(13);
        expect(result[0].remainingWeight).toBe(17);
    });

    it("skips containers with null weight capacity", () => {
        const items = [{
            _id: "c1", name: "Pouch", type: "container",
            system: {
                weight: { value: 0, units: "lb" }, quantity: 1, equipped: false, container: null,
                capacity: { weight: { value: null, units: "lb" }, volume: { units: "cubicFoot", value: null }, count: 2 },
            },
        }];
        expect(getContainersWithCapacity(items)).toEqual([]);
    });

    it("skips containers with zero weight capacity", () => {
        const items = [makeContainer({ maxWeight: 0 })];
        expect(getContainersWithCapacity(items)).toEqual([]);
    });

    it("handles multiple containers", () => {
        const items = [
            makeContainer({ _id: "c1", name: "Bag A", maxWeight: 10 }),
            makeContainer({ _id: "c2", name: "Bag B", maxWeight: 20 }),
        ];
        const result = getContainersWithCapacity(items);
        expect(result).toHaveLength(2);
    });

    it("returns empty when no containers exist", () => {
        const items = [makeItem()];
        expect(getContainersWithCapacity(items)).toEqual([]);
    });

    it("ignores non-container items when computing capacity", () => {
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30 }),
            makeItem({ container: null, weight: 99 }),
        ];
        const result = getContainersWithCapacity(items);
        expect(result[0].currentWeight).toBe(0);
    });
});

// ── planPacking ──

describe("planPacking", () => {
    it("packs a single item into a single container", () => {
        const items = [{ id: "i1", name: "Torch", totalWeight: 1 }];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 30, currentWeight: 0, remainingWeight: 30 }];
        const result = planPacking(items, containers);
        expect(result.assignments).toEqual([
            { itemId: "i1", itemName: "Torch", containerId: "c1", containerName: "Bag" },
        ]);
        expect(result.overflow).toEqual([]);
    });

    it("packs multiple items into one container", () => {
        const items = [
            { id: "i1", name: "A", totalWeight: 5 },
            { id: "i2", name: "B", totalWeight: 3 },
        ];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 30, currentWeight: 0, remainingWeight: 30 }];
        const result = planPacking(items, containers);
        expect(result.assignments).toHaveLength(2);
        expect(result.overflow).toEqual([]);
    });

    it("distributes items across multiple containers", () => {
        const items = [
            { id: "i1", name: "Heavy", totalWeight: 8 },
            { id: "i2", name: "Light", totalWeight: 5 },
        ];
        const containers = [
            { id: "c1", name: "Small", maxWeight: 10, currentWeight: 0, remainingWeight: 10 },
            { id: "c2", name: "Medium", maxWeight: 10, currentWeight: 0, remainingWeight: 10 },
        ];
        const result = planPacking(items, containers);
        expect(result.assignments).toHaveLength(2);
        expect(result.assignments[0].containerId).toBe("c1"); // heavy (8) into first
        expect(result.assignments[1].containerId).toBe("c2"); // light (5) won't fit in remaining 2, goes to second
    });

    it("reports overflow when items don't fit", () => {
        const items = [{ id: "i1", name: "Boulder", totalWeight: 100 }];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 10, currentWeight: 0, remainingWeight: 10 }];
        const result = planPacking(items, containers);
        expect(result.assignments).toEqual([]);
        expect(result.overflow).toEqual([{ id: "i1", name: "Boulder", totalWeight: 100 }]);
    });

    it("sorts items heaviest-first (first-fit decreasing)", () => {
        const items = [
            { id: "light", name: "Light", totalWeight: 1 },
            { id: "heavy", name: "Heavy", totalWeight: 10 },
            { id: "mid", name: "Mid", totalWeight: 5 },
        ];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 100, currentWeight: 0, remainingWeight: 100 }];
        const result = planPacking(items, containers);
        // heavy should be assigned first
        expect(result.assignments[0].itemId).toBe("heavy");
        expect(result.assignments[1].itemId).toBe("mid");
        expect(result.assignments[2].itemId).toBe("light");
    });

    it("handles zero-weight items", () => {
        const items = [{ id: "i1", name: "Feather", totalWeight: 0 }];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 10, currentWeight: 0, remainingWeight: 10 }];
        const result = planPacking(items, containers);
        expect(result.assignments).toHaveLength(1);
        expect(result.overflow).toEqual([]);
    });

    it("handles exact fit", () => {
        const items = [{ id: "i1", name: "Exact", totalWeight: 10 }];
        const containers = [{ id: "c1", name: "Bag", maxWeight: 10, currentWeight: 0, remainingWeight: 10 }];
        const result = planPacking(items, containers);
        expect(result.assignments).toHaveLength(1);
        expect(result.overflow).toEqual([]);
    });

    it("fills first container before moving to second", () => {
        const items = [
            { id: "i1", name: "A", totalWeight: 8 },
            { id: "i2", name: "B", totalWeight: 8 },
        ];
        const containers = [
            { id: "c1", name: "Bag1", maxWeight: 10, currentWeight: 0, remainingWeight: 10 },
            { id: "c2", name: "Bag2", maxWeight: 10, currentWeight: 0, remainingWeight: 10 },
        ];
        const result = planPacking(items, containers);
        expect(result.assignments[0].containerId).toBe("c1");
        expect(result.assignments[1].containerId).toBe("c2");
    });

    it("returns empty assignments and overflow for empty inputs", () => {
        expect(planPacking([], [])).toEqual({ assignments: [], overflow: [] });
    });

    it("returns all items as overflow when no containers", () => {
        const items = [{ id: "i1", name: "A", totalWeight: 1 }];
        const result = planPacking(items, []);
        expect(result.assignments).toEqual([]);
        expect(result.overflow).toHaveLength(1);
    });

    it("does not mutate the input containers", () => {
        const containers = [{ id: "c1", name: "Bag", maxWeight: 10, currentWeight: 0, remainingWeight: 10 }];
        const items = [{ id: "i1", name: "A", totalWeight: 5 }];
        planPacking(items, containers);
        expect(containers[0].remainingWeight).toBe(10);
    });
});

// ── getContainerItemIds ──

describe("getContainerItemIds", () => {
    it("finds items inside containers", () => {
        const items = [
            makeItem({ _id: "i1", name: "Torch", container: "c1" }),
            makeItem({ _id: "i2", name: "Rope", container: "c2" }),
        ];
        const result = getContainerItemIds(items);
        expect(result).toEqual([
            { id: "i1", name: "Torch" },
            { id: "i2", name: "Rope" },
        ]);
    });

    it("excludes items not in containers", () => {
        const items = [
            makeItem({ _id: "i1", name: "Loose", container: null }),
            makeItem({ _id: "i2", name: "Packed", container: "c1" }),
        ];
        const result = getContainerItemIds(items);
        expect(result).toEqual([{ id: "i2", name: "Packed" }]);
    });

    it("returns empty array when no items are in containers", () => {
        const items = [makeItem({ container: null })];
        expect(getContainerItemIds(items)).toEqual([]);
    });

    it("returns empty array for empty input", () => {
        expect(getContainerItemIds([])).toEqual([]);
    });

    it("includes containers nested inside other containers", () => {
        const items = [makeContainer({ _id: "nested", container: "parent" })];
        const result = getContainerItemIds(items);
        expect(result).toEqual([{ id: "nested", name: "Backpack" }]);
    });
});

// ── planCoinPacking ──
// 50 coins/lb; a 5 lb container fits 250 coins

describe("planCoinPacking", () => {
    it("moves currency into a container", () => {
        const currency = { pp: 1, gp: 10, ep: 0, sp: 5, cp: 20 };
        const items = [makeContainer({ _id: "c1", maxWeight: 30 })];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates[0].currency).toEqual({ pp: 1, gp: 10, ep: 0, sp: 5, cp: 20 });
        expect(result.remainingCurrency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
        expect(result.totalMoved).toBe(36);
    });

    it("adds to existing container currency", () => {
        const currency = { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 };
        const items = [makeContainer({ _id: "c1", maxWeight: 30, currency: { pp: 0, gp: 3, ep: 0, sp: 0, cp: 0 } })];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates[0].currency.gp).toBe(8);
    });

    it("enforces weight-based coin limit (1 lb remaining = 50 coins)", () => {
        const currency = { pp: 0, gp: 100, ep: 0, sp: 0, cp: 0 };
        // Container has 200 coins (4 lb) inside, 5 lb max → 1 lb remaining = 50 coins
        const items = [makeContainer({ _id: "c1", maxWeight: 5, currency: { pp: 0, gp: 200, ep: 0, sp: 0, cp: 0 } })];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates[0].currency.gp).toBe(250);
        expect(result.remainingCurrency.gp).toBe(50);
        expect(result.totalMoved).toBe(50);
    });

    it("skips full containers and fills the next", () => {
        const currency = { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 };
        const items = [
            makeContainer({ _id: "c1", maxWeight: 0 }),
            makeContainer({ _id: "c2", maxWeight: 30 }),
        ];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates).toHaveLength(1);
        expect(result.containerUpdates[0].id).toBe("c2");
        expect(result.containerUpdates[0].currency.gp).toBe(10);
    });

    it("distributes coins across containers when first fills up", () => {
        const currency = { pp: 0, gp: 400, ep: 0, sp: 0, cp: 0 };
        const items = [
            makeContainer({ _id: "c1", maxWeight: 5 }),
            makeContainer({ _id: "c2", maxWeight: 5 }),
        ];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates).toHaveLength(2);
        expect(result.containerUpdates[0].currency.gp).toBe(250);
        expect(result.containerUpdates[1].currency.gp).toBe(150);
        expect(result.remainingCurrency.gp).toBe(0);
        expect(result.totalMoved).toBe(400);
    });

    it("leaves overflow when all containers are full", () => {
        const currency = { pp: 0, gp: 600, ep: 0, sp: 0, cp: 0 };
        const items = [
            makeContainer({ _id: "c1", maxWeight: 5 }),
            makeContainer({ _id: "c2", maxWeight: 5 }),
        ];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.totalMoved).toBe(500);
        expect(result.remainingCurrency.gp).toBe(100);
    });

    it("only returns updates for changed containers", () => {
        const currency = { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 };
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30 }),
            makeContainer({ _id: "c2", maxWeight: 30 }),
        ];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.containerUpdates).toHaveLength(1);
        expect(result.containerUpdates[0].id).toBe("c1");
    });

    it("returns zero totalMoved when no currency to move", () => {
        const currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
        const items = [makeContainer({ _id: "c1", maxWeight: 30 })];
        const containers = getContainersWithCapacity(items);
        const result = planCoinPacking(currency, items, containers);
        expect(result.totalMoved).toBe(0);
        expect(result.containerUpdates).toEqual([]);
    });

    it("handles empty containers list (all coins remain)", () => {
        const currency = { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 };
        const result = planCoinPacking(currency, [], []);
        expect(result.remainingCurrency.gp).toBe(10);
        expect(result.totalMoved).toBe(0);
    });
});

// ── collectContainerCurrency ──

describe("collectContainerCurrency", () => {
    it("collects currency from all containers", () => {
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30, currency: { pp: 0, gp: 10, ep: 0, sp: 5, cp: 0 } }),
            makeContainer({ _id: "c2", maxWeight: 30, currency: { pp: 1, gp: 0, ep: 0, sp: 0, cp: 20 } }),
        ];
        const containers = [{ id: "c1" }, { id: "c2" }];
        const result = collectContainerCurrency(items, containers);
        expect(result.collected).toEqual({ pp: 1, gp: 10, ep: 0, sp: 5, cp: 20 });
        expect(result.totalCollected).toBe(36);
    });

    it("zeroes out containers that had currency", () => {
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30, currency: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 } }),
        ];
        const containers = [{ id: "c1" }];
        const result = collectContainerCurrency(items, containers);
        expect(result.containerUpdates).toEqual([
            { id: "c1", currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
        ]);
    });

    it("skips containers with no currency", () => {
        const items = [makeContainer({ _id: "c1", maxWeight: 30 })];
        const containers = [{ id: "c1" }];
        const result = collectContainerCurrency(items, containers);
        expect(result.containerUpdates).toEqual([]);
        expect(result.totalCollected).toBe(0);
    });

    it("handles empty input", () => {
        const result = collectContainerCurrency([], []);
        expect(result.collected).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 });
        expect(result.totalCollected).toBe(0);
    });

    it("only collects from containers in the provided list", () => {
        const items = [
            makeContainer({ _id: "c1", maxWeight: 30, currency: { pp: 0, gp: 10, ep: 0, sp: 0, cp: 0 } }),
            makeContainer({ _id: "c2", maxWeight: 30, currency: { pp: 0, gp: 5, ep: 0, sp: 0, cp: 0 } }),
        ];
        const containers = [{ id: "c1" }]; // only c1
        const result = collectContainerCurrency(items, containers);
        expect(result.totalCollected).toBe(10);
        expect(result.containerUpdates).toHaveLength(1);
    });
});

// ── getPackablePotions ──

describe("getPackablePotions", () => {
    it("finds loose potions", () => {
        const items = [makePotion({ _id: "p1", name: "Healing" })];
        const result = getPackablePotions(items);
        expect(result).toEqual([{ id: "p1", name: "Healing" }]);
    });

    it("excludes equipped potions", () => {
        const items = [makePotion({ equipped: true })];
        expect(getPackablePotions(items)).toEqual([]);
    });

    it("excludes potions already in a container", () => {
        const items = [makePotion({ container: "ptb1" })];
        expect(getPackablePotions(items)).toEqual([]);
    });

    it("excludes non-potion consumables", () => {
        const items = [makeItem({ type: "consumable" })];
        expect(getPackablePotions(items)).toEqual([]);
    });

    it("returns empty for no items", () => {
        expect(getPackablePotions([])).toEqual([]);
    });
});

// ── getPotionBelts ──

describe("getPotionBelts", () => {
    it("finds Potion Belt containers with count capacity", () => {
        const items = [makePotionBelt({ _id: "ptb1", maxCount: 5 })];
        const result = getPotionBelts(items);
        expect(result).toEqual([{
            id: "ptb1", name: "Potion Belt", maxCount: 5, currentCount: 0, remainingCount: 5,
        }]);
    });

    it("computes remaining count from contents", () => {
        const items = [
            makePotionBelt({ _id: "ptb1", maxCount: 5 }),
            makePotion({ _id: "p1", container: "ptb1" }),
            makePotion({ _id: "p2", container: "ptb1" }),
        ];
        const result = getPotionBelts(items);
        expect(result[0].currentCount).toBe(2);
        expect(result[0].remainingCount).toBe(3);
    });

    it("ignores non-Potion-Belt containers", () => {
        const items = [makeContainer({ _id: "c1", name: "Backpack" })];
        expect(getPotionBelts(items)).toEqual([]);
    });

    it("returns empty when none exist", () => {
        expect(getPotionBelts([])).toEqual([]);
    });
});

// ── planPotionPacking ──

describe("planPotionPacking", () => {
    it("assigns potions to a potion belt", () => {
        const potions = [{ id: "p1", name: "Healing" }];
        const belts = [{ id: "ptb1", name: "Potion Belt", maxCount: 5, currentCount: 0, remainingCount: 5 }];
        const result = planPotionPacking(potions, belts);
        expect(result.assignments).toEqual([
            { itemId: "p1", itemName: "Healing", containerId: "ptb1", containerName: "Potion Belt" },
        ]);
        expect(result.overflow).toEqual([]);
    });

    it("reports overflow when belt is full", () => {
        const potions = [
            { id: "p1", name: "A" },
            { id: "p2", name: "B" },
        ];
        const belts = [{ id: "ptb1", name: "Potion Belt", maxCount: 1, currentCount: 0, remainingCount: 1 }];
        const result = planPotionPacking(potions, belts);
        expect(result.assignments).toHaveLength(1);
        expect(result.overflow).toEqual([{ id: "p2", name: "B" }]);
    });

    it("returns all as overflow when no belts", () => {
        const potions = [{ id: "p1", name: "A" }];
        const result = planPotionPacking(potions, []);
        expect(result.overflow).toHaveLength(1);
    });

    it("handles empty inputs", () => {
        const result = planPotionPacking([], []);
        expect(result.assignments).toEqual([]);
        expect(result.overflow).toEqual([]);
    });

    it("does not mutate input belts", () => {
        const belts = [{ id: "ptb1", name: "Potion Belt", maxCount: 5, currentCount: 0, remainingCount: 5 }];
        planPotionPacking([{ id: "p1", name: "A" }], belts);
        expect(belts[0].remainingCount).toBe(5);
    });
});
