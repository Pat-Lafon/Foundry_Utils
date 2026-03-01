// Pure logic for the downtime activity tracker macro.
// Imported by macros/src/downtime.js and inlined by the build step.

export const ACTIVITY_TYPES = ["Research", "Crafting", "Training", "Other"];

/**
 * Validate that an activity object has the correct shape and values.
 * Throws on any malformed field.
 * @param {object} activity
 */
export function validateActivity(activity) {
    if (!activity || typeof activity !== "object") {
        throw new Error("Activity must be an object");
    }
    if (typeof activity.id !== "number" || !Number.isFinite(activity.id)) {
        throw new Error("Activity id must be a finite number");
    }
    if (typeof activity.name !== "string" || activity.name.trim() === "") {
        throw new Error("Activity name must be a non-empty string");
    }
    if (!ACTIVITY_TYPES.includes(activity.type)) {
        throw new Error(`Activity type must be one of: ${ACTIVITY_TYPES.join(", ")}`);
    }
    if (typeof activity.goal !== "number" || !Number.isFinite(activity.goal) || activity.goal <= 0) {
        throw new Error("Activity goal must be a positive number");
    }
    if (typeof activity.progress !== "number" || !Number.isFinite(activity.progress) || activity.progress < 0) {
        throw new Error("Activity progress must be a non-negative number");
    }
    if (typeof activity.notes !== "string") {
        throw new Error("Activity notes must be a string");
    }
    if (typeof activity.completed !== "boolean") {
        throw new Error("Activity completed must be a boolean");
    }
}

/**
 * Create a new activity object.
 * @param {string} name - Activity name (trimmed, must be non-empty)
 * @param {string} type - One of ACTIVITY_TYPES
 * @param {number} goal - Hours required (must be > 0)
 * @param {string} [notes=""] - Optional free-text notes
 * @returns {object} New activity object
 */
export function createActivity(name, type, goal, notes = "") {
    if (typeof name !== "string" || name.trim() === "") {
        throw new Error("Activity name must be a non-empty string");
    }
    if (!ACTIVITY_TYPES.includes(type)) {
        throw new Error(`Activity type must be one of: ${ACTIVITY_TYPES.join(", ")}`);
    }
    if (typeof goal !== "number" || !Number.isFinite(goal) || goal <= 0) {
        throw new Error("Activity goal must be a positive number");
    }
    if (typeof notes !== "string") {
        throw new Error("Activity notes must be a string");
    }

    return {
        id: Date.now(),
        name: name.trim(),
        type,
        progress: 0,
        goal,
        notes,
        completed: false,
    };
}

/**
 * Log progress hours on an activity. Returns a new activity with updated progress.
 * Caps progress at goal and sets completed when reached.
 * @param {object} activity - Existing activity
 * @param {number} hours - Hours to add (must be > 0)
 * @returns {object} New activity with updated progress
 */
export function logProgress(activity, hours) {
    validateActivity(activity);
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
        throw new Error("Hours must be a positive number");
    }
    if (activity.completed) {
        throw new Error("Cannot log progress on a completed activity");
    }

    const newProgress = Math.min(activity.progress + hours, activity.goal);
    return {
        ...activity,
        progress: newProgress,
        completed: newProgress >= activity.goal,
    };
}

/**
 * Replace an activity in the array by ID. Returns a new array.
 * @param {Array} activities - Existing activities array
 * @param {object} updated - Updated activity (must have matching id)
 * @returns {Array} New array with the activity replaced
 */
export function updateActivities(activities, updated) {
    if (!Array.isArray(activities)) {
        throw new Error("Activities must be an array");
    }
    validateActivity(updated);
    const idx = activities.findIndex(a => a.id === updated.id);
    if (idx === -1) {
        throw new Error(`Activity with id ${updated.id} not found`);
    }
    const result = [...activities];
    result[idx] = updated;
    return result;
}

/**
 * Remove an activity from the array by ID. Returns a new array.
 * @param {Array} activities - Existing activities array
 * @param {number} id - Activity ID to remove
 * @returns {Array} New array without the activity
 */
export function deleteActivity(activities, id) {
    if (!Array.isArray(activities)) {
        throw new Error("Activities must be an array");
    }
    const idx = activities.findIndex(a => a.id === id);
    if (idx === -1) {
        throw new Error(`Activity with id ${id} not found`);
    }
    return activities.filter(a => a.id !== id);
}

/**
 * Filter to active (not completed) activities.
 * @param {Array} activities
 * @returns {Array}
 */
export function getActiveActivities(activities) {
    if (!Array.isArray(activities)) {
        throw new Error("Activities must be an array");
    }
    return activities.filter(a => !a.completed);
}

/**
 * Filter to completed activities.
 * @param {Array} activities
 * @returns {Array}
 */
export function getCompletedActivities(activities) {
    if (!Array.isArray(activities)) {
        throw new Error("Activities must be an array");
    }
    return activities.filter(a => a.completed);
}

/**
 * Edit an existing activity by applying partial changes.
 * Returns a new activity object with the updates applied.
 * @param {object} activity - Existing activity (must pass validateActivity)
 * @param {object} changes - Partial updates: {name?, type?, goal?, notes?}
 * @returns {object} New activity with changes applied
 */
export function editActivity(activity, changes) {
    validateActivity(activity);
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
        throw new Error("Changes must be a plain object");
    }

    const recognized = ["name", "type", "goal", "notes"];
    const keys = Object.keys(changes).filter(k => recognized.includes(k));
    if (keys.length === 0) {
        throw new Error("Changes must include at least one of: name, type, goal, notes");
    }

    const updated = { ...activity };

    if ("name" in changes) {
        if (typeof changes.name !== "string" || changes.name.trim() === "") {
            throw new Error("Activity name must be a non-empty string");
        }
        updated.name = changes.name.trim();
    }

    if ("type" in changes) {
        if (!ACTIVITY_TYPES.includes(changes.type)) {
            throw new Error(`Activity type must be one of: ${ACTIVITY_TYPES.join(", ")}`);
        }
        updated.type = changes.type;
    }

    if ("goal" in changes) {
        if (typeof changes.goal !== "number" || !Number.isFinite(changes.goal) || changes.goal <= 0) {
            throw new Error("Activity goal must be a positive number");
        }
        updated.goal = changes.goal;
        if (updated.progress > updated.goal) {
            updated.progress = updated.goal;
            updated.completed = true;
        } else if (updated.completed && updated.progress < updated.goal) {
            updated.completed = false;
        }
    }

    if ("notes" in changes) {
        if (typeof changes.notes !== "string") {
            throw new Error("Activity notes must be a string");
        }
        updated.notes = changes.notes;
    }

    validateActivity(updated);
    return updated;
}

/**
 * Format an activity's progress as a human-readable string.
 * @param {object} activity
 * @returns {string} e.g. "12 / 50 hours (24%)"
 */
export function formatProgress(activity) {
    validateActivity(activity);
    const pct = Math.round((activity.progress / activity.goal) * 100);
    return `${activity.progress} / ${activity.goal} hours (${pct}%)`;
}
