import { describe, it, expect } from "vitest";
import {
    getChoicesAllowed,
    getCasterLevel,
    getRecoveryBudget,
    MAX_RECOVERY_SLOT_LEVEL,
    calcHitDiceRecovery,
    getMissingSpellSlots,
    validateSlotRecovery,
    filterLongRestFeatures,
} from "../lib/medium-rest.js";

// ---------------------
// Helper: build a mock class item
// ---------------------
function makeClass(levels, progression) {
    return {
        system: {
            levels,
            spellcasting: progression ? { progression } : undefined,
        },
    };
}

// ============================
// getChoicesAllowed
// ============================
describe("getChoicesAllowed", () => {
    it("returns 0 for 0 rations", () => {
        expect(getChoicesAllowed(0)).toBe(0);
    });

    it("returns 0 for 1 ration", () => {
        expect(getChoicesAllowed(1)).toBe(0);
    });

    it("returns 1 for 2 rations", () => {
        expect(getChoicesAllowed(2)).toBe(1);
    });

    it("returns 2 for 3 rations", () => {
        expect(getChoicesAllowed(3)).toBe(2);
    });
});

// ============================
// getCasterLevel
// ============================
describe("getCasterLevel", () => {
    it("returns 0 for no classes", () => {
        expect(getCasterLevel([])).toBe(0);
    });

    it("returns full levels for a full caster (e.g. wizard 5)", () => {
        expect(getCasterLevel([makeClass(5, "full")])).toBe(5);
    });

    it("returns half levels floored for a half caster (e.g. paladin 5)", () => {
        expect(getCasterLevel([makeClass(5, "half")])).toBe(2);
    });

    it("returns third levels floored for a third caster (e.g. eldritch knight 9)", () => {
        expect(getCasterLevel([makeClass(9, "third")])).toBe(3);
    });

    it("ignores pact casters (warlock)", () => {
        expect(getCasterLevel([makeClass(5, "pact")])).toBe(0);
    });

    it("ignores classes with no spellcasting", () => {
        expect(getCasterLevel([makeClass(10, null)])).toBe(0);
    });

    it("ignores 'none' progression", () => {
        expect(getCasterLevel([makeClass(10, "none")])).toBe(0);
    });

    it("sums multiclass caster levels correctly (wizard 5 / paladin 4)", () => {
        const classes = [makeClass(5, "full"), makeClass(4, "half")];
        // 5 + floor(4/2) = 5 + 2 = 7
        expect(getCasterLevel(classes)).toBe(7);
    });

    it("handles multiclass with warlock (wizard 5 / warlock 3)", () => {
        const classes = [makeClass(5, "full"), makeClass(3, "pact")];
        // warlock ignored, just wizard 5
        expect(getCasterLevel(classes)).toBe(5);
    });
});

// ============================
// getRecoveryBudget
// ============================
describe("getRecoveryBudget", () => {
    it("returns half caster level rounded up (odd level)", () => {
        // Wizard 5 -> ceil(5/2) = 3
        expect(getRecoveryBudget(5)).toBe(3);
    });

    it("returns half caster level (even level)", () => {
        // Wizard 4 -> ceil(4/2) = 2
        expect(getRecoveryBudget(4)).toBe(2);
    });

    it("returns 1 for caster level 1", () => {
        expect(getRecoveryBudget(1)).toBe(1);
    });

    it("returns 0 for caster level 0", () => {
        expect(getRecoveryBudget(0)).toBe(0);
    });

    it("works for high-level casters (level 20)", () => {
        expect(getRecoveryBudget(20)).toBe(10);
    });

    it("works end-to-end with getCasterLevel (wizard 7 / paladin 6)", () => {
        const classes = [makeClass(7, "full"), makeClass(6, "half")];
        const casterLevel = getCasterLevel(classes); // 7 + 3 = 10
        expect(getRecoveryBudget(casterLevel)).toBe(5); // ceil(10/2) = 5
    });
});

// ============================
// MAX_RECOVERY_SLOT_LEVEL
// ============================
describe("MAX_RECOVERY_SLOT_LEVEL", () => {
    it("is 5 (no 6th level or higher per PHB 2014)", () => {
        expect(MAX_RECOVERY_SLOT_LEVEL).toBe(5);
    });
});

// ============================
// calcHitDiceRecovery
// ============================
describe("calcHitDiceRecovery", () => {
    it("recovers half of max rounded up (all spent)", () => {
        // 5 HD max, all 5 spent -> recover ceil(5/2) = 3, newSpent = 2
        const result = calcHitDiceRecovery(5, 5);
        expect(result.recover).toBe(3);
        expect(result.newSpent).toBe(2);
    });

    it("caps recovery at number of spent dice", () => {
        // 5 HD max, only 1 spent -> recover min(3, 1) = 1, newSpent = 0
        const result = calcHitDiceRecovery(1, 5);
        expect(result.recover).toBe(1);
        expect(result.newSpent).toBe(0);
    });

    it("handles even max (recover exactly half)", () => {
        // 6 HD max, all 6 spent -> recover ceil(6/2) = 3, newSpent = 3
        const result = calcHitDiceRecovery(6, 6);
        expect(result.recover).toBe(3);
        expect(result.newSpent).toBe(3);
    });

    it("handles no spent dice", () => {
        // 10 HD max, 0 spent -> recover min(5, 0) = 0, newSpent = 0
        const result = calcHitDiceRecovery(0, 10);
        expect(result.recover).toBe(0);
        expect(result.newSpent).toBe(0);
    });

    it("handles partial spend", () => {
        // 8 HD max, 3 spent -> recover min(4, 3) = 3, newSpent = 0
        const result = calcHitDiceRecovery(3, 8);
        expect(result.recover).toBe(3);
        expect(result.newSpent).toBe(0);
    });
});

