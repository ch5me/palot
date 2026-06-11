# Task 2: Palot/OpenCode Bridge & Session-Scoped Tool Seam Inventory

## What This Means for V2 (summary)

The current Palot bridge is a single first-party OpenCode plugin (`palot-bridge`) injected via `OPENCODE_PLUGIN` into a server process that Palot itself spawns. It is **not** a generalized plugin system. It is one plugin with thirteen tools, four bridge actions over a localhost HTTP seam, and a main-process side that owns session bindings, browser action buses, and the renderer-visible UI snapshot. The bridge is a *facade*, not a runtime: the plugin module contract validates `id` + `server` only, there is no manifest, no capability broker, no per-tool scopes, and no per-session tool gate. Session scope is implicit: every call carries `context.sessionID` from the OpenCode runtime and the resolver is the only state authority. The "managed-server-only" caveat is real and load-bearing: when Palot attaches to a pre-existing OpenCode server (`opencode-manager.ts:74`, `opencode-manager.ts:103`), the plugin is **not** retrofitted, so all thirteen tools and the `<elf-context>` system prompt block are silently absent. V2 must treat the bridge as a transport seam that lives behind a generalized `PluginDescriptor` + `PluginSessionHandle` model, move all magic strings (e.g. `VALID_SIDE_PANEL_TABS`, `PRODUCT_CONTROL_TOOLS`) into the descriptor, replace the localhost fallback bridge with a session-scoped host runtime, and explicitly write a managed vs attached server policy up front. V2.0 keeps the managed-only boundary; V2.1 generalizes to attached servers via a dedicated plugin install pathway.

---

## 1. Per-Tool / Per-Hook Inventory

13 tools + 2 hooks shipped by the canonical plugin file `apps/desktop/src/main/palot-plugin/plugin.js`. The compatibility shim `apps/desktop/.opencode/plugins/palot-bridge.js` re-exports the same module (it is not an alternate implementation).

