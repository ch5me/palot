# Task 12 — API Tiering, Versioning, and Manifest Evolution <!-- oc:id=sec_aa -->

> Wave 2, Task 12 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

V2 promises tiered API stability so plugin authors can build with confidence. `tier: stable` means the host will not break the manifest under a patch release. `tier: proposed` means the schema is in flight and the plugin must subscribe to `deprecations[]`. `tier: internal` is reserved for built-in plugins and rejected for third-party. Manifest evolution is explicit: every change goes through a `deprecations[]` record with `since` and optional `until` semver. Bridge/tool schemas evolve under the same policy as the manifest.

## 1. Tier definitions <!-- oc:id=sec_ac -->

| Tier | Allowed for | Stability promise | Required for plugin | Required for host |
|---|---|---|---|---|
| `stable` | any plugin (built-in, local-dev, signed-third-party) | host will not break the schema in a patch release; breaking change only in major bump with `deprecations[]` | `fireflyClientVersion` semver pin within patch range | host documents breaking changes one major in advance |
| `proposed` | any plugin | schema is in flight; host may change the schema in any release | `enabledApiProposals: ["<proposalId>"]` array in manifest (host must respect) | host ships codemod proposal with `until` semver |
| `internal` | built-in plugins only; rejected for third-party | no stability promise; host may break at any time | no host-side contract; `tier: internal` is a flag only | host may refactor freely |

## 2. Compatibility contract matrix <!-- oc:id=sec_ad -->

| Consumer of `fireflyClientVersion` | What host guarantees |
|---|---|
| strict-equality | host only activates plugins whose required version equals installed version |
| tilde (`~`) range | host activates plugins within the same minor; major bump requires new manifest revision |
| caret (`^`) range | host activates plugins within the same major; major bump requires new manifest revision |
| `*` (host reject) | rejected; plugin must pin a real version |

`apiVersion` in the manifest is the schema version, separately tracked. The host ships the Zod schema; the plugin must compile against it. `apiVersion` is bumped on every schema change (additive or breaking). `fireflyClientVersion` is the SDK behavior version; the plugin pins it to a range. Both are required.

## 3. Manifest evolution rules <!-- oc:id=sec_ae -->

- adding a new contribution family: new `apiVersion`; old plugins continue to work if they declared an `apiVersion` range; new family is opt-in
- adding a new field under an existing family: backward-compatible; old plugins ignore the field; no `apiVersion` bump
- changing the meaning of an existing field: new `apiVersion` plus `deprecations[]` with `since` and `replacement` populated
- removing a field: new `apiVersion` plus `deprecations[]` with `since` and `until` populated; host emits deprecation warnings to the operator log and the `plugins.lifecycle` tool result envelope

Cross-version behavior:

- host refuses to activate a plugin if `apiVersion` is unknown
- host warns on the operator log if `apiVersion` is older than supported
- host refuses to activate a plugin if `fireflyClientVersion` is strictly newer than installed

## 4. Bridge/tool schema evolution policy <!-- oc:id=sec_af -->

Bridge payloads (`palot-bridge-schemas.ts`) and tool schemas (`contributes.tools[].inputSchema`) evolve under the same rules:

- additive: old hosts ignore new fields; new hosts ignore old fields
- breaking: requires `apiVersion` bump plus `deprecations[]` entry plus codemod for migration
- for tool schemas, the host runs the plugin's Zod schema against the input; if the plugin upgrades and rejects the old envelope, the agent receives a `validation_error` and may retry with a newer envelope

The OpenCode tool projection always emits the standard tool envelope (see Task 9 §5). Plugin-emitted `errorCode` strings are scoped to the plugin id; canonical error codes are host-reserved and never change shape.

## 5. Deprecation workflow and codemod expectations <!-- oc:id=sec_ag -->

When the host deprecates a field, it emits:

1. a `deprecations[]` entry in the manifest schema (so plugin authors can see it) <!-- oc:id=item_aa -->
1. a runtime warning to the operator log (so operators can see it) <!-- oc:id=item_ab -->
1. a `plugins.lifecycle` tool result field listing active deprecations per plugin (so the agent can see it) <!-- oc:id=item_ac -->
1. for breaking changes only, a `until` semver; the host will refuse to activate plugins using the deprecated field past that version <!-- oc:id=item_ad -->

Codemod expectations:

- the host ships a `firefly-client-codemod` CLI tool that reads a plugin manifest and applies automatic migrations for any `deprecations[]` entry
- codemods are pure transforms; no manifest mutation without operator consent
- codemod emits a diff for operator review before write

## 6. Stable vs proposed example <!-- oc:id=sec_ah -->

Stable field example: `id` in `contributes.panels[]`. Always present, never changed, never removed.

Proposed field example: `requiresCapabilities` array entries. New capabilities may be added to the enum in any release. The host treats unknown capability strings as `denied` with `errorCode: validation_error`. Plugin authors who depend on a new capability must declare it in `enabledApiProposals: ["new-capability-shape"]` and pin `fireflyClientVersion` to a release that includes the proposal.

Stable but with future intent: `tier: stable` with `deprecations: [{ field: "usesLegacyRender", since: "2.0.0", until: "3.0.0", replacement: "renderMode" }]`. The host emits a runtime warning whenever a plugin declares `usesLegacyRender: true`, and refuses to activate it after `3.0.0`.

## 7. Acceptance summary <!-- oc:id=sec_ai -->

- [x] Stable/proposed/internal policy covers host APIs and tool schemas
- [x] Manifest evolution and compatibility rules are explicit