# Task 19 Evidence — Reconciliation Failure Fallback <!-- oc:id=sec_aa -->

Fallback behavior documented in `docs/session-sync-reconciliation.md`.

Defined fallback:
- preserve last known good store when reconciliation fails
- emit explicit degraded diagnostics
- do not silently clear state and pretend success