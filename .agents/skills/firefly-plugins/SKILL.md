---
name: firefly-plugins
description: How to build a Firefly desktop plugin in the palot/elf app — the V2 manifest + capability-broker system. Use when adding or changing a plugin, an inline widget or side-panel surface, a command, an agent tool, a theme, a host capability token, or the catalog/dispatch wiring. Triggers on "add a plugin", "inline widget", "above-chat toolbar", "side panel", "host capability", "devmux toolbar", "firefly plugin".
license: MIT
metadata:
  author: palot
  version: "1.0.0"
---

# Firefly Plugin System (V2)

The desktop app (`apps/desktop`, internally "elf") extends its UI and agent
surface through **plugins**. A plugin is a **manifest** — pure data — that
declares what it contributes. The host (Electron main process) validates the
manifest, derives a descriptor, projects it into the renderer, and owns all
privileged execution behind a **capability broker**.

This is the VS Code model: declarative `contributes`, host-executed
`registerCommand`-style handlers, and a curated capability surface
(`vscode.tasks` / `vscode.env`). Use it; do not bolt feature-specific IPC onto
`window.elf`.

## Mental model

```
manifest (pure data)  ──parse/derive──►  catalog (main)  ──project──►  renderer
  contributes: { panels, widgets, commands, tools, themes, components, navSidebars }
  capabilities: ["host:…", "fs:read", …]            │
                                                     ▼
   UI click / agent tool call ──IPC──►  dispatch (main)  ──broker check──►  host handler (Node)
```

- **Manifest is data only.** A plugin ships **no backend code today**. Anything
  Node-only (filesystem, child processes, a Node library) runs in a
  **host handler** gated by a capability token.
- **Built-ins render host-bundled React components.** The manifest declares the
  contribution + capabilities + commands/tools; the actual component is wired
  through a renderer registry (see gotchas). `render.mode: "host-reconciler"`.
- **The capability broker is the gate**, not the grant list. See gotchas.

## Surfaces (contribution families) — the vocabulary

| Term | Family | Where it renders | Gets |
|---|---|---|---|
| **Inline widget** | `widgets` | a session zone: `above-chat` (toolbar strip over the chat) or `chat-inline-right` (right rail) | `{ agent }` |
| **Side panel** | `panels` (`formFactor: "side-panel-tab"`) | its own tab in the right side-panel | host-routed |
| **Main pane** | `panels` (`formFactor: "main-pane"`) | the main content area | host-routed |
| **Nav sidebar entry** | `navSidebars` | left nav | host-routed |
| **Command** | `commands` | command palette / keybinding / programmatic | host handler |
| **Agent tool** | `tools` | OpenCode/agent-callable | host handler |
| **Theme** | `themes` | token map applied by host | — |
| **GenUI component** | `components` | declarative gen-UI artifact | declarative props |

"Inline widget" (e.g. the Task list, the DevMux toolbar) ≠ "side panel" (e.g.
Notes). Pick the inline widget for a compact strip scoped to the open session;
pick a side panel when it needs its own real estate.

## Key files

- `apps/desktop/src/shared/firefly-plugin/manifest.ts` — the Zod `PluginManifest` schema (source of truth for every field).
- `apps/desktop/src/shared/firefly-plugin/capabilities.ts` — the **closed** capability catalog + broker rules.
- `apps/desktop/src/main/firefly-plugin/capability-broker.ts` — runtime grant decisions.
- `apps/desktop/src/main/firefly-plugin/catalog.ts` — `BUILT_IN_MANIFESTS` (register built-ins here) + descriptor/projection build.
- `apps/desktop/src/main/firefly-plugin/dispatch.ts` — host command/tool handler registry (`registerHostCommand` / `registerHostTool`) and `registerBuiltInHostCommands()` (called at boot).
- `apps/desktop/src/main/firefly-plugin/ipc.ts` — the `firefly-plugin:*` IPC channels (`invoke`, `invoke-tool`, list/describe/…).
- `apps/desktop/src/renderer/hooks/use-firefly-plugins.ts` — renderer client: `invokePluginCommand(...)` → `window.elf.plugins.invoke`.
- `apps/desktop/src/renderer/session-widget-registry.tsx` — **renders inline widgets**: `SESSION_WIDGET_REGISTRY` (id → component).
- `apps/desktop/src/renderer/atoms/session-widgets.ts` — `SessionWidgetId` union + `DEFAULT_LAYOUT` placement.
- `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx` — **renders panels**: `PLUGIN_PANEL_COMPONENTS` (id → component).
- `apps/desktop/plugins/<name>/manifest.ts` — a plugin's TS manifest.
- `scripts/build-plugins.ts` — the per-plugin build/validation pipeline (runs in `build`).

