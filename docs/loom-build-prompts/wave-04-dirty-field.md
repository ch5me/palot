# Wave 4 — Per-node `rev` + dirty-field protection (Loom §8) <!-- oc:id=sec_aa -->

> **Status:** ready to dispatch (after wave 3 ships + dogfood).
> **Plan section:** `docs/loom-implementation-plan.md` §3 Phase 4.
> **Assessment anchor:** `docs/loom-alignment-assessment.md` Gap 1.4
> (per-node `rev`), Gap 3 (conflict surfacing).
> **Goal:** the agent's tree is authoritative. Concurrent human edits
> are never silently clobbered. Every `palot_patch` carries the
> expected `rev`; mismatches are rejected with a structured 409-style
> response. Patches to dirty fields are held and surfaced as a
> `conflict` event on the next `palot_poll`. Per-component conflict
> policy.

## Context <!-- oc:id=sec_ab -->

Wave 3 gave us the dual binding model. The next invariant from the
Loom spec (§8) is **agent-authoritative reconciliation with dirty-field
protection**. Without it, an agent's `palot_patch` can clobber a
human's in-progress edit on a `notes` field. The runtime holds the
patch; the next `palot_poll` returns a `conflict` event with both
values; the agent decides.

This is **deliberately not CRDT** for the v0 single-human+single-agent
case. Last-write-wins with dirty protection is enough and vastly
simpler. CRDT is a v2 multi-human concern.

## Touched files <!-- oc:id=sec_ac -->

### New <!-- oc:id=sec_ad -->

- `apps/desktop/src/main/palot-runtime/dirty.ts` — per-field `dirty`
  set per node. Marked when a state binding mutates a field; cleared
  when the agent's `palot_patch` succeeds on a clean field.
- `apps/desktop/src/main/palot-runtime/conflict.ts` — conflict
  resolution: per-component `conflictPolicy: "agent-wins" |
  "human-wins" | "merge" | "ask"`. Default `"ask"`. `merge` requires
  a per-component `merge` function.
- `apps/desktop/src/main/palot-runtime/__tests__/dirty.test.ts` — Bun.
- `apps/desktop/src/main/palot-runtime/__tests__/conflict.test.ts` —
  Bun.

### Changed <!-- oc:id=sec_ae -->

- `apps/desktop/src/main/palot-runtime/session-store.ts` — extend
  the tree to carry per-node `rev`; each `palot_patch` carries the
  expected `rev`; mismatches are rejected.
- `apps/desktop/src/main/palot-runtime/commands.ts` — `palot_patch`
  returns `errorCode: "stale_rev" | "dirty_field"` on conflict
  (TOON). `palot_poll` returns the held-conflict set.
- `apps/desktop/src/renderer/loom/use-loom-session.ts` — surface
  `conflict` events to the registered component via a
  `onConflict(nodeId, field, humanValue, agentValue)` callback
  declared in the binding.
