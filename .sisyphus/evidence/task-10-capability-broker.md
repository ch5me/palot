# Task 10 — Capability Broker, Grants, and Denial Semantics <!-- oc:id=sec_aa -->

> Wave 2, Task 10 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

The capability broker is the only path from a plugin (worker process) to a privileged host action. No capability, no action. No short-circuit through "the plugin is built-in" or "the plugin has been around forever." The grant model is per-plugin, per-scope, and deny-by-default. Every dangerous capability declared in the manifest must pass through the broker at runtime.

## 1. Capability taxonomy <!-- oc:id=sec_ac -->

Each capability is an enum string. Host-reserved, with a stable contract.

| Capability | Scope | Default grant | What it allows |
|---|---|---|---|
| `fs:plugin` | always implicit | yes (in manifest) | read/write the plugin's own install directory |
| `fs:read` | session, project | prompt | read files inside granted paths |
| `fs:write` | session, project | prompt | write files inside granted paths |
| `net` | session | prompt | outbound network to granted `networkDomains` |
| `shell` | session, project | prompt | execute shell command in granted cwd |
| `clipboard` | session | prompt | read or write host clipboard |
| `ai` | session, project | prompt | make model calls attributed to plugin |
| `host:ui` | always | yes for declared panels | contribute iframe panels, host-owned DOM stays untouched |
| `host:commands` | always | yes for declared commands | contribute commands to host registry |
| `host:themes` | always | yes for declared themes | contribute theme data (data-only) |
| `host:widgets` | always | yes for declared widgets | contribute widget placements in host zones |
| `bridge:session-read` | session | prompt | read current `PluginSessionHandle`-bound state |
| `bridge:session-write` | session | prompt | write session-scoped plugin state |
| `bridge:ui-state-read` | session, app | prompt | read current `palotUiStateSnapshot` (side-panel state, etc.) |
| `bridge:ui-state-write` | session, app | prompt | open/close side-panel, set `availableTabs`, mutate UI state |
| `browser:lane-control` | session | prompt | drive the embedded browser lane (navigate, click, type, scroll) |
| `theme:apply` | app | yes for declared themes | trigger host apply of a theme by id |
| `command:register` | always | yes for declared commands | host accepts new command ids in this plugin's namespace |
| `tool:register` | always | yes for declared tools | host accepts new tool ids in this plugin's namespace |
| `feature_flag` | app | yes for declared commands | host honors `when: featureFlag:X` conditions |

The `fs:plugin` capability is the only implicit one; it's required for any plugin to read its own package. Without it, a plugin can do nothing else.

## 2. Grant lifecycle and storage <!-- oc:id=sec_ad -->

States for any grant:

- `requested` — declared in `manifest.capabilities[]`, not yet granted
- `granted:session` — granted for the current OpenCode session only
- `granted:project` — granted for sessions in the current working directory
- `granted:app` — granted for all sessions for the current user
- `denied:session` — explicitly denied for current session
- `denied:project` — explicitly denied for current project
- `denied:app` — explicitly denied for the user
- `revoked` — previously granted, now denied (operator or system action)

Storage:

- session-scoped grants: in-memory only, do not persist
- project-scoped grants: `~/.config/elf/firefly-client/grants/projects/<project-hash>.json`
- app-scoped grants: `~/.config/elf/firefly-client/grants/app.json`
- encrypted at rest with host `safeStorage`

Effective grant resolution: per `(pluginId, capability)`, query `app -> project -> session` in that order; first non-null wins. Default is `requested`, which means the broker prompts the user (or denies on timeout).

## 3. Denial semantics <!-- oc:id=sec_ae -->

Two callers, two envelopes.

### UI caller (palette, panel-header, context menu) <!-- oc:id=sec_af -->

- Triggered by `plugin.<id>.command.run` or surface control wrapper
- UI shows: "Denied: plugin needs `<capability>`" with one-click "Grant for session" / "Grant for project" / "Deny"
- If denied: command silently does not invoke; tool envelope has `status: denied`, `errorCode: permission_denied`
- UI denial does not surface a modal; the inline badge is the entire signal

### Agent/tool caller (OpenCode) <!-- oc:id=sec_ag -->

