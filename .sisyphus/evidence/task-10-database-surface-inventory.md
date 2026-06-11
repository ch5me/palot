# Task 10: Database Surface Inventory <!-- oc:id=sec_aa -->

## Canonical Database Surface <!-- oc:id=sec_ab -->
- **Primary page**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/databases/DatabasePage.tsx`
- **Table runtime wrapper**: `/Users/hassoncs/src/ch5/folio-db/apps/web/src/databases/table/FolioTableView.tsx`

## Included View Families <!-- oc:id=sec_ac -->
`DatabasePage.tsx` routes among many view renderers:
- table (`FolioTableView`)
- board
- list
- gallery
- calendar
- timeline
- chart
- dashboard
- form
- map
- feed
- unsupported placeholder fallback

## Core Behaviors <!-- oc:id=sec_ad -->
- loads database schema + rows
- chooses active view id / type / config
- supports route-family default views
- search query and filtered rows
- create row
- open row -> navigates to linked document page
- view config mutation for sortable / configurable views
- route-ledger section that reports parity / gap status

## Surface Mapping <!-- oc:id=sec_ae -->
- **Primary family**: `page`
- **Sub-surfaces inside page**:
  - view switcher -> `page`-local control, not separate host surface
  - row open -> deep link into document `page`
  - unsupported view -> still page-level fallback
- **Future contextual candidates**:
  - `side-panel` for row preview / field inspector / relation details

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Current and future database view families are enumerated.
- [x] Page-level ownership is explicit, with contextual candidates noted separately.