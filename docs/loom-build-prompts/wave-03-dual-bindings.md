# Wave 3 — Dual signal/state bindings + dirty-field protection <!-- oc:id=sec_aa -->

> **Status:** BLOCKED on Wave 2 completion.
> **Plan section:** `docs/loom-implementation-plan.md` §3 Phase 3.
> **Assessment anchor:** `docs/loom-alignment-assessment.md` §3 Gap 3.
> **Goal:** one component ships with both a local `state` binding and a
> `signal` event. The agent sees only the signal; the surface mutates state
> optimistically. The agent's tree is authoritative; concurrent human edits
> are never silently clobbered.

## Context (for the worker) <!-- oc:id=sec_ab -->

Wave 2 gave us the wire. Wave 3 fills in the binding model. Concretely:

- Every interactive affordance in a registered component declares its binding class. State bindings mutate local state immediately. Signal bindings queue typed events for the agent's next `poll`.
- The runtime enforces dirty-field protection: an agent patch to a dirty field is held and surfaced as a `conflict` on the next `poll`.
- A new `decision_card` component is shipped as a built-in V2 contribution. It demonstrates both: a `state`-bound `notes` textarea and a `signal`-bound `submit` button.

This is the **defensible idea** from the Loom spec. Without it, every interactive control is either a slow form (signal-only) or an invisible local mutation (state-only). With it, the UI feels like a real app.

## Why this is the right next wave <!-- oc:id=sec_ac -->

- The wire is in place. Adding the binding model is a renderer-side change plus a runtime-side change; both are localized.
- The new `decision_card` is the smallest fixture that exercises both binding classes.
- The dirty-field protection is the load-bearing reconciliation policy from Loom §8. It belongs in this wave, not Wave 4, because it depends on the binding model existing (a `state` field is the only thing that can be `dirty`).
- Reversible: behind `loom.dualBindings` feature flag.

## Touched files (NEW) <!-- oc:id=sec_ad -->

- `apps/desktop/src/main/palot-runtime/bindings.ts` — binding declaration parsing; signal queue + state delta accumulator. Reads the `events` / `state` declarations from the registry.
- `apps/desktop/src/main/palot-runtime/dirty.ts` — per-field `dirty` set; conflict surfacing; conflict policy resolution.
- `apps/desktop/src/renderer/loom/loom-binding-host.tsx` — React primitives that wrap a node's `events` / `state` and attach the right `onChange` / `onClick` handler per binding class.
- `apps/desktop/src/renderer/genui/components/decision-card.tsx` — the new built-in V2 contribution fixture.
- `apps/desktop/src/main/palot-runtime/__tests__/bindings.test.ts`
- `apps/desktop/src/main/palot-runtime/__tests__/dirty.test.ts`
- `apps/desktop/src/renderer/genui/__tests__/decision-card.test.ts`

## Touched files (CHANGED) <!-- oc:id=sec_ae -->

