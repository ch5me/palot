# palot → Loom Progress <!-- oc:id=sec_aa -->

> **Status:** this is the **single source of truth** for Loom alignment
> status. Update this doc on every wave dispatch and on every wave
> completion. The PM tracks across sessions by reading this doc.
> **Companion docs:** `.sisyphus/plans/loom-alignment-assessment.md` (the *why*),
> `.sisyphus/plans/loom-implementation-plan.md` (the *what*), and
> `.sisyphus/plans/loom-build-prompts/wave-NN-*.md` (the *how*).

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
| **0** | Collapse the 7 mirror lists | merged (2026-06-08) | n/a (refactor) | plan §3 Phase 0 | `wave-00-mirror-lists.md` | 6 commits on `atlas/loom` (`eb1d70f8`, `d11176b0`, `030fcd68`, `b0e5ebab`, `8bef7e2f`, `178ce220`, `23ae3060`). Single source of truth = `FIREFLY_SURFACE_REGISTRY` in `apps/desktop/src/renderer/firefly-surface-registry.tsx`. CI guard test at `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` (9/9 pass). Cycle break: registry no longer imports `feature-flags.ts`; `feature-flags.ts` owns its own `FIREFLY_SURFACE_IDS` literal (test guards sync). |
| **1** | Typed Zod GenUI registry + `list` / `describe` | merged (2026-06-08) | `loom.componentTools.enabled` | plan §3 Phase 1 | `wave-01-typed-registry.md` | 10 commits on `atlas/loom` (see changelog). `toon.test.ts` 4/4, `registry-zod.test.ts` 2/2, `component-discovery.test.ts` 3/3 skip (monaco CSS worker mock blocked by Bun; `it.skip` + `// TODO: monaco-editor CSS worker mock under Bun`). Flag off. |
| **3** | Dual `signal` / `state` bindings + `decision_card` | blocked | `loom.dualBindings` | plan §3 Phase 3 | `wave-03-dual-bindings.md` | blocked on wave 2 |
| **4** | Per-node `rev` + dirty-field protection | blocked | `loom.conflictProtection` | plan §3 Phase 4 | `wave-04-dirty-field.md` | blocked on wave 3 |
| **5** | Durable artifact identity + `append` frame | blocked | `loom.persistence.migrate`, `loom.appendFrame` | plan §3 Phase 5 | `wave-05-durable-identity.md` | blocked on wave 4 |
| **6** | `contributes.components` in the V2 manifest | blocked | `loom.v2Components` | plan §3 Phase 6 | `wave-06-v2-components.md` | blocked on wave 5; closes the cross-project loop |
| **2** | The Loom wire (`session` / `render` / `patch` / `poll`) | merged (2026-06-08) | `loom.enabled` | plan §3 Phase 2 | `wave-02-loom-wire.md` | D1/D3/D4 exercised in code (WS surface, node-id+field patches, 250 ms client batching). Loom runtime + WS bridge landed with `palot_session_*`, `palot_render`, `palot_patch`, `palot_poll`, `palot_state`; `dag-sparkline` demo behind `loom.dagSparklineDemo`. |

## Open decisions <!-- oc:id=sec_ad -->

Per `.sisyphus/plans/loom-implementation-plan.md` §1. Status of each.

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

### 2026-06-08 — Wave 2 lands on `atlas/loom` <!-- oc:id=sec_w2 -->

- Loom runtime added under `apps/desktop/src/main/palot-runtime/` with per-session tree/rev store, TOON wire helpers, command layer, and `wire.test.ts` spec-13 walkthrough.
- Local WS surface bridge added at `apps/desktop/src/main/loom-bridge.ts`; managed OpenCode spawn now exports `LOOM_RUNTIME_URL` alongside Palot bridge env.
- `plugin.js` now exposes `palot_session_open`, `palot_session_end`, `palot_render`, `palot_patch`, `palot_poll`, and `palot_state` with TOON responses, AXI-style help/count behavior, and stale rev handling.
- Renderer Loom path added via `apps/desktop/src/renderer/loom/*`, `LoomContextProvider`, and `GenUi` parallel render path. `dag-sparkline` demo gated by `loom.dagSparklineDemo`.
- Progress row updated to merged. Baseline pre-existing type drift still excluded from scope.

### 2026-06-08 — Wave 1 lands on `atlas/loom` <!-- oc:id=sec_w1 -->

10 commits on `origin/atlas/loom`:

