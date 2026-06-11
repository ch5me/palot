# Task 8: Folio Route Identity and Primary Route Inventory <!-- oc:id=sec_aa -->

## Core Route Identity Contract <!-- oc:id=sec_ab -->
`/Users/hassoncs/src/ch5/folio-db/apps/web/src/documents/route.ts` shows Folio route identity is query-param driven:
- `readRouteIdentityFromUrl()` reads `?route=` from `window.location.href`
- `writeRouteIdentityToUrl()` persists the route identity back into the current URL

This means Palot integration must treat Folio navigation as a host-owned deep-link contract, not a React-router subtree assumption.

## Primary Route Families Identified <!-- oc:id=sec_ac -->

### 1. Workspace Home <!-- oc:id=sec_ad -->
- **Surface**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/WorkspaceHome.tsx`
- **Route identity examples**: empty route / workspace home state
- **Host family target**: `page`
- **Notes**: includes search, recent pages, recent databases, create-page, create-database, and template creation flows.

### 2. Document Routes <!-- oc:id=sec_ae -->
- **Surface family dispatcher**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/documents/DocumentPageDispatcher.tsx`
- **Base editor shell**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/documents/BaseDocumentPage.tsx`
- **Known page families**:
  - checklist
  - sparse
  - test-harness
  - link-index
  - dashboard
  - sheet
- **Host family target**: `page`
- **Notes**: all are document-first experiences, some with surface slots like sheet presence.

### 3. Database Routes <!-- oc:id=sec_af -->
- **Surface**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/databases/DatabasePage.tsx`
- **Host family target**: `page`
- **Notes**: database routes contain view switching, row opening, search, route-family ledgers, and fallback rendering for unsupported views.

### 4. Auth / Entry Routes <!-- oc:id=sec_ag -->
- **Sign in**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/AuthPage.tsx`
- **Onboarding**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/OnboardingPage.tsx`
- **Invite acceptance**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/InvitePage.tsx`
- **Host family target**: `page` now, later some settings/admin handoff paths may exist

## Route Identity Implications for Palot <!-- oc:id=sec_ah -->
- Palot needs a first-class Folio route/deeplink adapter that preserves `?route=` semantics.
- The host cannot assume one URL path per surface; route identity is already a logical route token.
- Page restoration should store the logical route identity plus workspace context, then hand it back to Folio runtime.

## Acceptance Check <!-- oc:id=sec_ai -->
- [x] Primary route families are inventoried.
- [x] Query-param route identity contract is explicit.