# Task 0 — OpenCode plugin↔host bridge decision <!-- oc:id=sec_aa -->

Date: 2026-06-06
Plan: `palot-browser-side-panel-opencode-magic-browser-cursor`
Scope: runtime matrix + resolver seam decision for T8/T9/T16

## Decision <!-- oc:id=sec_ab -->

Use a desktop-only, in-process plugin bridge hosted by Electron main.

- The Palot plugin should load as a normal OpenCode local plugin from `apps/desktop/.opencode/plugins/` or a built package that is added to the OpenCode plugin path/config.
- The plugin must run in the same Node/Bun runtime as the OpenCode server, not in the renderer.
- The resolver must live in Palot main-owned code, not in the renderer and not inside the plugin itself.
- The plugin should call one main-owned resolver seam per hook/tool invocation:

```ts
resolve(opencodeSessionId: string): {
  binding: SessionBinding | null
  nonSecretSnapshot: PalotBrowserSnapshot | null
  opaqueActionTarget: OpaqueActionTarget | null
}
```

- Browser-mode dev stays UI-only. Plugin hooks/tools no-op cleanly there and the browser panel shows an explicit unavailable/status badge.
- Do not add a localhost sidecar. Reuse the OpenCode plugin runtime plus a direct in-process bridge from plugin code to Palot main-owned state.

## Why this is the smallest credible seam <!-- oc:id=sec_ac -->

1. Palot already centralizes OpenCode server ownership in Electron main via `apps/desktop/src/main/opencode-manager.ts`. <!-- oc:id=item_aa -->
1. Palot already centralizes browser lane ownership in Electron main via `apps/desktop/src/main/browser-lane-manager.ts`. <!-- oc:id=item_ab -->
1. Renderer already uses preload IPC for browser lane control and status; renderer is not the right authority for session binding or secrets. <!-- oc:id=item_ac -->
1. OpenCode plugins already support per-session hooks and custom tools with `sessionID` in the hook/tool context, so the plugin can resolve bindings on every call instead of caching lane state. <!-- oc:id=item_ad -->
1. OpenCode docs and examples confirm plugins can add tools and mutate system prompts without changing OpenCode runtime. <!-- oc:id=item_ae -->

## Runtime matrix <!-- oc:id=sec_ad -->

### Palot desktop runtime <!-- oc:id=sec_ae -->

- `apps/desktop/src/main/opencode-manager.ts`
  - Owns local OpenCode server lifecycle (`ensureServer()`, `restartServer()`, `getServerUrl()`).
  - Broadcasts active OpenCode session presence via `getActiveOpenCodeSessions()`.
- `apps/desktop/src/main/browser-lane-manager.ts`
  - Owns browser lane registry, runtime prep, local/remote lane health, tab operations, and persistence.
- `apps/desktop/src/main/ipc-handlers.ts`
  - Exposes main-owned browser lane actions to renderer via IPC.
- `apps/desktop/src/preload/index.ts`
  - Exposes `window.elf.browserLanes.*` and OpenCode server lifecycle to renderer.
- `apps/desktop/src/renderer/services/backend.ts`
  - Chooses Electron IPC vs browser HTTP, confirming desktop mode already has a hard main/renderer seam.

Implication: the resolver belongs beside `opencode-manager.ts` and `browser-lane-manager.ts` in main-owned code.

### Palot browser-mode dev runtime <!-- oc:id=sec_af -->

- `apps/desktop/src/renderer/services/backend.ts`
  - In browser mode, calls go to HTTP server endpoints instead of `window.elf` IPC.
- `apps/server/src/routes/browser-lanes.ts`
  - Browser-mode can render lane streams and inject page shim logic.
- Browser-mode does not own the OpenCode plugin runtime from Electron main.

Implication: browser-mode is acceptable for renderer overlay work, but not for the plugin↔host contract. Treat plugin/tools as unavailable there.

## OpenCode plugin runtime facts <!-- oc:id=sec_ag -->

Source of truth:
- `https://opencode.ai/docs/plugins/`
- `https://opencode.ai/docs/custom-tools/`
- `https://opencode.ai/docs/server/`

Confirmed plugin capabilities:
- Plugins are local JS/TS modules loaded from `.opencode/plugins/` or `~/.config/opencode/plugins/`.
- Canonical shape is a plugin function (`Plugin`) returning hooks; legacy `PluginModule { server }` also exists in real-world plugins.
- Plugins can implement:
  - `experimental.chat.system.transform`
  - `event`
  - `tool`
  - `tool.execute.before`
  - `tool.execute.after`
  - `experimental.session.compacting`
  - other hooks not needed for V1
- Custom tool `execute(args, context)` gets `sessionID`, `messageID`, `directory`, and `worktree`.
- `experimental.chat.system.transform` receives `{ sessionID?, model }` according to current research and GitHub issue trail.
- Tool and hook code should use `client.app.log()` instead of `console.log`.

