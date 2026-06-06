# Session Sync Audit Remediation Task Breakdown <!-- oc:id=sec_aa -->

## Wave 1 <!-- oc:id=sec_ab -->

1. Define canonical session sync invariants and scope boundaries <!-- oc:id=item_aa -->
- Write `docs/session-sync-reconciliation.md` invariant section covering visibility, freshness, active-state, attachment, child linkage, reconciliation guarantees, exclusion rules, and source precedence.
- Capture failure-state vocabulary in `docs/session-sync-reconciliation.md` for stale, missing, orphaned, detached, waiting, retrying, invisible-but-running.
- Add evidence checklist in `.sisyphus/evidence/session-sync/task-1-invariants.md` proving each invariant names a concrete source of truth.
- Add scope audit in `.sisyphus/evidence/session-sync/task-1-scope-check.md` confirming no unrelated product redesign work entered plan artifacts.

1. Map every session-state source and freshness signal <!-- oc:id=item_ab -->
- Inventory all session inputs in `docs/session-sync-reconciliation.md`: project list API, session list API, session status API, `/global/event`, active session presence snapshot/stream, SQLite helper evidence, sandbox/worktree mapping, child metadata.
- Map current code owners and update cadence for each source with references to `apps/desktop/src/renderer/services/connection-manager.ts`, `apps/desktop/src/renderer/hooks/use-discovery.ts`, `apps/server/src/services/opencode-active-sessions.ts`, `apps/desktop/src/main/opencode-manager.ts`, `apps/desktop/src/renderer/atoms/actions/event-processor.ts`.
- Record blind spots where live events can arrive before hydration and where renderer currently drops or under-materializes sessions.
- Write evidence files `.sisyphus/evidence/session-sync/task-2-source-map.md` and `.sisyphus/evidence/session-sync/task-2-freshness-map.md`.

1. Design timestamp/activity model replacing stale `session.time.updated` reliance <!-- oc:id=item_ac -->
- Define canonical `lastActivityAt` precedence in `docs/session-sync-reconciliation.md` using message completion, part updates/deltas, session updates, presence heartbeat, and explicit degraded fallback.
- Specify separate `lastContentActivityAt` vs local liveness/presence semantics for ordering vs “running locally”.
- Identify store fields required in `apps/desktop/src/renderer/atoms/sessions.ts` and `apps/desktop/src/renderer/lib/types.ts` for canonical timestamps and provenance.
- Write evidence files `.sisyphus/evidence/session-sync/task-3-precedence.md` and `.sisyphus/evidence/session-sync/task-3-heartbeat-rule.md`.

1. Add sync diagnostics model and drift vocabulary <!-- oc:id=item_ad -->
- Define structured drift classes in `docs/session-sync-reconciliation.md`: invisible-running, stale-recency, missing-child, dropped-reconnect, pending-tool-vs-dead-child, attached-but-unhydrated, unknown-session-event, stale-worktree-mapping.
- Define script/UI-consumable diagnostic object fields for reason, severity, sources, expected state, observed state, timestamps, and recommended next checks.
- Note how diagnostics map to existing debug tooling in `scripts/debug-sessions.ts` and future renderer debug surfaces.
- Write evidence files `.sisyphus/evidence/session-sync/task-4-drift-coverage.md` and `.sisyphus/evidence/session-sync/task-4-schema-check.md`.

1. Expand operator debug tooling for session visibility and freshness analysis <!-- oc:id=item_ae -->
- Extend `scripts/debug-sessions.ts` to show canonical activity evidence, visibility reasons, parent/child divergence, and attached/unhydrated presence clues.
- Add helper modes or flags to compare DB recency vs renderer/session-store/API status inputs.
- Update `docs/session-debugging.md` with hidden-session, stale-recency, reconnect, and child-divergence audit flows.
- Add concise command pointers in `AGENTS.md` for canonical session-debug workflow.
- Capture proof in `.sisyphus/evidence/session-sync/task-5-hidden-session.md` and `.sisyphus/evidence/session-sync/task-5-freshness.md`.

## Wave 2 <!-- oc:id=sec_ac -->

1. Redesign startup/discovery hydration so active sessions cannot be skipped by preload limits <!-- oc:id=item_af -->
- Replace fixed focused-project preload assumption in `apps/desktop/src/renderer/hooks/use-discovery.ts` with explicit session graph bootstrap inputs.
- Add bootstrap union logic in `apps/desktop/src/renderer/services/connection-manager.ts` for focused projects, active local sessions, attached sessions, open/navigated sessions, and possibly child-linked sessions.
- Ensure unknown active sessions outside focused project preload are hydrated through targeted `getSession`/`listSessions` paths without loading whole backlog.
- Update discovery/project store handling so surfaced sessions can append owning projects safely.
- Capture evidence in `.sisyphus/evidence/session-sync/task-6-hydration.md` and `.sisyphus/evidence/session-sync/task-6-bounds.md`.

