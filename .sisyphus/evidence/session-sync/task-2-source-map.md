# Task 2 Evidence — Source Map <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Covered surfaces:
- sidebar active/recent/PM
- command palette
- tray
- session view
- sub-agent cards
- debug script/runbook

Covered sources:
- project list API
- session list API
- session get API
- session status API
- global SSE
- active presence snapshot/stream
- process scan
- inferred runtime/session correlation
- SQLite helper
- sandbox/worktree mapping
- child linkage via `parentID`

Result:
- Every visible session surface has a backing-source map.
- Known blind spots called out: focused preload gap, Electron/browser parity gap, reconnect gap, child row absence.