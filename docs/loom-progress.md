# palot → Loom Progress <!-- oc:id=sec_aa -->

> **Status:** this is the **single source of truth** for Loom alignment
> status. Update this doc on every wave dispatch and on every wave
> completion. The PM tracks across sessions by reading this doc.
> **Companion docs:** `docs/loom-alignment-assessment.md` (the *why*),
> `docs/loom-implementation-plan.md` (the *what*), and
> `docs/loom-build-prompts/wave-NN-*.md` (the *how*).

## Legend <!-- oc:id=sec_ab -->

- `not started` — wave prompt is written; nothing else.
- `dispatched` — workstream is in flight.
- `in review` — PR open; awaiting review.
- `merged` — landed on `main`; behind feature flag (or shipped, if
  no flag).
- `flagged off` — merged but feature flag is off; not yet dogfooded.
- `shipped` — merged, feature flag on, dogfooded by a real OpenCode
  session.
- `blocked` — explicit blocker named in the row.

## Wave status <!-- oc:id=sec_ac -->

| Wave | Title | Status | Feature flag | Doc | Prompt | Notes |
|---|---|---|---|---|---|---|
| **0** | Collapse the 7 mirror lists | not started | n/a (refactor) | plan §3 Phase 0 | `wave-00-mirror-lists.md` | prerequisite for everything |
| **1** | Typed Zod GenUI registry + `list` / `describe` | not started | `loom.componentTools.enabled` | plan §3 Phase 1 | `wave-01-typed-registry.md` | first Loom wave; smallest safe step |
| **2** | The Loom wire (`session` / `render` / `patch` / `poll`) | blocked | `loom.enabled` | plan §3 Phase 2 | `wave-02-loom-wire.md` | blocked on D1, D3, D4 |
| **3** | Dual `signal` / `state` bindings + `decision_card` | complete (2026-06-08) | `loom.dualBindings` | plan §3 Phase 3 | `wave-03-dual-bindings.md` | landed on `atlas/loom`; dirty-field protection included |
| **4** | Per-node `rev` + dirty-field protection | complete (2026-06-08) | `loom.conflictProtection` | plan §3 Phase 4 | `wave-04-dirty-field.md` | landed on `atlas/loom`; per-node `rev` fence + `conflict.test.ts` coverage |
| **5** | Durable artifact identity + `append` frame | blocked | `loom.persistence.migrate`, `loom.appendFrame` | plan §3 Phase 5 | `wave-05-durable-identity.md` | blocked on wave 4 |
| **6** | `contributes.components` in the V2 manifest | blocked | `loom.v2Components` | plan §3 Phase 6 | `wave-06-v2-components.md` | blocked on wave 5; closes the cross-project loop |
| **7** | Tool-renderer consolidation (deferred) | not started | n/a (refactor) | plan §3 Phase 7 | `wave-07-tool-renderers.md` | post-Loom refactor; not part of Loom |

## Open decisions <!-- oc:id=sec_ad -->

Per `docs/loom-implementation-plan.md` §1. Status of each.

| # | Decision | Status | Resolution |
|---|---|---|---|
| D1 | Transport to surface (WS vs SSE+POST) | **resolved** | WebSocket. |
| D2 | Streaming `append` frame | **resolved** | Include it (wave 5). |
| D3 | Patch addressing | **resolved** | Node-id + field. |
| D4 | Event batching window for `state` deltas | **resolved** | 250 ms default; `LOOM_POLL_BATCH_MS` env-tunable. |
| D5 | Component versioning on hot-reload | **resolved** | Version-pin per session. |
| D6 | TOON for the surface channel | **resolved** | No; JSON over WS. |

D1–D6 are all resolved at the plan level. Each wave prompt reaffirms the
decision it relies on. Update the `Resolution` column when a wave is
dispatched and a decision is exercised in code.

## Cross-project tracking <!-- oc:id=sec_ae -->

palot is the reference build-out. The V2 manifest is the contract
cross-project teams consume.