- Tool envelope: `{ status: "denied", errorCode: "permission_denied", errorMessage: "...", requiredCapability: "shell", grantedCapabilities: [...] }`
- Agent can call `plugins.permissions` to discover the gap, `plugins.lifecycle` or its own governance layer to escalate
- The agent never sees a UI prompt directly; the broker handles prompts on the user's behalf before denial
- If user is offline, the broker returns `denied` immediately with `errorCode: permission_denied` and no prompt

## 4. Revocation and expansion <!-- oc:id=sec_ah -->

- A grant is expanded by user granting the requested capability at a wider scope (e.g. session -> project)
- A grant is revoked by user action, plugin disable, or trust downgrade
- On revocation, the broker signals the plugin via the host API; in-flight tool calls continue, new calls are denied
- A grant expansion does NOT retroactively change audit log entries; previous actions stay attributed to the scope at the time

## 5. Audit logging and per-plugin telemetry <!-- oc:id=sec_ai -->

Every broker invocation produces one audit record. Stored in `~/.config/elf/firefly-client/audit/<pluginId>/<yyyy-mm>.ndjson` (NDJSON, append-only, rotated monthly).

Record shape:

```ts
{
  ts: number            // ms epoch
  pluginId: string
  capability: string
  operation: string     // canonical operation name, e.g. "file.read", "net.fetch", "shell.exec"
  scope: "session" | "project" | "app"
  decision: "granted" | "denied" | "prompt" | "error"
  errorCode?: string
  bytesAccessed?: number // for fs/net operations
  redactedArgs?: unknown // for sensitive operations
}
```

Per-plugin telemetry namespace: `firefly-client.broker.<pluginId>`. Emits:
- `firefly-client.broker.<pluginId>.invocation.count` (counter)
- `firefly-client.broker.<pluginId>.denied.count` (counter)
- `firefly-client.broker.<pluginId>.bytes.accessed` (counter, fs/net only)

## 6. Examples grounded in current repo <!-- oc:id=sec_aj -->

### Example A — `palot-bridge` (built-in) opening a side panel <!-- oc:id=sec_ak -->

- Plugin declares `commands: ["plugin.palot.open-browser"]` with `requiresCapabilities: ["bridge:ui-state-write"]`
- Agent calls `plugin.palot.open-browser({ sessionId, tab: "browser" })`
- Broker: capability is granted at app scope for built-in plugin; allowed
- Host executes `setUiStateSnapshot({ sidePanel: { open: true, activeTab: "browser" } })`
- Side panel opens in renderer via existing `palot:open-side-panel` event
- Audit: `granted`, capability `bridge:ui-state-write`, operation `sidePanel.open`

### Example B — `palot-bridge` browser navigate <!-- oc:id=sec_al -->

- Plugin declares tool `browser_navigate` with `requiresCapabilities: ["browser:lane-control", "fs:read"]`
- Plugin runtime does not have `browser:lane-control` granted at session scope
- Broker prompts user; user denies
- Tool envelope: `denied`, `permission_denied`, `requiredCapability: browser:lane-control`
- Agent must surface this to user; OpenCode runtime re-asks the model
- Audit: `denied`, capability `browser:lane-control`, operation `browser.navigate`

### Example C — third-party theme plugin applying a theme <!-- oc:id=sec_am -->

- Plugin declares `themes: ["plugin.example.cortex-glow"]` and `capabilities: ["theme:apply"]`
- User invokes `plugin.example.theme.apply({ themeId: "plugin.example.cortex-glow" })`
- Broker: `theme:apply` is granted at app scope (user previously allowed)
- Host applies the theme per the precedence matrix; renders CSS var injection
- Audit: `granted`, capability `theme:apply`, operation `theme.apply`

### Example D — third-party plugin requesting `fs:write` to a new path <!-- oc:id=sec_an -->

- Plugin declares `requiresCapabilities: ["fs:write"]` with `networkDomains: []`
- Agent calls `plugin.example.file.write({ path: "/Users/chris/secrets.txt", content: "..." })`
- Broker: `fs:write` not yet granted; user not present
- Result: `denied`, `permission_denied`, `requiredCapability: fs:write`, no audit entry beyond the denial record
- If user is present: prompt shows path; user can grant `project` (path inside current working dir) or `session` (any path)

## 7. Acceptance summary <!-- oc:id=sec_ao -->

- [x] Broker model covers all dangerous capabilities
- [x] Denial behavior is defined for UI and agent/tool callers