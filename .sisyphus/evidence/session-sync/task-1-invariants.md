# Task 1 Evidence — Invariants <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Checklist:
- visibility invariant present
- freshness invariant present
- local presence invariant present
- status invariant present
- reconciliation invariant present
- flush invariant present
- child-session invariant present
- sandbox/worktree invariant present
- diagnostics invariant present
- each invariant names source precedence or concrete truth source

Result:
- All required sync domains documented.
- Source precedence explicitly named for existence, visibility, freshness, local presence, and status.
- Reconciliation and flush invariants explicitly separate live event handling from recovery behavior.