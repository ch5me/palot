# Task 1: Inventory of Current Contribution Registries and Hardcoded Sources

## What this means for V2

Firefly is a single desktop app with **four hardcoded renderer contribution registries** (side panels in `firefly-surface-registry.tsx`, session widgets in `session-widget-registry.tsx`, themes in `lib/themes.ts`, and the ad hoc `surface.*` command ids baked into `command-palette.tsx`) and **one OpenCode-side plugin bundle** (`palot-bridge.js` / `palot-plugin/plugin.js`) that already acts as a real first-party plugin via `OPENCODE_PLUGIN` env injection on the managed OpenCode server. None of these five are derived from a single canonical source; each owns its own id namespace, its own flag atom, its own persistence key, and its own renderer wiring, and they only line up by convention. The session-widget persistence lives in `atomWithStorage("elf:session-widget-layouts", ...)` keyed by session id, side-panel flags in `elf:*SurfaceEnabled` `atomWithStorage` plus a `fireflySurfacePreferencesAtom` last-tab, themes in `elf:theme` / `elf:colorScheme`, and the Palot plugin carries its own tool surface (`browser_*`, `open_side_panel`, `ui_state`, plus four MCP discovery tools) over a localhost bridge transport that is intentionally only used by Palot-spawned OpenCode servers (attached/pre-existing servers are unsupported). V2 must collapse these five sources into a single `PluginDescriptor` plus projections; the migration table at the end of this file enumerates all 18 current first-party side panels plus one explicit `defer` row, with each row bound to a target plugin id, family, tool surface, capability set, and rollout phase. The biggest planning caveats are: (a) `firefly-surface-registry.tsx` is currently a renderer-side **canonical** source for side panels and must be demoted to a projection, (b) `palot-bridge.js` already lives on the canonical plugin path so it can become the seed built-in plugin, (c) the `crm` / `bridges` / `oracle` / `ch5pm` / `pdf-review` / `pulse` panels are domain-specific firefly features whose plugin boundary needs design, and (d) the `surface.*` command ids that are hardcoded in `command-palette.tsx` are not contributed commands yet and must be re-issued by the per-panel plugins themselves.

---

## 1. Per-Family Inventory Tables

Classification key:

- **canonical** = authoritative source-of-truth for the family (will become the V2 `PluginDescriptor` contributor).
- **projection** = computed view of canonical data; safe to delete or regenerate from the canonical source.
- **consumer** = read-only renderer/main user of the data; not authoritative.

### 1.1 Side Panels (18 entries)

| Surface id | Current owner file (definition) | Current owner file (consumer) | Activation conditions | Persistence | Command ids | Classification |
|---|---|---|---|---|---|---|
| `review` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `apps/desktop/src/renderer/components/agent-detail.tsx`, `apps/desktop/src/renderer/components/command-palette.tsx` | Flag `elf:reviewSurfaceEnabled` (default true) AND `ctx.flags.review` AND `ctx.diffStats.fileCount > 0` | `side-panel.review` (`firefly-surface-registry.tsx:114`); also persists last tab in `elf:firefly-surface-preferences` | `surface.review.open` | canonical |
| `browser` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:browserPanelEnabled` (default true) AND `ctx.flags.browserPanelEnabled` | `side-panel.browser` | `surface.browser.open`, `surface.browser.toggle` | canonical |
| `notes` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:notesSurfaceEnabled` (default true) | `side-panel.notes` | `surface.notes.open`, `surface.notes.toggle` | canonical |
| `pulse` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:pulseSurfaceEnabled` (default false) | `side-panel.pulse` | `surface.pulse.open`, `surface.pulse.toggle` | canonical |
| `artifacts` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:artifactsSurfaceEnabled` (default true) | `side-panel.artifacts` | `surface.artifacts.open`, `surface.artifacts.toggle` | canonical |
| `memory` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:memorySurfaceEnabled` (default false) | `side-panel.memory` | `surface.memory.open`, `surface.memory.toggle` | canonical |
| `files` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:filesSurfaceEnabled` (default true) | `side-panel.files` | `surface.files.open`, `surface.files.toggle` | canonical |
| `terminal` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:terminalSurfaceEnabled` (default true) | `side-panel.terminal` | `surface.terminal.open`, `surface.terminal.toggle` | canonical |
| `editor` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:editorSurfaceEnabled` (default true) | `side-panel.editor` | `surface.editor.open`, `surface.editor.toggle` | canonical |
| `plugins` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:pluginsSurfaceEnabled` (default true) | `side-panel.plugins` | `surface.plugins.open`, `surface.plugins.toggle` | canonical |
| `bridges` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:bridgesSurfaceEnabled` (default true) | `side-panel.bridges` | `surface.bridges.open`, `surface.bridges.toggle` | canonical |
| `crm` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:crmSurfaceEnabled` (default true) | `side-panel.crm` | `surface.crm.open`, `surface.crm.toggle` | canonical |
| `studio` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:studioSurfaceEnabled` (default true) | `side-panel.studio` | `surface.studio.open`, `surface.studio.toggle` | canonical |
| `voice` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:voiceSurfaceEnabled` (default true) | `side-panel.voice` | `surface.voice.open`, `surface.voice.toggle` | canonical |
| `oracle` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:oracleSurfaceEnabled` (default true) | `side-panel.oracle` | `surface.oracle.open`, `surface.oracle.toggle` | canonical |
| `claude` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:claudeSurfaceEnabled` (default true) | `side-panel.claude` | `surface.claude.open`, `surface.claude.toggle` | canonical |
| `ch5pm` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:ch5pmSurfaceEnabled` (default false) | `side-panel.ch5pm` | `surface.ch5pm.open`, `surface.ch5pm.toggle` | canonical |
| `pdf-review` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `agent-detail.tsx`, `command-palette.tsx` | Flag `elf:pdfReviewSurfaceEnabled` (default false) | `side-panel.pdf-review` | `surface.pdfReview.open`, `surface.pdfReview.toggle` | canonical |