- `apps/desktop/src/main/palot-runtime/session-store.ts` — extend the tree to carry per-node `rev` + per-field `dirty` flags. `patch` marks fields dirty before applying; on conflict, the held value is queued.
- `apps/desktop/src/main/palot-runtime/commands.ts` — extend `poll` to return `events[]` + `state_delta[]` + `conflicts[]` in TOON. Extend `patch` to mark fields dirty; on conflict return `errorCode: "dirty_field"` + the held value.
- `apps/desktop/src/main/palot-runtime/wire.ts` — TOON shape for `conflicts[]`: `{nodeId, field, humanValue, agentValue, policy}`.
- `apps/desktop/src/renderer/loom/loom-renderer.tsx` — consume `loom-binding-host.tsx`; route events through the WS client.
- `apps/desktop/src/renderer/loom/use-loom-session.ts` — extend the WS client to emit `event` and `state` frames; coalesce state deltas at 250 ms before sending.
- `apps/desktop/src/renderer/genui/registry.ts` — finalize the `events` and `state` declaration slots; the schema validator enforces both are present (Zod `min(0)`); conflict policy declared per component: `agent-wins` | `human-wins` | `merge` | `ask`. Default is `ask`.
- `apps/desktop/src/shared/firefly-plugin/component-zod.ts` — Zod-to-summary must include the binding class per affordance.
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` — declare the built-in `decision_card` contribution.

## Required tools <!-- oc:id=sec_af -->

- `edit`, `write`, `read`
- `bun run check-types`, `bun run lint`
- `bun test`

## Must do <!-- oc:id=sec_ag -->

1. **`bindings.ts`** parses each component's `events` / `state` declarations. At `render` time, the runtime attaches a binding declaration to each node. At interaction time, the renderer routes the event to the right channel (signal or state). <!-- oc:id=item_aa -->
1. **`dirty.ts`** maintains `Map<nodeId, Set<field>>`. When a `state` mutation lands in the renderer, the renderer calls `setDirty(nodeId, field, true)`. The runtime mirrors this on the next state delta. When the runtime applies a `patch` to a field with `dirty === true`, it holds the patch, increments the session `rev` (to invalidate the agent's expected `rev`), and queues a `conflict` frame. <!-- oc:id=item_ab -->
1. **`conflictPolicy`** per component: `agent-wins` (apply the patch, drop the human's value), `human-wins` (drop the patch), `merge` (call a per-component `merge(humanValue, agentValue)` function declared in the registry), `ask` (surface a `conflict` event to the agent; do not apply the patch). Default is `ask`. <!-- oc:id=item_ac -->
1. **`decision_card` fixture** has: <!-- oc:id=item_ad -->
   - `props: { title, options: [{id, label}], selected: string | null }` (Zod).
   - `events: { submit: { optionId: string } }` (signal binding).
   - `state: { notes: string }` (state binding).
   - `conflictPolicy: "ask"`.
1. **Renderer Loom client** sends `event` frames for signal bindings and `state` frames for state bindings. State frames coalesce at 250 ms. <!-- oc:id=item_ae -->
1. **`poll` returns** `events[]` + `state_delta[]` + `conflicts[]` in TOON. `conflicts[]` has `{nodeId, field, humanValue, agentValue, policy}`. When `policy: "ask"`, the agent receives a structured signal that it should reason about the conflict. <!-- oc:id=item_af -->
1. **`patch` returns** either `{rev}` (success) or `{errorCode: "stale_rev" | "dirty_field", rev, held}` (failure). Errors are TOON. <!-- oc:id=item_ag -->
1. **AXI compliance**: every new binding type surfaces in `components describe` output. The `decision_card`'s `events` and `state` are listed. <!-- oc:id=item_ah -->
1. **`conflict` test fixtures**: a clean patch applies; a patch to a dirty field is held; the policy's behavior matches the registry declaration. <!-- oc:id=item_ai -->
1. **No regression in the wire** from Wave 2. Existing `palot_render` / `palot_patch` / `palot_poll` still work. <!-- oc:id=item_aj -->

## Must NOT do <!-- oc:id=sec_ah -->

- No persistence. (Wave 5.)
- No `append` frame. (Wave 5.)
- No V2 `contributes.components`. (Wave 6.)
- No new transport.
- No changes to the existing fence flow.
- Do not bundle the `decision_card` into the `dag-sparkline` migration. The `dag-sparkline` is a view-only component; `decision_card` is the new fixture.

## Proof criteria <!-- oc:id=sec_ai -->

1. `bindings.test.ts`: a `state` mutation renders instantly in the renderer and accumulates in the `state_delta` for the next `poll`. A `signal` event queues and returns on the next `poll`. <!-- oc:id=item_ak -->
1. `dirty.test.ts`: an agent `patch` to a dirty field is held; the next `poll` returns a `conflict` frame with both the human's value and the agent's intended value. A clean field accepts the patch normally. <!-- oc:id=item_al -->
1. The `decision_card` fixture is reproducible: a session opens with the card; the human types into notes (state, no round-trip); the human clicks submit (signal); the agent receives the submit event + the notes delta in one `poll`; the agent patches `selected: "opt_b"`; the renderer updates. <!-- oc:id=item_am -->
1. The `conflict` policy is honored: `agent-wins` overrides the human; `human-wins` keeps the human; `merge` calls the registered `merge` function; `ask` surfaces a `conflict` event. <!-- oc:id=item_an -->
1. `bun run check-types` clean. <!-- oc:id=item_ao -->
1. `bun run lint` clean. <!-- oc:id=item_ap -->
1. All new tests pass. <!-- oc:id=item_aq -->

## Risk <!-- oc:id=sec_aj -->

- **Medium.** Renderer behavior change. New runtime module. New `decision_card` fixture.
- Failure mode: state mutations not actually coalesced. Tests assert the 250 ms window.
- Failure mode: dirty-field tracking is one-way (human → dirty, but patch doesn't unset). Add a `clearDirty(nodeId, field)` call when the agent patch is acknowledged in a `poll` response.
- Failure mode: `merge` function called with non-deterministic result. `decision_card`'s `merge` for `notes` is `notes: humanValue + " " + agentValue` (deterministic). Test asserts.

## Out of scope (for later waves) <!-- oc:id=sec_ak -->

- Wave 4 is **not** a separate wave. Dirty-field protection lands here, with the binding model. (The plan originally listed Wave 4 separately; the assessment and the dependency analysis show it belongs with the binding model.)
- Wave 5 (persistence + `append`).
- Wave 6 (`contributes.components`).

## Definition of done <!-- oc:id=sec_al -->

- All proof criteria pass.
- `decision_card` works end-to-end in a real session.
- `docs/loom-progress.md` is updated with `Wave 3: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.