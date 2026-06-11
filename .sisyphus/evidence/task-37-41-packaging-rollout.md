# Task 37-41: Packaging, Rollout, and Generalization <!-- oc:id=sec_aa -->

## Bundled Plugin Packaging Strategy <!-- oc:id=sec_ab -->
- Folio is **not** a special-case hardcoded path. It is packaged as a standard first-party plugin suite (`firefly.built-in.folio`).
- Manifests live in `apps/desktop/src/shared/firefly-plugin/folio-manifest.ts`.
- Components are lazy-loaded via the existing `PLUGIN_PANEL_COMPONENTS` registry pattern, extended for `page` and `nav-sidebar` surface types.
- Catalog authority remains unified; Folio contributions are projected alongside all other plugins.

## Crash-Isolation & Telemetry Model <!-- oc:id=sec_ac -->
- **UI Crashes**: Each Folio surface (`page`, `nav-sidebar` tab) is wrapped in a `PluginSurfaceBoundary` (error boundary) that catches renders, reports to host, and displays a localized fallback without taking down the Palot shell.
- **Runtime Crashes**: Repeated tRPC failures or sync crashes increment a host-managed quarantine counter. After N failures, the surface is disabled and flagged for review.
- **Telemetry**: All surface opens, switches, and command invocations emit to the host telemetry namespace `firefly.surface.folio.*`.

## Phased Rollout Plan <!-- oc:id=sec_ad -->
1. **Phase 1**: `nav-sidebar` proof (built-in tabs + host shell). <!-- oc:id=item_aa -->
1. **Phase 2**: Core `page` surfaces (documents, database table) + basic deeplink bridge. <!-- oc:id=item_ab -->
1. **Phase 3**: `command` palette integration + `settings-section` (org admin). <!-- oc:id=item_ac -->
1. **Phase 4**: Advanced runtime (offline cache coordination, full auth cutover). <!-- oc:id=item_ad -->
1. **Phase 5**: Telemetry, crash hardening, and full verification matrix. <!-- oc:id=item_ae -->

## Verification Matrix <!-- oc:id=sec_ae -->
| Surface Family | Proof Method | Evidence Artifact |
|---|---|---|
| `nav-sidebar` | Local UI smoke: tab switching, persistence, collapse. | `task-12-built-in-switch.png` |
| `page` | E2E: Open workspace home → create doc → edit → save. | `task-32-document-surface-e2e.log` |
| `settings-section` | Unit: Settings registry includes Folio org admin. | `task-21-settings-contract.md` |
| `command` | Unit: Palette search returns "New Folio Page". | `task-23-command-contract.md` |

## Future Generalization <!-- oc:id=sec_af -->
- All host surface contracts (`nav-sidebar`, `page`, `settings-section`) are defined generically in `firefly-plugin/family-contracts.ts`.
- No Folio-specific types leak into the core projection pipeline.
- The next bundled app can follow the exact same manifest + lazy-load pattern without host modifications.

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Packaging strategy uses normal catalog authority.
- [x] Safety and observability model covers all major surface families.
- [x] Rollout sequencing is credible and cumulative.
- [x] Architecture generalizes beyond Folio.