Notes on side panels:

- `SidePanelTabId` union is defined in **two** places that must stay in sync: `apps/desktop/src/renderer/atoms/ui.ts:25-43` and `apps/desktop/src/renderer/atoms/preferences.ts:26-45` (`FireflySurfacePreferences.lastSidePanelTab`). V2 must collapse these into a single contribution-declared id namespace. A third copy lives in `apps/desktop/src/shared/palot-bridge-schemas.ts:3-22` as `sidePanelTabValues`.
- The `surface.{id}.open` / `surface.{id}.toggle` command ids are **declared inside the registry** but **not registered** as actual commands anywhere -- `command-palette.tsx` builds its own dynamic toggle commands from feature-flag atoms instead of dispatching on the `commandIds` array. This is a real projection gap.
- `agent-detail.tsx:286` calls `getFireflySurfaceTabs(ctx)` to drive the tab bar; `command-palette.tsx:278` calls the same function for the "Surfaces" group. Both are consumer projections, not canonical sources.
- `getFireflySurfaceTabs` is the single projection function that fans the registry out to renderer consumers (`firefly-surface-registry.tsx:465-484`).

### 1.2 Session Widgets (2 entries)

| Widget id | Current owner file (definition) | Current owner file (consumer) | Activation conditions | Persistence | Classification |
|---|---|---|---|---|---|
| `session-task-list` | `apps/desktop/src/renderer/session-widget-registry.tsx` | `apps/desktop/src/renderer/components/session-widgets/session-widget-shell.tsx` | Always placed in `above-chat` zone; rendered if widget id present in `sessionWidgetLayoutFamily(sessionId).placement["above-chat"]` | `elf:session-widget-layouts` keyed by `sessionId`, schema in `atoms/session-widgets.ts:8-10` | canonical |
| `genui-artifacts` | `apps/desktop/src/renderer/session-widget-registry.tsx` | `session-widget-shell.tsx`, `apps/desktop/src/renderer/components/genui/genui-artifact-widget.tsx` | Placed in `chat-inline-right` zone; zone availability gated by `sessionWidgetZoneAvailabilityAtom` (currently `inlineRightEnabled: false` -- see `atoms/session-widgets.ts:48-50`) | same `elf:session-widget-layouts` storage | canonical |

Notes on widgets:

- `SessionWidgetZoneId = "above-chat" | "chat-inline-right"` is hardcoded in `atoms/session-widgets.ts:6` and the registry can only target these two zones. V2 must keep this a host-defined vocabulary.
- `moveSessionWidgetAtom` and `rehomeInlineWidgetsAtom` in `atoms/session-widgets.ts:52-107` are write-side actions; they are projection helpers, not canonical.
- `SessionWidgetId` union is closed (`"session-task-list" | "genui-artifacts"`), so adding a new widget today requires editing this type and the registry. V2 must source this from contributions.

### 1.3 Commands (multiple sub-surfaces)

| Sub-surface | Current owner file (definition) | Current owner file (consumer) | Activation | Persistence | Current command ids | Classification |
|---|---|---|---|---|---|---|
| `surface.{tab}.open` / `surface.{tab}.toggle` (18 pairs) | declared in `apps/desktop/src/renderer/firefly-surface-registry.tsx` (each entry has `commandIds: string[]`) | **not consumed as commands** -- `command-palette.tsx` builds its own feature-flag toggle items instead | static (always registered when surface is declared) | none beyond surface flag | `surface.review.open`, `surface.browser.open`, `surface.browser.toggle`, `surface.notes.open`, `surface.notes.toggle`, `surface.pulse.open`, `surface.pulse.toggle`, `surface.artifacts.open`, `surface.artifacts.toggle`, `surface.memory.open`, `surface.memory.toggle`, `surface.files.open`, `surface.files.toggle`, `surface.terminal.open`, `surface.terminal.toggle`, `surface.editor.open`, `surface.editor.toggle`, `surface.plugins.open`, `surface.plugins.toggle`, `surface.bridges.open`, `surface.bridges.toggle`, `surface.crm.open`, `surface.crm.toggle`, `surface.studio.open`, `surface.studio.toggle`, `surface.voice.open`, `surface.voice.toggle`, `surface.oracle.open`, `surface.oracle.toggle`, `surface.claude.open`, `surface.claude.toggle`, `surface.ch5pm.open`, `surface.ch5pm.toggle`, `surface.pdfReview.open`, `surface.pdfReview.toggle` | consumer (declared but not wired) |
| Surface enable/disable feature flags (16 toggles) | hardcoded in `apps/desktop/src/renderer/components/command-palette.tsx` `Features` group (lines ~425-613) | the palette itself | static + flag-state dependent | per-flag `elf:*SurfaceEnabled` atoms + `toggle*Surface` write atoms in `atoms/feature-flags.ts:110-180` | `Enable/Disable <Surface> Surface` (no stable id; rendered as a single palette group) | canonical (currently the only "command registry" that exists) |
| Theme switch | `apps/desktop/src/renderer/lib/themes.ts` `themes` array | `command-palette.tsx` `Appearance` group + `useThemeEffect` | static, derived from `themes: ThemeDefinition[]` | `elf:theme` `atomWithStorage` + `elf:colorScheme` | no id; rendered as palette items `Theme: <name>` | canonical |
| Window / preferences actions | hardcoded in `command-palette.tsx` | the palette | static | `elf:opaqueWindows` atom + `prefs:get-opaque-windows` / `prefs:set-opaque-windows` IPC | no id; rendered as palette items `Enable/Disable Transparency`, `Dark` / `Light` / `System`, `Reload Config` | canonical |
| Dev actions | `command-palette.tsx` `Developer` group (mock mode, react-scan) | the palette | static; react-scan gated by `import.meta.env.DEV` | `elf:isMockMode`, `elf:isReactScan` atoms | no id; rendered as palette items | canonical |
| Agent / session navigation | `command-palette.tsx` `Active Sessions` / `All Sessions` groups | the palette | dynamic, derived from `agents: Agent[]` | none | no id; rendered as palette items | consumer (no command contribution; just nav) |
| Server lifecycle | `useSessionRevert` in `apps/desktop/src/renderer/hooks/use-commands.ts` (`undo`/`redo`) | `command-palette.tsx` `Actions` group | static, gated by `canUndo` / `canRedo` | none | no id; rendered as palette items | canonical (posture only) |
| Fork session | `command-palette.tsx` `Fork Session` item | the palette | static, gated by `onForkSession` prop | none | no id | canonical (posture only) |
| Bridge localhost plugin tool-call (OpenCode tools) | `apps/desktop/src/main/palot-plugin/plugin.js` (no `commands` array; tools only) | OpenCode SDK tool runtime | n/a | n/a | `browser_status`, `browser_open`, `browser_navigate`, `browser_tabs`, `browser_click`, `browser_type`, `browser_scroll`, `open_side_panel`, `ui_state`, `search_tools`, `describe_tool`, `call_tool`, `tools_status` (13 total) | canonical (already plugin-owned) |

