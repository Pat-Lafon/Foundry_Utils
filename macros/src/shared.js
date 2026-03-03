/**
 * Prompt the user to select one of their owned characters. Returns the
 * actor directly if only one exists, or null if cancelled / none found.
 *
 * @returns {Promise<object|null>}
 */
export async function pickActor() {
    const owned = game.actors.filter(a => a.isOwner && a.type === "character");
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

    return new Promise(resolve => {
        new Dialog({
            title: "Select Character",
            content: `<form>${radioHtml}</form>`,
            buttons: {
                confirm: {
                    label: "Continue",
                    callback: (html) => {
                        const id = html.find("input[name='actor']:checked").val();
                        resolve(id ? game.actors.get(id) : null);
                    },
                },
                cancel: { label: "Cancel", callback: () => resolve(null) },
            },
            default: "confirm",
        }).render(true);
    });
}
