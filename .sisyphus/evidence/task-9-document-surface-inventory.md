# Task 9: Document Surface Inventory <!-- oc:id=sec_aa -->

## Canonical Document Shell <!-- oc:id=sec_ab -->
- **Base editor shell**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/documents/BaseDocumentPage.tsx`
- **Dispatcher**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/documents/DocumentPageDispatcher.tsx`

The base shell proves that document pages share:
- autosave status banner
- route identity exposure
- editor mount lifecycle
- retry-save flow
- optional `surfaceSlot` extension area
- title editing path via `onTitleChange`

## Document Families <!-- oc:id=sec_ac -->
1. `checklist` <!-- oc:id=item_aa -->
1. `sparse` <!-- oc:id=item_ab -->
1. `test-harness` <!-- oc:id=item_ac -->
1. `link-index` <!-- oc:id=item_ad -->
1. `dashboard` <!-- oc:id=item_ae -->
1. `sheet` (currently sparse page plus `SheetPresenceSurface` slot) <!-- oc:id=item_af -->

## Surface Mapping <!-- oc:id=sec_ad -->
- **Primary family**: `page`
- **Secondary contextual family candidates**:
  - `side-panel` for comments / metadata / backlinks / inspectors
  - `workspace-widget` for live presence or context affordances tied to an open document

## Integration Notes <!-- oc:id=sec_ae -->
- Documents are not merely editor components; they are full page surfaces with state restoration, save status, and route identity.
- The `surfaceSlot` seam indicates that some document families may expose adjunct contextual surfaces without replacing the main page contract.
- The host should preserve per-document page title + autosave/error surfacing in Palot page chrome or contextual UI.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] All known document family variants are named.
- [x] Page vs contextual-adjunct mapping is explicit.