Notes on commands:

- The plan's V2 contribution family `commands` is currently **not realized** as a registry. `command-palette.tsx` enumerates palette groups by hand. V2 must introduce a command registry derived from plugin contributions + a small set of host-owned core commands.
- `commandIds` inside `firefly-surface-registry.tsx` is dead weight today: nothing reads it. V2 should re-validate that the plugin-contributed command ids match the surface's intent.

### 1.4 Themes (3 entries)

| Theme id | Current owner file (definition) | Current owner file (consumer) | Activation | Persistence | Classification |
|---|---|---|---|---|---|
| `default` (System) | `apps/desktop/src/renderer/lib/themes.ts:215-243` | `useThemeEffect` (`hooks/use-theme.ts`), `command-palette.tsx`, `useAvailableThemes` | always available; `colorScheme === "system"` defers to `prefers-color-scheme` | `elf:theme` (id) + `elf:colorScheme` (dark/light/system) | canonical |
| `cortex` (Cortex) | `apps/desktop/src/renderer/lib/themes.ts:119-139` | same | always available | same | canonical |
| `liquid-glass` (Liquid Glass) | `apps/desktop/src/renderer/lib/themes.ts:154-203` | same; rendered only if `useAvailableThemes` `platform === "darwin"` (see `hooks/use-theme.ts:144-148`) | `platforms: ["darwin"]` filter in `getAvailableThemes` | same | canonical |

Notes on themes:

- `packages/ui/src/styles/globals.css` is the visual baseline; the theme definitions are CSS custom-property overrides. The host applies classes and injects CSS into `<style id="elf-theme-vars">` from `useThemeEffect`. This **application** path is host-owned; the **contribution data** (id, name, cssVars, fonts, radius, density, glass) is what V2 should treat as the contribution shape.
- `window.elf.setNativeTheme` is the side-effect that syncs macOS native chrome tier with the CSS color scheme (`use-theme.ts:104-106`). V2 must keep this as host-owned.
- `getOrCreateStyleElement` injects CSS into a single style tag; multiple themes would not co-exist, so V2's theme contribution model should keep `apply = single-active` semantics.

### 1.5 Plugin-Ish Surfaces (5 sub-surfaces)

| Sub-surface | Current owner file | Role | Activation | Persistence | Classification |
|---|---|---|---|---|---|
| OpenCode plugin (`palot-bridge`) | `apps/desktop/src/main/palot-plugin/plugin.js` (canonical impl) re-exported via `apps/desktop/.opencode/plugins/palot-bridge.js`; loaded by `apps/desktop/src/main/opencode-manager.ts:414` via `OPENCODE_PLUGIN` env | Inject `<palot-browser-context>` system-prompt block; expose 13 tools; consume 5 callback seams (`resolve`, `dispatch`, `getUiState`, `listConnections`, `openSidePanel`) | Loaded by OpenCode server at startup (only on managed spawn); callbacks hydrated by `apps/desktop/src/main/palot-opencode-plugin-shim.ts` or HTTP `PALOT_BRIDGE_URL` fallback | none in plugin itself; tool calls push through action bus | canonical (closest thing to a V2 plugin today) |
| MCP connections | `apps/desktop/src/main/mcp-connections-runtime.ts`, `apps/desktop/src/main/mcp-connections-config.ts`; `apps/desktop/src/preload/index.ts:375-397` `mcpConnections.*` | Add/remove/configure MCP servers; browse catalog; login; test | static (always available in main); user-triggered | `mcp-connections:config-upsert` / `mcp-connections:register` IPC + on-disk `~/.config/elf/mcp-connections.json` | consumer (mcp is an *external* plugin-like system; V2 should treat it as host-owned capability, not a plugin) |
| Browser lanes | `apps/desktop/src/main/browser-lane-*.ts`; `apps/desktop/src/preload/index.ts:47-71` `browserLanes.*` | Spawn/teardown CDP-backed browsers; tab/session management | static; user-triggered | `~/.config/elf/browser-lanes/` | consumer (host-owned capability) |
| GenUI artifacts | `apps/desktop/src/renderer/components/genui/*`; `apps/desktop/src/renderer/atoms/chat.ts` (genui atoms); `docs/genui-artifact-architecture.md` | Dynamic React component surface for chat-time artifacts (provenance-checked, scoped to session) | dynamic, derived from assistant message parts | `elfdb` SQLite | consumer (host-rendered; not a plugin surface, but a host-owned dynamic UI contribution shape) |
| Automations | `apps/desktop/src/main/automation/*`; `apps/desktop/src/preload/index.ts:410-431` `automation.*` | Scheduled agent runs with RRule | static, runtime schedules | `~/.local/share/elf/automations/<id>/` per `apps/desktop/src/main/automation/paths.ts` | consumer (posture) |

