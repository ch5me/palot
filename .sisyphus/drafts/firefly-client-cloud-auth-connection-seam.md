# Draft: firefly-client cloud auth + connection seam <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Deliver one Atlas-ready implementation plan at `.sisyphus/plans/firefly-client-cloud-auth-connection-seam.md`
- Plan only. No code.
- Scope = firefly-client seam work in `palot` plus explicit cloud-side dependency gaps
- Must verify cited evidence with exact file:line references
- Must include sign-in route, secure token storage, cloud API client, dual-mode managed-relay + BYOK-direct connection seam, box discovery, dashboard box enumeration, read-only entitlement awareness
- Must run high-accuracy review passes until OKAY before final write

## Technical Decisions <!-- oc:id=sec_ac -->
- Output format = canonical single-plan template with checkbox TODOs and final verification wave
- Single plan mandate applies even though work spans client seam + cloud dependency callouts
- Cloud-side items listed as dependency gaps, not full task checklist

## Research Findings <!-- oc:id=sec_ad -->
- Pending seam audit from palot
- Pending seam audit from firefly-cloud
- Pending secure Electron token storage research
- Pending delegated RS256/JWKS client pattern research

## Open Questions <!-- oc:id=sec_ae -->
- None from user currently; explicit topology already decided

## Scope Boundaries <!-- oc:id=sec_af -->
- INCLUDE: client auth/session/connection seam planning, exact insertion points, verification strategy, cloud gap list
- EXCLUDE: implementation, code edits outside markdown, full cloud implementation checklist