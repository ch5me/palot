---
name: surface-contract
description: How a Firefly surface (a side-panel plugin) gives an agent tools, projects its live state into the agent's context every turn, and animates the agent's actions as a cursor — the generic human+agent+surface contract. Use when adding or changing agent-callable surface tools, per-turn context injection, the surface action stream / cursor overlay, or wiring a surface to Magic Browser. The Browser plugin is the reference implementation. Triggers on "surface tool", "web.* tools", "context projector", "surface-context", "action stream", "agent cursor", "magic browser", "browser lane", "streamed vs iframe".
license: MIT
metadata:
  author: palot
  version: "1.0.0"
---

# The Surface Contract

A **surface** is a side-panel the human sees *and* the agent can drive. Three
actors share one authoritative state (owned by Electron **main**): the human
clicks in the UI, the agent calls tools, the host re-projects state into the
agent's context every turn and animates the agent's actions back into the panel.

Get this right once and every surface (browser, editor, artifacts, terminal…)
plus every sub-agent inherits it. The **Browser** plugin is the reference build.

Pairs with the [`firefly-plugins`] skill (the V2 manifest/capability system this
builds on) and `docs/palot-opencode-plugin-bridge.md` (the deep runtime-seam ref).

## The three pieces a surface author writes

The host provides dispatch, capability checks, TOON I/O, context composition,
action-stream transport (ordering/actor/dedup), and `uiHints`. You write only:

1. **Tool handlers** — the effect of an agent action. `registerHostTool(pluginId, toolId, fn)`
   in `apps/desktop/src/main/firefly-plugin/dispatch.ts`. Declared in the plugin
   manifest's `contributes.tools` (with optional `panelId` to scope a tool to a panel).
2. **A context projector** — your surface's live state, emitted as TOON every turn.
   `registerHostContextProjector(pluginId, surfaceId, fn)` returning a
   `SurfaceContextFragment { surfaceId, label, toon }` (or `null` to contribute nothing).
3. **An action→animation renderer** — consume the surface action stream and draw it
   (a cursor). `useSurfaceActions(surfaceId)` in `renderer/surfaces/`.

## The two sync halves

### Context projection (host → agent, per turn)

Every turn, the OpenCode plugin's `experimental.chat.system.transform` hook calls
the `list-context-fragments` bridge route → `composeSurfaceContext(sessionId)`
(`apps/desktop/src/main/surface-context-compose.ts`) → runs every registered
projector → composes one `<surface-context>` block. This is how a **human action
mutates state that the agent sees on its next message**. Do NOT hand-roll context
text; register a projector. (The old hardcoded `buildProductContextBlock` is dead.)

Keep fragments tiny and AXI/TOON-shaped. The browser projector
(`buildBrowserSurfaceFragment` in `firefly-plugin/browser-tool-handlers.ts`) emits:
`mode iframe|streamed`, `bound y|n`, `url …`, `usable <tool list>`, and in iframe
mode `needs_streamed <tools>` — telling the agent honestly what it can/can't do now.

### Surface action stream (agent → surface, animated)

Every tool step publishes an **actor-tagged** event onto a per-surface stream the
renderer animates. Generic primitive:
- `apps/desktop/src/main/surface-action-bus.ts` — surfaceId-keyed, per-(surface,actor)
  monotonic sequence, dedup, capped ring.
- `apps/desktop/src/renderer/surfaces/use-surface-actions.ts` — `useSurfaceActions(surfaceId)`
  → `{ events, actors, eventsByActor, overlayState }`.
- `apps/desktop/src/shared/surface-action-events.ts` — generic `SurfaceActionEvent`
  (browser's `BrowserActionEvent` is a specialization with `surfaceId:"browser"`).

**Actor identity** (`Actor { id, displayName, cursorColor, kind:"main"|"sub" }`,
in `preload/api.d.ts`) is what lets a sub-agent render its own colored cursor.
Today `actorForSession(sessionId)` derives a stable color per session
(`palot-browser-dispatcher.ts`); Phase 4 will set `kind:"sub"` for sub-agents.

The browser still uses its specialized bus (`palot-browser-ipc.ts publishBrowserAction`
→ `palot:browser-actions` IPC → `useBrowserActions` → `BrowserCursorOverlay` mounted
over the iframe in `plugins/browser/panel/browser-panel.tsx`). New non-browser
surfaces should adopt the generic `surface-action-bus` + `useSurfaceActions` directly.

## AXI/TOON tool rules (load-bearing)

Follow the company `axi-loom` doctrine. Surface tools are agent-facing:
- **Short verb-first names**: `web.open`, `web.click`, `web.read`, `web.mode` — not
  `plugin.firefly.built-in.surface.browser.navigate` in the agent's eyeline (the long
  id is the registry key; the short `title` is what the agent reads).
- **Combined ops**: `web.open` = navigate + snapshot in one call.
- **Compact TOON output**, 3-4 fields, truncate big text with a `(truncated, N chars — use …)`
  hint + a next-step suggestion. See the `formatSnapshotToon`/`formatLinksToon` helpers.
