# Task 6 -- Plugin Identity, Lifecycle, and Trust Tiers

Wave 1, Task 6 of plan `firefly-plugin-system-v2`. Defines **who a plugin is**,
**how it moves through its lifetime inside Firefly**, and **how the host decides
what to trust it with**. Grounded in the canonical `PluginDescriptor` /
`PluginInstance` / `PluginSessionHandle` runtime model from plan section
"V2 Architecture > Source Of Truth Model" and the capability-broker posture from
plan section "Must Have".

This document feeds Wave 2 tasks 7 (manifest), 10 (capability broker), 11
(isolation/quarantine), 12 (API tiering) and Wave 4 task 22 (third-party
exemplar).

---

## 1. Plugin Identity

Identity is a **two-part, host-validated tuple** baked into the `PluginManifest`
on disk. The tuple is stable across versions, used as the durable primary key
in every catalog row, and never reused for a different plugin.

### 1.1 Plugin ID rules

| Rule | Value | Rationale |
|---|---|---|
| Format | `<scope>/<name>` -- lowercase, ASCII, `[a-z0-9_.-]` | Reversible, parseable, no quoting needed in logs/paths |
| Scope | `firefly` (built-in), `local` (local-dev), `<org>.<org>...` (third-party) | Scopes gate namespace reservation and trust tier policy |
| Min length | 4 chars total | Avoid trivial `a/b` collisions |
| Max length | 96 chars | Reasonable for filesystem + DB column |
| Reserved scopes | `firefly`, `elf`, `palot`, `system`, `host` | Host-owned; plugins cannot publish under these |
| Uniqueness | Global within Firefly install; not per-workspace | Plugins are installed once and projected per scope |
| Mutable? | NO. Identity is permanent. Renames require new install + uninstall of old | Plan section "Reserved namespaces" |

Examples:
- `firefly/review-panel` (built-in)
- `firefly/sidebar-plugins` (built-in, migrates current sidebar surface)
- `local/chris-dev-loop` (local-dev)
- `acme.corp/linear-bridge` (signed third-party)

### 1.2 Plugin version rules

| Rule | Value | Rationale |
|---|---|---|
| Format | `MAJOR.MINOR.PATCH[-prerelease]` semver | Standard, parseable, matches Elf packaging |
| Prerelease tags | Allowed only for `local` and `firefly` scopes; rejected for signed third-party at install time | Keeps marketplace install set boring |
| Build metadata | Optional `+<build>`; never used for identity, only for diagnostics | semver-strict |
| Min host compat | `fireflyHost: "^x.y.z"` field in manifest | Per plan "API tiering" workstream |
| Active version model | One active installed version per `(id)` slot; multi-version install is a separate feature, **out of V2 scope** | Keeps projections deterministic |
| Update class | `major`, `minor`, `patch` derived from semver deltas | Drives `automatic`, `opt-in`, `manual` update policy |

### 1.3 Identity vs runtime handle

- `pluginId` and `pluginVersion` are the **identity**; they live in
  `PluginManifest` and are copied into `PluginDescriptor` and every
  `PluginInstance` / `PluginSessionHandle` row.
- Activation, worker PID, transport handle, crash counter, and quarantine status
  are **lifecycle state**, never identity. Two installations of the same
  version still share identity; their `PluginInstance` rows are distinct only
  because the host may run one worker per activation context.
- A reinstall of the same `(pluginId, pluginVersion)` preserves grants, session
  state, and disable flags unless the manifest's `contributorKey` (publisher
  fingerprint) changes. Publisher change forces an uninstall+install flow with
  the user explicitly re-consenting.

---

## 2. Lifecycle State Machine

This is the canonical state machine for one `(pluginId, pluginVersion)` slot in
the host catalog. Quarantine and rollback hang off this machine as orthogonal
postures -- a plugin can be in `active` state and `quarantined` posture
simultaneously, with the posture taking precedence over posture-less state.

### 2.1 State diagram

