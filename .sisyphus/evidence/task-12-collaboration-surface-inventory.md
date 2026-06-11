# Task 12: Collaboration & Overlay Surface Inventory <!-- oc:id=sec_aa -->

## Canonical Collaboration Surfaces <!-- oc:id=sec_ab -->
- **Search panel**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/SearchPanel.tsx`
- **Actions overlay**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/overlay/ActionsOverlayPanel.tsx`
- **Share overlay**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/overlay/ShareOverlayPanel.tsx`
- **Overlay stack state**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/overlay/OverlayStack.tsx` and `overlay-state.ts`

## Behavior and Context <!-- oc:id=sec_ac -->
- **Search**: Debounced query, workspace-scoped, arrow-key navigation, navigates via `?route=` deep links.
- **Actions**: Command-style palette for page-level actions (copy link, duplicate, delete, favorite, lock). Excludes some features (import, export, version history) currently.
- **Share**: "Share" vs "Publish" tabs. Copy link, collaborator list, access control (stubbed).
- **Overlay mechanics**: Managed via a central `OverlayStackProvider`, supporting mobile drawer semantics and focus restoration.

## Surface Mapping <!-- oc:id=sec_ad -->
- **Primary family**: `page` adjuncts (contextual overlays/dialogs)
- **Secondary family candidate**: `command` (Actions panel maps closely to host command palette; Share maps to host share/intent surfaces).
- **Future integration need**: Palot must host the overlay stack state or replace Folio's overlay registry with Palot's native command/dialog surface routing, passing the same action payloads.

## Acceptance Check <!-- oc:id=sec_ae -->
- [x] Overlay/collaboration surfaces are explicitly identified and mapped to host families.