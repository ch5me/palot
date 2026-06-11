# Task 24 — Plugin Lifecycle / Operator Surface Plan <!-- oc:id=sec_aa -->

> Wave 4, Task 24 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Reads: Task 1 contribution inventory, Task 5 guardrails, Task 6 lifecycle, Task 10 capability broker, Task 13 renderer projection, Task 14 bridge projection.

## 1. Operator surface composition <!-- oc:id=sec_ab -->

Three operator surfaces, scoped tightly to lifecycle, no marketplace UI:

| Surface | Where | Replaces / adds |
|---|---|---|
| **Plugins tab in side panel** | the existing `side-panel/plugins-panel.tsx` becomes the operator inventory | current posture/inventory surface |
| **Per-plugin detail route** | opened by clicking any plugin row in the Plugins tab; lives in the same panel slot | new |
| **Quarantine review route** | opened by clicking a quarantined plugin row; lives in the same panel slot | new |

The tabs/panels are themselves first-class contributions. The `firefly.plugin-lifecycle` plugin (built-in, ships with the desktop build) owns these surfaces. The plugins tab is `host-only chrome` per Task 5, so it does not participate in `plugin.<id>.command.run` invocations from the agent — but the agent CAN read its data via `plugins.describe` and `plugins.lifecycle`.

## 2. Required operator fields per plugin <!-- oc:id=sec_ac -->

| Field | Source | Notes |
|---|---|---|
| name, id, version, publisher, tier, trust | manifest | always present |
| enabled posture | `PluginInstance.state` | `enabled`, `disabled`, `quarantined`, `degraded` |
| trust tier | manifest | `built-in`, `local-dev`, `signed-third-party` |
| crash count + last crash reason + last crash timestamp | `PluginInstance.crashCount` and history | visible if > 0 |
| granted capabilities (per scope) | capability broker | session, project, app |
| pending capability prompts | broker queue | if any, with a "Grant / Deny" action |
| active session bindings | `PluginSessionHandle` per session | one row per OpenCode session |
| exposed tools | introspection from `plugins.tools` | per-tool name, description, availability, last call, last call outcome |
| contributed panels / widgets / commands / themes | contributions | per contribution id + status |
| lifecycle state + posture | lifecycle supervisor | one badge per state |
| current applied theme ownership | only when plugin contributed themes | shows which theme is currently active and from which plugin |
| last reload timestamp + reload reason | hot reload log | manual or automatic |
| installation source | bundle | bundled, local-dev, signed-third-party |
| updatable | update policy | one button if newer version available |
| audit log entry count for plugin | audit log | for triage |
| dev-mode toggle (if `local-dev`) | build config | enable file watcher |

A "missing field" is itself a field — the operator UI must show "N/A" or "unsupported" rather than hide.

## 3. Replacement of current `plugins-panel.tsx` posture <!-- oc:id=sec_ad -->

Current `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx` is posture/inventory only (skills, commands, MCP). V2 replaces it with a **two-pane operator view**:

- left pane: plugin list with per-row summary (name, version, trust tier, posture badge, crash count, granted capability count, exposed tool count)
- right pane: per-plugin detail with the fields above, a `lifecycle` action group, and a `permissions` action group

Both panes read from the same host projection stream defined in Task 13: a new per-plugin `ProjectedOperatorView` derived from `PluginDescriptor` + `PluginInstance` + host policy state. The operator view is a host-rendered reconciler; it is not a plugin contribution.

Existing `plugins-panel.tsx` continues to show the existing posture list (skills, commands, MCP) but adds the operator view above it during the rollout. After Wave 5, the posture list is replaced by a sub-section of the operator view labeled "Status".

## 4. Lifecycle action UI mapping <!-- oc:id=sec_ae -->

Every operator action is a host-generated command over the same V2 envelope used by the agent. UI buttons are conveniences over those commands.

| Operator action | UI label | V2 command | Pre-flight |
|---|---|---|---|
| Install (from VSIX or path) | "Install Plugin" | `plugin.<id>.install` | capability `tool:register` for third-party? not needed for built-in/local-dev |
| Enable | "Enable" | `plugin.<id>.lifecycle.enable` | state must be `disabled` or `installed` |
| Disable | "Disable" | `plugin.<id>.lifecycle.disable` | state must be `active` or `degraded` |
| Update | "Update to <version>" | `plugin.<id>.update` | signature path required for signed-third-party |
| Rollback | "Rollback to <version>" | `plugin.<id>.rollback` | within 14-day rollback window |
| Uninstall | "Uninstall" | `plugin.<id>.uninstall` | state must be `disabled` or `removed` |
| Clear quarantine | "Review & Clear Quarantine" | `plugin.<id>.lifecycle.quarantine.clear` | state posture must be `quarantined` |
| Revoke capability | "Revoke <capability> at <scope>" | `plugin.<id>.permissions.revoke` | scope must be valid for that capability |
| Grant capability | "Grant <capability> at <scope>" | `plugin.<id>.permissions.grant` | opens prompt to user if not auto-grant |
| View history | "View History" | `plugin.<id>.lifecycle.history` | no pre-flight |
| Reload (dev mode) | "Reload" | `plugin.<id>.lifecycle.reload` | trust must be `local-dev` |

Each action surfaces a confirm dialog with the pre-flight outcome if it would fail. Successful actions emit telemetry under the existing `firefly.surface.plugins` namespace plus a new `firefly.operator.*` namespace.

## 5. Permission review UI <!-- oc:id=sec_af -->

Permissions are listed per scope with explicit "Grant at session" / "Grant at project" / "Grant at app" / "Deny" buttons. The UI explains the consequences in plain language per capability:

- `fs:read`, `fs:write` -> shows the granted paths
- `shell` -> shows the granted cwds
- `net` -> shows the granted `networkDomains`
- `ai` -> shows AI cost attribution
- `host:ui` / `host:commands` / `host:themes` / `host:widgets` / `theme:contribute` / `theme:apply` -> shows which contributions are affected
- `bridge:session-read/write`, `bridge:ui-state-read/write`, `browser:lane-control` -> shows which bridge state and which browser lanes are affected

The user must be able to understand every grant before granting it. The prompt must show the consequences, not just the capability name.

## 6. Logs and provenance UI <!-- oc:id=sec_ag -->

Per-plugin log viewer with three sections:

- **Lifecycle log**: state transitions with timestamps, last 100 entries
- **Audit log**: broker invocations (capability, operation, decision, args redacted), NDJSON-backed, paginated
- **Crash log**: per-crash reason, stack, recovery action taken

Each log entry shows `provenance`: plugin id, tool id (if any), scope, capability set used. Log entries are read-only from the operator UI; rotation is host-internal.

The audit log is the same NDJSON the agent can read via `plugins.permissions` introspection, just rendered visually.

## 7. Acceptance summary <!-- oc:id=sec_ah -->

- [x] Lifecycle operations represented in UI plan (11 operator actions, all mapped to V2 commands)
- [x] Scope bounded to lifecycle, not marketplace (no browse, no discover, no ranking)
- [x] Current `plugins-panel.tsx` posture replaced with two-pane operator view
- [x] Permission review UI is capability-specific and consequence-revealing
- [x] Logs surface provenance and tie to introspection tools