# Task 4 — Document domain map and existing shell fit audit <!-- oc:id=sec_aa -->

## Verdict <!-- oc:id=sec_ab -->
`pdf-review` fits existing Firefly side-panel shell cleanly. No second route or bespoke shell plumbing needed.

## Exact integration files <!-- oc:id=sec_ac -->
### Required shell touchpoints <!-- oc:id=sec_ad -->
1. `apps/desktop/src/renderer/atoms/ui.ts` <!-- oc:id=item_aa -->
   - widen `SidePanelTabId` with `"pdf-review"`
   - existing `sidePanelOpenAtom`, `sidePanelActiveTabAtom`, `openSidePanelTabAtom`, and `setAvailableSidePanelTabsAtom` already provide open/close/focus/fallback behavior

1. `apps/desktop/src/renderer/atoms/feature-flags.ts` <!-- oc:id=item_ab -->
   - add `pdfReviewSurfaceEnabledAtom`
   - add `togglePdfReviewSurfaceAtom`
   - add entries to defaults, flag-atom map, and labels map

1. `apps/desktop/src/renderer/firefly-surface-registry.tsx` <!-- oc:id=item_ac -->
   - add new `FireflySurfaceDef` entry
   - define tab id, title, icon, availability, command ids, persistence key, telemetry namespace, target, and `spawn()` panel component

1. `apps/desktop/src/renderer/components/agent-detail.tsx` <!-- oc:id=item_ad -->
   - subscribe to new flag atom
   - include flag in `FireflySurfaceContext.flags`
   - `getFireflySurfaceTabs(ctx)` then auto-feeds `SessionSidePanel`
   - app-bar surface pill and open/close button already work once tab is registered

1. `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx` <!-- oc:id=item_ae -->
   - no structural edits required
   - new tab will appear automatically in vertical tab rail when available

1. `apps/desktop/src/renderer/components/command-palette.tsx` <!-- oc:id=item_af -->
   - add feature toggle row for enable/disable
   - `Surfaces` group launcher already works via `availableSurfaceTabs.map(...)`

1. `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx` <!-- oc:id=item_ag -->
   - new panel component to implement actual viewer/review surface

## Existing flow the new surface should reuse <!-- oc:id=sec_ae -->
### Open path <!-- oc:id=sec_af -->
- Cmd+K `Surfaces` group calls `openSidePanelTab(surface.target.tab)` in `apps/desktop/src/renderer/components/command-palette.tsx:593`
- app-bar right-side button toggles overall side panel in `apps/desktop/src/renderer/components/agent-detail.tsx:506`
- any future citation/result jump can use the same atom writer pattern used by review panel helpers in `apps/desktop/src/renderer/atoms/ui.ts:74`

### Close path <!-- oc:id=sec_ag -->
- close button inside `SessionSidePanel` sets `sidePanelOpenAtom = false` in `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx:30`
- app-bar button toggles same atom in `apps/desktop/src/renderer/components/agent-detail.tsx:301`
- keyboard shortcut `Cmd/Ctrl+Shift+D` already toggles panel in `apps/desktop/src/renderer/components/agent-detail.tsx:162`

### Focus path <!-- oc:id=sec_ah -->
- `openSidePanelTabAtom` opens panel, sets tab, bumps `sidePanelFocusTokenAtom` in `apps/desktop/src/renderer/atoms/ui.ts:45`
- downstream consumers can watch focus token if the PDF panel needs to re-focus viewer/search input on repeated opens

### Restore path <!-- oc:id=sec_ai -->
- last active tab persists through `fireflySurfacePreferencesAtom.lastSidePanelTab` via `sidePanelActiveTabAtom` in `apps/desktop/src/renderer/atoms/ui.ts:25`
- invalid persisted tab is corrected by `setAvailableSidePanelTabsAtom` in `apps/desktop/src/renderer/atoms/ui.ts:55`
- this already satisfies disabled-surface fallback requirement once `pdf-review` participates in available tabs list

## User navigation paths for PDF review <!-- oc:id=sec_aj -->
### Discovery <!-- oc:id=sec_ak -->
- Cmd+K feature toggle under `Features`
- Cmd+K launcher under `Surfaces`
- app-bar side-panel toggle after at least one surface is available
- optional later: file preview / citation / artifact actions can jump directly to `pdf-review` by writing `openSidePanelTabAtom("pdf-review")`

### Document entry points <!-- oc:id=sec_al -->
Likely natural entry points inside current shell:
- file chosen from `StudioPanel`-style search list
- chat attachment or upload flow
- grounded citation click from chat
- search result click from future corpus search
- annotation/artifact clickback

These are actions inside existing panes, not new routes.

## Best existing panel precedents by concern <!-- oc:id=sec_am -->
- document-picker and office normalization precedent: `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx`
- open-another-surface-by-intent precedent: `apps/desktop/src/renderer/atoms/ui.ts:74`
- session draft/send-to-chat precedent: `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx`
- async service/error/fallback precedent: `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx`
- high-density/virtualized content precedent: `apps/desktop/src/renderer/components/review/review-panel.tsx`
- session artifact/source-link precedent: `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx`, `docs/genui-artifact-architecture.md`

## Layout constraints to preserve <!-- oc:id=sec_an -->
- right panel widths currently 280–760, expanded up to 1120 in `apps/desktop/src/renderer/components/agent-detail.tsx:73`
- chat content drops `max-w-4xl` when side panel is open in `apps/desktop/src/renderer/components/chat/chat-view.tsx` per prior repo findings; PDF review panel must stay responsive within this shared layout
- session widget inline-right zone is rehomed when side panel opens, so `pdf-review` should not introduce a second competing right-side inspector lane

## No-duplication rule for this feature <!-- oc:id=sec_ao -->
Do not:
- add a separate TanStack route for PDF review
- create a second side-panel host
- bypass `firefly-surface-registry.tsx`
- store panel-open state outside `atoms/ui.ts`

## Recommended tab metadata <!-- oc:id=sec_ap -->
- id: `pdf-review`
- form factor: `side-panel-tab`
- command ids: `surface.pdfReview.open`, `surface.pdfReview.toggle`
- persistence key: `side-panel.pdf-review`
- telemetry namespace: `firefly.surface.pdf-review`
- default flag: off until viewer/search/annotation stack is proven

## Verdict summary <!-- oc:id=sec_aq -->
Shell fit is concrete and already present. New work belongs in one panel component plus standard registry/flag wiring. No shell escalation justified.