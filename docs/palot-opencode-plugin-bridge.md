# Palot <-> OpenCode Plugin Bridge <!-- oc:id=sec_aa -->

Use this doc when working on the runtime seam between Palot (Elf desktop), the OpenCode server, the Palot bridge plugin, browser lanes, and side-panel UI control.

This is the canonical explanation of:
- how the Palot plugin is loaded
- which server instances get the plugin
- what tools the plugin exposes
- how plugin calls resolve Palot state
- how browser and UI control flow through main/preload/renderer seams
- where schemas are typed today and where Zod is still missing

## Scope and current truth <!-- oc:id=sec_ab -->

Current implementation is desktop-first and managed-server-first.

Important consequence:
- the Palot bridge plugin is injected only when Palot itself spawns the OpenCode server
- if Palot attaches to an already-running OpenCode server on the machine, Palot does not currently retrofit the plugin into that existing process
- Palot can still read and render local state in the app without the plugin, but OpenCode tool calling and prompt-context injection depend on the plugin being loaded in the target server process

Primary code paths:
- managed server spawn: `apps/desktop/src/main/opencode-manager.ts:414`
- plugin module file: `apps/desktop/.opencode/plugins/palot-bridge.js`
- plugin shape validator: `apps/desktop/src/main/palot-opencode-plugin-shim.ts:11`

## Runtime topology <!-- oc:id=sec_ac -->

There are five layers involved:

1. OpenCode server process <!-- oc:id=item_aa -->
- started by Palot or discovered as already running
- plugin runs inside this process when injected through `OPENCODE_PLUGIN`

1. Electron main process <!-- oc:id=item_ab -->
- owns Palot authority state
- owns session binding store
- owns browser lane registry and runtime operations
- owns browser action bus and mirrored UI snapshot
- owns IPC handlers exposed to preload/renderer

1. Electron preload bridge <!-- oc:id=item_ac -->
- exposes a typed `window.elf` API to the renderer
- acts as the only renderer-safe entrypoint into main-process Palot APIs

1. Renderer <!-- oc:id=item_ad -->
- shows the browser panel and side-panel UI
- reacts to `palot:open-side-panel` and browser action events
- does not own the authoritative session binding or resolver logic

1. Browser lane runtime <!-- oc:id=item_ae -->
- local or remote browser stream / CDP transport
- provides navigable lane URLs, tab management, and stream health

## Plugin loading <!-- oc:id=sec_ad -->

### Managed server path <!-- oc:id=sec_ae -->

When Palot spawns `opencode serve`, it mutates the child env before spawn:
- plugin path constant: `apps/desktop/src/main/opencode-manager.ts:56`
- env mutation: `apps/desktop/src/main/opencode-manager.ts:414`
- final spawn env includes `OPENCODE_PLUGIN`: `apps/desktop/src/main/opencode-manager.ts:454`
- child process spawn: `apps/desktop/src/main/opencode-manager.ts:469`

Behavior:
1. Palot computes `PALOT_PLUGIN_PATH` <!-- oc:id=item_af -->
1. `appendPalotPlugin()` verifies the file exists <!-- oc:id=item_ag -->
1. `appendPalotPlugin()` validates module shape with `loadPalotPluginModule()` <!-- oc:id=item_ah -->
1. `appendPalotPlugin()` appends the file path into `env.OPENCODE_PLUGIN` <!-- oc:id=item_ai -->
1. the spawned `opencode serve` process receives that env var <!-- oc:id=item_aj -->

Relevant refs:
- `apps/desktop/src/main/opencode-manager.ts:414`
- `apps/desktop/src/main/opencode-manager.ts:422`
- `apps/desktop/src/main/opencode-manager.ts:466`

### Existing server path <!-- oc:id=sec_af -->

When Palot detects an already-running same-user server, it attaches to it instead of spawning a new one:
- ensure path: `apps/desktop/src/main/opencode-manager.ts:74`
- existing server detection: `apps/desktop/src/main/opencode-manager.ts:103`

Current limitation:
- no code path edits the environment of an already-running server process
- no code path writes plugin config into a global OpenCode config file for out-of-process reuse
- therefore plugin availability is not guaranteed when Palot attaches to some preexisting server

This is the most important operational caveat in the current design.

## Plugin module contract <!-- oc:id=sec_ag -->

Palot validates only the minimal module shape:
- interface: `apps/desktop/src/main/palot-opencode-plugin-shim.ts:6`
- loader: `apps/desktop/src/main/palot-opencode-plugin-shim.ts:11`

Accepted module shape:
- default export `{ id, server }`, or
- named exports `id` and `server`

