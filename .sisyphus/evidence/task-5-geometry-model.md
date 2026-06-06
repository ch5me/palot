# Task 5 — Coordinate-space contract and geometry model <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Extended shared preload types in `apps/desktop/src/preload/api.d.ts`:
  - `DomRectSnapshot`
  - `PanelGeometrySnapshot`
  - `BrowserCoordinateTransformResult`
  - `BrowserGeometryFixture`
- Added pure transform helpers and fallback ladder in `apps/desktop/src/shared/browser-geometry.ts`.
- Added fixtures and unit tests in `apps/desktop/src/shared/browser-geometry.test.ts`.

## Coordinate spaces <!-- oc:id=sec_ac -->

- DOM rect: selector-relative/page viewport position via `DomRectSnapshot`
- Page viewport: center point derived from DOM rect
- Stream viewport: page viewport transformed by scroll and zoom
- Panel viewport: stream viewport transformed into panel offset/scale

## Fallback ladder <!-- oc:id=sec_ad -->

1. `page_rect_high_confidence` <!-- oc:id=item_aa -->
   - Uses page-reported rect
   - `caretConfidence = high`
   - No best-effort badge
1. `stream_transform_low_confidence` <!-- oc:id=item_ab -->
   - Uses event coordinates + stream/panel transform only
   - `caretConfidence = low`
   - Best-effort badge shown
1. `last_good_cursor_no_confidence` <!-- oc:id=item_ac -->
   - Holds last known good cursor position
   - `caretConfidence = none`
   - Best-effort badge shown

## Targets encoded in code <!-- oc:id=sec_ae -->

- Event burst cap: `200`
- Overlay FPS target: `30`
- Replay latency p95: `200ms`
- Drift tolerance: `4px`

## Fixtures <!-- oc:id=sec_af -->

- `iframe-zoomed`
- `scroll-anchored`

## Notes <!-- oc:id=sec_ag -->

- All math is pure and engine-agnostic.
- Caret fidelity is only considered high when a page rect is available.