## Building a plugin that needs a host (Node-only) callback

This is the common case (read a file, run a CLI/library, spawn a process). Three
layers, all in-grain:

### 1. Declare or reuse a capability token

`apps/desktop/src/shared/firefly-plugin/capabilities.ts` holds a **closed**
catalog. To add a host power, add an entry to `HOST_CAPABILITIES`:

```ts
"host:devmux.read":    { group: "host", verb: "devmux.read",    risk: "low" },
"host:devmux.control": { group: "host", verb: "devmux.control", risk: "medium" },
```

Pick the risk tier deliberately — it is the real gate (see gotchas). Model a
scoped power (`host:devmux.control`), never raw `shell:exec`, when the plugin
acts only on things the project already declares. If a built-in should get it
without an explicit per-session grant, also add it to
`BUILT_IN_DEFAULT_CAPABILITIES` (and keep it OUT of `NEVER_AUTO_GRANT`, which
`capabilities.test.ts` enforces).

### 2. Implement the host service (main process)

Put the Node-only logic in `apps/desktop/src/main/<feature>/service.ts`. This is
the **only** module that imports the Node library / Electron API. **Lazy-import
(`await import(...)`) heavy or ESM-only deps inside functions** so they never
enter the boot graph or the bun test module graph. Throw typed errors (CH5
fail-fast); never silently fall back.

### 3. Register host handlers + declare the manifest

- Add handlers in `dispatch.ts` via `registerHostCommand(pluginId, commandId, fn)`
  (UI-invoked) and/or `registerHostTool(pluginId, toolId, fn)` (agent-invoked),
  then call your `registerXHostHandlers()` from `registerBuiltInHostCommands()`.
  Both call the same service functions.
- The manifest declares the `widgets`/`panels`, the `commands`, the `tools`, and
  the `capabilities` superset, plus `activationEvents`.
- Register the manifest in `BUILT_IN_MANIFESTS` (`catalog.ts`).
- For an inline widget: add the id to `SessionWidgetId`, add a row to
  `SESSION_WIDGET_REGISTRY` with `render: ({ agent }) => <YourWidget agent={agent} />`,
  and add the id to `DEFAULT_LAYOUT.placement["above-chat"]`.
- The widget calls `invokePluginCommand({ pluginId, commandId, args })` from
  `use-firefly-plugins.ts`.

## Gotchas (read these before you start)

1. **Plugins ship no backend code (yet).** The worker host
   (`worker-supervisor.ts`, `utility-process-host.ts`) exists but built-ins run
   their handlers **in the main process** via `dispatch.ts`; the worker has no
   request RPC. So Node work goes in a host service + host handler, not in the
   plugin. (The migration target is an out-of-process extension host; the
   capability contract stays identical, only the transport changes.)

2. **The capability broker gates by risk + `NEVER_AUTO_GRANT`, not by the grant
   list — for built-ins.** A `built-in` plugin auto-grants ANY token that is
   neither `critical` risk nor in `NEVER_AUTO_GRANT`, regardless of
   `grantedTokens`. So: `low`/`medium` host tokens "just work" for built-ins;
   `critical` (e.g. `shell:exec`) always needs explicit consent; tokens in
   `NEVER_AUTO_GRANT` need an explicit grant that the command-dispatch path does
   not yet thread. Until per-session command consent exists, keep a built-in's
   required tokens out of `NEVER_AUTO_GRANT`.