The loader currently checks only:
- `id` is a string
- `server` exists

It does not execute the plugin.
It does not validate tool names, hook names, or callback injection wiring.

Tests:
- `apps/desktop/src/main/palot-opencode-plugin-shim.test.ts:14`
- `apps/desktop/src/main/palot-opencode-plugin-shim.test.ts:28`

## What the plugin exports <!-- oc:id=sec_ah -->

Plugin factory:
- `createPalotPlugin(...)`: `apps/desktop/.opencode/plugins/palot-bridge.js:153`

Default export:
- `id: "palot-bridge"`: `apps/desktop/.opencode/plugins/palot-bridge.js:303`
- `server`: `apps/desktop/.opencode/plugins/palot-bridge.js:304`

The plugin exposes two main categories:
- hooks
- tools

### Hook: system prompt injection <!-- oc:id=sec_ai -->

Hook name:
- `experimental.chat.system.transform`: `apps/desktop/.opencode/plugins/palot-bridge.js:156`

Behavior:
1. OpenCode calls the hook with `input.sessionID` <!-- oc:id=item_ak -->
1. plugin calls `resolveBinding(input.sessionID)` <!-- oc:id=item_al -->
1. plugin builds a compact `<palot-browser-context>` block <!-- oc:id=item_am -->
1. plugin appends it to `output.system` <!-- oc:id=item_an -->

Context block fields today:
- `session_id`
- `binding_status`
- `lane_id`
- `magic_browser_session_id`
- `viewer_url_hint`
- `current_url`
- `side_panel_open`
- `side_panel_tab`
- `side_panel_tabs`

Implementation:
- builder: `apps/desktop/.opencode/plugins/palot-bridge.js:17`
- hook body: `apps/desktop/.opencode/plugins/palot-bridge.js:156`

### Hook: event <!-- oc:id=sec_aj -->

Hook name:
- `event`: `apps/desktop/.opencode/plugins/palot-bridge.js:163`

Current behavior:
- listens only for `session.idle`
- re-runs `resolveBinding(sessionID)` opportunistically

This is not a state sync transport by itself. It is only a lightweight refresh touchpoint.

## Plugin tools <!-- oc:id=sec_ak -->

The plugin currently exposes these tools:

### MCP compact runtime tools <!-- oc:id=sec_al -->
- `mcp_search`: `apps/desktop/.opencode/plugins/palot-bridge.js:170`
- `mcp_describe`: `apps/desktop/.opencode/plugins/palot-bridge.js:182`
- `mcp_call`: `apps/desktop/.opencode/plugins/palot-bridge.js:200`
- `mcp_status`: `apps/desktop/.opencode/plugins/palot-bridge.js:235`

These are related but separate from Palot browser control.

### Browser tools <!-- oc:id=sec_am -->
- `palot_browser_status`: `apps/desktop/.opencode/plugins/palot-bridge.js:244`
- `palot_browser_open`: `apps/desktop/.opencode/plugins/palot-bridge.js:249`
- `palot_browser_navigate`: `apps/desktop/.opencode/plugins/palot-bridge.js:254`
- `palot_browser_tabs`: `apps/desktop/.opencode/plugins/palot-bridge.js:259`
- `palot_browser_click`: `apps/desktop/.opencode/plugins/palot-bridge.js:264`
- `palot_browser_type`: `apps/desktop/.opencode/plugins/palot-bridge.js:269`
- `palot_browser_scroll`: `apps/desktop/.opencode/plugins/palot-bridge.js:274`

### UI tools <!-- oc:id=sec_an -->
- `palot_open_side_panel`: `apps/desktop/.opencode/plugins/palot-bridge.js:279`
- `palot_ui_state`: `apps/desktop/.opencode/plugins/palot-bridge.js:284`

## Callback injection seam <!-- oc:id=sec_ao -->

The plugin is written to accept injected callbacks:
- `resolve`
- `dispatch`
- `getUiState`
- `openSidePanel`

Factory signature:
- `apps/desktop/.opencode/plugins/palot-bridge.js:153`

Inside the plugin:
- `resolve` -> `createResolver()`: `apps/desktop/.opencode/plugins/palot-bridge.js:36`
- `dispatch` -> browser tool handler: `apps/desktop/.opencode/plugins/palot-bridge.js:71`
- `getUiState` -> UI state tool: `apps/desktop/.opencode/plugins/palot-bridge.js:144`
- `openSidePanel` -> UI command tool: `apps/desktop/.opencode/plugins/palot-bridge.js:119`

