# Task 8 Evidence — Reconnect Reconciliation <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/services/connection-manager.ts`

Reconciliation behavior added:
- successful SSE open now triggers `reconcileSessionGraph("sse-connected")`
- project-client HMR recovery triggers `reconcileSessionGraph("project-client-recovery")`
- base-client recovery triggers `reconcileSessionGraph("base-client-recovery")`
- reconciliation refreshes active presence, project catalog, bootstrap directories, and targeted project session/status hydration

Deterministic convergence path:
1. reopen stream <!-- oc:id=item_aa -->
1. sync active presence <!-- oc:id=item_ab -->
1. reload project list <!-- oc:id=item_ac -->
1. union discovery bootstrap directories with active-session directories <!-- oc:id=item_ad -->
1. reload session lists for those directories <!-- oc:id=item_ae -->

Verification:
- desktop package typecheck passed after reconciliation-path changes