- `apps/desktop/src/renderer/genui/registry.ts` — add a
  `conflictPolicy` slot on the component's binding declaration. Add
  an optional `merge` function for the `merge` policy.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` — Zod schemas for
  the conflict response shape.

## Required tools <!-- oc:id=sec_af -->

- All standard.
- `bun test`.

## Must do <!-- oc:id=sec_ag -->

1. Extend `SessionStore` to carry per-node `rev`. Initialize to <!-- oc:id=item_aa -->
   the parent's `rev + 1` on creation. Increment on every patch
   that succeeds.
1. `palot_patch --expected-rev N` carries the expected per-node <!-- oc:id=item_ab -->
   `rev`. If the runtime's per-node `rev` is `!= N`, return
   `errorCode: "stale_rev"` + the current `rev` + a delta (the
   dirty fields, if any).
1. `dirty.ts` tracks per-field `dirty` set per node. A state <!-- oc:id=item_ac -->
   binding mutates a field → mark dirty. The runtime knows the
   field has unsent human edits.
1. `palot_patch` to a dirty field: <!-- oc:id=item_ad -->
   - **Default (`"ask"` policy)**: hold the patch, surface as
     `conflict` on the next `palot_poll`. Do NOT apply.
   - **`"agent-wins"` policy**: apply the patch. Clear the dirty
     flag. Surface a `conflict_resolved: "agent-wins"` event.
   - **`"human-wins"` policy**: drop the patch. Clear the dirty
     flag. Surface a `conflict_resolved: "human-wins"` event.
   - **`"merge"` policy**: call the component's `merge` function
     with `(humanValue, agentValue)`, apply the result. Clear the
     dirty flag. Surface a `conflict_resolved: "merge"` event.
1. The renderer's `use-loom-session` exposes <!-- oc:id=item_ae -->
   `onConflict(nodeId, field, humanValue, agentValue)` to the
   component. The component chooses how to render the conflict
   (e.g. a diff tooltip, a side-by-side, a banner).
1. AXI compliance for the new conflict output: structured TOON, <!-- oc:id=item_af -->
   smallest-schema, `help[]` after the conflicts list.
1. New Bun tests: <!-- oc:id=item_ag -->
   - `dirty.test.ts`: state binding marks dirty; agent patch on
     clean field clears it; agent patch on dirty field holds.
   - `conflict.test.ts`: each policy produces the expected outcome
     and the expected `conflict` / `conflict_resolved` event.
   - A regression test that covers each of the 4 policies on the
     `decision_card` `notes` field.

## Must NOT do <!-- oc:id=sec_ah -->

- No CRDT. v0 is last-write-wins with dirty protection. CRDT is v2
  multi-human.
- No persistence. Sessions are still in-memory. (Wave 5.)
- No `append` frame. (Wave 5.)
- No new components. The `decision_card` is the fixture; existing
  components get the default `"ask"` policy.
- Do not change the wire's patch addressing or binding model.

## Proof criteria <!-- oc:id=sec_ai -->

1. `bun run check-types` clean. <!-- oc:id=item_ah -->
1. `bun run lint` clean. <!-- oc:id=item_ai -->
1. `dirty.test.ts` + `conflict.test.ts` pass. <!-- oc:id=item_aj -->
1. End-to-end: a real OpenCode session opens a Loom session, the <!-- oc:id=item_ak -->
   agent renders a `decision_card`. The human types into `notes`
   (state, marks dirty). The agent issues `palot_patch
   --node card1 --field notes --value "agent's version"`. The
   runtime holds the patch. The agent's `palot_poll` returns:
   - `events[]`: empty.
   - `state_delta[]`: the human's edits.
   - `conflicts[]`: one entry with `field: "notes"`,
     `humanValue: "human's version"`, `agentValue: "agent's
     version"`.
1. The `decision_card`'s `conflictPolicy` is set to `"ask"`. The <!-- oc:id=item_al -->
   surface renders a conflict banner. The human picks: "use
   agent's", "keep mine", or "merge". The runtime applies the
   resolution. A `conflict_resolved` event surfaces on the next
   `palot_poll`.
1. The agent can `palot_patch --node card1 --field notes --value <!-- oc:id=item_am -->
   "another version" --expected-rev 0` after the human's edit.
   The runtime returns `errorCode: "stale_rev"`.
1. The existing fence path still works. <!-- oc:id=item_an -->

## Risk <!-- oc:id=sec_aj -->

- Medium. The runtime's `rev` semantics change. Mitigations: tests
  in `dirty.test.ts` and `conflict.test.ts`; full regression test of
  the existing fence flow.
- Failure mode: dirty flag set on a field that was never edited.
  Test in `dirty.test.ts` asserts the flag clears on patch.
- Failure mode: conflict held forever (human never resolves). Add a
  per-session `max_pending_conflicts` cap; when exceeded, the oldest
  conflict is auto-resolved with the component's default policy.

## Out of scope (for later waves) <!-- oc:id=sec_ak -->

- Wave 5: durable artifact identity, `append` frame.
- Wave 6: V2 `contributes.components`.
- Tool-renderer consolidation (wave 7, deferred).

## Definition of done <!-- oc:id=sec_al -->

- All proof criteria pass.
- `docs/loom-progress.md` is updated with `Wave 4: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.
- Manual dogfood: a real OpenCode session triggers a conflict;
  resolution path is verified.