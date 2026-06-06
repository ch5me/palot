# Task 4 Evidence — Drift Coverage <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Defined drift classes:
- invisible-running
- attached-but-unhydrated
- unknown-session-event
- stale-recency
- dropped-reconnect
- stale-worktree-mapping
- missing-child
- pending-tool-vs-dead-child
- timed-out-parent-live-child
- detached
- orphaned

Known issue mapping:
- hidden active session -> `invisible-running` or `attached-but-unhydrated`
- stale recent ordering -> `stale-recency`
- reconnect without convergence -> `dropped-reconnect`
- parent timeout while child active -> `timed-out-parent-live-child`
- child linkage loss -> `missing-child`

Result:
- Observed sync bugs land in named classes, not miscellaneous buckets.