# Current Goal

## Goal As Stated

Chris, 2026-06-16 (voice, multi-message):

> "The plugin integration with OpenCode … for the browser plugin, what the tool-level
> integration is … if I open a new session and tell the agent 'open the browser to this
> URL', what tools do we inject into the context and how is that mechanism set up. Let's
> get the browser working end-to-end perfectly … document it in a local skill."
>
> "Move fully onto the V2 plugin system — a generic contract between surfaces, the tools,
> how they get injected, how state changes as the conversation/user actions change before
> the next message. The agent needs to open the panel and take deeper browser actions, and
> eventually UI animations on top of the browser to show what the agent is doing, inside
> the browser plugin itself. Really expand the API for these panel surface tools. This is
> the key magic of the whole app: how the human + the agent interact with generic UI
> surface skills cohesively."
>
> "Tools should mirror the Magic Browser API — Magic Browser powers the Agentic Browser
> CLI and is what we actually want to hook up."
>
> "Default browser = the local iframe one, NOT docker-chromium. In future a tool + the
> plugin understand iframe vs remote-streamed and make clear what you can/can't do per mode.
> Magic Browser passes actions in batches; we want a synchronized animated UI mouse, and it
> must be easy for plugin authors to sync their surface state with the agent's tool calls —
> plan that in as a core part of the contract."
>
> "Tool names short and sweet — make the API really nice for the agent, following TOON/AXI."
>
> "Vertical slice including the cursor first, then move on to the streamed thing. Put all
> tasks in a markdown doc so I can drive a looping goal + a massive agent swarm."

## Interpreted Goal

Make the **Browser** the reference implementation of a **generic V2 Surface Contract** in
palot: a clean, reusable seam by which a plugin surface exposes agent tools, projects its
live state into the agent's context every turn, and renders the agent's actions as animated
UI (a cursor), so the human + the agent share one live surface cohesively. Drop all legacy.
Hook up **Magic Browser** as the real automation engine for streamed lanes. Default to the
lightweight **iframe** browser; make iframe-vs-streamed a first-class, capability-aware mode.
Tool API is short and AXI/TOON-shaped. End state demoable: open a session, say "open the
browser to URL X and click around", watch a named, colored cursor do it live; sub-agents get
their own tab/lane/cursor; a `show.doc` tool opens a report in a new surface tab.

Doctrine: **AXI + Loom** (`~/.claude/skills/axi-loom`) is the company contract for agent↔tool
and agent↔UI. The agent only ever speaks text/TOON tools; the human gets the live surface;
the runtime bridges. Token budget is first-class. Palot is the reference build-out.

## Success Criteria

Per phase: desktop typecheck clean, lint clean, tests pass, and the user-facing path proven
(not just unit-green) before moving on.

- **P1 vertical slice (iframe + cursor), DEMOABLE:** New session → agent calls short V2
  browser tools → a browser side-panel tab opens (default **iframe** lane), navigates, and an
  **animated cursor** plays the agent's actions over the surface. Zero manual setup: the
  session auto-binds a lane. No legacy `browser_*` tools used on this path.
- **P2 streamed engine:** Magic Browser drives a streamed (docker-chromium or remote-cdp)
  lane over CDP; the full short tool set (read/click/fill/submit/scroll/search/…) maps to
  Magic Browser worker tools; returns are TOON with AXI truncation + next-step hints; lane
  restart re-attaches; iframe⇄streamed switch via `web.mode`, capability-aware.
- **P3 generic contract:** The browser-specific action bus + context block are generalized
  into reusable **Surface Action Stream** + **context projector** primitives; a 3rd surface
  could adopt them by writing only {tool handlers, a context projector, an action→animation
  renderer}. `uiHints` (openPanel/focusWidget/refreshProjection) applied generically.
- **P4 multi-agent / multi-surface:** A sub-agent opens its own tab/lane with its own name +
  cursor color, visible concurrently; main agent calls `show.doc` → a new surface tab renders
  a report.
- **P5 cutover + durable docs:** Legacy `browser_*` + connected-app stubs deleted; `plugin.js`
  is a thin generic bridge with zero per-surface knowledge; a **local skill** documents the
  surface contract for future authors; e2e verification harness committed.

## Constraints