// ============================
// getMissingSpellSlots
// ============================
describe("getMissingSpellSlots", () => {
    it("returns empty array when all slots are full", () => {
        const spells = {
            spell1: { value: 4, max: 4 },
            spell2: { value: 3, max: 3 },
        };
        expect(getMissingSpellSlots(spells)).toEqual([]);
    });

    it("finds missing slots at specific levels", () => {
        const spells = {
            spell1: { value: 2, max: 4 },
            spell2: { value: 3, max: 3 },
            spell3: { value: 0, max: 2 },
        };
        const result = getMissingSpellSlots(spells);
        expect(result).toEqual([
            { lvl: 1, current: 2, max: 4, missing: 2 },
            { lvl: 3, current: 0, max: 2, missing: 2 },
        ]);
    });

    it("skips levels with no max (no slots at that level)", () => {
        const spells = {
            spell1: { value: 2, max: 4 },
            spell4: { value: 0, max: 0 },
        };
        const result = getMissingSpellSlots(spells);
        expect(result).toEqual([
            { lvl: 1, current: 2, max: 4, missing: 2 },
        ]);
    });

    it("handles empty spells object", () => {
        expect(getMissingSpellSlots({})).toEqual([]);
    });

    it("respects maxLevel parameter (cap at level 5 for arcane recovery)", () => {
        const spells = {
            spell1: { value: 2, max: 4 },
            spell5: { value: 0, max: 1 },
            spell6: { value: 0, max: 2 },
            spell7: { value: 0, max: 1 },
        };
        const result = getMissingSpellSlots(spells, MAX_RECOVERY_SLOT_LEVEL);
        expect(result).toEqual([
            { lvl: 1, current: 2, max: 4, missing: 2 },
            { lvl: 5, current: 0, max: 1, missing: 1 },
        ]);
    });

    it("defaults to MAX_RECOVERY_SLOT_LEVEL (5) when maxLevel is omitted", () => {
        const spells = {
            spell5: { value: 0, max: 1 },
            spell6: { value: 0, max: 2 },
        };
        const result = getMissingSpellSlots(spells);
        expect(result).toEqual([
            { lvl: 5, current: 0, max: 1, missing: 1 },
        ]);
    });
});

// ============================
// validateSlotRecovery
// ============================
describe("validateSlotRecovery", () => {
    const spellLevels = [
        { lvl: 1, current: 2, max: 4, missing: 2 },
        { lvl: 2, current: 1, max: 3, missing: 2 },
        { lvl: 3, current: 0, max: 2, missing: 2 },
    ];

    it("validates a selection within budget", () => {
        // Restore 1x level-1 + 1x level-2 = 3 budget used
        const result = validateSlotRecovery(spellLevels, { 1: 1, 2: 1 }, 5);
        expect(result.valid).toBe(true);
        expect(result.totalUsed).toBe(3);
        expect(result.updates).toEqual({
            "system.spells.spell1.value": 3,
            "system.spells.spell2.value": 2,
        });
    });

    it("rejects selection over budget", () => {
        // 2x level-3 = 6, budget is 5
        const result = validateSlotRecovery(spellLevels, { 3: 2 }, 5);
        expect(result.valid).toBe(false);
        expect(result.totalUsed).toBe(6);
    });

    it("allows exactly matching budget", () => {
        // 1x level-2 + 1x level-3 = 5, budget is 5
        const result = validateSlotRecovery(spellLevels, { 2: 1, 3: 1 }, 5);
        expect(result.valid).toBe(true);
        expect(result.totalUsed).toBe(5);
    });

    it("skips selections that exceed missing count", () => {
        // Try to restore 5 level-1 slots but only 2 are missing
        const result = validateSlotRecovery(spellLevels, { 1: 5 }, 10);
        expect(result.valid).toBe(true);
        expect(result.totalUsed).toBe(0); // skipped because 5 > 2 missing
        expect(result.updates).toEqual({});
    });

    it("handles empty selections", () => {
        const result = validateSlotRecovery(spellLevels, {}, 5);
        expect(result.valid).toBe(true);
        expect(result.totalUsed).toBe(0);
    });
});

// ============================
// filterLongRestFeatures
// ============================
describe("filterLongRestFeatures", () => {
    it("returns items with lr recovery period", () => {
        const items = [
            { name: "Indomitable", system: { uses: { max: 1, recovery: [{ period: "lr" }] } } },
            { name: "Second Wind", system: { uses: { max: 1, recovery: [{ period: "sr" }] } } },
        ];
        const result = filterLongRestFeatures(items);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Indomitable");
    });

    it("returns empty array when no lr features exist", () => {
        const items = [
            { name: "Second Wind", system: { uses: { max: 1, recovery: [{ period: "sr" }] } } },
        ];
        expect(filterLongRestFeatures(items)).toEqual([]);
    });

    it("excludes items without uses.max", () => {
        const items = [
            { name: "Passive", system: { uses: { max: 0, recovery: [{ period: "lr" }] } } },
        ];
        expect(filterLongRestFeatures(items)).toEqual([]);
    });

    it("excludes items without recovery array", () => {
        const items = [
            { name: "Broken", system: { uses: { max: 1 } } },
        ];
        expect(filterLongRestFeatures(items)).toEqual([]);
    });

    it("handles items with multiple recovery periods", () => {
        const items = [
            { name: "Flexible", system: { uses: { max: 2, recovery: [{ period: "sr" }, { period: "lr" }] } } },
        ];
        const result = filterLongRestFeatures(items);
        expect(result).toHaveLength(1);
    });
});