Notes on plugin-ish surfaces:

- Only the **OpenCode plugin** is a real V2-shaped plugin today. The others are host-owned subsystems that look pluggable from the renderer's perspective.
- `palot-bridge.js` is a **compatibility shim** per `AGENTS.md` ("canonical source is `apps/desktop/src/main/palot-plugin/plugin.js`; `apps/desktop/.opencode/plugins/palot-bridge.js` is only a compatibility shim"). The 21-line re-export shape declares the file as a default-exported OpenCode plugin module.

---

## 2. Source-of-Truth Diagram (Current System)

```
                              +----------------------------------------+
                              |  CURRENT: 5 hardcoded sources          |
                              |  No PluginDescriptor. No broker.       |
                              +----------------------------------------+

   +--------------------------+    static export    +----------------------------------+
   | firefly-surface-         | ------------------>| FIREFLY_SURFACE_REGISTRY         |
   | registry.tsx             |                    | (array of 18 FireflySurfaceDef)   |
   |  - 18 surface defs       |                    |  - id, title, icon                |
   |  - commandIds[] per def  |                    |  - enabledFlag {key, atom}        |
   |  - persistenceKey        |                    |  - persistenceKey                 |
   |  - target, spawn(ctx)    |                    |  - target, spawn(ctx)             |
   | CANONICAL (side panels)  |                    |  - commandIds, telemetryNs        |
   +--------------------------+                    |  - availability(ctx) fn           |
            |                                      +--------------+-------------------+
            | reads toggle atoms                                  | getFireflySurfaceTabs(ctx)
            |                                                      | (projection fn)
            v                                                      v
   +--------------------------+                    +----------------------------------+
   | atoms/feature-flags.ts   |                    | agent-detail.tsx (tab bar)       |
   |  - reviewSurfaceEnabled  |                    | command-palette.tsx (Surfaces    |
   |  - browserPanelEnabled   |                    |  group, ~line 614)               |
   |  - notesSurfaceEnabled   |                    | CONSUMERS                        |
   |  - ... 18 flag atoms     |                    +----------------------------------+
   |  - toggle*Surface atoms  |                                          |
   |  - fireflySurfaceFlagAtoms|                                         | openSidePanelTab(tab)
   |  - fireflySurfaceLabels  |                                          v
   |  - fireflySurfaceDefaults|                    +----------------------------------+
   | CANONICAL (per-surface   |                    | atoms/ui.ts                      |
   |  feature flag bit)       |                    |  - sidePanelOpenAtom             |
   +--------------------------+                    |  - sidePanelActiveTabAtom        |
                                                    |  - openSidePanelTabAtom          |
   +--------------------------+                    |  - closeSidePanelAtom            |
   | session-widget-          | -----------------> |  - SidePanelTabId union          |
   | registry.tsx             |                    | CONSUMER (UI state)              |
   |  - 2 widget defs         |                    | CANONICAL for id union           |
   |  - defaultZoneId, render |                    +----------------------------------+
   | CANONICAL (widgets)      |                                          |
   +--------------------------+                                          | IPC palot:open-side-panel
            | reads/writes layout                                        |
            v                                                           v
   +--------------------------+                    +----------------------------------+
   | atoms/session-widgets.ts |                    | preload/index.ts:72-98           |
   |  - SessionWidgetId union |                    |  window.elf.palot.openSidePanel  |
   |  - SessionWidgetZoneId   |                    |  onOpenSidePanel(cb)             |
   |  - sessionWidgetLayout-  |                    |  getUiStateSnapshot              |
   |    StorageAtom (Persist) |                    +----------------------------------+
   |  - moveSessionWidgetAtom |                                          |
   |  - rehomeInlineWidgets   |                                          | IPC
   | CANONICAL (widget layout)|                                          v
   +--------------------------+                                          +----------------------------------+
            | read by                                                    | main/palot-browser-ipc.ts        |
            v                                                           |  - getUiStateSnapshot            |
   +--------------------------+                                           |  - setUiStateSnapshot            |
   | session-widget-shell.tsx |                                           |  - localhost bridge (127.0.0.1)  |
   | CONSUMER (rendering)     |                                           |  - mirrors side-panel state      |
   +--------------------------+                                           | CANONICAL (UI state authority)   |
                                                                           +----------------------------------+
                                                                                       |
                                                                                       | HTTP PALOT_BRIDGE_URL
                                                                                       v
   +--------------------------+                  +------------------------------------------+
   | lib/themes.ts            | ---------------->| themes: ThemeDefinition[]                |
   |  - cortexTheme           |                  |  (3 entries: default, cortex,           |
   |  - liquidGlassTheme      |                  |   liquid-glass)                         |
   |  - systemTheme           |                  |  + ThemeDefinition type with cssVars,   |
   |  - themes: ThemeDef[]    |                  |    fonts, radius, density, glass,        |
   |  - getAvailableThemes    |                  |    platforms                            |
   |  - getTheme              |                  | CANONICAL                               |
   | CANONICAL (theme data)   |                  +------------------------------------------+
   +--------------------------+                                          |
                                                                          | read by
                                                                          v
                                                                  +------------------------------+
                                                                  | hooks/use-theme.ts           |
                                                                  |  - useThemeEffect            |
                                                                  |  - buildThemeCss             |
                                                                  |  - setNativeTheme IPC        |
                                                                  |  - cssVars injection         |
                                                                  |  - dark/light class swap     |
                                                                  | CONSUMER (host apply path)   |
                                                                  +------------------------------+
                                                                                       |
                                                                                       | mirror to <html>
                                                                                       v
                                                                  +------------------------------+
                                                                  | <html class="dark theme-x">  |
                                                                  | <style id="elf-theme-vars">  |
                                                                  | packages/ui/globals.css      |
                                                                  | RENDERER-OWNED               |
                                                                  +------------------------------+

   +--------------------------+                  +------------------------------------------+
   | components/              | -- reads ------> | side-panel tabs (defined in              |
   | command-palette.tsx      |                  | firefly-surface-registry)                |
   |  - 4 hardcoded groups:   |                  | themes (themes.ts)                       |
   |    Actions / Appearance  |                  | toggle atoms (feature-flags.ts)          |
   |    Window / Color Scheme |                  | session-widgets layout                   |
   |    Features / Surfaces   |                  | agents / sessions (services/backend.ts)  |
   |    Developer / Active    |                  |                                          |
   |  - Features group has    |                  |                                          |
   |    hardcoded per-surface |                  |                                          |
   |    enable/disable items  |                  |                                          |
   | CANONICAL (the only real |                  |                                          |
   |  command registry today) |                  |                                          |
   +--------------------------+                  | CONSUMER projection                       |
            |                                  +------------------------------------------+
            | Calls window.elf.palot / palot bridge
            v
   +--------------------------------------------------------------------------------------+
   | OpenCode side (managed server only)                                                 |
   |                                                                                      |
   | apps/desktop/.opencode/plugins/palot-bridge.js                                       |
   |   \- re-exports apps/desktop/src/main/palot-plugin/plugin.js (canonical impl)         |
   |                                                                                      |
   | plugin.js (477 lines, ESM .js so OpenCode can require it without TS build)           |
   |   - hook: experimental.chat.system.transform -> <palot-browser-context> block        |
   |   - hook: event (listens session.idle only)                                          |
   |   - tools: browser_status, browser_open, browser_navigate, browser_tabs,             |
   |            browser_click, browser_type, browser_scroll, open_side_panel, ui_state,    |
   |            search_tools, describe_tool, call_tool, tools_status (13 total)            |
   |   - callback injection: resolve, dispatch, getUiState, listConnections, openSidePanel |
   |   - bridge transport fallback via PALOT_BRIDGE_URL + PALOT_BRIDGE_TOKEN               |
   | CANONICAL (OpenCode plugin)                                                          |
   +--------------------------------------------------------------------------------------+
            | Loaded by
            v
   +--------------------------------------------------------------------------------------+
   | opencode-manager.ts spawns `opencode serve` with OPENCODE_PLUGIN env mutation        |
   | (only on managed spawn; attached/pre-existing servers are unsupported)                |
   | plugins valid: loadPalotPluginModule() in palot-opencode-plugin-shim.ts               |
   | reuses palot-resolver.ts, palot-browser-dispatcher.ts, palot-browser-ipc.ts          |
   |                                                                                      |
   | shared zod schemas: apps/desktop/src/shared/palot-bridge-schemas.ts                   |
   |   - sidePanelTabValues, sidePanelTabSchema                                           |
   |   - browserActionEventSchema, palotUiStateSnapshotSchema, browserStateSnapshotSchema  |
   |   - dispatchBrowserToolInputSchema, palotToolArgsSchemas                             |
   +--------------------------------------------------------------------------------------+

   +--------------------------------------------------------------------------------------+
   | main/ipc-handlers.ts                                                                 |
   |   - palot:browser-state-snapshot, palot:browser-action, palot:binding-get/-set/-     |
   |     release, palot:ui-state-snapshot, palot:open-side-panel                          |
   |   - opencode:ensure, opencode:url, opencode:stop, opencode:restart,                   |
   |     opencode:active-sessions                                                         |
   |   - browser:open-external                                                            |
   |   - mcp-connections:config-upsert/-remove, :catalog-browse/-search, :register,       |
   |     :login, :test, :records-list                                                     |
   |   - prefs:get-opaque-windows, prefs:set-opaque-windows, app:relaunch                 |
   |   - theme:set-native, theme:accent-color, theme:accent-color-changed                 |
   | CANONICAL for IPC channel surface                                                    |
   +--------------------------------------------------------------------------------------+
```

