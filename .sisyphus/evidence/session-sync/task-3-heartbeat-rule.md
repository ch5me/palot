# Task 3 Evidence — Heartbeat Rule <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Explicit rule:
- local presence heartbeat proves liveness
- heartbeat should not outrank newer content activity when ordering recent sessions
- heartbeat may seed `lastActivityAt` only when no content/session timestamps exist yet

Result:
- “alive locally” and “new content activity” separated cleanly.