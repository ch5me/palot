# Task 3 — Command Surfaces Inventory <!-- oc:id=sec_aa -->

> Wave 1, Task 3 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

Command is the least formalized of the four contribution families. The current `apps/desktop/src/renderer/components/command-palette.tsx` hand-rolls palette items, shortcuts, theme changes, surface open/toggle actions, and feature-flag toggles without a canonical `contributes.commands` contract. V2 must replace this with one declarative commands surface plus one host-generated control wrapper per surface, with clear static-vs-dynamic activation, reserved namespaces, and collision rules.

## 1. Six command families <!-- oc:id=sec_ac -->

| Family | Description | Concrete examples | Current owner | V2 owner |
|---|---|---|---|---|
| `palette` | items in `Cmd+K` palette | undo, redo, theme picker, mock mode, react-scan, open/toggle surfaces, reload config, relaunch | `command-palette.tsx` | host + plugin `contributes.commands` |
| `slash` | `/foo` style textual entrypoints | none surfaced today in first-party desktop UI | none | host + plugin `contributes.commands` with `activation: slash` |
| `surface-open` | explicit open/focus of side panel | `surface.<id>.open` and `surface.<id>.toggle` declared on surfaces | `firefly-surface-registry.tsx` | host-generated `plugin.panel.open` wrapper |
| `feature-toggle` | runtime feature flag switch | `toggle*SurfaceAtom`, mock-mode toggle, react-scan toggle, automations toggle | `command-palette.tsx` + `atoms/feature-flags.ts` | host + plugin commands gated by `feature_flag` |
| `shortcut` | global keyboard triggers | `Cmd+K`, `Cmd+B`, `Shift+Cmd+D`, `Cmd+Z`, `Shift+Cmd+Z` | `command-palette.tsx` | host + `contributes.keybindings` |
| `context-action` | right-click / contextual actions | review-panel line comment, editor panel actions, panel-header actions | scattered | host + `contributes.menus` |

## 2. Command inventory (current ids) <!-- oc:id=sec_ad -->

| id | activation style | current owner | current trigger | V2 namespace note |
|---|---|---|---|---|
| `session.undo` | shortcut + palette | host | `Cmd+Z`, palette item | host-reserved `session.*` |
| `session.redo` | shortcut + palette | host | `Shift+Cmd+Z`, palette item | host-reserved |
| `palette.open` | shortcut | host | `Cmd+K` | host-reserved |
| `sidebar.toggle` | shortcut | host | `Cmd+B` | host-reserved |
| `sidepanel.toggle` | shortcut | host | `Shift+Cmd+D` | host-reserved |
| `theme.open` | palette | host | palette item | host-reserved |
| `theme.set` | palette | host | palette item | host-reserved |
| `mock.toggle` | palette + flag | host | palette item | host-reserved |
| `reactscan.toggle` | palette + flag | host | palette item | host-reserved |
| `automations.toggle` | flag | host | toggle atom | host-reserved |
| `reload.config` | palette | host | palette item | host-reserved |
| `relaunch.app` | palette | host | after opaque toggle | host-reserved |
| `opaque.toggle` | palette | host | palette item | host-reserved |
| `surface.review.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.browser.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.notes.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.pulse.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.memory.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.files.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.terminal.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.editor.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.plugins.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.bridges.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.crm.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.studio.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.voice.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.oracle.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.claude.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.ch5pm.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.artifacts.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |
| `surface.pdf-review.open` / `.toggle` | surface-bound | host | declared per surface | host-reserved built-in projection |

## 3. Keyboard shortcut map <!-- oc:id=sec_ae -->

- `Cmd+K` — open command palette
- `Cmd+B` — toggle sidebar
- `Shift+Cmd+D` — toggle session side panel
- `Cmd+Z` — undo session turn
- `Shift+Cmd+Z` — redo session turn

These remain host-owned defaults in V2. Plugins may add new shortcuts through `contributes.keybindings` but may not shadow host-owned ones.

## 4. Surface-bound declarations and dormant split <!-- oc:id=sec_af -->

`firefly-surface-registry.tsx` declares both `surface.<id>.open` and `surface.<id>.toggle` per surface. The palette today only meaningfully wires toggle-style state changes from atoms and surface helpers, leaving the `open` siblings under-used. This is a contract smell.

V2 fix:
- keep `surface.*` as host-owned built-in projection ids
- route all explicit panel focus/open through `plugin.panel.open` wrappers
- treat `surface.<id>.toggle` as a transitional compatibility alias for built-in first-party surfaces until migration is complete

## 5. V2 contribution shapes plugins will need <!-- oc:id=sec_ag -->

Commands:
- `contributes.commands[]`
- fields: `id`, `title`, `category`, `icon`, `shortcut`, `menu`, `when`, `handlerPluginOnly`, `requiresCapabilities`

Menus:
- `contributes.menus[]`
- fields: `location`, `commandId`, `when`

Keybindings:
- `contributes.keybindings[]`
- fields: `commandId`, `key`, `when`

Panel wrappers:
- host-generated `plugin.<id>.panel.open`, `plugin.<id>.panel.state`

Concrete example ids:
- `plugin.git-plugin.run-status`
- `plugin.git-plugin.open-repo`
- `plugin.docs-plugin.search-index`
- `plugin.browser-plugin.capture-page`

## 6. Reserved namespace rules <!-- oc:id=sec_ah -->

- host owns: `firefly.*`, `surface.*`, `plugins.*`, `session.*`, `theme.*`, `sidebar.*`, `sidepanel.*`, `bridge.*`, `lifecycle.*`
- plugins use: `plugin.<pluginId>.*`
- current `surface.*` ids stay as built-in first-party projections in V2

## 7. Static vs dynamic activation <!-- oc:id=sec_ai -->

Static activation today dominates:
- palette item appears because host code rendered it
- shortcut exists because host registered it
- surface command exists because `commandIds` were attached to registry items

Dynamic activation needed in V2:
- command visibility depends on `PluginSessionHandle` availability
- theme apply command visible only if plugin contributed themes
- browser lane command visible only if `browser:lane-control` is granted and session has lane binding

## 8. What this means downstream <!-- oc:id=sec_aj -->

Task 17 must turn `command-palette.tsx` into a pure projection consumer. The palette should read a host-produced commands list derived from `PluginDescriptor` + `PluginSessionHandle`, not hand-roll built-ins in parallel. The only truly host-only commands should be bootstrapping, session undo/redo, and operator lifecycle commands.