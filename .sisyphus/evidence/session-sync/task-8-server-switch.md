# Task 8 Evidence — Server Switch Guardrail <!-- oc:id=sec_aa -->

Current behavior:
- `triggerServerSwitch()` clears discovery/session state before reconnect
- `connectToOpenCode()` resets bootstrap/session pagination state
- first successful SSE open now runs reconciliation before trusting steady-state view

Effect:
- stale server state is cleared before new-server reconciliation repopulates session graph
- reconnect flow no longer depends on lucky future events alone

Note:
- full end-to-end server-switch fixture still pending in later regression task, but code path now contains explicit reconcile step