# Task 9 Evidence — Stale Loop Disposal <!-- oc:id=sec_aa -->

Reconciliation safety:
- stale loop still discards its buffered queue when generation changes
- new active loop now runs explicit reconciliation on successful connect/recovery

Effect:
- old loop does not repopulate stale sessions after server switch
- lost buffered truth has deterministic recovery path through reconciliation-backed reloads instead of waiting for spontaneous events