```text
                                  install source
                                       v
              +-----------+    +-----------+   manifest parse fails
   (none) --> |discovered |--> | validated |------------------+
              +-----------+    +-----+-----+                   |
                                  |     |                      v
                                  |     +----------------+     v
                                  v                      |  +------------+
                            +-----------+                |  |  rejected  |
                            | installed |----------------+  +-----+------+
                            +-----+-----+                       |
                                  |        user/operator        |
                                  v       disable                v
                            +-----------+ <--------+        +-----------+
                  enable -> | disabled  |          |        |  removed  |
                            +-----+-----+          |        +-----------+
                                  |                |
                                  |  activate      |
                                  v                |
                            +-----------+          |
                  operator  | activating|          |
                  cancel --> +-----+-----+          |
                                  |                |
                          activation OK             |
                                  v                |
                            +-----------+          |
                            |  active   |----------+
                            +-----+-----+
                                  |
                          crash / hang / capability violation
                                  v
                            +-----------+
                            | degraded  |
                            +-----+-----+
                                  |
                          N crashes / cap violation / signature revoked
                                  v
                            +-----------+
                            |quarantined|
                            +-----+-----+
                                  |
                          user/operator clear
                                  |
                                  v
                            (back to `disabled` posture)
```

### 2.2 States (with allowed transitions)

| State | Definition | Allowed in-scope transitions out | Host actions that emit it |
|---|---|---|---|
| `discovered` | Manifest or installed package seen by host for the first time; not yet parsed/validated | `validated`, `rejected` | File watcher sees a new plugin dir, install command queued, OpenCode server announces a new plugin |
| `validated` | Manifest passed Zod parse, host version gate, identity rules, and any signature check for the tier | `installed`, `rejected`, `discovered` (re-scan) | Validation pipeline completes |
| `installed` | Plugin package on disk, descriptor in catalog, but operator has not enabled it yet | `disabled`, `rejected` (post-install failure), `removed` | Default landing state on successful install |
| `disabled` | Operator toggle is off; plugin is on disk and valid; no worker running, no tools projected | `activating` (operator enables), `removed` (uninstall) | `plugin.disable` command, fresh install of a trust tier that requires explicit enable |
| `activating` | Worker spinning up, capabilities being brokered, activation events firing | `active`, `disabled` (activation failure or operator cancel), `degraded` (worker started but health checks failing) | `plugin.enable` command, automatic activation by activation trigger (e.g. `onCommand:firefly.openPalette`) |
| `active` | Worker running, capabilities granted for the active session, surfaces projected | `degraded`, `disabled`, `quarantined` | Healthy post-activation |
| `degraded` | Worker alive but failing health checks / throwing unhandled rejections / not responding to heartbeat | `active` (recovery), `disabled` (operator force), `quarantined` (after N consecutive degraded samples) | Health monitor tick |
| `quarantined` | Posture layer marks the plugin as non-loadable; runtime state is preserved on disk; tools, panels, widgets, commands, and theme all become unavailable | `disabled` (clear quarantine), `removed` (operator purge) | Crash counter trip, signature revocation, manifest schema downgrade, operator manual action |
| `rejected` | Terminal negative state; plugin is recorded for audit but never loaded | (none -- must be fixed at source and re-discovered) | Signature failure, identity violation, capability self-declaration mismatch, install source policy denial |
| `removed` | Plugin uninstalled, package on disk deleted, descriptor purged, grants revoked; catalog row kept for audit only | (none -- reinstall re-enters `discovered`) | `plugin.uninstall` command, rollback to a version that no longer exists on disk |

### 2.3 Cross-cutting postures

Quarantine and rollback are **postures** that overlay the state machine. A
plugin's lifecycle state advances normally, but posture gates which states the
operator can reach and what the user actually sees.

