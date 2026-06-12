# Task 13: Route and Page Inventory <!-- oc:id=sec_aa -->

## Route Identity Model <!-- oc:id=sec_ab -->
Folio uses a query-parameter-driven route identity model (`?route=<identity>`), not React Router path segments. This means Palot must treat Folio page surfaces as host-owned routes that pass a logical route identity down to the Folio renderer.

## Major Route Families <!-- oc:id=sec_ac -->
1. **Workspace Home** (`route=` or empty) <!-- oc:id=item_aa -->
   - Search, recent pages, recent databases, create actions.
   - Target: `page` (Palot home-equivalent for Folio context).
1. **Document Pages** (`route=workspace:<id>/page:<docId>`) <!-- oc:id=item_ab -->
   - Base editor shell + family dispatcher (checklist, sparse, link-index, dashboard, sheet).
   - Target: `page` (with optional `side-panel` or `workspace-widget` adjuncts via `surfaceSlot`).
1. **Database Pages** (`route=workspace:<id>/database:<dbId>`) <!-- oc:id=item_ac -->
   - Database home, table view, and future views (board, list, gallery, calendar, timeline, chart, dashboard, form, map, feed).
   - Target: `page` (row open deep-links into document pages).
1. **Auth / Onboarding Flows** <!-- oc:id=item_ad -->
   - Sign-in, signup, invite acceptance, workspace creation.
   - Target: `page` (entry surfaces, likely handled via host-level auth gates before Folio plugin activates).

## MVP Integration Tiering <!-- oc:id=sec_ad -->
- **MVP First-Class**: Document pages, Database table view, Workspace home (via nav-sidebar links).
- **Later / Full Parity**: Advanced database views (calendar, chart, etc.), sheet presence overlays.
- **Unsupported / Deferred**: Publish-to-web flows (explicitly marked excluded in Folio code).

## Evidence <!-- oc:id=sec_ae -->
- `~/src/ch5/folio-db/apps/web/src/documents/route.ts` (route identity read/write)
- `~/src/ch5/folio-db/apps/web/src/documents/DocumentPageDispatcher.tsx` (document families)
- `~/src/ch5/folio-db/apps/web/src/databases/DatabasePage.tsx` (database view routing)
- `~/src/ch5/folio-db/tests/e2e/shell-facade-smoke.spec.ts` (e2e route coverage)

## Acceptance Criteria <!-- oc:id=sec_af -->
- [x] Every major Folio route/page family is listed with exact file refs.
- [x] Each route is tagged as MVP, later, or unsupported for first-class Palot integration.