Summary of canonical/projection/consumer split:

| Family | Canonical | Projection | Consumer |
|---|---|---|---|
| Side panels | `firefly-surface-registry.tsx` (id, flag, persistence, target, spawn) | `getFireflySurfaceTabs(ctx)`, `command-palette.tsx` Surfaces group, `agent-detail.tsx` tab bar | `atoms/feature-flags.ts` (toggle atoms), `atoms/ui.ts` (open/active tab atoms), `atoms/preferences.ts` (lastSidePanelTab) |
| Session widgets | `session-widget-registry.tsx` (id, defaultZone, render) + `atoms/session-widgets.ts` (zone id, layout atom, move/rehome) | `sessionWidgetLayoutFamily(sessionId)` | `session-widget-shell.tsx`, `genui-artifact-widget.tsx` |
| Commands | `command-palette.tsx` (the only "registry" in source) + per-surface `commandIds` declared in registry (unwired) | none (all hand-rendered) | `agents.find`, theme availability, toggle atoms, `useSessionRevert` |
| Themes | `lib/themes.ts` (theme data) + `atoms/preferences.ts` (`themeAtom`, `colorSchemeAtom`) | `getAvailableThemes(platform)`, `getTheme(id)`, `useThemeEffect` | `<html>` class, `#elf-theme-vars` style tag, `window.elf.setNativeTheme` IPC |
| Plugin-ish | `palot-plugin/plugin.js` (OpenCode plugin) | `palot-bridge.js` shim, `palot-opencode-plugin-shim.ts` loader | `opencode-manager.ts` (env inject), `palot-browser-ipc.ts` (bridge), `mcp-connections-*` (host capability, not a plugin) |

---

