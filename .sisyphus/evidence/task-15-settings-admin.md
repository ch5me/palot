# Task 15: Settings / Admin Surface Inventory <!-- oc:id=sec_aa -->

## Auth and Account Entry Surfaces <!-- oc:id=sec_ab -->
- **Auth page**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/AuthPage.tsx`
  - magic link
  - password sign-in
  - signup
  - forgot password
  - Google sign-in when enabled
- **Onboarding**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/OnboardingPage.tsx`
- **Invite acceptance**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/auth/InvitePage.tsx`

## Organization / Admin Surfaces <!-- oc:id=sec_ac -->
- **Org admin UI**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/components/OrgAdminPanel.tsx`
  - members tab
  - audit log tab
  - audit filters
- **API authority**:
  - `/Users/hassoncs/src/ch5/folio-db/apps/api/src/trpc/routes/auth.ts`
  - `/Users/hassoncs/src/ch5/folio-db/apps/api/src/trpc/routes/organizations.ts`

## Host Surface Mapping <!-- oc:id=sec_ad -->
- **Auth / onboarding / invite** -> `page`
  - these are full-flow entry pages with their own success routing
- **Org admin** -> `settings-section` or supporting `page`
  - members + audit are operator/admin settings content, not everyday document pages
- **Audit export / member actions / invites** -> `command` adjuncts plus `settings-section`
  - admin actions should be command-addressable from Palot even when the main settings page is not already open

## Coverage Notes <!-- oc:id=sec_ae -->
The admin routes are not optional later-work; they already exist in code and must be represented in the first-class integration architecture.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Major auth/admin/settings surfaces are inventoried.
- [x] Each is mapped to `page`, `settings-section`, or `command`.