| # | Tool / Hook name | Plugin args schema (Zod) | Bridge action | IPC channel(s) | Main handler / authority | Renderer facade wrapper | V2 projection target |
|---|---|---|---|---|---|---|---|
| 1 | `search_tools` (hook-shaped tool) | inline: `{ query: z.string().optional() }` (plugin.js:303) | none — static stub | none | none (plugin self-handles, returns fixture) | none | Plugin business tool — must move to a connection-driven projection; today it is a fixture |
| 2 | `describe_tool` | inline: `{ serverId?, toolName? }` (plugin.js:315) | none — static stub | none | none (plugin self-handles) | none | Plugin business tool — fixture; V2 should source from MCP connection records (`listMcpConnectionRecords`) |
| 3 | `call_tool` | inline: `{ query, serverId?, toolName?, state? }` (plugin.js:333) | none — local validation only | none | none (plugin self-handles) | none | Plugin business tool — proxy to MCP connection; current returns a "queued" envelope, no actual call |
| 4 | `tools_status` | inline: `{ serverId? }` (plugin.js:373) | none — local stub | none | none (plugin self-handles) | none | Plugin business tool — should derive from MCP connection runtime health |
| 5 | `browser_status` | `palotBrowserStatusArgsShape` (schemas.ts:285), `palotToolArgsSchemas.browser_status` (schemas.ts:334) | `dispatch-browser-tool` (plugin.js:217) | `palot:browser-state-snapshot` (ipc-handlers.ts:405) | `dispatchBrowserTool` -> `palot-browser-dispatcher.ts:84` -> `resolvePalotSessionBinding` -> returns status JSON | `fetchBrowserStateSnapshot` (preload/index.ts:73) | Surface control wrapper — host validates, plugin routes; pair with `plugin.browser.status` introspection |
| 6 | `browser_open` | `palotBrowserOpenArgsShape` (schemas.ts:286) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `navigateBrowserLane` (dispatcher.ts:103) | `fetchBrowserStateSnapshot` | Surface control wrapper — host owns browser lane operations |
| 7 | `browser_navigate` | `palotBrowserNavigateArgsShape` (schemas.ts:289) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `navigateBrowserLane` | `fetchBrowserStateSnapshot` | Surface control wrapper |
| 8 | `browser_tabs` | `palotBrowserTabsArgsShape` (schemas.ts:292) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `dispatchTabsAction` (dispatcher.ts:65) | `fetchBrowserStateSnapshot` | Surface control wrapper |
| 9 | `browser_click` | `palotBrowserClickArgsShape` (schemas.ts:297) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `clickBrowserLane` (dispatcher.ts:111) | `fetchBrowserStateSnapshot` | Surface control wrapper — only `x/y/button/clickCount` are used; `selector` is dead-coded (raises `geometry_low_confidence` when `__geometry_low_confidence__`) |
| 10 | `browser_type` | `palotBrowserTypeArgsShape` (schemas.ts:306) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `typeBrowserLane` (dispatcher.ts:119) | `fetchBrowserStateSnapshot` | Surface control wrapper |
| 11 | `browser_scroll` | `palotBrowserScrollArgsShape` (schemas.ts:311) | `dispatch-browser-tool` | `palot:browser-state-snapshot` | `dispatchBrowserTool` -> `scrollBrowserLane` (dispatcher.ts:125) | `fetchBrowserStateSnapshot` | Surface control wrapper |
| 12 | `open_side_panel` | `palotOpenSidePanelArgsShape` (schemas.ts:318), `palotOpenSidePanelArgsSchema` (schemas.ts:330) | `open-side-panel` (plugin.js:255) | `palot:open-side-panel` (ipc-handlers.ts:439) | `setUiStateSnapshot` + `broadcastOpenSidePanel` (browser-ipc.ts:336) | `openPalotSidePanel` (services/backend.ts:259), subscribe via `subscribeToPalotOpenSidePanel` | Surface control wrapper — host validates tab enum, mutates UI snapshot, fans to renderer windows |
| 13 | `ui_state` | `palotUiStateArgsShape` (schemas.ts:321) | `get-ui-state` (plugin.js:275) | `palot:ui-state-snapshot` (ipc-handlers.ts:435) | `getUiStateSnapshot` (browser-ipc.ts:193) | `fetchPalotUiStateSnapshot` (services/backend.ts:252) | Surface control wrapper — pure read |
| 14 | Hook: `experimental.chat.system.transform` | input/output from OpenCode runtime, no Palot schema | none (context injection) | none | `buildProductContextBlock` (plugin.js:73) — reads resolver result, emits `<elf-context>` block | none (read indirectly by model) | Introspection — host projects a per-plugin context block; this is the only current "introspection" surface |
| 15 | Hook: `event` | OpenCode event union, no Palot schema | none (refresh touchpoint) | none | On `session.idle`, calls `resolveBinding` to keep snapshot warm (plugin.js:294) | none | Introspection — same; V2 should generalize to per-plugin `PluginSessionHandle` refresh |

**Tool count: 13.** Hook count: 2. Total surface entries: 15.

Notes:

