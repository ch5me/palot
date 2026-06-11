# Task 19 Evidence — Rollout Guardrails <!-- oc:id=sec_aa -->

Rollout guidance now lives in `docs/session-sync-reconciliation.md` under rollout guardrails.

Guardrails documented:
- ship diagnostics/helper improvements first
- gate reconciliation/visibility changes behind internal dual-read mode if needed
- compare old vs new active/recent membership during rollout
- keep last known good state on reconciliation failure
- rollback triggers: hidden active session, reconnect drift, child divergence repro