# Wave 2 — The Loom wire: `session` / `render` / `patch` / `poll` / `state` / `end` <!-- oc:id=sec_aa -->

> **Status:** BLOCKED on D1 + D3 + D4 resolution (see plan §1).
> **Plan section:** `docs/loom-implementation-plan.md` §3 Phase 2.
> **Assessment anchor:** `docs/loom-alignment-assessment.md` §3 Gap 2.
> **Goal:** the full Loom protocol commands exist as bridge tools. TOON on
> the agent boundary, JSON over a localhost WS to the renderer. The runtime
> owns a `rev`-stamped tree. The renderer subscribes to patches.
> Single end-to-end demo on `dag-sparkline`.

## Open decisions to resolve BEFORE writing code <!-- oc:id=sec_ab -->

| # | Decision | Recommendation | Status |
|---|---|---|---|
| D1 | Transport to surface (WS vs SSE+POST) | **WebSocket**. | resolve in PM call before dispatch |
| D3 | Patch addressing | **Node-id + field**, not JSON Pointer. | resolve in PM call before dispatch |
| D4 | Event batching window for `state` deltas | **250 ms** default, env-tunable. | resolve in PM call before dispatch |

If any of these is still open when this wave is dispatched, the prompt reverts
to **Wave 1** as the next shippable step.

## Context (for the worker) <!-- oc:id=sec_ac -->

Wave 1 gave us introspectable components. Wave 2 introduces the wire. Concretely:

- The agent speaks **TOON** to a localhost bridge that already exists (`palot-browser-ipc.ts:271`). Five new bridge tools are added: `palot_session open`, `palot_session end`, `palot_render`, `palot_patch`, `palot_poll`. (Plus a 6th, `palot_state`, for the human-side state delta channel — that lands in Wave 3 but the verb is reserved here.)
- The **surface** (React renderer) holds a **WebSocket** to a new `loom-bridge.ts` server in main process. JSON over WS, no TOON on this side.
- The runtime owns a per-session `rev`-stamped tree. The renderer subscribes; agent patches become JSON patch frames to the renderer; human interactions become JSON event frames to the runtime; the runtime's `poll` returns events + state deltas in TOON.
- The wire follows the Loom spec §5 exactly: `render`, `patch`, `poll`, `state`, `session open`, `session end`.

This is the **load-bearing** wave. Every later wave depends on it.

## Why this is the right next wave <!-- oc:id=sec_ad -->

- The transport is the asymmetry. Without it, dual bindings (Wave 3) and dirty-field protection (Wave 4) have no home.
- The surface WS is a single new port on `127.0.0.1`. The proxy story is moot because Electron is the host.
- The runtime is in-memory. No persistence yet. Wave 5 adds that.
- One end-to-end demo (a `dag-sparkline` rendered via the wire, then patched live) is the proof criterion.

## Touched files (NEW) <!-- oc:id=sec_ae -->

- `apps/desktop/src/main/palot-runtime/session-store.ts` — in-memory per-session tree with per-node `rev`, monotonic session `rev`, event queue, state delta accumulator. ~200 LoC.
- `apps/desktop/src/main/palot-runtime/commands.ts` — `render` / `patch` / `poll` / `state` / `session open` / `session end` command implementations.
- `apps/desktop/src/main/palot-runtime/revision.ts` — monotonic per-session counter, conflict detection.
- `apps/desktop/src/main/palot-runtime/wire.ts` — TOON encode/decode for the agent boundary, JSON for the surface WS.
- `apps/desktop/src/main/loom-bridge.ts` — localhost WS server for the surface channel. Reuses the `PALOT_BRIDGE_URL` + token env seam.
- `apps/desktop/src/renderer/loom/loom-context.tsx` — provider that opens a WS per active Loom session, replays the tree.
- `apps/desktop/src/renderer/loom/use-loom-session.ts` — hook returning `{ tree, subscribe, sendEvent, sendStateDelta, applyPatch }`.
- `apps/desktop/src/renderer/loom/loom-renderer.tsx` — walks the tree, dispatches nodes to registered components.
- `apps/desktop/src/main/palot-runtime/__tests__/session-store.test.ts`
- `apps/desktop/src/main/palot-runtime/__tests__/commands.test.ts`
- `apps/desktop/src/main/palot-runtime/__tests__/wire.test.ts`
- `apps/desktop/src/renderer/loom/__tests__/use-loom-session.test.ts`

