# Foundry Utils

A collection of macros for Foundry VTT (v12+) running the D&D 5e 2014 system.

## Project Structure

- `lib/` — Pure logic functions (ES modules, tested with Vitest)
- `macros/src/` — Macro source files (ES modules that import from `lib/`)
- `macros/*.js` — **Auto-generated build output** (standalone scripts to paste into Foundry). Do not edit directly.
- `test/` — Unit tests

## Build

- `npm run build` — Bundles `macros/src/` + `lib/` into standalone `macros/*.js` via esbuild
- `npm run lint` — Lints `lib/` and `macros/src/` (build output is ignored)
- `npm test` — Runs unit tests

## Foundry VTT Context

Macros run in the browser inside Foundry's global scope. Key globals available at runtime:

- `game` — The core Game instance (actors, users, settings, modules, etc.)
- `canvas` — The active canvas (tokens, scenes, layers)
- `ui` — UI controllers (`ui.notifications.info/warn/error()`)
- `Dialog` — Foundry's dialog class for user prompts
- `ChatMessage` — For posting to chat
- `Roll` — Dice rolling engine
- `CONFIG` — System configuration object

## Actor & Item APIs (dnd5e 2014)

- `actor.system.spells.spell1` through `spell9` — Spell slot data (`{ value, max }`)
- `actor.system.attributes.hp` — Hit points (`{ value, max, temp }`)
- `actor.items.filter(i => i.type === "class")` — Class items
- `actor.system.attributes.hd` — Actor-level hit dice aggregate (`{ value, max, sizes, classes }`)
- `cls.system.hd` — Class-level hit dice (`{ denomination, max, value, spent, additional }`) — update via `spent`
- `cls.system.levels` — Class level
- `cls.system.spellcasting.progression` — `"full"`, `"half"`, `"third"`, `"pact"`, or `"none"`
- `item.system.uses` — Item uses (`{ max, spent, recovery: [{ period: "sr"|"lr" }] }`)
- `actor.shortRest()` / `actor.longRest()` — Built-in rest workflows

## Conventions

- Edit `macros/src/` and `lib/`, never `macros/*.js` directly
- Pure/testable logic goes in `lib/`, UI/dialog code in `macros/src/`
- `macros/src/` files import from `lib/`; esbuild inlines everything into a standalone IIFE
- Use `async`/`await` for Foundry API calls that return Promises (updates, rests)
- Use Foundry's `Dialog` class for user interaction
- Hardcoded actor name `"Ravos"` is used for debugging; production macros should use `canvas.tokens.controlled[0]?.actor ?? game.user.character`