| Posture | Independent of state? | Effect on rendering | Effect on tools | Cleared by |
|---|---|---|---|---|
| `quarantined` | Yes (orthogonal) | Surfaces hide; UI shows "plugin quarantined, click to review" badge with reason | All plugin tools return `status: "unavailable"`, `errorCode: "PLUGIN_QUARANTINED"` | Operator `plugin.clearQuarantine` or host quarantine TTL |
| `rollback-pending` | Yes (orthogonal) | Surfaces keep current state; no new activations | Plugin tools succeed, but new sessions created during the window get the previous version's handle | Update transaction completes or is aborted |
| `disabled` | Already encoded as a state | No worker, no projections, no tool availability | All plugin tools return `status: "unavailable"`, `errorCode: "PLUGIN_DISABLED"` | Operator enable |

### 2.4 Per-state guarantees

| State | Surfaces projected? | Tools available? | Grants persisted? | Worker running? |
|---|---|---|---|---|
| `discovered` | no | no | n/a | no |
| `validated` | no | no | n/a | no |
| `installed` | no | no | yes (default-deny) | no |
| `disabled` | no | no | yes | no |
| `activating` | partial (placeholder UI ok) | no | yes (active subset only) | yes |
| `active` | yes | yes | yes | yes |
| `degraded` | yes (with degraded badge) | yes (with health warning) | yes | yes |
| `quarantined` | no | no | yes (suspended) | no (forced stop) |
| `rejected` | no | no | no | no |
| `removed` | no | no | purged | no |

---

## 3. Lifecycle Operations

Every operator-visible command maps to one or more state transitions above.
This is the contract for the host command surface (CLI, command palette,
`plugins.lifecycle` introspection tool) and the OpenCode tool
`plugin.<id>.lifecycle`.

### 3.1 Install

| Aspect | Rule |
|---|---|
| Source | `firefly://built-in` (read-only), `file://` (local-dev), `https://...` (signed third-party from trusted mirror list) |
| Inputs | `pluginId` (or source URL), `expectedVersion?` (defaults to latest stable for tier), `enableAfterInstall?` (default tier-dependent; see trust table) |
| Steps | 1) fetch/discover -> 2) tier detection -> 3) signature/identity verify -> 4) Zod parse -> 5) version gate -> 6) policy check (does scope allow install? does requested capability exceed tier defaults?) -> 7) extract to `~/.local/share/elf/plugins/<id>/<version>/` -> 8) record in catalog -> 9) if `enableAfterInstall`, transition to `activating` |
| Failure modes | Network failure, signature failure, schema failure, version gate failure, identity collision, disk extraction failure, host policy denial |
| Idempotency | Re-installing the same `(id, version)` is a no-op; re-installing a different version of the same id triggers the **update** flow |
| Audit | `install` event with source URL, tier, signature status, capabilities declared, operator user |

### 3.2 Update

| Aspect | Rule |
|---|---|
| Pre-conditions | Plugin in `installed`, `disabled`, or `active` state; new version resolves from configured source |
| Semver policy | `patch`: automatic, no prompt; `minor`: opt-in, prompt with changelog; `major`: manual, requires explicit command and re-consent for new capabilities |
| Staged install | New version extracted alongside old; manifest validated; capabilities diffed against current grants |
| Rollback window | Previous version's package and `PluginDescriptor` retained for 14 days; if new version fails activation or hits quarantine within the window, auto-rollback restores previous version's worker and grants |
| Tool surface | `plugin.<id>.update({ toVersion?, dryRun? })`, `plugin.<id>.update.check()` |
| Failure handling | If activation fails twice, the plugin enters `quarantined`; operator must clear or uninstall |

### 3.3 Enable / Disable

| Aspect | Rule |
|---|---|
| Enable | `disabled|installed` -> `activating` -> `active` |
| Disable | `active|degraded` -> `disabled` (graceful worker shutdown) |
| Force disable | `quarantined` -> `disabled` (clears posture too) |
| Tool surface | `plugin.<id>.enable({ scope? })`, `plugin.<id>.disable({ scope? })` |
| Atomicity | Enable is not atomic -- there is an `activating` window during which capabilities are being granted. UI must show `activating` distinctly from `active` |

### 3.4 Uninstall

| Aspect | Rule |
|---|---|
| Pre-conditions | None -- uninstall works from any state |
| Steps | 1) `deactivate` worker if running -> 2) revoke all grants -> 3) close open `PluginSessionHandle`s -> 4) move package dir to `~/.local/share/elf/plugins/_trash/<id>/<version>/<ts>/` -> 5) purge catalog row -> 6) emit `removed` state with `removedAt` timestamp |
| Soft-delete window | 30 days; restore command puts the package back and re-applies prior grants within 24h of uninstall (operator can extend) |
| Audit | Uninstall never silently clears audit log; the catalog row stays in `removed` for `uninstall.audit.retentionDays` (default 365) |

### 3.5 Rollback

| Aspect | Rule |
|---|---|
| Trigger | Automatic on update failure, manual via `plugin.<id>.rollback({ toVersion? })` |
| State outcome | Plugin returns to `disabled` with the rolled-back version's descriptor and grants; if was `active` and no other constraints changed, transitions back to `activating` then `active` |
| Retention | Previous N versions retained on disk (default N=2, configurable per tier -- signed third-party defaults to N=3) |
| Tool surface | `plugin.<id>.rollback({ toVersion? })`, `plugin.<id>.history` |

---

## 4. Enablement Scopes

The host supports two orthogonal scopes. Both can be set independently; the
effective state is `(global, perProject)`. A plugin is "on" for a session only
if it is on in the global posture **and** on in the per-project posture for the
session's project (when one is bound).

| Scope | Stored at | Affects | Cleared by |
|---|---|---|---|
| `global` | `~/.local/share/elf/plugins/state/global.json` | All sessions with no project binding, and as the default for new projects | `plugin.<id>.disable({ scope: "global" })`, settings UI |
| `perProject` | `<project>/.elf/plugins.json` (project-local) | Only sessions whose `projectDir` matches | `plugin.<id>.disable({ scope: "perProject" })`, project file edit, project deletion |

### 4.1 Effective enablement resolution

For a session with project `P`:

```
effective(session) = enablement.global AND
                     (enablement.perProject[P] ?? enablement.perProjectDefault ?? true)
```

`perProjectDefault` is itself a host setting at `app` scope. Default is
"inherit global". Three possible per-project values: `enabled`, `disabled`,
`inherit`.

### 4.2 Built-in plugin scoping rule

Built-in plugins are a special case: their `global` posture defaults to
`enabled` for scopes the host declares as core (e.g. side panels that ship with
the app). Operators can still disable them globally or per-project, but doing
so shows a clear UX warning when the surface is a documented part of Firefly.

### 4.3 Tool projection visibility under scopes

| Global | PerProject (P) | Effective for session in P | Tool availability |
|---|---|---|---|
| enabled | enabled (or inherit) | on | available |
| enabled | disabled | off | `unavailable`/`PLUGIN_DISABLED_PER_PROJECT` |
| disabled | enabled | off | `unavailable`/`PLUGIN_DISABLED_GLOBAL` |
| disabled | disabled | off | `unavailable`/`PLUGIN_DISABLED_GLOBAL` |
| quarantined | any | off | `unavailable`/`PLUGIN_QUARANTINED` |

---

## 5. Quarantine Behavior

Quarantine is a first-class posture with its own entry/exit contract, audit
trail, and operator overrides. It is **not** the same as disable -- disable is
operator intent, quarantine is host defense.

### 5.1 Quarantine triggers

| Trigger | Counter / threshold | Severity |
|---|---|---|
| Worker crash within `N` seconds of activation | 3 consecutive | `restart-loop` |
| Unhandled rejection in worker event loop | 5 in 60s | `runtime-unstable` |
| Capability self-declaration exceeds manifest (plugin asks for `fs:write` but manifest says no `fs` cap) | 1 | `capability-violation` |
| Signature verification failure on hot reload | 1 | `signature-mismatch` |
| Bridge/tool call to a deprecated or removed API | configurable, default 10/min | `api-abuse` |
| Operator manual | n/a | `operator-action` |
| External signal: signed third-party publisher revoked | 1 | `publisher-revoked` |

### 5.2 Quarantine effects

- Worker is forced to terminate; graceful shutdown timeout 2s, then SIGKILL on the host's plugin worker.
- All `PluginSessionHandle`s for that plugin are closed; in-flight tool calls receive `status: "cancelled"`, `errorCode: "PLUGIN_QUARANTINED"`.
- Surfaces, commands, widgets, themes all stop projecting. Renderer receives a `plugin.quarantined` event with the reason code.
- Grants are **suspended**, not deleted. Audit log retains full grant history.
- Catalog row stays with state `quarantined` and a `quarantineReason` enum.

### 5.3 Quarantine exit

| Path | Mechanism | Audit |
|---|---|---|
| Operator `plugin.clearQuarantine` | Sets posture to `disabled`; allows normal enable flow | `quarantine.cleared` with operator id |
| Host quarantine TTL (default 24h, configurable) | Automatic posture reset to `disabled` if no further violations | `quarantine.autoExpired` |
| Uninstall | Removes plugin entirely; quarantine reason preserved in audit | `plugin.uninstalled` |

### 5.4 Quarantine persistence

Quarantine state is persisted in `~/.local/share/elf/plugins/state/quarantine.json`
keyed by `pluginId`. Survives host restart, plugin re-install (same id), and
host version upgrades. Cleared only by the paths in 5.3 or by direct operator
deletion of the entry (advanced; logged as `quarantine.forcedClear`).

---

## 6. Trust Tiers

Three trust tiers cover the V2 install surface. Each tier pins behavior in
five axes: signature requirement, capability defaults, consent UX, default
enablement scope, and exception handling.

### 6.1 Trust tier table

| Tier | Signature requirement | Capability defaults | Consent UX | Default enablement scope | Exception handling |
|---|---|---|---|---|---|
| **`built-in`** | Host-managed hash pin; signature optional in dev, required in shipped builds; pinned to a publisher key owned by Firefly | Full Firefly core surface (`ui:host`, `command:register`, `tool:register`, `theme:apply`, `bridge:session-read|write`, `bridge:ui-state-read|write`); dangerous caps (`fs:write` outside project, `shell:exec`, `network:outbound`, `clipboard:write`) require explicit grant | Single first-run screen on app launch: "These core panels, commands, and tools are part of Firefly. They can read UI state and register commands. Continue?" Core grants cached; per-capability revoke available in Settings | `global = enabled` for all built-ins whose manifest declares `tier: "built-in"` and `core: true`; `perProject = inherit` | Host-signed manifests can be revoked by host update; old version becomes `quarantined` on next launch with reason `publisher-revoked`; rollback to old version requires developer override |
| **`local-dev`** | None (unsigned); manifest still Zod-validated; `signing.publicKey` field ignored at this tier | `none` (deny-by-default); operator must explicitly grant each capability at install time from a per-capability checklist | Per-install modal: "Local plugin `<id>` declares: [list]. Allow all? Allow subset? Cancel install?"; selected grants persisted; later capability expansion triggers a re-prompt | `global = disabled`, `perProject = inherit (defaults to off)`; opt-in via command palette or settings | If a local-dev plugin crashes 3x in 60s it auto-quarantines; if it requests a capability outside the tier's allowed set (e.g. `network:outbound` from a `local-dev` plugin without explicit `network.outbound` declared in manifest), install is rejected with `rejected: capability-not-allowed-for-tier` |
| **`signed-third-party`** | Required: Ed25519 detached signature over the canonicalized manifest, verified against a host-trusted publisher key in `~/.local/share/elf/trusted-publishers.json`; revocation list checked at install and at host startup | Tier-default cap set: `ui:host`, `command:register`, `tool:register`, `bridge:session-read`, `bridge:ui-state-read`; network/shell/clipboard-write/`fs:write` outside project require per-capability grant and explicit consent | Per-install modal: "Signed by `<publisher>`. Plugin declares: [list]. Granted by tier: [list]. You must grant: [list]. Allow? Deny?" with publisher key fingerprint shown | `global = disabled`, `perProject = inherit (defaults to off)`; first install is always `disabled`, requires explicit enable | Signature failure: install rejected with `rejected: signature-invalid`. Publisher revoked: existing installs transition to `quarantined` with reason `publisher-revoked` on next launch. Manifest schema drift outside declared `fireflyHost` range: install rejected with `rejected: host-compat-mismatch` |

