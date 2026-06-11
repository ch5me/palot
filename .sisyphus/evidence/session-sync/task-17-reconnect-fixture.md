# Task 17 Evidence — Reconnect Drift Fixture <!-- oc:id=sec_aa -->

Fixture/tests:
- `apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx`
  - `supports reconnect drift fixture with precomputed debug badge`

What it proves:
- drift-state indicator survives a reconnect-style debug fixture path
- renderer can surface reconnect drift explicitly instead of silently hiding it

Execution proof:
- `bun test apps/desktop/src/main/palot-session-binding-store.test.ts apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx`