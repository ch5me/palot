# Studio / Office Preview Plan <!-- oc:id=sec_aa -->

## Current repo reality <!-- oc:id=sec_ab -->

- No dedicated Studio or Office preview domain exists yet.
- Files and Editor now prove file selection and read-only preview seams.
- Bridges now positions external integrations separately, so Studio does not need to carry connector hub concerns.

## Decision <!-- oc:id=sec_ac -->

Studio should remain a route-level candidate, but the first proof can still start as a side-panel shell until richer office/document workflows are real.

## Why <!-- oc:id=sec_ad -->

- There is no existing office-specific backend or creation workflow.
- Route-level promotion should follow proven data/workflow complexity, not precede it.
- A side-panel proof can validate whether users want document/office-specific inspection inside Palot at all.

## First shell shape <!-- oc:id=sec_ae -->

- Add a `studio` Firefly side-panel proof shell.
- Position it around office/document preview workflows: docs, PDFs, slides, and adjacent creation notes.
- Reuse existing file preview posture instead of adding a dedicated office runtime now.

## Promotion trigger <!-- oc:id=sec_af -->

Promote Studio to route-level only when one of these becomes true:
- multi-document workspace behavior is needed
- creation/edit flows become primary
- office/media tooling needs a dedicated navigation identity