# Task 15 — Geometry reconciliation / drift handling <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added `apps/desktop/src/renderer/hooks/use-panel-geometry.ts` using `ResizeObserver`.
- Updated `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` to capture panel geometry container and surface drift as best-effort failure state.
- Extended `apps/desktop/src/renderer/atoms/browser-actions.ts` with `showDriftBadge`.
- Updated `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx` to:
  - compare last two cursor positions with `calculateDriftPx`
  - show drift badge when beyond tolerance
  - hide overlay when active session mismatches
- Added `apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx`.

## Notes <!-- oc:id=sec_ac -->

- Drift detection currently uses cursor jump distance plus overlay state flags.
- Panel geometry capture is now in place for future richer transform use.
- Full runtime-fed geometry snapshots still improve later with deeper automation wiring.