| Project | Status | Notes |
|---|---|---|
| **palot** | Loom waves 0–6 in flight | this doc |
| Firefly / ELF plugins | pending | consume the V2 `contributes.components` family (wave 6) |
| OpenCode fork | pending | wire Loom core as a built-in SessionStart hook (post-palot-wave-6) |
| CH5 agent CLIs/tools | ongoing | new tools run the AXI checklist by default |

## Changelog <!-- oc:id=sec_af -->

### 2026-06-08 — planning session, doc set lands <!-- oc:id=sec_ag -->

- `docs/loom-alignment-assessment.md` — file-anchored gap analysis vs. Loom
  protocol spec. Five gaps: Zod-typed registry, patch/poll protocol, dual
  bindings, durable artifact identity, protocol-aware streaming. Seven
  mirror lists consolidated as wave-0 prerequisite.
- `docs/loom-implementation-plan.md` — six Loom waves + one prereq + one
  deferred. Open decisions resolved.
- `docs/loom-build-prompts/` — one prompt per wave, self-contained.
  Recommended first dispatch: wave 0 + wave 1.
- `docs/loom-progress.md` — this doc.
- Companion addendum: `docs/loom-alignment-assessment.md` Appendix C
  (added after the recovered GenUI architecture map surfaced V1
  bridge-server / dead-code facts the first pass missed).

## Definition of "wave dispatched" <!-- oc:id=sec_ah -->

A wave is **dispatched** when:

1. The PM picks a workstream (`quick` for waves 0/1, `deep` for waves <!-- oc:id=item_aa -->
   2/3/4, `ultrabrain` for waves 5/6, `artistry` only if the wave
   surfaces novel territory).
1. The workstream is given the matching `wave-NN-*.md` prompt from <!-- oc:id=item_ab -->
   `docs/loom-build-prompts/` and the relevant sections of the
   assessment + plan.
1. The workstream is given the `loom-progress.md` URL and is asked <!-- oc:id=item_ac -->
   to update it on completion.

A wave is **shipped** when:

1. All proof criteria in the prompt pass. <!-- oc:id=item_ad -->
1. `bun run check-types` and `bun run lint` are clean. <!-- oc:id=item_ae -->
1. New Bun tests pass. <!-- oc:id=item_af -->
1. A PR is merged on `main`. <!-- oc:id=item_ag -->
1. The feature flag is on (for waves that gate behind one). <!-- oc:id=item_ah -->
1. A real OpenCode session has used the new tool/wire/binding in a <!-- oc:id=item_ai -->
   dogfood session.
1. The progress doc row is updated to `shipped` with a date. <!-- oc:id=item_aj -->

## Open questions for the PM <!-- oc:id=sec_ai -->

- **Who owns D1–D6 documentation?** Each resolved decision should be
  cited in the matching wave's PR description. The PM should call
  this out in the wave-2 dispatch.
- **When does the OpenCode fork team pick up the SessionStart hook
  work?** Palot waves 0–6 do not require OpenCode fork changes. The
  hook is post-palot. Schedule a follow-up plan doc when wave 6
  ships.
- **When does Firefly/ELF consume the V2 `contributes.components`
  family?** Same answer: post-palot-wave-6. The
  `COMPONENT_CONTRACT.md` doc in `shared/firefly-plugin/` is the
  contract. Coordinate with the Firefly/ELF leads when wave 6
  ships.
- **Is wave 7 (tool-renderer consolidation) actually needed?** Yes,
  but not for Loom. Schedule as a separate post-Loom workstream
  after wave 6 ships and is stable in production.

## How to use this doc <!-- oc:id=sec_aj -->

- **At the start of every session**, read this doc. It tells you
  which waves are dispatched, in review, merged, flagged off,
  shipped, or blocked.
- **At the end of every wave**, update the row in §"Wave status"
  with the new status, the date, and any notes. The PM uses this
  to track progress across sessions.
- **When a wave is blocked**, document the blocker in the row's
  `Notes` column. Unblockers land as small follow-up PRs (not as
  parts of the blocked wave).
- **When a decision is exercised in code**, update the `Open
  decisions` table. D1–D6 are all resolved at the plan level; the
  table becomes historical once waves 1–5 are merged.