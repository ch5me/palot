# Task 7 — PDF review side-panel shell registration <!-- oc:id=sec_aa -->

## Registration path <!-- oc:id=sec_ab -->
`pdf-review` follows standard Firefly side-panel registration flow.

## Tab metadata <!-- oc:id=sec_ac -->
- tab id: `pdf-review`
- title: `PDF Review`
- icon: `FileTextIcon`
- form factor: `side-panel-tab`
- feature flag key: `pdfReview`
- feature flag atom: `pdfReviewSurfaceEnabledAtom`
- default flag state: `false`
- command ids: `surface.pdfReview.open`, `surface.pdfReview.toggle`
- persistence key: `side-panel.pdf-review`
- telemetry namespace: `firefly.surface.pdf-review`
- spawn component: `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx`

## Files wired <!-- oc:id=sec_ad -->
### `apps/desktop/src/renderer/atoms/ui.ts` <!-- oc:id=sec_ae -->
- `SidePanelTabId` widened with `"pdf-review"`

### `apps/desktop/src/renderer/atoms/feature-flags.ts` <!-- oc:id=sec_af -->
- `fireflySurfaceDefaults.pdfReview = false`
- `pdfReviewSurfaceEnabledAtom`
- `fireflySurfaceFlagAtoms.pdfReview`
- `fireflySurfaceLabels.pdfReview = "PDF Review"`
- `togglePdfReviewSurfaceAtom`

### `apps/desktop/src/renderer/firefly-surface-registry.tsx` <!-- oc:id=sec_ag -->
- imports `pdfReviewSurfaceEnabledAtom`
- imports `PdfReviewPanel`
- adds `FIREFLY_SURFACE_REGISTRY` entry for `pdf-review`
- availability rule: available only when `ctx.flags.pdfReview` is true

### `apps/desktop/src/renderer/components/agent-detail.tsx` <!-- oc:id=sec_ah -->
- subscribes to `pdfReviewSurfaceEnabledAtom`
- adds `pdfReview` to `FireflySurfaceContext.flags`
- `getFireflySurfaceTabs(ctx)` handles the rest

### `apps/desktop/src/renderer/components/command-palette.tsx` <!-- oc:id=sec_ai -->
- imports `pdfReviewSurfaceEnabledAtom`
- imports `togglePdfReviewSurfaceAtom`
- adds feature toggle row with keywords: `pdf`, `pdf review`, `document`, `paper`, `citation`
- `Surfaces` group already auto-discovers available registry entries

### `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx` <!-- oc:id=sec_aj -->
- current panel stub exists
- shows locator contract preview and next-slice roadmap
- enough for shell proof while deeper viewer/selection/citation work remains pending

## Default flag policy <!-- oc:id=sec_ak -->
Choose default OFF.

### Why OFF is right for v1 <!-- oc:id=sec_al -->
- viewer stack not fully implemented yet
- expensive / uncertain surface per playbook should default off
- browser-mode parity and extraction seams are still partial/net-new
- avoids restore/startup surprises before real viewer behavior lands

This matches `docs/firefly-surface-playbook.md:31` guidance: default OFF for expensive, native-heavy, or uncertain surfaces.

## Discoverability path <!-- oc:id=sec_am -->
- feature enable/disable via Cmd+K `Features`
- open surface via Cmd+K `Surfaces`
- app-bar side-panel toggle once at least one surface is available
- future clickback actions can call `openSidePanelTabAtom("pdf-review")`

## Current availability rule <!-- oc:id=sec_an -->
If `pdfReview` flag disabled:
- surface registry returns unavailable state with reason `PDF review surface is disabled in feature flags`
- no bespoke fallback logic required in registry entry itself
- `availableSidePanelTabs` filtering in `agent-detail.tsx` prevents surfacing disabled tab as active option

## QA acceptance check <!-- oc:id=sec_ao -->
- tab id named: yes
- flag named: yes
- command ids named: yes
- persistence key named: yes
- telemetry namespace named: yes
- spawn file named: yes
- discoverability path included: yes

## Remaining note <!-- oc:id=sec_ap -->
Shell registration is done, but panel is still proof-stage. Viewer, resolution, selection, and citation behavior belong to later tasks.