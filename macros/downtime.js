// Auto-generated — do not edit. Source: macros/src/
(() => {
  // lib/downtime.js
  var ACTIVITY_TYPES = ["Research", "Crafting", "Training", "Other"];
  function validateActivity(activity) {
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
  function createActivity(name, type, goal, notes = "") {
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
      completed: false
    };
  }
  function logProgress(activity, hours) {
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
      completed: newProgress >= activity.goal
    };
  }
  function updateActivities(activities, updated) {
    if (!Array.isArray(activities)) {
      throw new Error("Activities must be an array");
    }
    validateActivity(updated);
    const idx = activities.findIndex((a) => a.id === updated.id);
    if (idx === -1) {
      throw new Error(`Activity with id ${updated.id} not found`);
    }
    const result = [...activities];
    result[idx] = updated;
    return result;
  }
  function deleteActivity(activities, id) {
    if (!Array.isArray(activities)) {
      throw new Error("Activities must be an array");
    }
    const idx = activities.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Activity with id ${id} not found`);
    }
    return activities.filter((a) => a.id !== id);
  }
  function getActiveActivities(activities) {
    if (!Array.isArray(activities)) {
      throw new Error("Activities must be an array");
    }
    return activities.filter((a) => !a.completed);
  }
  function getCompletedActivities(activities) {
    if (!Array.isArray(activities)) {
      throw new Error("Activities must be an array");
    }
    return activities.filter((a) => a.completed);
  }
  function editActivity(activity, changes) {
    validateActivity(activity);
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new Error("Changes must be a plain object");
    }
    const recognized = ["name", "type", "goal", "notes"];
    const keys = Object.keys(changes).filter((k) => recognized.includes(k));
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
  function formatProgress(activity) {
    validateActivity(activity);
    const pct = Math.round(activity.progress / activity.goal * 100);
    return `${activity.progress} / ${activity.goal} hours (${pct}%)`;
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

  // macros/src/downtime.js
  var FLAG_KEY = "downtime-activities";
  function getActivities(actor) {
    return actor.getFlag("world", FLAG_KEY) ?? [];
  }
  async function saveActivities(actor, activities) {
    await actor.setFlag("world", FLAG_KEY, activities);
  }
  (async () => {
    const actor = await pickActor();
    if (!actor) return;
    await showMainMenu();
    async function showMainMenu() {
      const activities = getActivities(actor);
      const active = getActiveActivities(activities);
      const completed = getCompletedActivities(activities);
      return new Promise((resolve) => {
        new Dialog({
          title: `Downtime Activities \u2014 ${actor.name}`,
          content: `<p>${active.length} active, ${completed.length} completed</p>`,
          buttons: {
            newActivity: {
              label: "New Activity",
              callback: async () => {
                await showCreateForm();
                resolve();
              }
            },
            logProgress: {
              label: "Log Progress",
              callback: async () => {
                await showActivityPicker();
                resolve();
              }
            },
            viewManage: {
              label: "Manage",
              callback: async () => {
                await showViewManage();
                resolve();
              }
            },
            close: {
              label: "Close",
              callback: () => resolve()
            }
          },
          default: "newActivity"
        }).render(true);
      });
    }
    async function showCreateForm(defaults = {}) {
      const dName = defaults.name ?? "";
      const dType = defaults.type ?? ACTIVITY_TYPES[0];
      const dGoal = defaults.goal ?? 8;
      const dNotes = defaults.notes ?? "";
      const typeOptions = ACTIVITY_TYPES.map((t) => {
        const selected = t === dType ? "selected" : "";
        return `<option value="${t}" ${selected}>${t}</option>`;
      }).join("");
      return new Promise((resolve) => {
        new Dialog({
          title: "New Downtime Activity",
          content: `
                    <form>
                        <div class="form-group">
                            <label>Name:</label>
                            <input type="text" name="name" value="${dName}" placeholder="e.g. Craft Healing Potion"/>
                        </div>
                        <div class="form-group">
                            <label>Type:</label>
                            <select name="type">${typeOptions}</select>
                        </div>
                        <div class="form-group">
                            <label>Goal (hours):</label>
                            <input type="number" name="goal" value="${dGoal}" min="1" step="1"/>
                        </div>
                        <div class="form-group">
                            <label>Notes:</label>
                            <textarea name="notes" rows="2">${dNotes}</textarea>
                        </div>
                    </form>`,
          buttons: {
            create: {
              label: "Create",
              callback: async (html) => {
                const name = html.find("[name='name']").val();
                const type = html.find("[name='type']").val();
                const goal = Number(html.find("[name='goal']").val());
                const notes = html.find("[name='notes']").val();
                try {
                  const activity = createActivity(name, type, goal, notes);
                  const activities = getActivities(actor);
                  await saveActivities(actor, [...activities, activity]);
                  ui.notifications.info(`Created activity: ${activity.name}`);
                } catch (e) {
                  ui.notifications.error(e.message);
                  await showCreateForm({ name, type, goal, notes });
                  resolve();
                  return;
                }
                await showMainMenu();
                resolve();
              }
            },
            cancel: {
              label: "Cancel",
              callback: async () => {
                await showMainMenu();
                resolve();
              }
            }
          },
          default: "create"
        }).render(true);
      });
    }
    async function showActivityPicker() {
      const activities = getActivities(actor);
      const active = getActiveActivities(activities);
      if (!active.length) {
        ui.notifications.info("No active activities to log progress on.");
        await showMainMenu();
        return;
      }
      let radioHtml = "";
      for (const a of active) {
        radioHtml += `<div><label><input type="radio" name="activity" value="${a.id}"/> <strong>${a.name}</strong> (${a.type}) \u2014 ${formatProgress(a)}</label></div>`;
      }
      return new Promise((resolve) => {
        new Dialog({
          title: "Log Progress \u2014 Select Activity",
          content: `<form>${radioHtml}</form>`,
          buttons: {
            select: {
              label: "Select",
              callback: async (html) => {
                const id = Number(html.find("input[name='activity']:checked").val());
                const activity = active.find((a) => a.id === id);
                if (!activity) {
                  ui.notifications.warn("No activity selected.");
                  await showMainMenu();
                  resolve();
                  return;
                }
                await showLogHours(activity);
                resolve();
              }
            },
            cancel: {
              label: "Cancel",
              callback: async () => {
                await showMainMenu();
                resolve();
              }
            }
          },
          default: "select"
        }).render(true);
      });
    }
    async function showLogHours(activity) {
      const remaining = activity.goal - activity.progress;
      return new Promise((resolve) => {
        new Dialog({
          title: `Log Progress \u2014 ${activity.name}`,
          content: `
                    <form>
                        <p>Current: ${formatProgress(activity)}</p>
                        <p>Remaining: ${remaining} hours</p>
                        <div class="form-group">
                            <label>Hours to log:</label>
                            <input type="number" name="hours" value="4" min="0.5" step="0.5"/>
                        </div>
                    </form>`,
          buttons: {
            log: {
              label: "Log",
              callback: async (html) => {
                const hours = Number(html.find("[name='hours']").val());
                try {
                  const updated = logProgress(activity, hours);
                  const activities = getActivities(actor);
                  const newActivities = updateActivities(activities, updated);
                  await saveActivities(actor, newActivities);
                  if (updated.completed) {
                    ui.notifications.info(`${activity.name} is now complete!`);
                  } else {
                    ui.notifications.info(`Logged ${hours} hours on ${activity.name}. ${formatProgress(updated)}`);
                  }
                } catch (e) {
                  ui.notifications.error(e.message);
                }
                await showMainMenu();
                resolve();
              }
            },
            cancel: {
              label: "Cancel",
              callback: async () => {
                await showMainMenu();
                resolve();
              }
            }
          },
          default: "log"
        }).render(true);
      });
    }
    async function showViewManage() {
      const activities = getActivities(actor);
      const completed = getCompletedActivities(activities);
      let tableRows = "";
      for (const a of activities) {
        const style = a.completed ? ' style="opacity:0.5"' : "";
        const status = a.completed ? "Done" : "Active";
        const notesLine = a.notes ? `<br/><em style="font-size:0.9em">${a.notes}</em>` : "";
        tableRows += `<tr${style}><td><input type="radio" name="editActivity" value="${a.id}"/> ${a.name}${notesLine}</td><td>${a.type}</td><td>${formatProgress(a)}</td><td>${status}</td></tr>`;
      }
      const tableHtml = activities.length ? `<form><table style="width:100%"><tr><th>Name</th><th>Type</th><th>Progress</th><th>Status</th></tr>${tableRows}</table></form>` : `<p><em>No activities yet.</em></p>`;
      const buttons = {
        close: {
          label: "Close",
          callback: async () => {
            await showMainMenu();
          }
        }
      };
      if (activities.length) {
        buttons.edit = {
          label: "Edit",
          callback: async (html) => {
            const id = Number(html.find("input[name='editActivity']:checked").val());
            const activity = activities.find((a) => a.id === id);
            if (!activity) {
              ui.notifications.warn("No activity selected.");
              await showViewManage();
              return;
            }
            await showEditForm(activity);
          }
        };
      }
      if (completed.length) {
        buttons.deleteCompleted = {
          label: "Delete Completed",
          callback: async () => {
            let current = getActivities(actor);
            for (const c of getCompletedActivities(current)) {
              current = deleteActivity(current, c.id);
            }
            await saveActivities(actor, current);
            ui.notifications.info(`Deleted ${completed.length} completed activities.`);
            await showMainMenu();
          }
        };
      }
      return new Promise((resolve) => {
        new Dialog({
          title: `Downtime Activities \u2014 ${actor.name}`,
          content: tableHtml,
          buttons,
          default: "close",
          close: () => resolve()
        }).render(true);
      });
    }
    async function showEditForm(activity, defaults = null) {
      const d = defaults ?? activity;
      const typeOptions = ACTIVITY_TYPES.map((t) => {
        const selected = t === d.type ? "selected" : "";
        return `<option value="${t}" ${selected}>${t}</option>`;
      }).join("");
      return new Promise((resolve) => {
        new Dialog({
          title: `Edit Activity \u2014 ${activity.name}`,
          content: `
                    <form>
                        <div class="form-group">
                            <label>Name:</label>
                            <input type="text" name="name" value="${d.name}"/>
                        </div>
                        <div class="form-group">
                            <label>Type:</label>
                            <select name="type">${typeOptions}</select>
                        </div>
                        <div class="form-group">
                            <label>Goal (hours):</label>
                            <input type="number" name="goal" value="${d.goal}" min="1" step="1"/>
                        </div>
                        <div class="form-group">
                            <label>Notes:</label>
                            <textarea name="notes" rows="2">${d.notes}</textarea>
                        </div>
                    </form>`,
          buttons: {
            save: {
              label: "Save",
              callback: async (html) => {
                const name = html.find("[name='name']").val();
                const type = html.find("[name='type']").val();
                const goal = Number(html.find("[name='goal']").val());
                const notes = html.find("[name='notes']").val();
                try {
                  const updated = editActivity(activity, { name, type, goal, notes });
                  const activities = getActivities(actor);
                  const newActivities = updateActivities(activities, updated);
                  await saveActivities(actor, newActivities);
                  ui.notifications.info(`Updated activity: ${updated.name}`);
                } catch (e) {
                  ui.notifications.error(e.message);
                  await showEditForm(activity, { name, type, goal, notes });
                  resolve();
                  return;
                }
                await showViewManage();
                resolve();
              }
            },
            cancel: {
              label: "Cancel",
              callback: async () => {
                await showViewManage();
                resolve();
              }
            }
          },
          default: "save"
        }).render(true);
      });
    }
  })();
})();
