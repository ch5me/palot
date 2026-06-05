# Task 1 — Viewer/runtime decision gate <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->
Choose `react-pdf` (PDF.js-backed) as canonical v1 desktop-first viewer substrate for `pdf-review`.

## Why this path fits PALOT <!-- oc:id=sec_ac -->
- Existing repo has no PDF viewer dependency today; current PDF/office preview is iframe-only via `StudioPanel`, which proves preview but not selectable text or anchored overlays.
- Firefly side-panel architecture wants one registry/flag/persistence path, not a separate route or bespoke shell. `react-pdf` can live inside a new side-panel surface cleanly.
- Browser-mode parity matters. Electron-only seams exist for file preview and office conversion, but renderer-side React viewer logic can still run in both Electron and browser mode once document bytes or URL access is wired through `services/backend.ts`.
- Text selection, text layer, annotation layer, and overlay hooks are first-class PDF.js concepts. Iframe preview cannot deliver reliable span selection, jump-to-span overlays, or locator-grounded annotations.

## Repo evidence <!-- oc:id=sec_ad -->
- `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx:65` converts office docs to PDF, then shows PDFs with `<iframe>` at `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx:132`.
- `apps/desktop/src/main/files.ts:418` only classifies previews by kind; for PDFs it returns metadata-only preview at `apps/desktop/src/main/files.ts:428`, not extracted text or anchors.
- `apps/desktop/src/renderer/services/backend.ts:434` exposes preview reads only in Electron; browser mode throws. Same for office conversion at `apps/desktop/src/renderer/services/backend.ts:471`.
- `docs/firefly-surface-playbook.md:13` says proof surfaces belong in existing side-panel tab system first.
- `apps/desktop/package.json:39` shows no `react-pdf`, `pdfjs-dist`, or equivalent viewer package exists yet.

## Chosen v1 substrate <!-- oc:id=sec_ae -->
- Renderer viewer: `react-pdf` + PDF.js text/annotation layers.
- Shell: new `pdf-review` side-panel surface in Firefly registry.
- File input path:
  - native PDFs: load directly into viewer
  - office docs: continue using existing LibreOffice conversion seam, then load produced PDF into same viewer
- Shared contract stays viewer-agnostic; viewer consumes resolved locators but does not define them.

## Required capabilities against plan <!-- oc:id=sec_af -->
### Selectable text <!-- oc:id=sec_ag -->
- `react-pdf` supports PDF.js text layer; this is required for user text selection and quote/rect capture.
- Current iframe path does not provide repo-owned text-layer access, so it fails this requirement.

### Jump-to-span <!-- oc:id=sec_ah -->
- Viewer must support page navigation plus custom overlay rendering tied to resolved locator spans.
- PDF.js viewport math gives stable path for page + rect highlight jumps.
- Current iframe path only supports document display, not reliable in-app highlight orchestration.

### Browser-mode parity <!-- oc:id=sec_ai -->
- Browser mode currently cannot use `fetchFilePreview` or `convertOfficeToPdf` because those are Electron-only.
- For v1, parity path should be:
  - keep viewer renderer-first
  - add backend seam for reading PDF bytes / served file URL in browser mode
  - keep office conversion explicitly degraded or unavailable in browser mode until mirrored
- This preserves desktop-first scope without hard-baking Electron-only assumptions into shared contracts.

### Native parity implications <!-- oc:id=sec_aj -->
- Native/mobile should reuse locator, annotation, project, and citation contracts only.
- Do not leak PDF.js DOM concepts like text spans, viewport pixels, or iframe behavior into shared schema.
- Desktop implementation may use PDF.js-specific adapter that maps shared locator contract into viewport highlights.

## Rejected alternatives <!-- oc:id=sec_ak -->
### Keep current iframe-based PDF preview <!-- oc:id=sec_al -->
Rejected because:
- no repo-owned text selection surface
- no reliable highlight overlay layer
- no grounded jump-to-span control path
- no annotation/sidebar synchronization hooks

### Build directly on raw `pdfjs-dist` <!-- oc:id=sec_am -->
Rejected for v1 because:
- lower-level integration cost
- more custom rendering and lifecycle work
- repo has no existing PDF.js infra to reuse
- `react-pdf` already gives React-friendly document/page composition while preserving PDF.js layer model underneath

### Use `@react-pdf-viewer/*` plugin suite as primary substrate <!-- oc:id=sec_an -->
Rejected for v1 because:
- more opinionated surface than current Firefly side-panel system
- likely heavier than needed for first grounded-review slice
- plugin sidebar patterns useful as reference, but PALOT already has shell, registry, and command-palette substrate

### Stay in Studio / Office surface instead of new `pdf-review` <!-- oc:id=sec_ao -->
Rejected because:
- Studio is generic preview lane, not grounded review lane
- plan requires tight chat + citation + annotation integration through Firefly side-panel shell
- mixing grounded review into generic office preview would blur responsibilities and make degraded behavior harder to reason about

## Consequences <!-- oc:id=sec_ap -->
- Need new dependencies for PDF viewer stack.
- Need browser-mode backend seam for PDF bytes or served document URL.
- Need adapter layer for page/rect overlays and selection capture.
- Existing office conversion seam stays useful for DOCX/XLS/PPT -> PDF normalization.

## Execution note <!-- oc:id=sec_aq -->
Proceed with `react-pdf` as v1 viewer substrate. Do not implement native/mobile viewer now. Shared locator contract remains first downstream dependency.