1. Redesign local-active-session presence detection beyond attach-only assumptions <!-- oc:id=item_ag -->
- Strengthen `apps/server/src/services/opencode-active-sessions.ts` and `apps/desktop/src/main/opencode-manager.ts` parity so both Electron and browser-mode enumerate attach and inferred sessions the same way.
- Expose presence source/confidence metadata through `apps/desktop/src/renderer/services/backend.ts` and related preload/server APIs.
- Hydrate/infer sessions started without `opencode attach` using recent root-session correlation by directory and process start time.
- Ensure presence snapshots can explain source and confidence in diagnostics and store fields.
- Capture evidence in `.sisyphus/evidence/session-sync/task-7-non-attach.md` and `.sisyphus/evidence/session-sync/task-7-source-model.md`.

1. Add full reconciliation pass after SSE connect/reconnect/server switch <!-- oc:id=item_ah -->
- Add explicit reconciliation pipeline in `apps/desktop/src/renderer/services/connection-manager.ts` after SSE open/reopen and HMR/base-client recovery.
- Re-fetch authoritative global/project/session state needed for open sessions, attached sessions, focused projects, and active presence snapshots.
- Materialize placeholder/minimal store entries when live events arrive for unknown sessions, then backfill via reconciliation.
- Clear/partition old server state safely on server switch before applying new reconciled data.
- Capture evidence in `.sisyphus/evidence/session-sync/task-8-reconnect.md` and `.sisyphus/evidence/session-sync/task-8-server-switch.md`.

1. Fix event batching/flush semantics for idle, buffered parts, and stale-loop disposal <!-- oc:id=item_ai -->
- Audit `apps/desktop/src/renderer/services/connection-manager.ts` batcher and flush paths for `session.status idle`, `session.idle`, disconnect, reconnect, and stale-loop disposal.
- Ensure streaming/non-streaming part buffers flush identically regardless of idle signal shape.
- Make reconciliation preserve or rehydrate truth if stale loop dies mid-buffer.
- Add deterministic per-session flush boundaries to avoid cross-session interference.
- Capture evidence in `.sisyphus/evidence/session-sync/task-9-idle-flush.md` and `.sisyphus/evidence/session-sync/task-9-stale-loop.md`.

1. Define child-session/task reconciliation contract <!-- oc:id=item_aj -->
- Document parent/child liveness contract in `docs/session-sync-reconciliation.md` using `parentID`, descendant requests, tool/task card status, and child activity propagation.
- Refactor child-link derivation surfaces in `apps/desktop/src/renderer/atoms/derived/agents.ts`, `apps/desktop/src/renderer/atoms/derived/session-requests.ts`, and `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx` to carry degraded/divergent state.
- Ensure child waiting (permission/question) bubbles to parent consistently and is auditable.
- Capture evidence in `.sisyphus/evidence/session-sync/task-10-timeout-divergence.md` and `.sisyphus/evidence/session-sync/task-10-waiting-bubble.md`.

## Wave 3 <!-- oc:id=sec_ad -->

1. Refactor renderer session store around reconciled freshness fields <!-- oc:id=item_ak -->
- Extend `SessionEntry` in `apps/desktop/src/renderer/atoms/sessions.ts` with canonical activity timestamps, presence details, visibility reasons, drift flags, and hydration provenance.
- Extend `Agent`/shared types in `apps/desktop/src/renderer/lib/types.ts` to expose canonical sync fields needed by consumers.
- Centralize session truth updates in session atoms/actions rather than component-local derivation.
- Capture evidence in `.sisyphus/evidence/session-sync/task-11-store-shape.md` and `.sisyphus/evidence/session-sync/task-11-hidden-store.md`.

1. Refactor sidebar Active/Recent/PM derivation to use canonical session graph <!-- oc:id=item_al -->
- Update `apps/desktop/src/renderer/components/sidebar.tsx` and `apps/desktop/src/renderer/atoms/derived/agents.ts` to sort/filter using canonical `lastActivityAt`, presence, visibility, and exclusion reason fields.
- Ensure Active Now criteria no longer depend on `createdAt` sorting when actual activity differs.
- Keep PM tagging and pinned behavior layered on top of canonical graph, not separate recency rules.
- Capture evidence in `.sisyphus/evidence/session-sync/task-12-active-sidebar.md` and `.sisyphus/evidence/session-sync/task-12-recent-order.md`.

