# Task 12 — Renderer event subscription pipeline <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added renderer action-stream atoms in `apps/desktop/src/renderer/atoms/browser-actions.ts`.
- Added subscription hook in `apps/desktop/src/renderer/hooks/use-browser-actions.ts`.
- Added dedupe/cap tests in `apps/desktop/src/renderer/atoms/browser-actions.test.ts`.

## Behavior <!-- oc:id=sec_ac -->

- Subscribes only through `window.elf.palot.onBrowserActions` via `subscribeToBrowserActions()`.
- Filters by `sessionId` in the hook when provided.
- Dedupes on `(id, laneId)`.
- Caps retained queue to 100 events.
- Clears queue on hook re-subscribe / session switch.

## Notes <!-- oc:id=sec_ad -->

- This is the renderer-side state pipeline only; overlay rendering comes later.
- Queue cap is intentionally conservative until real playback pressure is measured.