Important truth:
- this repo documents the callback seam clearly
- but the exact runtime site where OpenCode passes these callbacks into `createPalotPlugin(...)` is not yet visible as a completed host-side bridge in this repo
- the spawn path injects the plugin file into OpenCode, but the host-side callback hydration path is still the critical seam to verify during runtime integration

This is the main architecture gap to keep in mind.

## Resolver contract <!-- oc:id=sec_ap -->

The hard seam is:

```ts
resolve(opencodeSessionId) -> {
  binding,
  nonSecretSnapshot,
  opaqueActionTarget,
  uiState?
}
```

Current source:
- resolver entry: `apps/desktop/src/main/palot-resolver.ts:14`

What it reads:
- binding authority from `getSessionBinding(...)`
- browser lane snapshot from `getBrowserStateSnapshot(...)`

Supporting state sources:
- browser/main snapshot state: `apps/desktop/src/main/palot-browser-ipc.ts:116`
- binding store: `apps/desktop/src/main/palot-session-binding.ts:86`

Tests:
- `apps/desktop/src/main/palot-resolver.test.ts:16`

### Session binding authority model <!-- oc:id=sec_aq -->

Canonical session binding store:
- `apps/desktop/src/main/palot-session-binding.ts`

Authority contract:
- `agentAuthority = OpenCode session id`: `apps/desktop/src/main/palot-session-binding.ts:17`
- `browserAuthority = Magic Browser session id`: `apps/desktop/src/main/palot-session-binding.ts:19`
- `transportAuthority = Browser lane id`: `apps/desktop/src/main/palot-session-binding.ts:20`

Persisted fields:
- `openCodeSessionId`
- `browserLaneId`
- `magicBrowserSessionId`
- `status`
- timestamps

Persistence file:
- `~/.config/elf/opencode/session-bindings.json`
- path getter: `apps/desktop/src/main/palot-session-binding.ts:131`

Lifecycle updates from OpenCode event stream:
- adapter: `apps/desktop/src/main/palot-session-binding-store.ts:76`
- responds to `session.created`, `session.updated`, `session.idle`, `session.deleted`

## Browser snapshot and action bus seam <!-- oc:id=sec_ar -->

Main-owned action bus and snapshot mirror:
- `apps/desktop/src/main/palot-browser-ipc.ts`

Responsibilities:
- per-session sequence numbers: `apps/desktop/src/main/palot-browser-ipc.ts:19`
- takeover rejection for tool requests: `apps/desktop/src/main/palot-browser-ipc.ts:25`
- lane snapshot mirror: `apps/desktop/src/main/palot-browser-ipc.ts:98`
- derived browser snapshot by OpenCode session: `apps/desktop/src/main/palot-browser-ipc.ts:116`
- publish event and broadcast to renderer windows: `apps/desktop/src/main/palot-browser-ipc.ts:138`
- mirrored UI snapshot: `apps/desktop/src/main/palot-browser-ipc.ts:158`

Renderer receives only derived state:
- not binding secrets
- not SecretCache entries
- not viewer auth tokens

## Browser tool dispatch seam <!-- oc:id=sec_as -->

Browser tool dispatcher:
- `apps/desktop/src/main/palot-browser-dispatcher.ts:88`

Dispatch algorithm:
1. resolve binding for `sessionId` <!-- oc:id=item_ao -->
1. fail with `unbound_session` if no `browserLaneId` <!-- oc:id=item_ap -->
1. publish a `toolRequest` browser action event <!-- oc:id=item_aq -->
1. route specific tool names to browser lane operations <!-- oc:id=item_ar -->
1. publish a `toolResult` browser action event <!-- oc:id=item_as -->
1. return `{ status, resultSummary }` <!-- oc:id=item_at -->

Actual live operations today:
- `palot_browser_open` / `palot_browser_navigate` -> `navigateBrowserLane(...)`: `apps/desktop/src/main/palot-browser-dispatcher.ts:98`
- `palot_browser_tabs` -> tab create/activate/close/list shim: `apps/desktop/src/main/palot-browser-dispatcher.ts:72`

Still partial today:
- `click`
- `type`
- `scroll`

Those tool names exist in the plugin, but dispatcher implementation is still minimal for them.

## Magic Browser seam <!-- oc:id=sec_at -->

Magic Browser bootstrap helper:
- `apps/desktop/src/main/palot-magic-browser.ts:25`

What it does:
- derives deterministic `magicBrowserSessionId`
- derives viewer token
- derives `viewerUrl`
- persists only non-secret session binding fields back to binding store
- keeps token in main-only secret cache

Key rule:
- secrets stay in main-only secret cache
- tokens do not go into tool output, renderer state, or persisted binding JSON

## IPC / preload / renderer seam <!-- oc:id=sec_au -->