- **AXI/TOON tools:** short verb-first names, TOON output, combined ops (open = nav+snapshot),
  truncation + `full` escape hatch, definitive empty states, structured errors, contextual
  next-step hints. Make the API nice for the agent.
- **Pure V2, no legacy, no compat shims.** Delete `browser_*` and the fake `search_tools /
  describe_tool / call_tool / tools_status` stubs. Do not add new ones.
- **Fail fast, no reflexive fallbacks** (CH5 #9). Unbound/unavailable/wrong-mode ⇒ typed error
  naming the missing precondition, never a silent no-op. Lane auto-provision is the intended
  primary path (lazy/self-healing, CH5 #10), made observable — not a fallback masking a bug.
- **Reuse, don't rebuild.** The action-event union, action bus, geometry transforms, cursor
  overlay, panel, and lane model already exist (see Current State). Extend/repoint them.
- **Secrets stay main-only.** Viewer/CDP tokens never enter tool output, renderer state, or
  persisted binding JSON (carried over from the prior plan's security boundary).
- **Swarm discipline:** impl sub-agents do **NOT** git add/commit/push (a rogue agent pushed
  to main last time). The orchestrator integrates disjoint slices, typechecks, then commits.
  See [[swarm-subagents-no-git-mutation]].
- Renderer never calls the resolver / never loads plugin code; consumes derived snapshots only.

## Non-Goals

- A Chrome-extension-first automation path; raw-CDP as the primary session identity.
- Exact caret fidelity claims without a page helper (keep the best-effort badge).
- Web build first-class for automation tools (desktop-first; iframe UI may degrade in web).
- Multi-human CRDT editing (Loom v2 line).
- Rebuilding the cursor/geometry/action machinery that already exists.

## Current State (verified reuse map, 2026-06-16)

### Progress (updated 2026-06-16 PM)

LANDED + pushed to HQ: **P0–P4 + P3.2 + P5.1**.
- P4 (sub-agent actor cursors + `show.doc`), commit `7c8e9c151`.
- P3.2 generic `uiHints` (manifest-declared openPanel/focusWidget/refreshProjection applied
  host-side post-dispatch via the `palot:tool-ui-hints` IPC channel + agent-detail reactor)
  **and** the canonical tool-id resolution root fix (handler keys canonicalized via
  `resolveCanonicalPluginId` so canonical `namespace.name` + legacy reverse-DNS ids both
  resolve), commit `0a82c819c`.
- P5.1 legacy cutover: `browser_*` tools + the fake `search_tools/describe_tool/call_tool/
  tools_status` stubs + dead `buildProductContextBlock` removed from `plugin.js` (V2 `web.*`
  fully covers via the same dispatcher; verified zero-residue).

**The Electron cold-boot crash is RESOLVED** (fixed 2026-06-16 in `e11c58a37` + `0d3877fdc`;
proven by code, git history, and a clean `electron-vite build` with zero static `bun:` imports).
The AGENTS.md "crashes on load" staging note was stale and has been corrected. Live demo proof
is therefore UNBLOCKED (owner: Chris drives the Electron run).

REMAINING: the two-lanes-side-by-side panel multiplexing follow-on (deferred; not needed for the
demoable target), and Chris-driven live Electron demo proof.

The prior plan `palot-browser-side-panel-opencode-magic-browser-cursor.md` already landed
T1–T15. **Most machinery exists; it is wired to legacy tools and Magic Browser is a stub.**

REUSABLE as-is:
- V2 browser panel `apps/desktop/plugins/browser/panel/browser-panel.tsx` (iframe **and**
  selkies modes both wired; `<iframe src=…>` for direct-iframe vs streamUrl for selkies).
- V2 browser manifest `apps/desktop/plugins/browser/manifest.ts` (tools `.open`, `.state`).
- `BrowserActionEvent` 15-variant discriminated union (`src/preload/api.d.ts:374`) + factory
  `normalizeBrowserActionEvent` (`src/shared/browser-action-events.ts`).
- Geometry transforms + 3-tier fallback ladder + fixtures (`src/shared/browser-geometry.ts`).
- Lane model `BrowserLaneSurfaceKind = "selkies-stream" | "direct-iframe"`
  (`src/shared/browser-lanes.ts`); URL builders in `src/renderer/atoms/browser.ts`.
- Main action bus `publishBrowserAction` (dedup/sequence/takeover-guard/broadcast,
  `src/main/palot-browser-ipc.ts:229`); preload `onBrowserActions`; `subscribeToBrowserActions`.

NEEDS-REFACTOR (built, not wired / wrong scope):
- Cursor overlay `src/renderer/components/side-panel/browser-cursor-overlay.tsx` — **fully
  built + tested but mounted NOWHERE.** Wire it over the iframe in the V2 panel.
- `useBrowserActions` hook + `atoms/browser-actions.ts` — global single-session ring; needs
  per-lane/per-actor scoping (`atomFamily`).
- V2 tools `.open`/`.state` (`src/main/firefly-plugin/dispatch.ts:1201`) — only open panel /
  read state; they **publish nothing** to the action bus. Add action tools + bus publish here.

LEGACY-TIED (delete after V2 covers it):
- `browser_*` tools in `src/main/palot-plugin/plugin.js` (+ `palot-browser-dispatcher.ts`) —
  the only thing that currently drives navigate/click/type and feeds the action bus.
- `search_tools/describe_tool/call_tool/tools_status` fake stubs in `plugin.js`.

MISSING (the real new work):
- Real Magic Browser integration — `src/main/palot-magic-browser.ts` is a stub that fabricates
  a fake session id and never calls Magic Browser. Engine: `~/src/ch5/magic-browser` library
  `startBrowserSession({adapter:'remote-cdp', remoteCdpUrl})` + `executeMagicBrowserWorkerTool`
  + `withSessionConnection` (no MCP; TS dispatcher).
- Session→lane auto-bind: `applyBindingLifecycleEvent` exists but is **never called** by any
  live event listener; bindings are only set from the renderer. ⇒ `unbound_session` today.
- Generic context projection: `buildProductContextBlock` is hardcoded in `plugin.js`;
  `projectPerPluginSystemContextBlocks` is dead code; `uiHints` has no runtime consumer.
- Actor identity (agent name + cursor color) on action events; multi-actor overlay.
- Short AXI tool names; iframe-default; `web.mode`; `show.doc`.

Loom (separate, already built): WS bridge + render/patch/poll/state verbs + dual bindings +
TOON codec + component registry live on `atlas/loom`. Loom renders **chat-stream** trees, not
surface panels. The Surface Action Stream reuses Loom's TOON + actor/presence vocabulary but
is a **surface primitive**, not Loom-internal. See `docs/palot-opencode-plugin-bridge.md`.

## Architecture — the Surface Contract

A **plugin** contributes one or more **surfaces**. A surface = `panel(s) + tools +
context-projector + capabilities + action-stream`. **Tools are surface-scoped**; commands are
plugin-global. Two sync halves:
1. **Context projection (host→agent, per turn):** each enabled surface emits live TOON state
   composed into `<surface-context>` every message (replaces `buildProductContextBlock`).
   Human/agent actions mutate main-owned state → reflected next turn (Loom "poll deltas").
2. **Surface Action Stream (agent→surface, animated):** every tool step emits an actor-tagged,
   ordered event the surface renderer animates (cursor). Actor identity → sub-agent name+color.

A surface author writes only **3 small pieces** (tool handlers, a context projector, an
action→animation renderer); the host provides dispatch, capability checks, TOON I/O, context
composition, action-stream transport (ordering/actor/batch), and uiHints.

Browser surface = reference: default **iframe** mode (lightweight, navigate + human view, no
CDP); **streamed** mode (docker/remote-cdp) driven by **Magic Browser** for full agentic
actions. The context projector advertises the current mode + what's possible.

Proposed short tools (agent-facing, `web.*`; ids stay `plugin.firefly…browser.*`):
`web.open {url}` · `web.read {?q}` · `web.click {text|sel}` · `web.fill {field,val}` ·
`web.submit {?field}` · `web.scroll {?to}` · `web.tabs` / `web.tab {new|use|close}` ·
`web.search {q}` · `web.status` · `web.mode {iframe|streamed}` · `web.act {steps[]}` (batch,
smooth animation) · later `show.doc {…}` on the artifacts surface.

## Plan

Legend: `[deps]` = blocked-by task ids · `‖G` = parallel group · `owns:` = file ownership
(disjoint within a group) · `verify:` = acceptance.

### Phase 0 — Contract foundation (SEQUENTIAL, orchestrator; dependency root)
- **F0.1 Actor identity on events.** Add `Actor {id, displayName, cursorColor, kind:"main"|"sub"}`;
  extend `BrowserActionEventBase` + `normalizeBrowserActionEvent` with optional `actor`.
  owns: `shared/browser-action-events.ts`, `preload/api.d.ts`. verify: typecheck + factory test.
- **F0.2 Context projector seam.** Add `registerHostContextProjector(pluginId, surfaceId, fn)`
  + a `composeSurfaceContext(sessionId)` that returns TOON fragments; bridge route
  `list-context-fragments`. No behavior change yet (stub returns []). owns:
  `firefly-plugin/dispatch.ts`, new `main/surface-context-compose.ts`, `palot-browser-ipc.ts`.
- **F0.3 Surface-scoped tools.** Add optional `panelId` to `toolContributionSchema`
  (back-compat). owns: `shared/firefly-plugin/manifest.ts`. verify: existing manifest tests green.

### Phase 1 — Vertical slice incl. cursor (iframe, V2) — DEMOABLE  ‖ after Phase 0
- **P1.1 V2 browser action tools.** Add `web.open/navigate/click/type/scroll/tabs/status/read`
  to the browser manifest + host handlers that route to the EXISTING dispatcher/lane-CDP and
  publish action-bus events (with `actor`). Short TOON outputs. [F0.1,F0.3] ‖A
  owns: `plugins/browser/manifest.ts`, new `firefly-plugin/browser-tool-handlers.ts`,
  `firefly-plugin/dispatch.ts` (registration only). verify: tool dispatch test emits events.
- **P1.2 Mount the cursor overlay in the V2 panel.** Wire `BrowserCursorOverlay` +
  `useBrowserActions` over the iframe; scope atoms per lane/actor (`atomFamily`). [F0.1] ‖A
  owns: `plugins/browser/panel/browser-panel.tsx`, `hooks/use-browser-actions.ts`,
  `atoms/browser-actions.ts`. verify: overlay capture harness shows cursor at fed coords.
- **P1.3 Auto-bind session→lane.** Wire `applyBindingLifecycleEvent` into the live OpenCode
  event stream; on session.created ensure binding; lazily ensure+bind a lane on first browser
  tool call (default direct-iframe). [F0.1] ‖A
  owns: `palot-session-binding-store.ts`, the event-stream subscriber, `palot-browser-dispatcher.ts`
  (auto-provision hook). verify: synthetic session.created → bound lane; first tool → no `unbound_session`.
- **P1.4 iframe default.** Default lane = `direct-iframe`, not docker-chromium. ‖A
  owns: `shared/browser-lanes.ts`, `browser-lane-manager.ts` (seed). verify: default lane test.
- **P1.5 Generic context projector (browser).** Replace hardcoded `buildProductContextBlock`
  with `composeSurfaceContext`; register a browser projector reporting mode/url/tabs/available
  actions/binding (TOON). [F0.2] ‖B
  owns: `palot-plugin/plugin.js` (context section), `firefly-plugin/dispatch.ts` (browser projector).
  verify: bound vs unbound injected-context test.
- **P1.6 Integration + demo proof (orchestrator).** Launch app, new session, drive `web.open`+
  `web.click`, confirm panel opens (iframe), navigates, cursor animates. Evidence under `.sisyphus/evidence/`.

### Phase 2 — Streamed engine (Magic Browser)  ‖ after Phase 1
- **P2.1 Magic Browser engine module.** Replace stub `palot-magic-browser.ts` with real
  `startBrowserSession({adapter:'remote-cdp', remoteCdpUrl: <lane CDP ws>})`; persist returned
  UUID as `magicBrowserSessionId`. owns: new `main/palot-magic-browser-engine.ts`. [P1.1]
- **P2.2 Route streamed tools through Magic Browser.** `web.*` in streamed mode call
  `executeMagicBrowserWorkerTool` (open_snapshot/click_text/extract_*/form_*/web_search) /
  `withSessionConnection`; iframe mode stays navigate-only. owns: `browser-tool-handlers.ts`. [P2.1]
- **P2.3 Lane restart re-attach.** Lane restart (new CDP port) invalidates + recreates the
  Magic Browser session. owns: `palot-magic-browser-engine.ts`, `browser-lane-manager.ts`. [P2.1]
- **P2.4 `web.mode` + mode state.** Tool to switch iframe⇄streamed; streamed provisions a
  docker/remote lane + MB session; default iframe. owns: `browser-tool-handlers.ts`, binding store. [P2.1]
- **P2.5 TOON return shapes.** Map snapshots/tables/links/evidence to compact TOON with AXI
  truncation + `full` + next-step hints. owns: `browser-tool-handlers.ts`. [P2.2]
- **P2.6 Knowledge mode.** Default `local-only`. owns: `palot-magic-browser-engine.ts`. [P2.1]

### Phase 3 — Generalize the contract  ‖ after Phase 1 (parallel with P2 where disjoint)
- **P3.1 Surface Action Stream primitive.** Generalize the browser action bus → surfaceId-keyed,
  actor-tagged generic stream + `useSurfaceActions(surfaceId)`; browser becomes a consumer.
  owns: new `main/surface-action-bus.ts`, new `renderer/surfaces/use-surface-actions.ts`; repoint browser.
- **P3.2 Generic uiHints application.** Apply `openPanel/focusWidget/refreshProjection` post-dispatch.
  owns: `firefly-plugin/dispatch.ts`, a renderer reactor.
- **P3.3 Dynamic availability in context.** Projector advertises which tools are usable per mode/binding.
  owns: browser projector + `composeSurfaceContext`.
- **P3.4 Author guide (3-piece contract).** Draft for the skill (Phase 5). owns: docs.

### Phase 4 — Multi-agent / multi-surface
- **P4.1 Sub-agent actor.** Sub-agent session → own lane + `Actor` (name + cursor color);
  overlay multiplexes multiple actors per surface. owns: binding store, overlay, action bus.
- **P4.2 `show.doc` → artifacts surface.** New tool opens an artifacts tab rendering a report
  (reuse Loom component tree or artifacts panel). owns: artifacts plugin, dispatch.
- **P4.3 Multi-tab demo.** "Compare A & B" runbook: main + sub-agent tabs, report tab.

### Phase 5 — Cutover, hardening, durable docs
- **P5.1 Kill legacy.** Delete `browser_*` + stub tools from `plugin.js`; it becomes a thin
  generic bridge (catalog tools + context compose + action emission + uiHints). owns: `plugin.js`.
- **P5.2 Tests.** V2 tool dispatch, actor on bus, context compose, MB engine, extend
  `palot-managed-runtime-verification.test.ts` (plugin loaded → context injected → tool →
  action event → overlay). owns: test files.
- **P5.3 Overlay capture harness** (old T19a) committed under `scripts/`. owns: scripts.
- **P5.4 Local skill** — surface-contract authoring guide (the "for the future" doc); update
  `docs/palot-opencode-plugin-bridge.md` + loom docs. owns: skill + docs.
- **P5.5 Remove dead code** (`projectPerPluginSystemContextBlocks` etc. if superseded).

## Swarm Execution Notes

- **Phase 0 is the dependency root** — land it first, sequentially, by the orchestrator (small,
  load-bearing types/seams). Then fan out.
- Within a phase, tasks in the same `‖` group have **disjoint file ownership** → safe to
  parallelize. `dispatch.ts`, `plugin.js`, `manifest.ts` are contention points: assigned to a
  single task per group; orchestrator merges.
- Impl agents return diffs/summaries; **orchestrator commits** coherent slices after typecheck.
  No agent runs git mutation. Re-verify the merged tree.
- Demo proof beats unit-green: each phase ends with the real user path exercised (evidence under
  `.sisyphus/evidence/`).

## Verification

- Desktop typecheck (tsgo) clean; lint clean.
- `bun test apps/desktop/...` for `bun:test` files; `bun <file>` for `node:test` files.
- e2e seam: `apps/desktop/src/main/palot-managed-runtime-verification.test.ts` (real plugin +
  bridge + dispatcher), extended to assert action events + injected context.
- Launch: `bun run dev:desktop` (devmux → OpenCode on :4096; bare → :14096). Docker only needed
  for streamed lanes (P2); iframe slice (P1) needs no docker.

## Next Update Triggers

- a phase completes (update Current State; check Success Criteria)
- goal / constraints / acceptance change
- a blocker is hit (record it + shortest path forward)
- a design decision (tool shape, mode model, Loom reuse) changes