3. **Inline widgets and panels render through STATIC renderer registries**, not
   from the manifest. The manifest `widgets`/`panels` entry drives the catalog,
   capability gating, commands, and availability — but the rendered component
   comes from `SESSION_WIDGET_REGISTRY` (widgets) / `PLUGIN_PANEL_COMPONENTS`
   (panels). You must touch both. The card chrome (border, title, drag handle)
   is supplied by `SessionWidgetCard`; your widget renders only the body.

4. **New widgets only auto-appear in NEW sessions.** Per-session layouts persist
   to `localStorage` (`elf:session-widget-layouts`); existing sessions keep their
   stored placement and won't show a newly added widget. Test in a fresh session.

5. **`catalog.ts` is renderer-importable** (`use-firefly-plugins.ts` imports
   `buildPluginCatalog`). Therefore **manifests must be pure data** — no
   Electron/Node imports at module load. Keep `shell`/`fs`/native libs in
   main-only service modules, lazy-imported.

6. **The plugin invoke IPC is Electron-only — support the web build with a second
   transport.** `invokePluginCommand` → `window.elf.plugins.invoke`; in the web
   build `window.elf` is absent. A widget with no web story must **hide itself**
   (catch + render null). To make it work in the web build (the current visual
   hot path — see AGENTS.md), add a **Hono route in `apps/server`** that calls
   the same runtime-neutral host service, and a renderer client that branches on
   `isElectron` (IPC) vs a `fetch` to the server (web). Keep the host service
   free of Electron/DOM so `apps/server` can use it. Note: importing `apps/desktop`
   files into `apps/server` by **relative path** fails (`composite`/`rootDir`);
   the DevMux route instead adapts the shared `@chriscode/devmux` library directly,
   emitting the same JSON shapes. The capability broker currently gates only the
   IPC path; a server route needs its own check once untrusted plugins exist.

7. **Command args are NOT schema-validated; tool args ARE.** `commands` carry no
   `args` field — the handler receives raw `args` and must read them defensively.
   `tools` declare a Zod `args` shape that the dispatcher validates before the
   handler runs. Expose an action as a **tool** when you also want the agent to
   call it (and validation for free), as a **command** for UI clicks.

8. **Id rules** (enforced by Zod): plugin id `firefly.built-in.<area>` for
   built-ins; command ids are short (`a-zA-Z0-9-`, no dots) and must not use
   reserved prefixes (`firefly.`/`surface.`/`plugins.`/`plugin.`); tool ids use
   `plugin.<pluginId>.<name>` (dots allowed, not the `plugins.` prefix).

9. **`build-plugins.ts` rules:** a built-in plugin keeps `manifest.ts` only (no
   `manifest.json` — a disk manifest claiming `built-in` trust is quarantined);
   the dir must export exactly one V2 manifest; workers (`worker/index.ts`) are
   the only emitted built-in artifact.

