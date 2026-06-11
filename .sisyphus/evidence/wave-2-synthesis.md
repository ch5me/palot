# Wave 2 synthesis -> Wave 3 readiness <!-- oc:id=sec_aa -->

## Verified Wave 2 evidence <!-- oc:id=sec_ab -->

| Task | File | Lines | Status |
|---|---|---|---|
| Task 7 | `.sisyphus/evidence/task-7-manifest-schema.md` | 12K | present |
| Task 8 | `.sisyphus/evidence/task-8-family-contracts.md` | 8K | present |
| Task 9 | `.sisyphus/evidence/task-9-tool-projection.md` | 8K | present |
| Task 10 | `.sisyphus/evidence/task-10-capability-broker.md` | 9K | present |
| Task 11 | `.sisyphus/evidence/task-11-isolation.md` | 7K | present |
| Task 12 | `.sisyphus/evidence/task-12-api-tiering.md` | 6K | present |

## Cross-cutting findings from Wave 2 <!-- oc:id=sec_ac -->

1. Manifest splits cleanly into 4 canonical objects: `PluginManifest` -> `PluginDescriptor` -> `PluginInstance` -> `PluginSessionHandle`. `PluginDescriptor` is the only object the renderer reads; everything else is metadata. <!-- oc:id=item_aa -->
1. Surface contracts are uniform: every contribution family has `id`, host-derived fields, paired `plugin.<id>.<family>.*` host-generated wrappers, and one canonical tool result envelope. <!-- oc:id=item_ab -->
1. Tool envelope is locked at 6 statuses (`completed | failed | denied | unavailable | queued | cancelled`) + canonical `errorCode` taxonomy. State machine is 9 states including `timeout` -> `failed`. Cancel reachable from any non-terminal. <!-- oc:id=item_ac -->
1. Capability broker is single-path with deny-by-default. UI and agent/tool callers get different denial envelopes. Per-plugin audit + telemetry. <!-- oc:id=item_ad -->
1. Isolation uses utilityProcess + per-plugin worker_threads, with a 10-state lifecycle including `quarantined` and `removed`. Quarantine requires operator clearance. <!-- oc:id=item_ae -->
1. Tiering: `stable | proposed | internal`. `fireflyClientVersion` semver range + `apiVersion` schema version + `deprecations[]` per evolution rule. <!-- oc:id=item_af -->

## Wave 3 readiness <!-- oc:id=sec_ad -->

Wave 3 tasks (13-18) all depend on Wave 2 outputs. None need further synthesis before dispatch.

| Task | Title | Inputs needed | Ready |
|---|---|---|---|
| 13 | Renderer projection architecture | Task 7 (manifest fields), 8 (family contracts), 6 (lifecycle states) | yes |
| 14 | OpenCode bridge projection architecture | Task 7 (bridge metadata), 9 (tool projection), 12 (tiering) | yes |
| 15 | Storage/state scopes and persistence | Task 7 (instance state), 10 (audit/grants), 11 (quarantine persistence) | yes |
| 16 | Theme contribution pipeline and precedence | Task 8 (theme contract), 4 (current theme runtime) | yes |
| 17 | Command/menu/keybinding projection | Task 8 (command contract), 3 (current command inventory) | yes |
| 18 | Hot reload and dev loop | Task 11 (worker lifecycle), 12 (tiering) | yes |

Wave 3 can be dispatched in parallel.

## Caveat carried forward <!-- oc:id=sec_ae -->

Plan has duplicate acceptance/QA additions in Task 9 and Task 16 from prior patching. Will not block Wave 3, but should be cleaned before final verification (Wave 5 / F1-F4).