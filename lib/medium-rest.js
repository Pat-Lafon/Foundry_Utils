// Pure logic for the medium rest macro.
// Imported by macros/src/medium-rest.js and inlined by the build step.

/**
 * Calculate how many medium rest choices a character gets based on rations consumed.
 * @param {number} rations - Number of rations consumed
 * @returns {number} Number of bonus choices allowed (0 if rations <= 1)
 */
export function getChoicesAllowed(rations) {
    return Math.max(rations - 1, 0);
}

/**
 * Compute effective caster level from an actor's class items.
 * Warlock (pact) casters are excluded since they use pact slots.
 * @param {Array<{system: {levels: number, spellcasting?: {progression?: string}}}>} classes
 * @returns {number} Total effective caster level
 */
export function getCasterLevel(classes) {
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

/**
 * Calculate the arcane recovery spell slot budget from a caster level.
 * Based on PHB 2014 Arcane Recovery: "equal to or less than half your wizard level (rounded up)"
 * Ref: https://2014.5e.tools/classes.html#wizard_phb,state:feature=s0-0
 * @param {number} casterLevel - Effective caster level (from getCasterLevel)
 * @returns {number} Maximum total spell levels that can be recovered
 */
export function getRecoveryBudget(casterLevel) {
    return Math.ceil(casterLevel / 2);
}

/**
 * Maximum spell slot level that can be recovered via arcane recovery.
 * PHB 2014: "none of the slots can be 6th level or higher"
 */
export const MAX_RECOVERY_SLOT_LEVEL = 5;

/**
 * Calculate the hit dice recovery budget from total max hit dice.
 * PHB 2014: "up to a number of dice equal to half of the character's total
 * number of them (minimum of one die)." Round down per general 5e rule (PHB p.7).
 * Ref: https://2014.5e.tools/book.html#phb,8,resting,0
 * @param {number} totalMaxHD - Total max hit dice across all classes
 * @returns {number} Number of hit dice that can be recovered
 */
export function getHitDiceBudget(totalMaxHD) {
    return Math.max(Math.floor(totalMaxHD / 2), 1);
}

/**
 * Build a list of classes that have spent hit dice.
 * @param {Array<{name: string, system: {hd?: {denomination?: string, max?: number, spent?: number}}}>} classes
 * @returns {Array<{name: string, denomination: string, max: number, spent: number}>}
 */
export function getSpentHitDice(classes) {
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
            spent: hd.spent,
        });
    }
    return result;
}

/**
 * Validate a hit dice recovery selection against the budget.
 * Each die costs 1 toward the budget (not weighted by denomination).
 * @param {Array<{name: string, spent: number}>} spentHitDice - Classes with spent HD
 * @param {Record<string, number>} selections - Map of class name -> number of dice to recover
 * @param {number} budget - Maximum total dice that can be recovered
 * @returns {{valid: boolean, totalUsed: number, updates: Array<{name: string, newSpent: number}>}}
 */
export function validateHitDiceRecovery(spentHitDice, selections, budget) {
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

/**
 * Calculate how many hit dice to recover (half of max, rounded up)
 * and the resulting spent count.
 *
 * dnd5e data model: cls.system.hd = { denomination, max, value, spent, additional }
 * - spent + value = max (always)
 * - to recover dice, reduce spent
 *
 * @param {number} spent - Currently spent hit dice
 * @param {number} max - Maximum hit dice for this class
 * @returns {{recover: number, newSpent: number}}
 */
export function calcHitDiceRecovery(spent, max) {
    const recover = Math.min(Math.ceil(max / 2), spent);
    const newSpent = spent - recover;
    return { recover, newSpent };
}

/**
 * Build the list of spell levels that have missing slots.
 * @param {Record<string, {value: number, max: number}>} spells - Actor spell slot data (spell1..spell9)
 * @param {number} [maxLevel=MAX_RECOVERY_SLOT_LEVEL] - Highest spell level to consider
 * @returns {Array<{lvl: number, current: number, max: number, missing: number}>}
 */
export function getMissingSpellSlots(spells, maxLevel = MAX_RECOVERY_SLOT_LEVEL) {
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

/**
 * Validate a spell slot recovery selection against the budget.
 * @param {Array<{lvl: number, current: number, missing: number}>} spellLevels - Available spell levels
 * @param {Record<number, number>} selections - Map of spell level -> number of slots to restore
 * @param {number} budget - Maximum total spell levels that can be recovered
 * @returns {{valid: boolean, totalUsed: number, updates: Record<string, number>}}
 */
export function validateSlotRecovery(spellLevels, selections, budget) {
    let totalUsed = 0;
    /** @type {Record<string, number>} */
    const updates = {};

    for (const sp of spellLevels) {
        const val = selections[sp.lvl] ?? 0;
        if (val <= 0 || val > sp.missing) continue;
        totalUsed += val * sp.lvl;
        updates[`system.spells.spell${sp.lvl}.value`] = sp.current + val;
    }

    return { valid: totalUsed <= budget, totalUsed, updates };
}

/**
 * Filter actor items to find long-rest recovery features.
 * @param {Array<{system: {uses?: {max: number, recovery?: Array<{period: string}>}}}>} items
 * @returns {Array} Items that have long-rest recovery
 */
export function filterLongRestFeatures(items) {
    return items.filter(i => {
        const uses = i.system.uses;
        return uses?.max && Array.isArray(uses.recovery) && uses.recovery.some(r => r.period === "lr");
    });
}