### Main IPC handlers <!-- oc:id=sec_av -->

Palot-specific handlers:
- browser snapshot: `apps/desktop/src/main/ipc-handlers.ts:398`
- browser action publish: `apps/desktop/src/main/ipc-handlers.ts:404`
- binding get: `apps/desktop/src/main/ipc-handlers.ts:410`
- binding set: `apps/desktop/src/main/ipc-handlers.ts:414`
- binding release: `apps/desktop/src/main/ipc-handlers.ts:421`
- UI snapshot: `apps/desktop/src/main/ipc-handlers.ts:427`
- open side panel: `apps/desktop/src/main/ipc-handlers.ts:431`

### Preload bridge <!-- oc:id=sec_aw -->

Renderer-safe `window.elf.palot` surface:
- `apps/desktop/src/preload/index.ts:72`

Methods:
- `getBrowserStateSnapshot(sessionId)`
- `publishBrowserAction({ event })`
- `getBinding(sessionId)`
- `setBinding(binding)`
- `releaseBinding(sessionId)`
- `getUiStateSnapshot()`
- `openSidePanel(tab)`
- `onOpenSidePanel(callback)`
- `onBrowserActions(callback)`

### Renderer API wrapper <!-- oc:id=sec_ax -->

Renderer uses backend facade, not raw preload in most places:
- `apps/desktop/src/renderer/services/backend.ts:229`

Methods:
- `fetchPalotSessionBinding(...)`: `apps/desktop/src/renderer/services/backend.ts:229`
- `fetchPalotUiStateSnapshot(...)`: `apps/desktop/src/renderer/services/backend.ts:236`
- `openPalotSidePanel(...)`: `apps/desktop/src/renderer/services/backend.ts:243`
- `subscribeToPalotOpenSidePanel(...)`: `apps/desktop/src/renderer/services/backend.ts:250`
- `subscribeToBrowserActions(...)`: `apps/desktop/src/renderer/services/backend.ts:259`

### Renderer side-panel reaction path <!-- oc:id=sec_ay -->

Current reaction path:
- active tab registry computed in `apps/desktop/src/renderer/components/agent-detail.tsx:286`
- available tabs mirrored into main/UI snapshot path: `apps/desktop/src/renderer/components/agent-detail.tsx:291`
- renderer subscribes to `palot:open-side-panel`: `apps/desktop/src/renderer/components/agent-detail.tsx:295`
- renderer restores open side panel from main snapshot on mount: `apps/desktop/src/renderer/components/agent-detail.tsx:305`

This is the visible UI manipulation seam.

## Exact tool/API inventory <!-- oc:id=sec_az -->

### OpenCode plugin hook APIs used <!-- oc:id=sec_ba -->
- `experimental.chat.system.transform`
- `event`
- `tool.{name}.execute(args, context)`

### Main-process resolver APIs <!-- oc:id=sec_bb -->
- `resolvePalotSessionBinding(opencodeSessionId)`: `apps/desktop/src/main/palot-resolver.ts:14`
- `getBrowserStateSnapshot(sessionId)`: `apps/desktop/src/main/palot-browser-ipc.ts:116`
- `getUiStateSnapshot()`: `apps/desktop/src/main/palot-browser-ipc.ts:158`

### Main-process browser APIs <!-- oc:id=sec_bc -->
- `dispatchBrowserTool(...)`: `apps/desktop/src/main/palot-browser-dispatcher.ts:88`
- `navigateBrowserLane(...)`
- `createBrowserLaneTab(...)`
- `activateBrowserLaneTab(...)`
- `closeBrowserLaneTab(...)`

### IPC APIs <!-- oc:id=sec_bd -->
- `palot:browser-state-snapshot`
- `palot:browser-action`
- `palot:binding-get`
- `palot:binding-set`
- `palot:binding-release`
- `palot:ui-state-snapshot`
- `palot:open-side-panel`
- event channel `palot:browser-actions`
- event channel `palot:open-side-panel`

### Renderer facade APIs <!-- oc:id=sec_be -->
- `fetchPalotSessionBinding`
- `fetchPalotUiStateSnapshot`
- `openPalotSidePanel`
- `subscribeToPalotOpenSidePanel`
- `subscribeToBrowserActions`

## Schemas and Zod status <!-- oc:id=sec_bf -->

### Current state <!-- oc:id=sec_bg -->

Today the seam is mostly TypeScript-typed, not Zod-backed.