### 6.2 Tier-to-state defaults

| Tier | Install lands in | First-time enable requires |
|---|---|---|
| `built-in` | `active` (or `disabled` if operator pre-disabled in settings) | n/a; first-run consent covers enablement |
| `local-dev` | `installed` -> `disabled` | Operator enable command |
| `signed-third-party` | `installed` -> `disabled` | Operator enable command **and** per-capability grant confirmation |

### 6.3 Tier detection

Tier is determined by a combination of source and signature state, not by
manifest self-declaration. The manifest's `tier` field is a hint and may be
empty; the host computes authoritative tier:

1. `installSource` is in `firefly://built-in` set -> `built-in` regardless of manifest hint
2. `installSource` is `file://` and not host-managed -> `local-dev`
3. `installSource` is `https://...` (or any non-`firefly://` non-`file://`) and signature verifies against trusted publisher -> `signed-third-party`
4. `installSource` is `https://...` and signature missing/invalid -> `rejected` at the signature stage, never promoted to `signed-third-party`

This prevents a third-party plugin from claiming `tier: "built-in"` in its
manifest to gain privilege.

### 6.4 Exception handling cross-reference

| Exception | Built-in | Local-dev | Signed third-party |
|---|---|---|---|
| Signature missing | OK in dev; required in shipped | OK (tier allows unsigned) | `rejected: signature-invalid` |
| Signature revoked after install | n/a (no separate revocation) | n/a | `quarantined: publisher-revoked` on next launch |
| Manifest `fireflyHost` range violated | `rejected: host-compat-mismatch` | `rejected: host-compat-mismatch` | `rejected: host-compat-mismatch` |
| Identity collision (id already installed by different publisher) | n/a (host namespace) | `rejected: identity-collision` | `rejected: identity-collision` |
| Capability exceeds tier ceiling | `rejected` | `rejected: capability-not-allowed-for-tier` | `rejected: capability-not-allowed-for-tier` |
| Crash loop | `quarantined: restart-loop` | `quarantined: restart-loop` | `quarantined: restart-loop` |
| Operator uninstall | `removed` (audit retained) | `removed` (audit retained) | `removed` (audit retained) |

---

## 7. Persistence Layout

The state machine above maps to concrete files. This is what Wave 3 task 15
will own, listed here for downstream reference.

| Path | Holds | Lifecycle |
|---|---|---|
| `~/.local/share/elf/plugins/<id>/<version>/` | Extracted plugin package | Created on install, soft-deleted to `_trash/` on uninstall, hard-purged after retention |
| `~/.local/share/elf/plugins/state/catalog.json` | `PluginDescriptor` per installed `(id, version)` | Created on validated, updated on enable/disable/quarantine, removed only on hard purge |
| `~/.local/share/elf/plugins/state/global.json` | Map of `pluginId` -> `global` enablement posture | Per-session, durable |
| `<projectDir>/.elf/plugins.json` | Map of `pluginId` -> per-project posture | Per-project, source-controlled or local depending on project posture |
| `~/.local/share/elf/plugins/state/quarantine.json` | Map of `pluginId` -> `{ reason, since, expiresAt }` | Per-host, durable across restarts |
| `~/.local/share/elf/plugins/state/grants.json` | Per-plugin granted capability set with grant timestamps and grant scope | Durable; suspended on quarantine, not deleted |
| `~/.local/share/elf/trusted-publishers.json` | Publisher keys for `signed-third-party` | Host-managed; user-editable for adding own trusted keys |
| `~/.local/share/elf/plugins/_trash/<id>/<version>/<ts>/` | Soft-deleted packages for restore | 30-day TTL |
| `~/.local/share/elf/audit/plugins.jsonl` | Append-only audit log of install/update/enable/disable/quarantine/uninstall | 365-day retention, no operator delete |