10. **URLs / external open:** don't build a plugin capability for this — the
    renderer already has `openExternalUrl(url)` in `services/backend.ts`
    (`window.elf.openExternal` in Electron, `window.open` in the web build). Embed
    a localhost service in-app with a plain `<iframe>` — no app-side CSP blocks it
    (only the target's own `X-Frame-Options`/`frame-ancestors` would).

11. **Cross-surface (plugin → plugin) communication is a renderer action, and the
    TARGET surface owns the API.** All surfaces render in the same renderer, so one
    surface drives another through a shared write-only **action atom** or a hook the
    target exports — not by reaching into the target's internals. Example: the DevMux
    toolbar's "In app" opens a service in the **Browser** side panel via
    `useOpenInBrowserPanel()` (`components/side-panel/open-in-browser-panel.ts`).
    The browser surface owns that hook and hides its own complexity (the panel only
    renders an `<iframe>` for a `direct-iframe` browser *lane*, so the hook
    ensures/reuses one, makes it active, sets the URL, and opens the panel). The
    caller stays ignorant of lanes. This is pure atoms + HTTP, so it works in both
    builds. (A capability-brokered, host-routed surface-command bus — gated by e.g.
    `host:browser.tab-control` — is the future formalization; today it's a direct
    renderer call.)

## Worked example: `firefly.built-in.devmux-toolbar`

An inline `above-chat` widget that reads the active project's
`devmux.config.json`, lists its DevMux services, shows live running state, and
launches them (open in the Browser side panel, or the system browser). Works in
**both** the Electron and web builds. It is the canonical "plugin that needs a
host callback" AND "plugin that hands off to another surface". Files:

- `apps/desktop/plugins/devmux-toolbar/manifest.ts` — widget + commands + tools + capabilities (`host:devmux.read`, `host:devmux.control`).
- `apps/desktop/src/main/devmux/service.ts` — the runtime-neutral host service wrapping `@chriscode/devmux` (lazy ESM import; no Electron/DOM).
- `apps/desktop/src/shared/firefly-plugin/capabilities.ts` — `host:devmux.read` / `host:devmux.control`.
- `apps/desktop/src/main/firefly-plugin/dispatch.ts` — `registerDevmuxHostHandlers()` (commands + tools → service); the Electron transport.
- `apps/desktop/src/main/firefly-plugin/catalog.ts` — manifest registered in `BUILT_IN_MANIFESTS`.
- `apps/server/src/routes/devmux.ts` — the **web** transport (`/api/devmux/list|status|ensure`), adapting `@chriscode/devmux` directly.
- `apps/desktop/src/renderer/services/devmux.ts` — renderer client that picks IPC (Electron) vs server `fetch` (web).
- `apps/desktop/src/renderer/components/side-panel/open-in-browser-panel.ts` — the Browser surface's `useOpenInBrowserPanel()` API (plugin → surface handoff; owns its lane management).
- `apps/desktop/src/renderer/components/devmux/devmux-toolbar-widget.tsx` — the host-bundled component (devmux client + `useOpenInBrowserPanel` + `backend.openExternalUrl`).
- `apps/desktop/src/renderer/session-widget-registry.tsx` + `atoms/session-widgets.ts` — registry row + `SessionWidgetId` + default placement.

DevMux library notes (`@chriscode/devmux`, ESM-only, shells out to `tmux`):
`loadConfig(startDir)` walks UP to find the config (there is **no**
`loadConfigExact`); `getAllStatus(config)` → live `ServiceStatus[]`;
`ensureService(config, name, { timeout })` is idempotent start+health-wait;
service URL = `status.proxyUrl ?? http://localhost:${status.resolvedPort ?? status.port}`.

## Verify

- Typecheck: `cd apps/desktop && bunx tsgo --noEmit`.
- Tests: `cd apps/desktop && bun test src/shared/firefly-plugin/capabilities.test.ts src/main/firefly-plugin/dispatch.test.ts src/main/firefly-plugin/catalog.test.ts`.
- Manifest validates in the build pipeline: `bun scripts/build-plugins.ts`.
- Host path headlessly (no Electron UI): import `registerBuiltInHostCommands` +
  `invokePluginCommand`/`invokePluginTool` from `dispatch.ts`, register, and
  invoke your command with a real `projectDir` — the dispatcher runs the broker
  → handler → service exactly as the renderer does over IPC.
- Web transport headlessly: `curl -X POST localhost:30206/api/devmux/status -H 'content-type: application/json' -d '{"projectDir":"<repo>"}'`.
- Live UI (web is the visual hot path): `bun run dev`, open `localhost:20883`,
  open a **new** session in a project that has the relevant config, and confirm
  the widget in the `above-chat` zone.
