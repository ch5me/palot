# Task 9 — Desktop viewer integration <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Plan concrete desktop viewer integration for `pdf-review` using chosen `react-pdf` substrate while preserving Firefly side-panel responsiveness.

## Recommended viewer architecture <!-- oc:id=sec_ac -->
### Surface layout <!-- oc:id=sec_ad -->
Use a three-zone panel inside `PdfReviewPanel`:
1. document list / outline rail <!-- oc:id=item_aa -->
1. main PDF viewer <!-- oc:id=item_ab -->
1. contextual review rail for citations / annotations / metadata <!-- oc:id=item_ac -->

For v1 inside current side-panel width constraints:
- start with two-zone layout inside the panel body: main viewer + compact right/under viewer context area
- keep list/outline collapsible or deferred until wider expanded mode
- do not force a permanent third visible column at default width 392

### Viewer stack <!-- oc:id=sec_ae -->
- `react-pdf` as renderer substrate
- enable PDF.js text layer for selection
- enable annotation layer when available
- add custom overlay layer above page wrapper for transient highlight pulse and stored annotation regions

### Page virtualization strategy <!-- oc:id=sec_af -->
- render only visible / near-visible pages
- default to one-page focus or limited window when document large
- lazy-mount text layers for off-screen pages
- keep heavy page tree out of DOM when panel closed or document not selected

## Component split <!-- oc:id=sec_ag -->
### `PdfReviewPanel` <!-- oc:id=sec_ah -->
Owns shell and high-level selection:
- active document id
- active citation/annotation target
- zoom mode
- active page
- side surface mode (viewer / citations / annotations)

### `PdfDocumentViewport` <!-- oc:id=sec_ai -->
Dedicated viewer container that:
- loads document bytes / URL
- renders page list
- owns scroll container ref
- maps resolved locators into `scrollToPageAndRange()` actions

### `PdfPageView` <!-- oc:id=sec_aj -->
Per-page unit that renders:
- page canvas via `react-pdf`
- text layer
- annotation layer
- custom overlay layer
- selection capture hooks

### `PdfLocatorOverlay` <!-- oc:id=sec_ak -->
Viewer adapter only. Converts shared `DocumentLocator` into:
- page target
- text-range pulse
- region rect overlay
- page-only fallback indicator

This keeps locator logic out of viewer rendering.

## Navigation and jump behavior <!-- oc:id=sec_al -->
### Page navigation <!-- oc:id=sec_am -->
Required controls:
- next / previous page
- page number jump
- optional thumbnail/outline later
- active page derived from scroll position or explicit jump target

### Jump-to-span flow <!-- oc:id=sec_an -->
1. external source triggers locator target <!-- oc:id=item_ad -->
1. resolver returns `resolved | ambiguous | page-fallback | unresolved | missing-text-layer | deleted-document` <!-- oc:id=item_ae -->
1. viewer receives resolved target <!-- oc:id=item_af -->
1. if `resolved`: <!-- oc:id=item_ag -->
   - scroll target page into view
   - compute overlay region from range or region rects
   - flash temporary highlight pulse
1. if `page-fallback`: <!-- oc:id=item_ah -->
   - scroll page into view
   - show fallback badge instead of precise highlight
1. if `ambiguous` or `unresolved`: <!-- oc:id=item_ai -->
   - show degraded message in side context rail
   - do not fake precise highlight

## Selection layer behavior <!-- oc:id=sec_ao -->
### Selection support <!-- oc:id=sec_ap -->
- text layer must stay enabled for user selection
- selection capture reads browser selection rects from page text layer area
- convert selection back into shared locator selectors + document-space rects
- viewer must not own durable annotation state; it only emits selection payloads upward

### Selection actions seam <!-- oc:id=sec_aq -->
Viewer emits:
```ts
interface PdfSelectionPayload {
	documentId: string
	pageIndex: number
	quote: string
	rects: RegionRect[]
	locator: DocumentLocator
}
```
Panel or action menu consumes this for highlight / ask-AI / note flows.

## Zoom and rerender considerations <!-- oc:id=sec_ar -->
### Zoom model <!-- oc:id=sec_as -->
- keep zoom state in panel-local UI state
- use discrete steps or fit-width / fit-page modes
- never encode zoom into shared locator contract

### Rerender safety <!-- oc:id=sec_at -->
- locator resolution reruns against extracted corpus, not DOM
- overlay recomputation happens after page render from document-space rects
- same locator must survive zoom changes because stored rects use `pdf-points`, not screen pixels

### Flash behavior <!-- oc:id=sec_au -->
- highlight pulse should be short-lived and local to overlay layer
- use CSS animation on overlay region after jump
- avoid layout thrash by not mutating page DOM tree deeply

## Browser-mode parity expectations <!-- oc:id=sec_av -->
### Desktop first <!-- oc:id=sec_aw -->
Electron path can load local PDFs and office-converted PDFs first.

### Browser mode <!-- oc:id=sec_ax -->
Until PDF byte-serving seam exists:
- PDF review surface may render explicit unavailable/degraded state in browser mode for local files
- once byte URL/backend seam lands, same viewer component can run in browser mode
- office conversion may remain unavailable in browser mode longer than native PDF viewing

## Responsiveness constraints <!-- oc:id=sec_ay -->
### Must preserve <!-- oc:id=sec_az -->
- side-panel open chat width behavior from `chat-view.tsx:616`
- right panel width range from `agent-detail.tsx`
- no second right-side inspector lane

### Performance controls <!-- oc:id=sec_ba -->
Borrow from review panel strategy:
- lazy-load heavy content
- gated loading for large docs
- collapse/defer non-essential rails on narrow width
- memoize page/overlay props
- virtualize page list when large
- avoid rendering both light/dark variants at once

## State ownership split <!-- oc:id=sec_bb -->
### Viewer local state <!-- oc:id=sec_bc -->
- current page
- zoom mode
- visible pages
- transient pulse target
- live selection

### Durable domain state <!-- oc:id=sec_bd -->
- documents
- annotations
- notes
- ingest outputs
- artifact refs
- locator records

### Cross-pane route state <!-- oc:id=sec_be -->
- open panel tab
- focus token
- optional active document id if later promoted to surface-level atom

## Acceptance check <!-- oc:id=sec_bf -->
- viewer can open document: planned via dedicated viewport + `react-pdf`
- navigate to page/span: planned via resolver result -> page/overlay adapter
- selection layer present: yes, text layer + selection payload seam
- side panel readable/perf-safe: yes, two-zone default + virtualization/lazy render
- reopen/rerender/zoom accounted for: yes, shared locator independent of viewport and zoom

## QA mapping <!-- oc:id=sec_bg -->
### Scenario: jump-to-span <!-- oc:id=sec_bh -->
Expected proof path:
- load known text PDF
- activate `pdf-review`
- trigger locator jump
- verify page scroll + highlight pulse

### Scenario: zoom/re-render <!-- oc:id=sec_bi -->
Expected proof path:
- zoom changes rerender pages
- same locator re-applies via resolver + overlay adapter
- explicit degradation if exact target no longer recoverable

## Key non-goals <!-- oc:id=sec_bj -->
- do not mix locator resolution into PDF page components
- do not depend on hidden text-span ids for durable behavior
- do not require full-width route surface yet