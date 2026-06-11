# Task 24-36: Integration Design Summary <!-- oc:id=sec_aa -->

*(Consolidated evidence for tasks 24 through 36 covering workspace shell, document/page, database/view, settings, command palette, and contextual side-panel integration).*

## Workspace Shell Integration (T24, T31) <!-- oc:id=sec_ab -->
- **Decomposition**: Palot owns the outer container, breadcrumbs, and mobile toggles. Folio owns the inner tree data, page rendering, and overlay definitions.
- **Non-Duplicative**: No duplicate sidebars or headers. Folio's `WorkspaceShell.tsx` is decomposed into Palot `nav-sidebar` + `page` contributions.

## Document / Page Surface (T25, T32) <!-- oc:id=sec_ac -->
- **Contract**: Host parses `?route=` and renders the matching Folio editor inside a Palot page frame.
- **Features Preserved**: Autosave status, route identity exposure, title editing, and `surfaceSlot` adjuncts (like sheet presence) are rendered by the plugin, wrapped by the host.

## Database / View Surface (T26, T33) <!-- oc:id=sec_ad -->
- **Contract**: Similar to documents, but with internal view switching (table, board, calendar, etc.).
- **Row Opening**: Deep-links into a new document `page` surface, maintaining the host routing state.

## Settings & Command Palette (T27, T28, T34, T35) <!-- oc:id=sec_ae -->
- **Settings**: `OrgAdminPanel` becomes a `settings-section` contribution, gated by host role-checks.
- **Commands**: Creation and navigation actions are registered as `command` contributions, making them globally accessible via `Cmd+K`.

## Contextual Side-Panel (T29, T36) <!-- oc:id=sec_af -->
- **Classification**: Only transient, context-specific adjuncts (row inspectors, backlinks) use the `side-panel` surface. Overlays (search, share) map to host-native dialogs.

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Integration designs for all listed surfaces are explicit and implementation-ready.