## 3. Side-Panel Migration Table (18 ids + 1 `defer` row)

Per the plan, V2 collapses `SidePanelTabId` into a contribution-declared id namespace. Each row below maps a current first-party side panel to a target V2 plugin id, family, tool surface, required capabilities, and a rollout phase. Plugin ids are tentative; the manifest format will be defined in Wave 2 Task 7.

| # | Current id (`firefly-surface-registry.tsx`) | Current owner file | Target V2 plugin id | Target contribution family | Target tool surface | Required capabilities | Rollout phase |
|---|---|---|---|---|---|---|---|
| 1 | `review` | `firefly-surface-registry.tsx:96-118` + `components/review/review-panel.tsx` | `firefly.changes` (built-in) | `panels` (slot: `side-panel` / zone: n/a) + `commands` (`surface.review.open`, `surface.review.toggle`) + `tools` (`plugin.firefly.changes.state`, optional `plugin.firefly.changes.open`) | `plugin.firefly.changes.state` reads session diff stats; renderer-side panel reactively renders against projected state | `bridge:session-read` (read diff/session), `host-ui:panel-render` | **Phase 1** (must-have, used by undo/redo and review) |
| 2 | `browser` | `firefly-surface-registry.tsx:120-138` + `components/side-panel/browser-panel.tsx` | `firefly.browser` (built-in) | `panels` + `commands` + `tools` (already has the largest tool set in `palot-plugin/plugin.js`: `browser_status`, `browser_open`, `browser_navigate`, `browser_tabs`, `browser_click`, `browser_type`, `browser_scroll`, `open_side_panel`, `ui_state`) | full `plugin.firefly.browser.*` set; projection re-issues existing tool ids from the V2 manifest | `bridge:session-read`, `bridge:session-write`, `browser:lane-control`, `host-ui:panel-render`, `host-commands:register`, `tool:register` | **Phase 1** (most mature today; canonical Palot plugin path becomes seed built-in) |
| 3 | `notes` | `firefly-surface-registry.tsx:140-158` + `components/side-panel/notes-panel.tsx` | `firefly.notes` (built-in) | `panels` + `commands` (`surface.notes.open`/`toggle`) + `tools` (`plugin.firefly.notes.append`, `plugin.firefly.notes.list`) | host-owned storage; plugin provides Zod schema for note payloads | `host-ui:panel-render`, `host-commands:register`, `tool:register`, optional `fs:read-write` (scoped to project) | **Phase 2** (low coupling; first-party notes storage moves to plugin-local state) |
| 4 | `pulse` | `firefly-surface-registry.tsx:160-178` + `components/side-panel/pulse-panel.tsx` | `firefly.pulse` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.pulse.status`, `plugin.firefly.pulse.history` (read-only telemetry) | `bridge:session-read`, `host-ui:panel-render` | **Phase 3** (default off; not in default tab set) |
| 5 | `artifacts` | `firefly-surface-registry.tsx:180-198` + `components/side-panel/artifacts-panel.tsx` | `firefly.artifacts` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.artifacts.list`, `plugin.firefly.artifacts.pin`, `plugin.firefly.artifacts.unpin` (delegates to GenUI artifact surface) | `bridge:session-read`, `bridge:session-write`, `host-ui:panel-render`, `tool:register` | **Phase 1** (already in default tab set; has GenUI widget projection in `chat-inline-right`) |
| 6 | `memory` | `firefly-surface-registry.tsx:200-218` + `components/side-panel/memory-panel.tsx` | `firefly.memory` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.memory.recall`, `plugin.firefly.memory.pin` (per `atoms/preferences.ts` `memoryModeAtom` and `memoryApiConfigAtom`) | `bridge:session-read`, `bridge:session-write`, `host-ui:panel-render`, `tool:register` | **Phase 2** (depends on memory mode policy) |
| 7 | `files` | `firefly-surface-registry.tsx:220-238` + `components/side-panel/files-panel.tsx` | `firefly.files` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.files.list`, `plugin.firefly.files.read`, `plugin.firefly.files.tree` (proxies `files:list-directory`, `files:read-directory-tree`, `files:read-text`) | `fs:read`, `host-ui:panel-render`, `tool:register` | **Phase 1** (default on; first-party files projection) |
| 8 | `terminal` | `firefly-surface-registry.tsx:240-258` + `components/side-panel/terminal-panel.tsx` | `firefly.terminal` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.terminal.spawn`, `plugin.firefly.terminal.write`, `plugin.firefly.terminal.resize`, `plugin.firefly.terminal.kill` (proxies `pty:*` IPC) | `pty:spawn`, `pty:write`, `host-ui:panel-render`, `tool:register` | **Phase 2** (PTY needs host sandbox; capability-heavy) |
| 9 | `editor` | `firefly-surface-registry.tsx:260-278` + `components/side-panel/editor-panel.tsx` | `firefly.editor` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.editor.open`, `plugin.firefly.editor.save` | `fs:read-write`, `host-ui:panel-render`, `tool:register` | **Phase 2** |
| 10 | `plugins` | `firefly-surface-registry.tsx:280-298` + `components/side-panel/plugins-panel.tsx` | `firefly.plugins` (built-in, operator surface) | `panels` + `commands` + `tools` | `plugin.firefly.plugins.list`, `plugin.firefly.plugins.describe`, `plugin.firefly.plugins.enable`, `plugin.firefly.plugins.disable`, `plugin.firefly.plugins.uninstall`, `plugin.firefly.plugins.install` (host generates from `PluginDescriptor` + `PluginInstance` state) | `host-ui:panel-render`, `host-commands:register`, `tool:register`, `bridge:plugin-meta` | **Phase 1** (operator surface; required for any non-built-in plugin to work) |
| 11 | `bridges` | `firefly-surface-registry.tsx:300-318` + `components/side-panel/bridges-panel.tsx` | `firefly.bridges` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.bridges.list`, `plugin.firefly.bridges.activity`, `plugin.firefly.bridges.upsert` (proxies existing `bridges:list` / `bridges:activity` IPC) | `bridge:connectors-read`, `bridge:connectors-write`, `host-ui:panel-render`, `tool:register` | **Phase 3** (connectors are a posture/inventory surface today; V2 split needs design) |
| 12 | `crm` | `firefly-surface-registry.tsx:320-338` + `components/side-panel/crm-panel.tsx` | `firefly.crm` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.crm.list`, `plugin.firefly.crm.saveContact`, `plugin.firefly.crm.deleteContact` (proxies `crm:load`/`crm:save-contact`/`crm:delete-contact`) | `fs:read-write` (CRM JSON), `host-ui:panel-render`, `tool:register` | **Phase 3** (domain-specific; defer until plugin authority model is solid) |
| 13 | `studio` | `firefly-surface-registry.tsx:340-358` + `components/side-panel/studio-panel.tsx` | `firefly.studio` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.studio.open`, `plugin.firefly.studio.preview`, `plugin.firefly.studio.convert` (uses `office:convert`) | `fs:read-write`, `host-ui:panel-render`, `tool:register` | **Phase 3** |
| 14 | `voice` | `firefly-surface-registry.tsx:360-378` + `components/side-panel/voice-panel.tsx` | `firefly.voice` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.voice.start`, `plugin.firefly.voice.stop`, `plugin.firefly.voice.transcribe` | `ai:audio-input`, `ai:audio-output`, `host-ui:panel-render`, `tool:register` | **Phase 3** (capability-heavy; depends on `ai:*` capability class) |
| 15 | `oracle` | `firefly-surface-registry.tsx:380-398` + `components/side-panel/oracle-panel.tsx` | `firefly.oracle` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.oracle.list`, `plugin.firefly.oracle.create`, `plugin.firefly.oracle.rename`, `plugin.firefly.oracle.delete`, `plugin.firefly.oracle.appshot` (proxies `oracles:list` / `oracles:create` / `oracles:rename` / `oracles:delete` / `oracles:appshot`) | `pty:spawn`, `shell:exec`, `host-ui:panel-render`, `tool:register` | **Phase 2** |
| 16 | `claude` | `firefly-surface-registry.tsx:400-418` + `components/side-panel/claude-panel.tsx` | `firefly.claude` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.claude.import`, `plugin.firefly.claude.preview`, `plugin.firefly.claude.execute` (uses `onboarding:scan-provider`, `onboarding:preview-migration`, `onboarding:execute-migration`) | `fs:read`, `host-ui:panel-render`, `tool:register` | **Phase 2** (migration feature; not a runtime surface) |
| 17 | `ch5pm` | `firefly-surface-registry.tsx:420-438` + `ch5pm-dashboard/panel` | `firefly.ch5pm` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.ch5pm.dashboard`, `plugin.firefly.ch5pm.metrics` | `bridge:pm-read`, `host-ui:panel-render`, `tool:register` | **Phase 3** (ch5-specific; defer until first-party plugin path is proven) |
| 18 | `pdf-review` | `firefly-surface-registry.tsx:440-458` + `components/side-panel/pdf-review-panel.tsx` | `firefly.pdf-review` (built-in) | `panels` + `commands` + `tools` | `plugin.firefly.pdf-review.open`, `plugin.firefly.pdf-review.comment`, `plugin.firefly.pdf-review.cite` | `fs:read`, `host-ui:panel-render`, `tool:register` | **Phase 2** |
| 19 | `defer` | n/a | (no target plugin yet) | n/a | n/a | n/a | n/a |

Notes on the migration table:

- **Phase 1** = foundations: side panels that already have stable UI, a working Palot plugin tool path, or that the operator needs to see the plugin system working. Concretely: `review`, `browser`, `artifacts`, `files`, `plugins` (the operator surface for the plugin system itself).
- **Phase 2** = post-foundation migration: side panels with their own state or capability burden (`notes`, `memory`, `terminal`, `editor`, `oracle`, `claude`, `pdf-review`). These need the manifest/broker/tool runtime from Wave 2-3 to be stable first.
- **Phase 3** = domain-specific or experimental: `pulse`, `bridges`, `crm`, `studio`, `voice`, `ch5pm`. These are the most likely to surface real capability/broker gaps; the `defer` row covers any id not enumerated above.
- `SidePanelTabId` union (`atoms/ui.ts:25-43`, `atoms/preferences.ts:26-45`) and the `sidePanelTabValues` array (`shared/palot-bridge-schemas.ts:3-22`) must all derive from the contribution manifest in V2. Today they are three independently-maintained copies of the same list.
- The `commandIds` array in `firefly-surface-registry.tsx` is **declared** but never consumed. In V2 each plugin's manifest should re-declare its contributed command ids; the command palette in V2 reads from a derived projection, not from the per-surface registry.

---

## 4. Cross-References and Caveats

- **Managed-server-only**: The OpenCode plugin (`palot-bridge`) is loaded only when Palot spawns the OpenCode server. Attached/pre-existing OpenCode servers are intentionally unsupported for Palot bridge features today (`docs/palot-opencode-plugin-bridge.md` "Existing server path" caveat). V2 must call this out in its plan explicitly (Task 14 is expected to decide the V2 stance).
- **OpenCode callback injection**: The plugin declares `createPalotPlugin({ resolve, dispatch, getUiState, openSidePanel, listConnections })` but the live standalone OpenCode runtime cannot import Electron main callbacks directly. The repo's current truth is: (1) direct injected callbacks are used when present; (2) otherwise a localhost bridge (`PALOT_BRIDGE_URL` + `PALOT_BRIDGE_TOKEN`) is the fallback; (3) the `palot-opencode-plugin-shim.ts` still hydrates local test/runtime callbacks when the factory seam is available (`palot-opencode-plugin-shim.ts:87-107`). V2 must not regress this fallback path.
- **Schemas in `shared/palot-bridge-schemas.ts`**: This module already centralizes the Zod surface for the Palot bridge. V2's manifest schema should reuse and supersede these (`sidePanelTabSchema`, `palotToolArgsSchemas`, `palotUiStateSnapshotSchema`).
- **Three copies of `SidePanelTabId`**: `atoms/ui.ts`, `atoms/preferences.ts`, `shared/palot-bridge-schemas.ts`. V2 must collapse.
- **Wired command ids**: The `surface.{id}.open` / `surface.{id}.toggle` strings are declared in the registry's `commandIds` but are not actually dispatched by the command palette (which builds its own toggle items from `toggle*SurfaceAtom`). V2 must wire these properly or remove them.
- **Persistence keys**: `elf:session-widget-layouts` (widgets), `elf:*SurfaceEnabled` (per-surface flags), `elf:firefly-surface-preferences` (last tab), `elf:theme` / `elf:colorScheme` / `elf:opaqueWindows` (theme/window), `elf:isMockMode` / `elf:isReactScan` (dev). All will be retained, but the **namespace mapping** (e.g. `elf:firefly.browser.flag`) should be derivable from the manifest in V2.
- **GenUI artifact widget is already an internal zone** (`chat-inline-right`); V2 should keep it as a host-defined zone rather than letting plugins mint their own.
- **Per panel, the `defaultOn: boolean` in `firefly-surface-registry.tsx` is the closest thing to a contribution-level default**, but it only controls the **tab visibility default**, not the panel's "open" state. V2 should distinguish `defaultActive` from `defaultOn`.
- **There is no `plugin://` or `palot-plugin://` URL scheme today**; V2 will need to define one for plugin-local assets and for the `apps/desktop/.opencode/plugins/palot-bridge.js` compatibility shim path.

