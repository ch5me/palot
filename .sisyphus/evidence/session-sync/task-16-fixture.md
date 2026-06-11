# Task 16 Evidence — Hidden Active Session Fixture <!-- oc:id=sec_aa -->

Fixture/tests:
- `apps/desktop/src/main/palot-session-binding-store.test.ts`
  - `idle status event repairs hidden active binding after timeout drift`

What it proves:
- a released/hidden binding can be restored when idle status evidence arrives later
- hidden active-session recovery no longer depends on manual intervention

Execution proof:
- `bun test apps/desktop/src/main/palot-session-binding-store.test.ts apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx`