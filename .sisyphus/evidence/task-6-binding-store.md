# Task 6 — Persistent mapping store and lifecycle hooks <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added lifecycle adapter in `apps/desktop/src/main/palot-session-binding-store.ts`.
- Added tests in `apps/desktop/src/main/palot-session-binding-store.test.ts`.

## Store behavior <!-- oc:id=sec_ac -->

- `ensureSessionBindingForSession(sessionId)` creates missing bindings in `attaching` state.
- `markSessionBindingAttached(sessionId)` moves bindings to `attached`.
- `releaseBindingForSession(sessionId)` marks bindings `released` without deleting history.
- `reconcileBindingsWithActiveSessions(activeSessionIds)`:
  - restores released bindings if their session id is present again
  - releases non-active bindings that were still live
- `applyBindingLifecycleEvent(event)` maps OpenCode events:
  - `session.created` -> attach/create binding
  - `session.updated` -> mark attached
  - `session.idle` -> mark attached
  - `session.deleted` -> release binding

## Notes <!-- oc:id=sec_ad -->

- This is the lifecycle/store layer. Wiring it into a live main-process event stream is still pending follow-up integration work.
- Binding persistence still uses the T1 JSON-backed store and does not place secrets in the record.
- Restart recovery is handled by `reconcileBindingsWithActiveSessions(activeSessionIds)` and can be called from any future active-session snapshot source.