# Task 37-41: Packaging, Safety, Rollout, and Generalization Summary <!-- oc:id=sec_aa -->

## Bundled Plugin Packaging (T37) <!-- oc:id=sec_ab -->
- **Strategy**: Single umbrella plugin ID (`firefly.built-in.folio`) with multiple `surface` contributions, rather than modular per-surface plugins.
- **Catalog**: Loaded via standard first-party manifest path, no bespoke loading logic.

## Crash Isolation & Telemetry (T38) <!-- oc:id=sec_ac -->
- **Isolation**: React Error Boundaries wrap each `page` and `side-panel` surface. Repeated crashes trigger host-level quarantine of the specific surface contribution, not the entire plugin.
- **Telemetry**: Standardized namespace (`firefly.surface.<kind>.<id>`) for open, switch, crash, and restore events.

## Phased Rollout (T39) <!-- oc:id=sec_ad -->
- **Phase 1**: `nav-sidebar` proof (completed).
- **Phase 2**: Core `page` surfaces (document + database table) + `command` integration.
- **Phase 3**: `settings-section` + advanced views.
- **Phase 4**: Runtime depth (offline sync, advanced auth bridge).

## Verification Matrix (T40) <!-- oc:id=sec_ae -->
- Each surface family has a defined QA scenario (e.g., T12 for nav-sidebar switching, T20 for page routing) with explicit evidence paths in `.sisyphus/evidence/`.

## Future Generalization (T41) <!-- oc:id=sec_af -->
- The unified `surface` family with discriminated `kind` ensures this architecture is not Folio-specific. Future apps can register `kind: "page"` or `kind: "nav-sidebar"` using the exact same host pipeline.

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Packaging, safety, rollout, verification, and generalization strategies are explicitly defined.