# Task 11 / 14: Workspace Shell and Sidebar Inventory <!-- oc:id=sec_aa -->

## Canonical Workspace Shell <!-- oc:id=sec_ab -->
- **Shell facade**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/shell-facade/WorkspaceShell.tsx`
- **Sidebar**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/Sidebar.tsx`
- **Top bar breadcrumbs**: `Breadcrumbs` via `WorkspaceShell.tsx`

## Shell Pieces <!-- oc:id=sec_ac -->
### Nav-Sidebar Candidate <!-- oc:id=sec_ad -->
`Sidebar.tsx` includes:
- workspace switcher
- search trigger
- home row
- recents vs all tab toggle
- pages tree
- databases tree
- new page / new database footer quick actions

This is the clearest current source for Folio content that belongs in Palot's future `nav-sidebar` family.

### Host Page Header Context <!-- oc:id=sec_ae -->
`WorkspaceShell.tsx` injects `Breadcrumbs` as topbar content with:
- workspace name
- current page title for database routes
- mobile sidebar trigger

This maps to Palot host breadcrumbs/header context rather than a plugin-owned shell.

### Overlay / Supporting Shell Surfaces <!-- oc:id=sec_af -->
`WorkspaceShell.tsx` also defines overlay items:
- search
- actions
- share
These are supporting contextual surfaces and should not be confused with the main nav-sidebar or page surface.

## Ownership Split <!-- oc:id=sec_ag -->
- **Folio-owned content logic**: tree structure, workspace-specific actions, route-aware labels
- **Palot host-owned shell**: final chrome container, page header/breadcrumb zone, mobile drawer behavior, sidebar tab chrome

## Acceptance Check <!-- oc:id=sec_ah -->
- [x] Sidebar, breadcrumb, overlay, and content-frame pieces are separated.
- [x] Host-vs-Folio shell split is explicit.