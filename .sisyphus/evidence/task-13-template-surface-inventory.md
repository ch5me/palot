# Task 13: Template & Creation Surface Inventory <!-- oc:id=sec_aa -->

## Creation Entry Points <!-- oc:id=sec_ab -->
- **Workspace Home create actions**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/WorkspaceHome.tsx` (New page, New database, New page from template)
- **Sidebar footer quick actions**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/Sidebar.tsx` (New page, New database)
- **Onboarding**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/OnboardingPage.tsx` (Create workspace)

## Template Mechanics <!-- oc:id=sec_ac -->
- Templates are surfaced in `WorkspaceHome.tsx` via a dropdown populated by `client.documents.templates.list`.
- Application triggers `client.documents.templates.applyTemplate`, yielding a new `routeIdentity` that the host navigates to.

## Surface Mapping <!-- oc:id=sec_ad -->
- **Primary family**: `command` (creation commands should be globally accessible from Palot, not just inside Folio's home/sidebar).
- **Secondary family**: `page` (the resulting created page/database).
- **Future integration need**: Palot's command palette should expose "New Folio Page", "New Folio Database", and "New Folio Page from Template" as first-class commands, routing creation through the same tRPC client but initiated from the host context.

## Acceptance Check <!-- oc:id=sec_ae -->
- [x] Creation and template surfaces are documented and mapped to host command/page targets.