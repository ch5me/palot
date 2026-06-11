# Task 14: Workspace Shell and Nav Inventory <!-- oc:id=sec_aa -->

## Shell Decomposition <!-- oc:id=sec_ab -->
Folio's current `WorkspaceShell.tsx` acts as a monolithic facade. For Palot first-class integration, this must be decomposed:

### Host-Owned Chrome (Palot) <!-- oc:id=sec_ac -->
- Outer application shell (window controls, transport layer).
- Page-level header/breadcrumbs (currently `Breadcrumbs` in Folio, but should map to Palot's native app-bar/header context).
- Sidebar container width, collapse state, and responsive mobile drawer behavior.
- `nav-sidebar` tab header (`DiscreteTabs`) and persistence of active tab.

### Folio-Owned Content (Plugin Contributions) <!-- oc:id=sec_ad -->
- Sidebar inner content: workspace switcher, search trigger, home row, pages/databases tree, recents toggle, quick-action footer.
  - **Target**: `nav-sidebar` contribution.
- Page content: `WorkspaceHome`, `DatabasePage`, `BaseDocumentPage` + `DocumentPageDispatcher`.
  - **Target**: `page` contribution.
- Contextual overlays: `SearchPanel`, `ActionsOverlayPanel`, `ShareOverlayPanel`.
  - **Target**: `side-panel` or host-native overlay equivalents (depending on Palot's global command/search architecture).

## Key Boundary Rule <!-- oc:id=sec_ae -->
Folio plugins must **not** own the outer routing shell or sidebar collapse logic. They provide tab content payloads and page surface bodies that the host renders inside its owned containers.

## Evidence <!-- oc:id=sec_af -->
- `apps/web/src/components/shell-facade/WorkspaceShell.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/storybook/stories/Shell.stories.tsx`

## Acceptance Criteria <!-- oc:id=sec_ag -->
- [x] Workspace shell pieces are split into host-owned chrome vs Folio-owned content/navigation.