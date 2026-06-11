# Task 9 Evidence — Idle Flush Convergence <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/services/connection-manager.ts`
- `apps/desktop/src/renderer/atoms/actions/event-processor.ts`

Converged behavior:
- `session.status { type: "idle" }` flushes streaming parts into main store
- `session.idle` now flushes same streaming path
- `session.idle` also updates session status atom to `{ type: "idle" }`

Result:
- both idle-style signals converge on same final renderer state
- buffered text/reasoning parts no longer depend on one event shape only