- **Fail fast, name the precondition** (CH5 #9): a tool that can't run in the current
  mode returns a typed error (`needs_streamed_mode`, `unbound_session`) — NEVER a
  silent no-op. The projector advertises usability so the agent rarely calls a dead tool.

## Browser: iframe vs streamed (capability-aware)

Two lane modes, surfaced honestly in context:
- **`direct-iframe`** (DEFAULT — no docker): lightweight, human-browsable. Can
  `web.open`/`web.navigate`/`web.tabs`/`web.status`/`web.mode` only. No CDP ⇒ no
  DOM read/click/type (cross-origin). `web.read`/`click`/`type`/`scroll` fail-fast
  with `needs_streamed_mode`.
- **`streamed`** (`selkies-stream` docker-chromium OR remote-attached with a
  `cdpEndpoint`): full agentic actions via **Magic Browser**.

First browser tool call on an unbound session **lazily auto-provisions + binds** a
default iframe lane (`provisionDefaultLaneForSession` in `palot-browser-dispatcher.ts`),
so "open the browser to URL X" works with zero manual setup. Session→binding lifecycle
is wired into the OpenCode event stream in `notification-watcher.ts`.

## Magic Browser = CLI shell-out (NOT a library import)

`@ch5/magic-browser` (`~/src/ch5/magic-browser`) exposes **no library `exports`/`main`
— only a CLI bin**. Integration is shell-out (also the AXI-native path), via
`apps/desktop/src/main/palot-magic-browser-engine.ts`:
- `resolveMagicBrowserBin()` — `MAGIC_BROWSER_BIN` env → `magic-browser` on PATH →
  dev-fallback `…/magic-browser/dist/cli.js` → throws `MagicBrowserUnavailableError`.
- `--remote-cdp-url` must be the **browser-level CDP WEBSOCKET** url — fetch
  `<lane.cdpEndpoint>/json/version` → `webSocketDebuggerUrl` (NOT the HTTP endpoint).
- `session stop` is **detach-only** (never kills the lane). Lane restart → new CDP
  port → the MB session record is stale (CDP url is immutable per session) → re-attach.
- Streamed `web.*` route through `dispatchStreamedTool` → engine verbs
  (`openSnapshot`/`clickText`/`typeSelector`/`evalExpr`/…); iframe `web.*` keep the raw
  lane-CDP/navigate path.

## Security boundary (do not break)

Secrets stay main-only: viewer/CDP tokens and the CDP endpoint never enter tool
output, renderer state, or the persisted binding JSON (`session-bindings.json`).
The renderer never calls the resolver and never loads plugin code — it consumes
derived snapshots + the action stream only.

## Verification

The prior Electron cold-boot crash (`ERR_UNSUPPORTED_ESM_URL_SCHEME` for `bun:`) is
**RESOLVED** (fixed 2026-06-16 in `e11c58a37` + `0d3877fdc`: `bun:sqlite` now resolves
through a runtime-guarded `createRequire`, so the `bun:` scheme never reaches Electron's
ESM loader; `electron-vite build` is clean with zero static `bun:` imports). The app
cold-boots — Electron is bootable for visual proof. The web build still has no `window.elf`
IPC, so Electron-only surfaces must be proven in Electron or headlessly. Default verification
remains headless (fast, deterministic); add Electron visual proof when a surface is Electron-only.

Headless proof commands (from `apps/desktop`):
- `bunx tsgo --noEmit` — typecheck.
- `bun test src/main/firefly-plugin/browser-tool-handlers.test.ts` — tool routing
  (engine mocked).
- `bun test src/main/palot-magic-browser.test.ts` — engine (CLI exec mocked).
- `bun test src/main/surface-action-bus.test.ts` — generic stream.
- `bun test src/main/palot-browser-dispatcher.test.ts` — dispatch + auto-provision.
- The cursor overlay renders via SSR assertion in
  `src/renderer/components/side-panel/browser-cursor-overlay.test.tsx`.
- `bun ../../scripts/build-plugins.ts` — manifest validation after a manifest change.

When mocking `mock.module("./browser-lane-manager", …)`, include EVERY export the
code under test imports (e.g. `getBrowserLane`, `ensureBrowserLane`) or you get
`SyntaxError: Export named 'X' not found` — module mocks fully replace the module.

## Where things live (map)

| Concern | File |
|---|---|
| Tool/projector registries + helpers | `apps/desktop/src/main/firefly-plugin/dispatch.ts` |
| Browser tool mapping + projector + TOON | `apps/desktop/src/main/firefly-plugin/browser-tool-handlers.ts` |
| Browser dispatch (iframe + streamed) + actor | `apps/desktop/src/main/palot-browser-dispatcher.ts` |
| Magic Browser CLI engine | `apps/desktop/src/main/palot-magic-browser-engine.ts` |
| Session→lane binding (real MB session) | `apps/desktop/src/main/palot-magic-browser.ts` |
| Context composition | `apps/desktop/src/main/surface-context-compose.ts` |
| Generic action stream (main / shared / renderer) | `surface-action-bus.ts` / `shared/surface-action-events.ts` / `renderer/surfaces/use-surface-actions.ts` |
| Browser panel + cursor overlay | `apps/desktop/plugins/browser/panel/browser-panel.tsx`, `renderer/components/side-panel/browser-cursor-overlay.tsx` |
| Manifest (tools/panels/capabilities) | `apps/desktop/plugins/browser/manifest.ts` |
| OpenCode plugin (transform hook + catalog tools) | `apps/desktop/src/main/palot-plugin/plugin.js` |

## Roadmap context

This contract is built in phases (`.sisyphus/goals/current-goal.md`). Done: P0
foundation, P1 iframe+cursor vertical slice, P2 streamed Magic Browser engine,
P3.1 generic action stream, P4 multi-agent (sub-agent actor cursors + `show.doc`),
P3.2 generic `uiHints` application (manifest-declared hints applied host-side
post-dispatch; handler keys canonicalized so canonical + legacy ids both resolve),
and P5.1 legacy cutover (the `browser_*` tools + fake discovery stubs + dead
`buildProductContextBlock` removed from `plugin.js`). Pending: the two-lanes-side-by-side
panel multiplexing follow-on, and live Electron demo proof (now unblocked — the app
cold-boots; see Verification).
