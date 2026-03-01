import { describe, it, expect, vi } from "vitest";
import {
    ACTIVITY_TYPES,
    createActivity,
    editActivity,
    logProgress,
    updateActivities,
    deleteActivity,
    getActiveActivities,
    getCompletedActivities,
    validateActivity,
    formatProgress,
} from "../lib/downtime.js";

// ---------------------
// Helper: build a valid activity
// ---------------------
function makeActivity(overrides = {}) {
    return {
        id: 1000,
        name: "Craft Healing Potion",
        type: "Crafting",
        progress: 10,
        goal: 50,
        notes: "",
        completed: false,
        ...overrides,
    };
}

// ============================
// ACTIVITY_TYPES
// ============================
describe("ACTIVITY_TYPES", () => {
    it("contains the four expected types", () => {
        expect(ACTIVITY_TYPES).toEqual(["Research", "Crafting", "Training", "Other"]);
    });
});

// ============================
// createActivity
// ============================
describe("createActivity", () => {
    it("creates a valid activity with defaults", () => {
        vi.spyOn(Date, "now").mockReturnValue(12345);
        const a = createActivity("Craft Sword", "Crafting", 40);
        expect(a).toEqual({
            id: 12345,
            name: "Craft Sword",
            type: "Crafting",
            progress: 0,
            goal: 40,
            notes: "",
            completed: false,
        });
        vi.restoreAllMocks();
    });

    it("trims the name", () => {
        const a = createActivity("  Research Lore  ", "Research", 20);
        expect(a.name).toBe("Research Lore");
    });

    it("accepts notes parameter", () => {
        const a = createActivity("Train", "Training", 8, "With the monks");
        expect(a.notes).toBe("With the monks");
    });

    it("throws on empty name", () => {
        expect(() => createActivity("", "Crafting", 10)).toThrow("non-empty string");
    });

    it("throws on whitespace-only name", () => {
        expect(() => createActivity("   ", "Crafting", 10)).toThrow("non-empty string");
    });

    it("throws on non-string name", () => {
        expect(() => createActivity(42, "Crafting", 10)).toThrow("non-empty string");
    });

    it("throws on invalid type", () => {
        expect(() => createActivity("Test", "cooking", 10)).toThrow("type must be one of");
    });

    it("throws on zero goal", () => {
        expect(() => createActivity("Test", "Crafting", 0)).toThrow("positive number");
    });

    it("throws on negative goal", () => {
        expect(() => createActivity("Test", "Crafting", -5)).toThrow("positive number");
    });

    it("throws on non-number goal", () => {
        expect(() => createActivity("Test", "Crafting", "ten")).toThrow("positive number");
    });

    it("throws on non-string notes", () => {
        expect(() => createActivity("Test", "Crafting", 10, 42)).toThrow("notes must be a string");
    });
});

// ============================
// logProgress
// ============================
describe("logProgress", () => {
    it("advances progress by the given hours", () => {
        const a = makeActivity({ progress: 10, goal: 50 });
        const result = logProgress(a, 5);
        expect(result.progress).toBe(15);
        expect(result.completed).toBe(false);
    });

    it("caps progress at goal", () => {
        const a = makeActivity({ progress: 45, goal: 50 });
        const result = logProgress(a, 10);
        expect(result.progress).toBe(50);
        expect(result.completed).toBe(true);
    });

    it("sets completed when progress equals goal exactly", () => {
        const a = makeActivity({ progress: 40, goal: 50 });
        const result = logProgress(a, 10);
        expect(result.progress).toBe(50);
        expect(result.completed).toBe(true);
    });

    it("returns a new object (immutable)", () => {
        const a = makeActivity({ progress: 10, goal: 50 });
        const result = logProgress(a, 5);
        expect(result).not.toBe(a);
        expect(a.progress).toBe(10);
    });

    it("throws on zero hours", () => {
        const a = makeActivity();
        expect(() => logProgress(a, 0)).toThrow("positive number");
    });

    it("throws on negative hours", () => {
        const a = makeActivity();
        expect(() => logProgress(a, -3)).toThrow("positive number");
    });

    it("throws on non-number hours", () => {
        const a = makeActivity();
        expect(() => logProgress(a, "two")).toThrow("positive number");
    });

    it("throws on completed activity", () => {
        const a = makeActivity({ progress: 50, goal: 50, completed: true });
        expect(() => logProgress(a, 1)).toThrow("completed activity");
    });

    it("throws on malformed activity", () => {
        expect(() => logProgress({ id: "bad" }, 1)).toThrow();
    });
});

