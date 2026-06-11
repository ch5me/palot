# Task 18 Evidence — Parent / Child Divergence Fixture <!-- oc:id=sec_aa -->

Fixtures/tests:
- `apps/desktop/src/renderer/atoms/session-sync-regressions.test.ts`
  - `child waiting bubbles through session request tree`
  - `timeout error marks parent-child divergence drift flag`

What it proves:
- child permission requests bubble to parent request tree
- timeout error marks canonical divergence drift flag

Execution proof:
- `bun test apps/desktop/src/main/palot-session-binding-store.test.ts apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx apps/desktop/src/renderer/atoms/session-sync-regressions.test.ts`