- The schema module exposes two parallel shapes for each tool: `*ArgsShape` (raw ZodRawShape, satisfies OpenCode `args` contract) and `*ArgsSchema` (ZodObject, used for `.parse()` at runtime). See schemas.ts:285-355.
- Discovery tools (#1-4) are stubs and do **not** dispatch through the bridge.
- `dispatchBrowserToolInputSchema` (schemas.ts:266) is the bridge-side type that the dispatcher parses; the `args` field is `z.record(z.string(), z.unknown())` and is not narrowed per tool inside the dispatcher.
- `palotOpenSidePanelInputSchema` (schemas.ts:276) is a ZodEnum equal to `sidePanelTabSchema`; the plugin re-validates with its own `VALID_SIDE_PANEL_TABS` array (plugin.js:124) — this list is duplicated, not derived from the shared schema.

---

## 2. Session Binding Authority Model

The plugin is session-scoped by design, but the binding store is a flat per-user file with explicit authority contract.

### Authority contract (palot-session-binding.ts:21-27)

| Field | Authority | Source |
|---|---|---|
| `agentAuthority` | OpenCode session id | input from `event.properties.info.id` / `event.properties.sessionID` |
| `browserAuthority` | Magic Browser session id | derived: `mb_<sha1(bindingId).slice(0,12)>` (palot-magic-browser.ts:13) |
| `transportAuthority` | Browser lane id | `binding.browserLaneId`, set when a lane attaches |
| `visualizationAuthority` | Overlay event stream | `palot:browser-actions` channel |
| Derived | `viewerUrl`, `laneHealth`, `currentUrl` | computed from main state mirrors |

### Persisted fields (schemas.ts:87-103)

`SessionBinding` (in shared schema) and `SessionBindingRecord` (preload api) hold: `id`, `openCodeSessionId`, `browserLaneId` (nullable), `magicBrowserSessionId` (nullable), `status`, `createdAt`, `updatedAt`, `releasedAt`. `SessionBindingStoreFile = { version: 1, bindings: SessionBindingRecord[] }`.

### Persistence path (palot-session-binding.ts:17-19)

`~/.config/elf/opencode/session-bindings.json` — derived from `getConfigDir()` (XDG `XDG_CONFIG_HOME` or `~/.config`), joined with `opencode/`. File is written via temp-rename (`palot-session-binding.ts:50-55`). Reads validate through `sessionBindingStoreFileSchema.parse` (palot-session-binding.ts:40). Invalid store resets to empty `[]` with a warn log.

### Lifecycle adapter events (palot-session-binding-store.ts:76-101)

| OpenCode event | Adapter effect | Resulting binding status |
|---|---|---|
| `session.created` | `ensureSessionBindingForSession` (status `attaching`) | `attaching` |
| `session.updated` | `markSessionBindingAttached` | `attached` |
| `session.idle` | `markSessionBindingAttached` | `attached` |
| `session.status` (when type=`idle`) | `markSessionBindingAttached` | `attached` |
| `session.deleted` | `releaseBindingForSession` | `released` |
| `reconcileBindingsWithActiveSessions` (sweep) | release bindings not in active set, restore `released` ones that are | `released` / `restored` |

Status state machine: `unbound -> attaching -> attached <-> suspended -> released -> restored (from released, on re-attach)`. Schema is `sessionBindingStatusSchema` (schemas.ts:52-59).

### Secret/cache split (palot-magic-browser.ts:5-10, palot-secret-cache.ts)

Magic Browser `viewerAuthToken` lives only in `palot-secret-cache.ts` (main-only). The persisted binding JSON never contains the token; it only carries non-secret IDs. `inspectBindingPersistenceSurface` returns `{ binding, viewerUrl, hasSecret }` so callers can confirm the secret is present without retrieving it (palot-magic-browser.ts:48-62).

### OpenCode session id, browser-lane id, magic-browser-session-id mapping

- **opencode-session-id** = `event.properties.info.id` / `event.properties.sessionID` (input from OpenCode event stream).
- **browser-lane-id** = opaque string from `browser-lane-manager`; assigned to binding when a lane attaches to a session (not yet wired into the event adapter; today it is set by the renderer/main via `setBinding` IPC).
- **magic-browser-session-id** = `mb_<sha1(bindingId).slice(0,12)>` deterministically derived from `binding.id = binding_<openCodeSessionId>` (palot-magic-browser.ts:13-15).

All three are surfaced to the plugin via the resolver (`resolvePalotBridgeBinding`, browser-ipc.ts:298-319). The plugin never persists them; it only reads the resolver payload per `system.transform` or tool call.

---

## 3. Bridge Transport Seam Map

### Standalone bridge server

**File**: `apps/desktop/src/main/palot-browser-ipc.ts` (function `ensurePalotBridgeServer`, lines 375-442). Started at `app.whenReady` in `apps/desktop/src/main/index.ts:295` and re-started on demand by `appendPalotPlugin` in `opencode-manager.ts:610`.

**Host/port**: `127.0.0.1:0` (kernel-assigned ephemeral port). Path: `DEFAULT_BRIDGE_PATH = "/palot-bridge"` (browser-ipc.ts:45). The actual URL is built by `appendPalotPlugin` as `http://${host}:${port}${path}` (opencode-manager.ts:613).

**Auth header**: `x-palot-bridge-key: <random token>` (browser-ipc.ts:46, 389). Token is generated via `randomBytes(32).toString("hex")` (browser-ipc.ts:383) and persisted in module state (`bridgeServerToken`).

**Routes served** (single endpoint, dispatch by `action` field):

| `action` value | Handler | Resolves to |
|---|---|---|
| `resolve-binding` | `executeBridgeRequest` -> `resolvePalotBridgeBinding(sessionId)` (browser-ipc.ts:262-267) | `PalotResolverResult` (binding + non-secret snapshot + opaque action target + UI state) |
| `dispatch-browser-tool` | `executeBridgeRequest` -> `dispatchPalotBridgeBrowserTool` (browser-ipc.ts:268-280) -> dynamic import of `palot-browser-dispatcher` -> `dispatchBrowserTool` | `{ status, resultSummary }` |
| `get-ui-state` | `executeBridgeRequest` -> `getUiStateSnapshot()` (browser-ipc.ts:281-282) | `PalotUiStateSnapshot` |
| `open-side-panel` | `executeBridgeRequest` -> `openPalotBridgeSidePanel(tab)` (browser-ipc.ts:283-288) | `PalotUiStateSnapshot` (after `setUiStateSnapshot` + `broadcastOpenSidePanel`) |
| (other) | `createBridgeError("unknown_action", ...)` (browser-ipc.ts:289-291) | 500 with `ok: false` |

Transport is `application/json` POST; non-200 responses carry `{ ok: false, error: { code, message } }`.

### Env vars injected into spawned OpenCode process

`apps/desktop/src/main/opencode-manager.ts:604-615` (`appendPalotPlugin`):

| Env var | Value | Source line |
|---|---|---|
| `OPENCODE_PLUGIN` | existing value + comma + resolved repo-local plugin path (`apps/desktop/src/main/palot-plugin-entry.ts` resolves to `apps/desktop/src/main/palot-plugin-entry.js`) | opencode-manager.ts:612 |
| `PALOT_BRIDGE_URL` | `http://${bridgeServer.host}:${bridgeServer.port}${bridgeServer.path}` | opencode-manager.ts:613 |
| `PALOT_BRIDGE_TOKEN` | the random hex token | opencode-manager.ts:614 |

These are set on the `spawnEnv` passed to `spawn("opencode", args, ...)` (opencode-manager.ts:646-665).

### Env-var-driven fallback the plugin uses when no direct callbacks exist

`apps/desktop/src/main/palot-plugin/plugin.js:152-174` (`createBridgeClient`):

1. Reads `PALOT_BRIDGE_URL` and `PALOT_BRIDGE_TOKEN` from `globalThis.process.env`.
2. If either is missing, returns `null` and the plugin falls back to direct callbacks (when present) or to local "queued" envelopes.
3. If both are present, builds a `bridgeRequest(payload)` function that POSTs to `${bridgeUrl}` with header `x-palot-bridge-key: bridgeToken`, body `JSON.stringify(payload)`, expects `{ ok: true, result }` back, throws on `{ ok: false }` or non-2xx.
4. Used by `createResolver` (line 109), `buildBrowserToolHandler` (line 215), `buildOpenSidePanelHandler` (line 254), `buildUiStateHandler` (line 274).

Direct callbacks are only injected in test paths via `palot-opencode-plugin-shim.ts:87-107` (`buildHydratedServer`); the live production path always goes through the bridge fallback (opencode-manager.ts spawn path only sets env vars, never injects callbacks).

### Bridge client caller chain (resilience to direct-vs-fallback)

```
createPalotPlugin({ resolve?, dispatch?, getUiState?, openSidePanel?, listConnections? }, { bridgeRequest = createBridgeClient() })
  -> resolveBinding = createResolver({ resolve, bridgeRequest, listConnections })
  -> resolveBinding tries `resolve(sessionID)` first; if absent, falls back to bridgeRequest({ action: "resolve-binding", sessionId })
  -> browser tools: try `dispatch(...)` first; else bridgeRequest({ action: "dispatch-browser-tool", ... })
  -> open_side_panel: try `openSidePanel(tab)` first; else bridgeRequest({ action: "open-side-panel", tab })
  -> ui_state: try `getUiState()` first; else bridgeRequest({ action: "get-ui-state" })
```

When **none** of the callbacks and **no** bridge env vars exist, browser tools return a `createQueuedResponse` envelope with `requestId = toolName:sessionID` (plugin.js:224-230) and `open_side_panel` / `ui_state` return typed errors (`permission_denied`) (plugin.js:262-265, 277). This is the documented "queued/no-bridge" behavior today.

---

## 4. Attached-Server Limitation

This is the most important operational caveat in the current design. It is **explicitly written in the bridge doc** (docs/palot-opencode-plugin-bridge.md, "Existing server path" section), and it is observable in the spawn-vs-attach code.

### Where the limitation lives (exact paths and line numbers)

| Location | Lines | What it does / doesn't do |
|---|---|---|
| `apps/desktop/src/main/opencode-manager.ts` | 74 (`ensureServer` ensure path entry) | If a server is already running, calls `detectExistingServer` and **does not** spawn |
| `apps/desktop/src/main/opencode-manager.ts` | 103 (`detectExistingServer` returns `kind: "found"`) | Sets `singleServer = { server: detection.server, process: null }` and returns without calling `spawnServer` |
| `apps/desktop/src/main/opencode-manager.ts` | 115-138 (`ensureServer` lockfile / detection branch) | Reconnects to a pre-existing server when lockfile is valid or detection returns `found` |
| `apps/desktop/src/main/opencode-manager.ts` | 191-233 (`handleLockfile`) | Verifies lockfile is alive, but does not touch the running process's env |
| `apps/desktop/src/main/opencode-manager.ts` | 243-275 (`detectExistingServer`) | Returns `found` for same-user servers without spawning |
| `apps/desktop/src/main/opencode-manager.ts` | 604-615 (`appendPalotPlugin`) | **Only called from `spawnServer` at line 650.** There is no equivalent path for detected/attached servers |
| `apps/desktop/src/main/opencode-manager.ts` | 617-718 (`spawnServer`) | Builds `spawnEnv` with `OPENCODE_PLUGIN`, `PALOT_BRIDGE_URL`, `PALOT_BRIDGE_TOKEN`, then `spawn("opencode", args, { env: spawnEnv, ... })` |
| `apps/desktop/src/main/palot-opencode-plugin-shim.ts` | 109-138 (`loadPalotPluginModule`) | Loads module for **shape validation only**; it is never imported by the live OpenCode runtime. Comments at lines 102-106 confirm "It does not execute the plugin. It does not validate tool names, hook names, or callback injection wiring." |
| `docs/palot-opencode-plugin-bridge.md` | 79-91 ("Existing server path" section) | Explicit caveat: "no code path edits the environment of an already-running server process; no code path writes plugin config into a global OpenCode config file for out-of-process reuse; attached/pre-existing OpenCode servers are therefore intentionally unsupported for Palot bridge features today" |
| `docs/palot-opencode-plugin-bridge.md` | 472-484 ("Gaps and caveats") | Restates: "Plugin injection is not global — only guaranteed for Palot-spawned managed servers" |

### Why the limitation exists in v2.0 (managed-only)

- Injecting the plugin into a running process requires either (a) OpenCode supporting a hot-load seam (it does not today), or (b) writing a global `~/.config/opencode/config.json` plugin entry that the pre-existing server would pick up on next restart, or (c) restarting the server, which would orphan all of the user's in-flight sessions.
- Writing global config without the user's explicit consent violates the deny-by-default posture in the plan.
- Hot reload of an in-process plugin is not supported by the OpenCode runtime; `loadPalotPluginModule` only validates shape and never re-executes inside the running server.

### Why v2.1 will generalize

- The plan (`.sisyphus/plans/firefly-plugin-system-v2.md`, server-mode matrix at lines 1084-1090) explicitly schedules the attached-server path to v2.1 with a "generalized plugin install pathway" requirement: manifests must declare an install pathway for the host to write into the user's OpenCode config. The attached row in the matrix carries `bridge_unsupported_server` error code in v2.0 and only flips to full plugin support in v2.1.
- This is a single, named workstream; the managed-only limitation in v2.0 is a deliberate scope choice, not a hidden design gap.

---

## 5. Zod Coverage Matrix

Coverage of the bridge contract is real but partial. Below is a per-boundary matrix.

| Boundary | Zod parse today? | Schema module | Recommended clean seam for V2 |
|---|---|---|---|
| Plugin tool args (OpenCode-facing) | **Yes (per tool)** | `palotToolArgsSchemas` (schemas.ts:333-343); `*ArgsShape` for OpenCode `args`, `*ArgsSchema` for runtime `.parse()` | Keep dual shape + ZodObject pattern; move discovery tools (`search_tools`, `describe_tool`, `call_tool`, `tools_status`) to be derived from MCP connection records instead of inline `z.string().optional()` |
| Plugin resolver result | **Yes** | `palotResolverResultSchema` (schemas.ts:243-254); `.parse()` in `createResolver` (plugin.js:108, 111) and `palot-resolver.ts:6` | Reuse as the canonical non-secret payload schema |
| Plugin `open_side_panel` args | **Yes** | `palotOpenSidePanelArgsSchema` (schemas.ts:330); `palotOpenSidePanelInputSchema` (schemas.ts:276) | V2 should **derive** `VALID_SIDE_PANEL_TABS` (plugin.js:124) from the same `sidePanelTabSchema` to remove duplication |
| Browser dispatcher input | **Yes** | `dispatchBrowserToolInputSchema` (schemas.ts:266-270); `.parse()` in `dispatchBrowserTool` (dispatcher.ts:85) | Keep; add per-tool discriminator if V2 adds more tools |
| Browser action event publication | **Yes** | `publishBrowserActionInputSchema` + `browserActionEventSchema` discriminated union (schemas.ts:152-209); `.parse()` in `publishBrowserAction` (browser-ipc.ts:172) and IPC handler (ipc-handlers.ts:413) | Keep; V2 should replace per-source strings with a plugin-attribution field |
| Bridge HTTP request body | **No (shape only)** | `parseRequestBody` only checks `typeof === "object"` (browser-ipc.ts:251-257) | **Add Zod parse**: `PalotBridgeRequestInputSchema` discriminated on `action`, validated before `executeBridgeRequest` |
| Bridge HTTP response envelope | **No** | `PalotBridgeResponse` interface only (browser-ipc.ts:35-42) | **Add Zod**: `palotBridgeResponseSchema` for testability and runtime safety |
| Session binding store (persisted file) | **Yes** | `sessionBindingStoreFileSchema` (schemas.ts:100-103); `.parse()` in `readStoreFile` (palot-session-binding.ts:40) | Keep; add migration helper for `version: 2` rollout |
| Session binding (in-memory) | **Yes** | `sessionBindingSchema` (schemas.ts:87-96); `.parse()` in `setSessionBinding` (browser-ipc.ts:230) and IPC handler (ipc-handlers.ts:425) | Keep |
| Browser state snapshot | **Yes** | `browserStateSnapshotSchema` (schemas.ts:221-230); `.parse()` in `getBrowserStateSnapshot` (browser-ipc.ts:152) | Keep |
| UI state snapshot | **Yes** | `palotUiStateSnapshotSchema` (schemas.ts:217-219); `.parse()` in `getUiStateSnapshot` (browser-ipc.ts:194) and `setUiStateSnapshot` (browser-ipc.ts:211, 218) | Keep |
| `open_side_panel` IPC tab | **Yes** | `palotOpenSidePanelInputSchema` (schemas.ts:276); `.parse()` in IPC handler (ipc-handlers.ts:441) | Keep |
| Browser action IPC input | **Yes** | `publishBrowserActionInputSchema` (schemas.ts:272-274); `.parse()` in IPC handler (ipc-handlers.ts:413) | Keep |
| OpenCode event payload -> binding store adapter | **No** | `Event` from `../renderer/lib/types` used directly (palot-session-binding-store.ts:76) | **Add Zod**: parse `event.properties.info.id` and `event.properties.sessionID` at adapter boundary; today relies on TS narrowing |
| Browser lane CDP responses | **No (out of scope)** | CDP responses not parsed at the bridge boundary | Out of scope for V2; CDP layer is the browser lane's contract |
| Bridge env var values | **No** | env read directly in `createBridgeClient` (plugin.js:153) and `appendPalotPlugin` (opencode-manager.ts:613-614) | Add Zod parse for `PALOT_BRIDGE_URL` as `z.string().url()` and `PALOT_BRIDGE_TOKEN` as non-empty string at the boundary |
| Plugin module shape | **Partial** | `PalotPluginModule` interface only (palot-opencode-plugin-shim.ts:8-11); no Zod parse | **Add Zod**: `palotPluginModuleSchema` to validate `id: z.string()` and `server: z.unknown()`; replace ad-hoc `typeof` checks |

### Other observations

- `palotNonSecretSnapshotSchema = browserStateSnapshotSchema.pick({ ... })` (schemas.ts:232-241) is the subset used by the resolver payload. The `palotResolverResultSchema.nonSecretSnapshot` field references it (schemas.ts:245). This is a clean reuse pattern that V2 should preserve.
- `palotOpenSidePanelArgsSchema = z.object(palotOpenSidePanelArgsShape)` (schemas.ts:330) and `palotOpenSidePanelInputSchema = sidePanelTabSchema` (schemas.ts:276) overlap but are not equivalent — the former expects an object, the latter is a bare enum. Today both are used: plugin parses an object, IPC handler parses a bare tab. This is internally consistent but should be unified under a single input schema in V2.
- The OpenCode `args` field is a `z.ZodRawShape` (raw shape, not ZodObject) per the inline comment at schemas.ts:278-284. The plugin must use `*ArgsShape` for the OpenCode-facing `args` field and `*ArgsSchema` for runtime `.parse()`. This is a footgun and should be documented in V2.

---

## 6. Evidence & Test Hooks

| Test | Path | Coverage |
|---|---|---|
| Plugin module shape | `apps/desktop/src/main/palot-opencode-plugin-shim.test.ts:14, :28` | Validates `id` + `server` shape only |
| Canonical plugin behavior | `apps/desktop/.opencode/plugins/palot-bridge.test.js` | `search_tools`, `describe_tool`, `call_tool`, `tools_status`, `createResolver` (direct + bridge fallback), `buildProductContextBlock` shape, `open_side_panel` valid + invalid tab |
| Resolver | `apps/desktop/src/main/palot-resolver.test.ts:16` | Zod parse on `PalotResolverResult` |
| Browser IPC snapshot | `apps/desktop/src/main/palot-browser-ipc.test.ts` | Snapshot shape, bridge server start, action event publication, sequence numbers, takeover rejection |
| Browser dispatcher | `apps/desktop/src/main/palot-browser-dispatcher.test.ts` | Unbound session error, tool request/result event emission, dispatch routing |
| Bridge server start in managed runtime proof | `apps/desktop/src/main/palot-managed-runtime-verification.test.ts:93` | Confirms `ensurePalotBridgeServer` boots in a live Electron boot path |
| Bridge MCP runbook | `docs/mcp-connections-runbook.md:5` | Operational guidance for `compact runtime tools` |

---

## 7. Open Gaps & Caveats (for downstream tasks)

1. **Plugin is not a plugin system.** It's a single hardcoded factory (`createPalotPlugin`) with 13 inline tool definitions. There is no manifest, no per-tool scope, no capability gate, no per-session gating. The plan's `PluginDescriptor` / `PluginSessionHandle` model does not exist yet.

2. **Tool naming namespace is flat.** All 13 tools live under `tool.{name}.execute` with no `plugin.<pluginId>.*` prefix. V2 reserves `plugins.*` (introspection) and `plugin.<pluginId>.*` (business). Current tools have no plugin prefix at all.

3. **No session-scoped gating today.** Tool availability is global for the entire process. There is no logic to hide a tool for a session that lacks a browser binding (the tool just returns a `unbound_session` error at execute time). V2 should make this declarative.

4. **No capability broker.** The plan defines `bridge:session-read`, `bridge:ui-state-read`, `bridge:ui-state-write`, `browser:lane-control`, `theme:apply`, `command:register`, `tool:register` as Firefly-specific capabilities (plan line 880). None exist as code; today everything is reachable from the plugin.

5. **Discovery tools are stubs.** `search_tools`, `describe_tool`, `call_tool`, `tools_status` (plugin.js:301-379) return hardcoded fixtures. The proper source is `listMcpConnectionRecords()` from `mcp-connections-runtime.ts` (already imported in the shim at line 69-73). V2 must connect these.

6. **System prompt block has product-control names hardcoded.** `PRODUCT_CONTROL_TOOLS` and `CONNECTION_DISCOVERY_TOOLS` (plugin.js:35-46) are inline arrays, not derived from the registered tool set. V2 should derive from `PluginDescriptor.tools` so the prompt block can never lie about which tools exist.

7. **VALID_SIDE_PANEL_TABS duplicated.** The plugin's `VALID_SIDE_PANEL_TABS` array (plugin.js:124-143) duplicates `sidePanelTabValues` in schemas.ts:3-22. If a new tab is added, both must change. V2 should derive the plugin's enum from the same source.

8. **Bridge env vars are unvalidated.** `PALOT_BRIDGE_URL` is interpolated as a string into a fetch call (plugin.js:159). A misconfigured token produces a runtime error, not a startup failure. V2 should validate at the boundary.

9. **Renderer backend service is read-only on the bridge surface.** `fetchPalotSessionBinding`, `fetchPalotUiStateSnapshot`, `openPalotSidePanel`, `subscribeToPalotOpenSidePanel`, `subscribeToBrowserActions` (services/backend.ts:245-280) are the only renderer-visible entry points. The renderer never calls `dispatchBrowserTool` or `setBinding` directly. V2 may want to add a renderer-visible dispatch path for UI-driven actions, but today that path is main-only.

10. **No Zod on the bridge HTTP body.** `parseRequestBody` accepts any object (browser-ipc.ts:251-257). A malformed or hostile payload from a misconfigured spawn will pass through to `executeBridgeRequest` and fail at the first property access. V2 should add a `PalotBridgeRequestInputSchema` discriminated union.

---

## Acceptance Criteria Check

- [x] Current bridge seams and session-scoped tools are fully mapped (15 surface entries; 13 tools + 2 hooks; full IPC and bridge transport map; 8 distinct IPC channels; 4 bridge actions).
- [x] Managed-server-only caveat and attached-server limitation are explicit in output (Section 4, with exact file:line references and v2.0 / v2.1 rationale).
- [x] Per-tool/per-hook inventory includes Zod schema, IPC channel, main handler, renderer facade, and V2 projection target (Section 1, 15-row table).
- [x] Session binding authority model covers opencode-session-id, browser-lane-id, magic-browser-session-id, persistence path, and lifecycle adapter events (Section 2, with state machine and event table).
- [x] Bridge transport seam map covers bridge server location, routes, env vars, and env-var-driven fallback (Section 3, with 4-action table and full caller chain).
- [x] Zod coverage matrix lists per-boundary Zod status and V2-recommended clean seam (Section 5, 16-row table).
- [x] "What this means for V2" summary is at the top of the file.

---

## Cross-references

- Plan: `.sisyphus/plans/firefly-plugin-system-v2.md` (Wave 1, Task 2; lines 446-498)
- Plan server-mode matrix: lines 1084-1090 (managed / attached / attached-after-v2.1 / offline / reconnect)
- Plan capability list: line 880
- Canonical doc: `docs/palot-opencode-plugin-bridge.md` (531 lines)
- Canonical plugin: `apps/desktop/src/main/palot-plugin/plugin.js` (477 lines)
- Compatibility shim: `apps/desktop/.opencode/plugins/palot-bridge.js` (21 lines, re-exports)
- Shared schemas: `apps/desktop/src/shared/palot-bridge-schemas.ts` (360 lines)
- Resolver: `apps/desktop/src/main/palot-resolver.ts` (7 lines)
- Bridge server: `apps/desktop/src/main/palot-browser-ipc.ts:375-442` (`ensurePalotBridgeServer`)
- Browser dispatcher: `apps/desktop/src/main/palot-browser-dispatcher.ts` (142 lines)
- Session binding store: `apps/desktop/src/main/palot-session-binding.ts` (142 lines)
- Session binding adapter: `apps/desktop/src/main/palot-session-binding-store.ts` (102 lines)
- Magic Browser helper: `apps/desktop/src/main/palot-magic-browser.ts` (68 lines)
- Plugin module shape: `apps/desktop/src/main/palot-opencode-plugin-shim.ts` (138 lines)
- Plugin entry resolver: `apps/desktop/src/main/palot-plugin-entry.ts` (40 lines)
- Spawn / env injection: `apps/desktop/src/main/opencode-manager.ts:604-615, 617-718`
- IPC handlers (palot: prefix): `apps/desktop/src/main/ipc-handlers.ts:404-451`
- Preload bridge: `apps/desktop/src/preload/index.ts:72-98`
- Renderer backend facade: `apps/desktop/src/renderer/services/backend.ts:245-280`
- Preload API types: `apps/desktop/src/preload/api.d.ts:145-234` (SessionBinding, SidePanelTabId, BrowserStateSnapshot, PalotUiStateSnapshot)
- Test: `apps/desktop/src/main/palot-managed-runtime-verification.test.ts:93`