1. Refactor command palette and tray session surfacing to share same model <!-- oc:id=item_am -->
- Update `apps/desktop/src/renderer/components/command-palette.tsx` active session filtering to match canonical status/visibility semantics.
- Update `apps/desktop/src/main/tray.ts` recent/live session ordering to stop relying on raw `session.time.updated` only.
- Share a single derivation helper or serialized session graph input between renderer and tray/main where practical.
- Capture evidence in `.sisyphus/evidence/session-sync/task-13-cross-surface.md` and `.sisyphus/evidence/session-sync/task-13-hidden-surface.md`.

1. Add explicit session visibility reasons and stale-state indicators in debug surfaces <!-- oc:id=item_an -->
- Add debug-only indicators in renderer surfaces for visibility reason, drift class, stale timestamps, and child divergence.
- Wire structured diagnostics from store into sidebar/chat/session debug surfaces without polluting normal UX.
- Align wording with `docs/session-debugging.md` and diagnostics schema.
- Capture evidence in `.sisyphus/evidence/session-sync/task-14-stale-indicator.md` and `.sisyphus/evidence/session-sync/task-14-visibility-reason.md`.

1. Add resilience for HMR/base-client/project-client recovery paths <!-- oc:id=item_ao -->
- Ensure `getBaseClient`/`getProjectClient` recovery in `apps/desktop/src/renderer/services/connection-manager.ts` triggers reconciliation and safe state reset order.
- Refresh sandbox/worktree mappings and child context during recovery, not only SSE stream.
- Verify server switch and client recreation do not leak stale sessions or orphan attached-state booleans.
- Capture evidence in `.sisyphus/evidence/session-sync/task-15-hmr.md` and `.sisyphus/evidence/session-sync/task-15-project-client.md`.

## Wave 4 <!-- oc:id=sec_ae -->

1. Add regression tests and scripted fixtures for missed active sessions <!-- oc:id=item_ap -->
- Add fixture/harness code for active local sessions outside focused preload assumptions using `scripts/` helpers and/or main/renderer tests.
- Cover root session surfacing plus explicit exclusion reasons for noise sessions.
- Persist proof outputs in `.sisyphus/evidence/session-sync/task-16-fixture.md` and `.sisyphus/evidence/session-sync/task-16-exclusions.md`.

1. Add regression tests and scripted fixtures for reconnect/event-loss drift <!-- oc:id=item_aq -->
- Build deterministic reconnect/server-change fixture covering stale state, dropped buffers, unknown-session-first events, and server switch drift.
- Add tests/helpers around `apps/desktop/src/renderer/services/connection-manager.ts` batch/reconcile paths.
- Persist proof outputs in `.sisyphus/evidence/session-sync/task-17-reconnect-fixture.md` and `.sisyphus/evidence/session-sync/task-17-buffered-parts.md`.

1. Add regression tests and scripted fixtures for child/session timeout divergence <!-- oc:id=item_ar -->
- Build parent timeout vs live child and child waiting fixtures around session-request and sub-agent card derivation.
- Add proof that degraded/divergent state surfaces correctly.
- Persist proof outputs in `.sisyphus/evidence/session-sync/task-18-parent-child.md` and `.sisyphus/evidence/session-sync/task-18-waiting.md`.

1. Rollout plan, migration safeguards, and failure fallback behavior <!-- oc:id=item_as -->
- Add rollout section to `docs/session-sync-reconciliation.md` describing guarded enablement, dual-read/diagnostic mode, rollback triggers, and reconciliation failure behavior.
- Define what client does when reconciliation fails, including diagnostics emission and degraded mode.
- Persist proof outputs in `.sisyphus/evidence/session-sync/task-19-rollout.md` and `.sisyphus/evidence/session-sync/task-19-fallback.md`.

1. Documentation, runbook updates, and team debugging workflow hardening <!-- oc:id=item_at -->
- Finalize `docs/session-debugging.md`, `docs/session-sync-reconciliation.md`, and `AGENTS.md` so future agents can diagnose hidden/stale/divergent sessions fast.
- Document parity expectations between Electron and browser mode, helper commands, evidence capture, and triage order.
- Persist proof outputs in `.sisyphus/evidence/session-sync/task-20-runbook.md` and `.sisyphus/evidence/session-sync/task-20-guidance.md`.

## Final Wave <!-- oc:id=sec_af -->

F1. Plan Compliance Audit
- Cross-check deliverables, must-haves, and must-not-haves against docs, code, scripts, and evidence files.

F2. Code Quality Review
- Run `bun run lint`, `bun run check-types`, targeted helper/test commands, and inspect for duplicated state logic and silent fallthroughs.

F3. Real QA
- Execute startup, reconnect, hidden-active-session, stale-recency, child-divergence, and server-switch scenarios and save evidence.

F4. Scope Fidelity Check
- Verify session-sync changes did not drift into unrelated product work.