---

## 5. Source-of-Truth Inventory Snapshot

| Source-of-truth concern | Current canonical location | V2 canonical target |
|---|---|---|
| Side-panel definitions | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `PluginDescriptor.contributes.panels[]` (one entry per built-in / first-party plugin) |
| Side-panel id union | `atoms/ui.ts:25-43` + `atoms/preferences.ts:26-45` + `shared/palot-bridge-schemas.ts:3-22` | derived from `panels[]` projection in main |
| Per-surface feature flag | `atoms/feature-flags.ts` `*SurfaceEnabledAtom` (18 atoms) | derived from `panels[i].defaultOn` + per-session/per-project override storage |
| Session widget definitions | `apps/desktop/src/renderer/session-widget-registry.tsx` | `PluginDescriptor.contributes.widgets[]` |
| Widget zone ids | `atoms/session-widgets.ts:6` (closed) | host-defined `WidgetZoneId` vocabulary (kept closed) |
| Widget placement | `atoms/session-widgets.ts` `sessionWidgetLayoutStorageAtom` | plugin-contributed `widgets[i].defaultZone` + user drag/drop mutations |
| Theme definitions | `apps/desktop/src/renderer/lib/themes.ts` `themes: ThemeDefinition[]` | `PluginDescriptor.contributes.themes[]` (data-only; host applies) |
| Theme application | `apps/desktop/src/renderer/hooks/use-theme.ts` `useThemeEffect` + `<style id="elf-theme-vars">` | stays host-owned; themes remain data-only contributions |
| OpenCode plugin | `apps/desktop/src/main/palot-plugin/plugin.js` (canonical) re-exported via `apps/desktop/.opencode/plugins/palot-bridge.js` | becomes the seed **built-in plugin** in V2 (e.g. `firefly.browser` + `firefly.changes` etc. package up its current tool surface) |
| Plugin Zod schemas | `apps/desktop/src/shared/palot-bridge-schemas.ts` | superseded/extended by V2 `PluginManifest` schema (Task 7) |
| Capability broker | none today (only `prefs:*` IPC + ad hoc per-channel `withLogging`) | V2 `CapabilityBroker` (Task 10) -- must cover `host-ui:panel-render`, `host-commands:register`, `tool:register`, `bridge:session-read`, `bridge:session-write`, `browser:lane-control`, `theme:apply`, etc. |
| Plugin host runtime | none today; plugin lives inside OpenCode's runtime | V2 `PluginHost` (utilityProcess / worker_thread per Task 11) -- required for non-OpenCode plugins |
| Plugin descriptor lifecycle | none today; plugin file is loaded once at managed OpenCode server startup | V2 `PluginInstance` + `PluginSessionHandle` (Task 7 + Task 15) |

---

## 6. Outstanding Unknowns (carried into Wave 2)

These items are not resolvable in Task 1 and must be picked up by the corresponding downstream tasks:

1. **Plugin identity / id collision policy** for built-in vs first-party vs third-party plugins (Task 6).
2. **Capability taxonomy**: full set of capability classes for the broker (Task 10). Today's `bridge:session-read`, `browser:lane-control`, `theme:apply`, `command:register`, `tool:register` are inferred from existing code; Task 10 must ratify them.
3. **iframe / webview escape hatch** scope (Task 8). Currently zero `iframe` usage in the 18 side panels; this is a clean slate.
4. **Attached-server / pre-existing OpenCode server** stance for V2 (Task 14). Today it is "intentionally unsupported".
5. **GenUI artifact placement** (`inline` / `above-chat` / `chat-inline-right` / `side-panel`) is host-owned dynamic UI, not a plugin contribution family. V2 must decide whether to keep it as a host projection or to expose it as a "host primitive" plugins can request.
6. **Workspace-link / cross-repo plugins**: `packages/configconv-cli` and `packages/ui` are shared packages. V2 should clarify whether plugins are first-party bundled into the desktop app or shipped via package workspaces (Task 26).