// ============================
// updateActivities
// ============================
describe("updateActivities", () => {
    it("replaces the matching activity by ID", () => {
        const activities = [makeActivity({ id: 1 }), makeActivity({ id: 2, name: "Old" })];
        const updated = makeActivity({ id: 2, name: "New" });
        const result = updateActivities(activities, updated);
        expect(result[1].name).toBe("New");
        expect(result[0].id).toBe(1);
    });

    it("returns a new array (immutable)", () => {
        const activities = [makeActivity({ id: 1 })];
        const updated = makeActivity({ id: 1, progress: 20 });
        const result = updateActivities(activities, updated);
        expect(result).not.toBe(activities);
        expect(activities[0].progress).toBe(10);
    });

    it("throws when ID is not found", () => {
        const activities = [makeActivity({ id: 1 })];
        const updated = makeActivity({ id: 999 });
        expect(() => updateActivities(activities, updated)).toThrow("not found");
    });

    it("throws on non-array input", () => {
        expect(() => updateActivities("bad", makeActivity())).toThrow("must be an array");
    });

    it("throws on malformed updated activity", () => {
        const activities = [makeActivity({ id: 1 })];
        expect(() => updateActivities(activities, { id: "bad" })).toThrow();
    });
});

// ============================
// deleteActivity
// ============================
describe("deleteActivity", () => {
    it("removes the activity by ID", () => {
        const activities = [makeActivity({ id: 1 }), makeActivity({ id: 2 })];
        const result = deleteActivity(activities, 1);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    it("returns a new array (immutable)", () => {
        const activities = [makeActivity({ id: 1 }), makeActivity({ id: 2 })];
        const result = deleteActivity(activities, 1);
        expect(result).not.toBe(activities);
        expect(activities).toHaveLength(2);
    });

    it("throws when ID is not found", () => {
        const activities = [makeActivity({ id: 1 })];
        expect(() => deleteActivity(activities, 999)).toThrow("not found");
    });

    it("throws on non-array input", () => {
        expect(() => deleteActivity("bad", 1)).toThrow("must be an array");
    });
});

// ============================
// getActiveActivities
// ============================
describe("getActiveActivities", () => {
    it("returns only non-completed activities", () => {
        const activities = [
            makeActivity({ id: 1, completed: false }),
            makeActivity({ id: 2, completed: true, progress: 50, goal: 50 }),
            makeActivity({ id: 3, completed: false }),
        ];
        const result = getActiveActivities(activities);
        expect(result).toHaveLength(2);
        expect(result.map(a => a.id)).toEqual([1, 3]);
    });

    it("returns empty array when all are completed", () => {
        const activities = [
            makeActivity({ id: 1, completed: true, progress: 50, goal: 50 }),
        ];
        expect(getActiveActivities(activities)).toEqual([]);
    });

    it("returns empty array for empty input", () => {
        expect(getActiveActivities([])).toEqual([]);
    });

    it("throws on non-array input", () => {
        expect(() => getActiveActivities("bad")).toThrow("must be an array");
    });
});

// ============================
// getCompletedActivities
// ============================
describe("getCompletedActivities", () => {
    it("returns only completed activities", () => {
        const activities = [
            makeActivity({ id: 1, completed: false }),
            makeActivity({ id: 2, completed: true, progress: 50, goal: 50 }),
        ];
        const result = getCompletedActivities(activities);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    it("returns empty array when none are completed", () => {
        const activities = [makeActivity({ id: 1, completed: false })];
        expect(getCompletedActivities(activities)).toEqual([]);
    });

    it("returns empty array for empty input", () => {
        expect(getCompletedActivities([])).toEqual([]);
    });

    it("throws on non-array input", () => {
        expect(() => getCompletedActivities(null)).toThrow("must be an array");
    });
});

// ============================
// validateActivity
// ============================
describe("validateActivity", () => {
    it("accepts a valid activity", () => {
        expect(() => validateActivity(makeActivity())).not.toThrow();
    });

    it("throws on null", () => {
        expect(() => validateActivity(null)).toThrow("must be an object");
    });

    it("throws on non-object", () => {
        expect(() => validateActivity("string")).toThrow("must be an object");
    });

    it("throws on non-finite id", () => {
        expect(() => validateActivity(makeActivity({ id: NaN }))).toThrow("finite number");
    });

    it("throws on string id", () => {
        expect(() => validateActivity(makeActivity({ id: "abc" }))).toThrow("finite number");
    });

    it("throws on empty name", () => {
        expect(() => validateActivity(makeActivity({ name: "" }))).toThrow("non-empty string");
    });

    it("throws on invalid type", () => {
        expect(() => validateActivity(makeActivity({ type: "cooking" }))).toThrow("type must be one of");
    });

    it("throws on zero goal", () => {
        expect(() => validateActivity(makeActivity({ goal: 0 }))).toThrow("positive number");
    });

    it("throws on negative progress", () => {
        expect(() => validateActivity(makeActivity({ progress: -1 }))).toThrow("non-negative number");
    });

    it("throws on non-string notes", () => {
        expect(() => validateActivity(makeActivity({ notes: 42 }))).toThrow("notes must be a string");
    });

    it("throws on non-boolean completed", () => {
        expect(() => validateActivity(makeActivity({ completed: 1 }))).toThrow("completed must be a boolean");
    });
});

// ============================
// editActivity
// ============================
describe("editActivity", () => {
    it("edits name only and trims it", () => {
        const a = makeActivity();
        const result = editActivity(a, { name: "  New Name  " });
        expect(result.name).toBe("New Name");
        expect(result.type).toBe(a.type);
    });

    it("edits multiple fields at once", () => {
        const a = makeActivity();
        const result = editActivity(a, { name: "Study Arcana", type: "Research", notes: "At the library" });
        expect(result.name).toBe("Study Arcana");
        expect(result.type).toBe("Research");
        expect(result.notes).toBe("At the library");
    });

    it("reduces goal below progress — caps progress and sets completed", () => {
        const a = makeActivity({ progress: 30, goal: 50 });
        const result = editActivity(a, { goal: 20 });
        expect(result.goal).toBe(20);
        expect(result.progress).toBe(20);
        expect(result.completed).toBe(true);
    });

    it("increases goal on completed activity — unsets completed", () => {
        const a = makeActivity({ progress: 50, goal: 50, completed: true });
        const result = editActivity(a, { goal: 100 });
        expect(result.goal).toBe(100);
        expect(result.progress).toBe(50);
        expect(result.completed).toBe(false);
    });

    it("returns a new object (immutable)", () => {
        const a = makeActivity();
        const result = editActivity(a, { name: "Changed" });
        expect(result).not.toBe(a);
        expect(a.name).toBe("Craft Healing Potion");
    });

    it("throws on empty name", () => {
        const a = makeActivity();
        expect(() => editActivity(a, { name: "" })).toThrow("non-empty string");
    });

    it("throws on invalid type", () => {
        const a = makeActivity();
        expect(() => editActivity(a, { type: "cooking" })).toThrow("type must be one of");
    });

    it("throws on bad goal", () => {
        const a = makeActivity();
        expect(() => editActivity(a, { goal: -5 })).toThrow("positive number");
    });

    it("throws on non-object changes", () => {
        const a = makeActivity();
        expect(() => editActivity(a, "bad")).toThrow("Changes must be a plain object");
    });

    it("throws when no recognized fields provided", () => {
        const a = makeActivity();
        expect(() => editActivity(a, { foo: "bar" })).toThrow("must include at least one");
    });
});

// ============================
// formatProgress
// ============================
describe("formatProgress", () => {
    it("formats progress correctly", () => {
        const a = makeActivity({ progress: 12, goal: 50 });
        expect(formatProgress(a)).toBe("12 / 50 hours (24%)");
    });

    it("formats 0% progress", () => {
        const a = makeActivity({ progress: 0, goal: 100 });
        expect(formatProgress(a)).toBe("0 / 100 hours (0%)");
    });

    it("formats 100% progress", () => {
        const a = makeActivity({ progress: 50, goal: 50, completed: true });
        expect(formatProgress(a)).toBe("50 / 50 hours (100%)");
    });

    it("rounds percentage to nearest integer", () => {
        const a = makeActivity({ progress: 1, goal: 3 });
        expect(formatProgress(a)).toBe("1 / 3 hours (33%)");
    });

    it("throws on malformed activity", () => {
        expect(() => formatProgress({ id: "bad" })).toThrow();
    });
});