## Touched files (CHANGED) <!-- oc:id=sec_af -->

- `apps/desktop/src/main/palot-plugin/plugin.js:1–484` — add the 5+1 new tools. Delegate to the runtime module.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` — add Zod args/results for the new tools.
- `apps/desktop/src/main/palot-browser-ipc.ts:271` — add the Loom CLI routes next to the existing 4 actions.
- `apps/desktop/src/main/opencode-manager.ts:414, 422, 466` — add `LOOM_RUNTIME_URL` env if needed; the WS server lives in main, the surface channel is a separate WS endpoint.
- `apps/desktop/src/main/palot-resolver.ts` — expose `openLoomSession` to the bridge.
- `apps/desktop/src/renderer/atoms/feature-flags.ts` — add `loom.enabled` and `loom.dagSparklineDemo` flags.
- `apps/desktop/src/renderer/components/chat/chat-view.tsx` — mount `LoomContext` when `loom.enabled && session has an open Loom session`.
- `apps/desktop/src/renderer/genui/genui-renderer.tsx:148–184` — add a parallel path: if a Loom session is active for this session id, subscribe to the tree instead of parsing fences.

## Required tools <!-- oc:id=sec_ag -->

- `edit`, `write`, `read`
- `bun run check-types`, `bun run lint`
- `bun test` (Bun test, per `AGENTS.md:242–248`)

## Must do <!-- oc:id=sec_ah -->

1. **TOON encode/decode** for: primitives, arrays, tabular forms, indented scalars. Round-trip the Loom spec's §13 example through `wire.test.ts` and assert byte-equality. <!-- oc:id=item_aa -->
1. **SessionStore** in-memory: `Map<sessionId, { tree, rev, eventQueue, stateDelta, dirty }>`. `render(tree.toon)` replaces the tree, increments `rev`, queues a `tree` frame to subscribed surfaces. `patch(patch.toon)` applies a node-id+field patch, increments `rev`, queues a `patch` frame. `poll(--rev N)` returns events + state delta + a slice of the tree since `--rev`. <!-- oc:id=item_ab -->
1. **State delta channel** (placeholder; full impl in Wave 3): `state(frame.toon)` is accepted by the runtime, accumulates per-field deltas, and is returned on next `poll`. <!-- oc:id=item_ac -->
1. **Surface WS** in `loom-bridge.ts`. `ws://127.0.0.1:<port>/loom/<sessionId>`. On connect: send the current tree. On `event` frame: queue. On `state` frame: accumulate. On `patch` from runtime: forward. Same `env[BRIDGE_ENV_TOKEN]` auth as the existing HTTP bridge. <!-- oc:id=item_ad -->
1. **Loom wire commands** in the bridge plugin: <!-- oc:id=item_ae -->
   - `palot_session open --title <t>` → `{session_id, surface_url, rev: 0}`.
   - `palot_session end` → `{rev}`.
   - `palot_render <tree.toon>` → `{rev}`.
   - `palot_patch <patch.toon>` → `{rev}` or `{errorCode: "stale_rev", rev, delta}`.
   - `palot_poll --rev N` → `{rev, events, state_delta, tree_slice}`.
   - `palot_state <delta.toon>` → `{rev}`. (Placeholder; full impl in Wave 3.)
