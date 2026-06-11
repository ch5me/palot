# Task 11 Evidence — Hidden Session Explainability In Store <!-- oc:id=sec_aa -->

Canonical store now carries explainability fields directly on session and agent shapes:
- `presenceSource`
- `visibilityReason`
- `driftFlags`
- `lastActivityAt`
- `lastContentActivityAt`

Result:
- a hidden active session no longer depends on component-local inference only
- renderer consumers can inspect why a session is visible, degraded, or sourced from attach/inferred presence