Examples:
- plugin args are placeholder schemas like `{ type: "navigate" }`: `apps/desktop/.opencode/plugins/palot-bridge.js:1`
- browser dispatch input is TypeScript-only: `apps/desktop/src/main/palot-browser-dispatcher.ts:11`
- IPC payloads are TypeScript-only through preload types in `apps/desktop/src/preload/api.d.ts`
- binding JSON persistence uses structural JSON parsing only: `apps/desktop/src/main/palot-session-binding.ts:29`

Repo evidence for Zod:
- `packages/configconv` depends on `zod`: `packages/configconv/package.json`
- `packages/ui` depends on `zod`: `packages/ui/package.json`

But this Palot/OpenCode seam does not currently use Zod.

### Recommended clean seam <!-- oc:id=sec_bh -->

If we want this contract to be the durable source of truth, add Zod at these boundaries:

1. Plugin tool args <!-- oc:id=item_au -->
- each tool should export a real schema
- parse inside `execute()` before dispatch

1. Resolver output <!-- oc:id=item_av -->
- define a Zod schema for the exact non-secret resolver payload passed to plugin hooks

1. Browser dispatcher input <!-- oc:id=item_aw -->
- parse tool dispatch payloads before route branching

1. IPC payloads <!-- oc:id=item_ax -->
- parse `openSidePanel(tab)` and browser action publish payloads in main handlers

1. Persisted binding store file <!-- oc:id=item_ay -->
- validate JSON file structure before treating it as a `SessionBindingStoreFile`

Suggested schema ownership:
- put shared runtime seam schemas in `apps/desktop/src/shared/` or a dedicated `apps/desktop/src/shared/palot-bridge-schema.ts`
- import the same schema into main, preload-facing validation, and plugin code where possible

## Gaps and caveats <!-- oc:id=sec_bi -->

These are the important known gaps to document honestly:

1. Plugin injection is not global <!-- oc:id=item_az -->
- only guaranteed for Palot-spawned managed servers
- not guaranteed when attaching to pre-existing OpenCode servers

1. Callback hydration path remains the key seam to verify <!-- oc:id=item_ba -->
- plugin code expects `resolve` / `dispatch` / `getUiState` / `openSidePanel`
- spawn path loads the plugin file, but this repo does not yet show a single obvious host-runtime site that instantiates the plugin with those callbacks inside OpenCode

1. Browser action tools are partially implemented <!-- oc:id=item_bb -->
- navigate/open/tabs are real
- click/type/scroll are still architectural placeholders

1. Renderer mirrors UI state but does not own authority <!-- oc:id=item_bc -->
- main owns the mirrored UI snapshot for plugin reads
- renderer reacts to commands and visual state

1. The resolver must remain renderer-inaccessible <!-- oc:id=item_bd -->
- current architecture intent matches this
- keep it that way

## Tests and supporting evidence <!-- oc:id=sec_bj -->

Primary tests:
- plugin shim: `apps/desktop/src/main/palot-opencode-plugin-shim.test.ts`
- plugin behavior: `apps/desktop/.opencode/plugins/palot-bridge.test.js`
- resolver: `apps/desktop/src/main/palot-resolver.test.ts`
- browser IPC snapshot: `apps/desktop/src/main/palot-browser-ipc.test.ts`
- browser dispatcher: `apps/desktop/src/main/palot-browser-dispatcher.test.ts`

Planning and prior architecture:
- master plan: `.sisyphus/plans/palot-browser-side-panel-opencode-magic-browser-cursor.md`
- MCP runbook mentioning compact runtime tools: `docs/mcp-connections-runbook.md:5`

## Operational guidance <!-- oc:id=sec_bk -->

If you are talking about "the Palot/OpenCode seam", use these questions:

- Is the OpenCode server managed by Palot or pre-existing?
- Is the plugin definitely loaded in that server process?
- Are we reading authoritative state from main or accidentally from renderer?
- Is this a browser lane operation, a session binding read, or a side-panel UI command?
- Is the payload validated structurally only, or by a real shared schema?

## Next hardening steps <!-- oc:id=sec_bl -->

1. Add shared Zod schemas for tool args, resolver output, and IPC payloads. <!-- oc:id=item_be -->
1. Document and verify the actual host-runtime callback injection path into `createPalotPlugin(...)`. <!-- oc:id=item_bf -->
1. Make plugin auto-install/global config strategy explicit if Palot must support attaching to long-lived preexisting OpenCode servers. <!-- oc:id=item_bg -->
1. Finish real implementations for click/type/scroll dispatch. <!-- oc:id=item_bh -->
1. Add one end-to-end verification path that proves: <!-- oc:id=item_bi -->
- plugin loaded
- `experimental.chat.system.transform` injected context
- `palot_open_side_panel` visibly opened the tab
- `palot_browser_navigate` emitted request/result events and navigated the lane