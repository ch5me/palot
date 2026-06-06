# Task 16a — Resolver bridge <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added main-owned resolver in `apps/desktop/src/main/palot-resolver.ts`.
- Added tests in `apps/desktop/src/main/palot-resolver.test.ts`.

## Resolver behavior <!-- oc:id=sec_ac -->

Per call, `resolvePalotSessionBinding(opencodeSessionId)` returns:
- `binding`
- `nonSecretSnapshot`
- `opaqueActionTarget`

The resolver reads current binding and current snapshot state each time, so it does not hold long-lived lane or Magic Browser ids inside plugin state.

## Notes <!-- oc:id=sec_ad -->

- This is the T16a seam only. It does not yet dispatch real automation.
- Snapshot data stays non-secret and derived from current main-owned state.