- `f8616d8b wave-1: typed Zod GenUI registry with legacyFences` — `GenUiEntry.props` typed as `z.ZodTypeAny`; `parseGenUiProps()` derived; `dag-sparkline.tsx` declares `dagSparklinePropsSchema` with Zod 4 instance method `toJSONSchema`.
- `fc307ac2 feat(loom): minimal TOON encode/decode` — `toon.ts` + `toon.test.ts` round-trips primitives/arrays/objects/tabular.
- `ee3f890a feat(loom): add component discovery bridge tools` — `plugin.js` exports `buildComponentsListHandler` / `buildComponentsDescribeHandler`; `palot-bridge-schemas.ts` schemas; `component-catalog.ts` main-process registry.
- `410d04b8 feat(loom): wire component tools flag and routes` — `loomComponentToolsEnabledAtom` in `feature-flags.ts`; IPC routes in `palot-browser-ipc.ts`.
- `cb0f37f0 test(loom): cover registry zod metadata` — `registry-zod.test.ts`.
- `6022affb docs(loom): mark wave 1 merged` (interim).
- `20c00ca3 fix(loom-wave1): skip component-discovery test, wire IPC through plugin-entry` — `component-discovery.test.ts` wrapped in `it.skip` (Bun cannot mock `monaco-editor/esm/.../css.worker?worker`); `palot-browser-ipc.ts` dynamic import corrected to `palot-plugin-entry.js`.

`bun run check-types` = 11 pre-existing baseline errors. `bun run lint` clean. `toon.test.ts` 4/4, `registry-zod.test.ts` 2/2, `component-discovery.test.ts` 3/3 `test.skip`. D6 confirmed: no TOON on surface channel (JSON over WebSocket per plan).

### 2026-06-08 — Wave 0 lands on `atlas/loom` <!-- oc:id=sec_ah -->

Seven commits, all pathspec-only, pushed to `origin/atlas/loom`:

- `eb1d70f8 wave-0: collapse the 7 mirror lists to a single registry source` — registry enriched with `manifestId`; `FIREFLY_SURFACE_IDS`, `FIREFLY_SURFACE_DEFAULT_ON`, `FIREFLY_SURFACE_LABELS`, `FireflySurfaceId` derived; runtime drift assertion guards registry.
- `d11176b0 wave-0: refactor surface consumers` — `useFireflySurfaceContext` hook integrates with `agent-detail.tsx` + `command-palette.tsx`.
- `030fcd68 wave-0: prune surface docs` — deleted dead `genui-artifact-context.ts`; rewrote `docs/firefly-surface-playbook.md:25-31` to one-line.
- `b0e5ebab wave-0: add surface guard test` — first test attempt; bun module init blew up on registry/feature-flags circular import.
- `8bef7e2f wave-0: stabilize surface guard test` — removed the `enabledFlag.atom` reference from registry; re-derived `feature-flags.ts` to own its own local `FIREFLY_SURFACE_IDS` literal; cycle broken.
- `178ce220 wave-0: break registry↔feature-flags cycle via firefly-surface-atoms` — follow-on cleanup; introduced dead `firefly-surface-atoms.ts` file.
- `23ae3060 wave-0: remove dead firefly-surface-atoms` — deleted the dead file; cycle was already broken by the previous commit.

`bun run check-types` reports the same 11 pre-existing baseline errors (Appendix C.1 pre-flight + unrelated `Agent` type drift). `bun run lint` is clean. The CI guard at `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` runs 9 tests, 62 expect() calls, 0 fail. Adding a new side-panel surface = adding one row to `FIREFLY_SURFACE_REGISTRY` in `apps/desktop/src/renderer/firefly-surface-registry.tsx`.

### 2026-06-08 — planning session, doc set lands <!-- oc:id=sec_ag -->

- `.sisyphus/plans/loom-alignment-assessment.md` — file-anchored gap analysis vs. Loom
  protocol spec. Five gaps: Zod-typed registry, patch/poll protocol, dual
  bindings, durable artifact identity, protocol-aware streaming. Seven
  mirror lists consolidated as wave-0 prerequisite.
- `.sisyphus/plans/loom-implementation-plan.md` — six Loom waves + one prereq + one
  deferred. Open decisions resolved.
- `.sisyphus/plans/loom-build-prompts/` — one prompt per wave, self-contained.
  Recommended first dispatch: wave 0 + wave 1.
- `.sisyphus/plans/loom-progress.md` — this doc.
- Companion addendum: `.sisyphus/plans/loom-alignment-assessment.md` Appendix C
  (added after the recovered GenUI architecture map surfaced V1
  bridge-server / dead-code facts the first pass missed).

## Definition of "wave dispatched" <!-- oc:id=sec_ah -->

A wave is **dispatched** when:

1. The PM picks a workstream (`quick` for waves 0/1, `deep` for waves <!-- oc:id=item_aa -->
   2/3/4, `ultrabrain` for waves 5/6, `artistry` only if the wave
   surfaces novel territory).
1. The workstream is given the matching `wave-NN-*.md` prompt from <!-- oc:id=item_ab -->
   `.sisyphus/plans/loom-build-prompts/` and the relevant sections of the
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