---

## 8. Operator / Agent Tool Surface

This is the projection of the lifecycle into the OpenCode/agent tool contract
from plan section "Plugin Surface = Tool Surface Principle". Listed here so
Wave 2 task 9 (tool projection) and Wave 4 task 24 (lifecycle UI) can pick
them up without re-deriving.

| Tool | Class | Scope | Notes |
|---|---|---|---|
| `plugins.lifecycle` | host-generated introspection | session | Read state of any plugin (state, posture, lastError, version, grants) |
| `plugin.<id>.install` | plugin-declared surface-control | session | Validated host-side; may require operator presence |
| `plugin.<id>.update.check` | host-generated | session | Returns latest version available + semver delta class |
| `plugin.<id>.update` | plugin-declared surface-control | session | Triggers install of new version; returns rollback window info |
| `plugin.<id>.rollback` | host-generated | session | Restores previous version within retention window |
| `plugin.<id>.enable` | plugin-declared | session | `scope: "global" \| "perProject"` |
| `plugin.<id>.disable` | plugin-declared | session | `scope: "global" \| "perProject"` |
| `plugin.<id>.uninstall` | plugin-declared | session | Records `removed` state, soft-deletes package |
| `plugin.<id>.quarantine.clear` | host-generated | session | Operator-only; logs `quarantine.forcedClear` |
| `plugin.<id>.history` | host-generated | session | Version history, grant history, state transitions within retention |

Every tool returns the standard envelope from plan section
"Plugin Surface = Tool Surface Principle": `status`, `errorCode`, `errorMessage`,
`data`, `uiHints`, `provenance`, `retryable`. Quarantined and disabled plugins
return `status: "unavailable"` with the codes from section 4.3.

---

## 9. Acceptance Criteria Checklist

Maps to the plan's acceptance criteria for Task 6 and downstream tasks.

- [x] Plugin ID rules: format, scope, uniqueness, immutability, reserved namespaces
- [x] Plugin version rules: semver, prerelease constraints, host-compat gate, single-active-version
- [x] Lifecycle states cover install through quarantine and rollback (10 states + 3 orthogonal postures)
- [x] Trust tiers define signature, capability, consent, default scope, exception handling (3 tiers, 6 columns + tier detection)
- [x] Per-project vs global enablement modeled (orthogonal, with effective resolution rule)
- [x] Quarantine behavior is operational: triggers, effects, exit, persistence
- [x] State machine has explicit transition table and per-state guarantees
- [x] Persistence layout named so Wave 3 task 15 can own it
- [x] Operator/agent tool surface named so Wave 2 task 9 and Wave 4 task 24 can project it

---

## 10. Downstream Handoff

| Task | What it inherits from this document |
|---|---|
| Task 7 (manifest schema) | Identity tuple, version rules, tier detection algorithm, `fireflyHost` compat gate |
| Task 10 (capability broker) | Tier default capability sets, `capability-not-allowed-for-tier` denial code |
| Task 11 (isolation / quarantine) | Crash counter thresholds, quarantine triggers/effects/exit, persistence path |
| Task 12 (API tiering) | Semver update policy, prerelease constraints, host-compat gate semantics |
| Task 22 (third-party exemplar) | Signed third-party install + consent UX, publisher key flow, revocation path |
| Task 24 (lifecycle UI) | State badges, posture overlay badges, operator actions, per-project toggle UX |
| Task 27 (risk register) | Identity collision, signature revocation, capability creep, quarantine persistence across upgrade |