1. **TOON output for `poll`** matches the spec's §9 example exactly. <!-- oc:id=item_af -->
1. **Renderer Loom client**: `useLoomSession({sessionId})` opens a WS, replays the tree on connect, applies incoming `patch` frames, exposes `sendEvent(nodeId, event, payload)` and `sendStateDelta(nodeId, field, value)`. Coalesces state deltas at 250 ms before sending. <!-- oc:id=item_ag -->
1. **Single end-to-end demo**: a `dag-sparkline` rendered via the wire, then patched (e.g. add a node), with the surface updating live. Behind `loom.dagSparklineDemo` feature flag. <!-- oc:id=item_ah -->
1. **Conflict detection placeholder** (full impl in Wave 4): `palot_patch` against a stale `rev` returns `errorCode: "stale_rev"` + current `rev` + a delta. Optimistic concurrency. <!-- oc:id=item_ai -->
1. **AXI compliance**: every new tool has `--help`, returns TOON, emits `count: 0` for empty results, no interactive prompts. Run the AXI 10-principle checklist on each new tool. <!-- oc:id=item_aj -->
1. **No regression in the fence path**: the existing ` ```dag ` / ` ```genui ` flow keeps working. Loom is opt-in. <!-- oc:id=item_ak -->

## Must NOT do <!-- oc:id=sec_ai -->

- No persistence. Sessions are in-memory; restart loses state.
- No dirty-field protection. Patches always win. (Wave 4.)
- No dual bindings declared on components yet. (Wave 3.)
- No `state` schema validation. (Wave 3.)
- No streaming `append` frame. (Wave 5.)
- No V2 `contributes.components`. (Wave 6.)
- No changes to the firefly-plugin manifest beyond a comment in the bridge manifest noting the new CLI tools.
- Do not change `palot-browser-ipc.ts` outside the new routes.

## Proof criteria <!-- oc:id=sec_aj -->

1. `palot_session open --title "demo"` returns `{session_id, surface_url, rev: 0}`. <!-- oc:id=item_al -->
1. `palot_render <tree.toon>` → `rev: 1`; the renderer displays the tree. <!-- oc:id=item_am -->
1. `palot_patch <patch.toon>` → `rev: 2`; the renderer shows the diff live. <!-- oc:id=item_an -->
1. `palot_poll --rev 0` returns no events (idle). <!-- oc:id=item_ao -->
1. A simulated human click on a placeholder `button` node produces a queued event; `palot_poll --rev 2` returns the event. <!-- oc:id=item_ap -->
1. The Loom spec's §13 minimal end-to-end walkthrough is reproducible in a `bun test`. <!-- oc:id=item_aq -->
1. `palot_patch` against a stale `rev` returns the structured error. <!-- oc:id=item_ar -->
1. No regression in the existing fence-render path. `dag-sparkline` still renders from a fence. <!-- oc:id=item_as -->
1. `bun run check-types` clean. <!-- oc:id=item_at -->
1. `bun run lint` clean. <!-- oc:id=item_au -->
1. All new tests pass. <!-- oc:id=item_av -->

## Risk <!-- oc:id=sec_ak -->

- **High.** New IPC, new runtime module, new surface WS, new bridge tools, new renderer context. Mitigations: feature flags, parallel fence path, tests covering the spec's §13 walkthrough.
- Failure mode: TOON spec violations. `wire.test.ts` catches this.
- Failure mode: WS auth bypass. Reuse the existing `env[BRIDGE_ENV_TOKEN]` env; tests assert a no-token connect fails.
- Failure mode: OpenCode plugin runtime timeout. Validate `palot_poll` short-poll + agent-driven retry against a real managed server before merge.

## Out of scope (for later waves) <!-- oc:id=sec_al -->

- Wave 3 (signal/state bindings actually wired on a real component).
- Wave 4 (dirty-field protection).
- Wave 5 (persistence + `append`).
- Wave 6 (`contributes.components`).

## Definition of done <!-- oc:id=sec_am -->

- All proof criteria pass.
- The spec's §13 walkthrough is reproducible in a `bun test`.
- `docs/loom-progress.md` is updated with `Wave 2: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.