Implication: T8 and T9 can resolve by OpenCode session id on each call without global plugin cache.

## Local Palot evidence already in repo <!-- oc:id=sec_ah -->

### Browser side panel exists now <!-- oc:id=sec_ai -->

- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
  - Existing side-panel browser surface.
  - Uses global `activeBrowserLaneIdAtom`, lane health polling, navigation, and iframe stream display.
- `apps/desktop/src/renderer/atoms/browser.ts`
  - Existing browser panel atoms are global-only today (`activeBrowserLaneIdAtom`, URL history).
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - Registers the `browser` side panel as a Firefly surface.
- `apps/desktop/src/renderer/components/agent-detail.tsx`
  - Builds side-panel tabs from the current agent/session context.
- `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`
  - Renders per-session side panels, which is where overlay scoping by session will matter later.

Implication: T11-T15 should adapt this existing surface instead of creating a new browser panel.

### OpenCode renderer connection exists now <!-- oc:id=sec_aj -->

- `apps/desktop/src/renderer/services/connection-manager.ts`
  - Maintains one base OpenCode connection plus per-project clients.
  - Subscribes to global events and hydrates sessions into renderer state.
- `apps/desktop/src/renderer/services/opencode.ts`
  - Wraps `@opencode-ai/sdk/v2/client` and supports both Electron IPC fetch and browser HTTP fetch.
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx`
  - Shows existing renderer-side access to OpenCode skills/commands/MCP through SDK client.
- `.sisyphus/evidence/aios-migration/task-18-plugins.txt`
  - Confirms the existing Plugins surface is renderer-side only and did not need main involvement.

Implication: plugin authoring/runtime must not be confused with the existing Plugins UI surface. The UI is only introspection, not plugin hosting.

## Bridge choice <!-- oc:id=sec_ak -->

### Chosen shape <!-- oc:id=sec_al -->

Create a main-owned resolver module and inject it into the Palot plugin factory at plugin initialization time.

Suggested layout:
- `apps/desktop/src/main/palot-opencode/session-binding.ts`
- `apps/desktop/src/main/palot-opencode/secret-cache.ts`
- `apps/desktop/src/main/palot-opencode/browser-snapshot.ts`
- `apps/desktop/src/main/palot-opencode/resolver.ts`
- `apps/desktop/.opencode/plugins/palot-bridge.ts` or packaged equivalent under `packages/palot-opencode-plugin`

Suggested factory shape:

```ts
export interface PalotPluginDeps {
  resolve: (sessionId: string) => ResolveResult
  dispatchBrowserAction: (input: DispatchBrowserActionInput) => Promise<QueuedToolResult>
  log: (entry: PluginLogEntry) => Promise<void>
  mode: "desktop" | "browser-dev"
}

export const createPalotPlugin = (deps: PalotPluginDeps): Plugin => {
  return async ({ client }) => ({
    "experimental.chat.system.transform": async (input, output) => {
      if (!input.sessionID || deps.mode !== "desktop") return
      const resolved = deps.resolve(input.sessionID)
      if (!resolved.binding || !resolved.nonSecretSnapshot) return
      output.system.push(buildPalotContextBlock(resolved))
    },
    tool: {
      palot_browser_status: tool({ ... }),
      palot_browser_navigate: tool({ ... }),
      palot_browser_click: tool({ ... }),
      palot_browser_type: tool({ ... }),
      palot_browser_scroll: tool({ ... }),
    },
  })
}
```

### Transport decision <!-- oc:id=sec_am -->

Use direct in-process calls, not HTTP and not renderer IPC.

Reasons:
- Renderer preload IPC is only available to Chromium renderer, not to plugin runtime.
- Localhost sidecar is explicitly forbidden by plan guardrails.
- Main already owns both server lifecycle and lane lifecycle.
- Resolver needs main-only access to future secret cache and binding persistence.

## Resolver contract <!-- oc:id=sec_an -->

The shared resolver is the only allowed seam for T8, T9, T16a, T16b, and T17.

```ts
export interface ResolveResult {
  binding: SessionBinding | null
  nonSecretSnapshot: {
    sessionId: string
    laneId: string | null
    magicBrowserSessionId: string | null
    viewerUrlHint: string | null
    laneHealth: BrowserLaneHealth | null
    currentUrl: string | null
    viewport: {
      width: number | null
      height: number | null
    } | null
    lastActions: BrowserActionEventSummary[]
    mode: "desktop" | "browser-dev"
  } | null
  opaqueActionTarget: {
    bindingId: string
    laneId: string | null
    magicBrowserSessionId: string | null
  } | null
}
```

Rules:
- Resolve by OpenCode `sessionID` on every call.
- Never return auth tokens, raw viewer auth, secret-cache handles, or persisted JSON file paths.
- `opaqueActionTarget` is only for main-owned dispatch; plugin treats it as opaque metadata.
- Renderer never imports or calls this module.

## Session id sources available to plugin <!-- oc:id=sec_ao -->

Reliable sources from current docs/examples:
- Custom tool `execute(_, context)` -> `context.sessionID`
- `experimental.chat.system.transform(input)` -> `input.sessionID` when available
- Event hook uses `event.type` payloads; session-bearing events include session ids on session/message/tool-related events

Practical implication:
- T8: inject only when `sessionID` exists.
- T9/T16: resolve from tool `context.sessionID`.
- T6/T17/T18: session lifecycle recovery should come from OpenCode session events in main-owned code or polling snapshots, not from renderer state.

## Browser-mode behavior <!-- oc:id=sec_ap -->

Browser-mode dev must not pretend the plugin bridge exists.

Required behavior:
- Plugin factory initialized in browser-mode returns hooks that do nothing or tools that return typed `unsupported_in_browser_mode`/`desktop_only` style errors.
- Browser panel surface remains usable for UI/overlay development.
- UI should show a badge/status copy indicating browser automation/plugin bridge is unavailable in browser-mode.

Why:
- Browser-mode currently relies on HTTP server routes and renderer runtime, not the Electron main runtime that owns OpenCode process + lane authority.
- A fake browser-mode resolver would split authority and create drift risk.

## Main risks / unknowns <!-- oc:id=sec_aq -->

1. **Plugin injection point in Palot desktop app is not implemented yet** <!-- oc:id=item_af -->
   - Existing repo shows OpenCode SDK usage and a Plugins UI surface, but not an existing Palot-owned plugin loader path.
   - Need a concrete way for the OpenCode server spawned by `opencode-manager.ts` to load the Palot plugin package/file in desktop mode.

1. **`experimental.chat.system.transform` behavior may drift across OpenCode versions** <!-- oc:id=item_ag -->
   - Research found docs/issues showing this hook has changed and had bugs.
   - Need a local proof harness before relying on it for critical context.

1. **Desktop plugin runtime vs Electron main module sharing** <!-- oc:id=item_ah -->
   - If the OpenCode plugin executes in a separate Bun/Node process from Electron main, a pure direct import will not be enough.
   - Task 0 assumption should be verified with a minimal spike: can a plugin module loaded by the OpenCode server call into Palot-owned runtime directly, or must Palot expose a tiny in-process host adapter during server spawn?

1. **Session binding persistence and recovery policy not built yet** <!-- oc:id=item_ai -->
   - Resolver depends on T1/T6 domain model and store.
   - The contract is clear, but the storage/recovery implementation is still future work.

1. **Magic Browser ownership is planned, not present in this repo slice yet** <!-- oc:id=item_aj -->
   - Current browser lane manager owns lane/CDP/stream concepts, but Magic Browser session attach/create logic still needs implementation.

## Recommended next implementation order <!-- oc:id=sec_ar -->

1. T1 — define `SessionBinding`, lifecycle, authority contract, and SecretCache contract in main-owned code. <!-- oc:id=item_ak -->
1. T3 — scaffold Palot plugin package/file and verify Palot can get it loaded by OpenCode in desktop runtime. <!-- oc:id=item_al -->
1. T0 follow-up micro-spike — prove exact plugin loading/injection path from `opencode-manager.ts` and whether direct import/injection is possible. <!-- oc:id=item_am -->
1. T4/T7 — add main-owned snapshot and IPC surfaces. <!-- oc:id=item_an -->
1. T8/T9 — wire plugin hooks and tool schemas to the resolver only. <!-- oc:id=item_ao -->
1. T16a — isolate per-call resolution before any real automation dispatch. <!-- oc:id=item_ap -->

## Concrete file paths that matter <!-- oc:id=sec_as -->

- `apps/desktop/src/main/opencode-manager.ts`
- `apps/desktop/src/main/browser-lane-manager.ts`
- `apps/desktop/src/main/ipc-handlers.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/api.d.ts`
- `apps/desktop/src/renderer/services/backend.ts`
- `apps/desktop/src/renderer/services/opencode.ts`
- `apps/desktop/src/renderer/services/connection-manager.ts`
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
- `apps/desktop/src/renderer/atoms/browser.ts`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/components/agent-detail.tsx`
- `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx`
- `.sisyphus/evidence/aios-migration/task-18-plugins.txt`

## Acceptance status for Task 0 <!-- oc:id=sec_at -->

- Runtime matrix doc: done in this file.
- Resolver contract committed as source-of-truth: decided here; code module not yet implemented.
- T8/T9/T16 references updated to use resolver module: not started yet.