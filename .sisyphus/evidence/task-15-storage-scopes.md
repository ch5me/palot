# Task 15 — Storage / State Scopes and Persistence Ownership <!-- oc:id=sec_aa -->

> Wave 3, Task 15 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Inherits from Wave 2: Task 6 (lifecycle/trust), Task 7 (manifest/descriptor), Task 10 (broker/audit), Task 11 (isolation/quarantine).
> Feeds Wave 4: Tasks 19, 20, 21, 22, 24 (migration + exemplars + UI). Wave 5: Tasks 25, 26, 27, 28, 29 (roadmap/risks/gates/quotas).

## What this means for V2 <!-- oc:id=sec_ab -->

A plugin's *declarations* live in `PluginManifest` and are projected through
`PluginDescriptor` (per Task 7). A plugin's *durable state* lives in host-owned
storage under Firefly's XDG roots, not in the plugin worker. The plugin worker
is a **runtime cache**, never the source of truth. On crash, hot-reload, disable,
or uninstall, host-owned storage is the only thing that survives.

Three orthogonal axes govern every piece of plugin state:

1. **Scope** — who reads/writes it (session, project, app, global-profile). <!-- oc:id=item_aa -->
1. **Owner** — host (durable) vs. plugin worker (in-memory cache). <!-- oc:id=item_ab -->
1. **Lifetime** — when it is created, persisted, and how it is purged. <!-- oc:id=item_ac -->

This document fixes all three.

---

## 1. Scope taxonomy

V2 defines four scopes. The taxonomy extends plan §`Session Scope Principle`
(session/project/app/global-profile) and aligns with the
grant-resolution order in Task 10 §2 (`app -> project -> session`).

| Scope | Lifetime | Key shape | Reads | Writes | Visible across |
|---|---|---|---|---|---|
| `session` | one OpenCode session | `sessionId` (UUID) | plugin worker, OpenCode agent, host main | plugin worker (via broker) | the single session |
| `project` | one working directory | `projectDir` (canonical abs path or `projectHash`) | plugin worker (within project binding), host main, OpenCode agent | plugin worker (via broker) | all sessions bound to the same `projectDir` |
| `app` | one Elf install + one OS user | none (single namespace) | plugin worker, host main, OpenCode agent, renderer UI | plugin worker (via broker) | every session, every project, every user-scope setting on this machine |
| `global-profile` | one Elf install + one OS user, **named profile** | `profileId` (string) | plugin worker (with profile opt-in), host main | plugin worker (via broker) | sessions that opt into the named profile; cross-project, cross-machine-via-sync (future) |

### 1.1 Default-by-scope

| State class | Default scope |
|---|---|
| panel/widget/command **runtime state** (open/closed, expanded, focused, last selection) | `session` |
| tool **call history**, tool **dispatch envelopes**, tool **drafts** | `session` |
| plugin **runtime cache** (e.g. in-memory index of project files) | `session` (in-memory only) |
| widget **layout** (placement in zones) | `project` if bound, else `session` (per current `sessionWidgetLayoutStorageAtom` pattern in `apps/desktop/src/renderer/atoms/session-widgets.ts`) |
| capability **grants** (per Task 10) | `app` -> `project` -> `session` in resolution order |
| **enablement** posture (per Task 6) | `app` (`global.json`) + `project` (`.elf/plugins.json`) |
| **applied theme** | `app` (single, per Task 16 precedence matrix) |
| **quarantine** | `app` (per Task 6 §5.4 + Task 11 §4) |
| **trusted publisher keys** | `app` (host-managed) |
| **user profiles** (cross-project setting bundles) | `global-profile` |
| **audit log** | `app` (per Task 10 §5) |
| **catalog** (`PluginDescriptor` per installed slot) | `app` |

### 1.2 Scope semantics — explicit and binding

The following rules are the authoritative semantics. Every downstream task
that touches state (Task 13 renderer projection, Task 14 OpenCode projection,
Task 18 hot reload, Task 19 migration, Task 24 operator UI) must honor them.

1. **Session scope is the default** for any plugin runtime state that is not
   explicitly declared otherwise in the manifest. A plugin that wants
   project- or app-scope state must declare it in `manifest.state.scopes[]`
   (Task 7 manifest extension; this task defines the shape, Task 26 repo
   matrix places it).
2. **Promotion is explicit and one-way.** A plugin cannot silently move
   `session` state into `project` or `app` state. Promotion requires a
   user-confirmed write, broker-audited, and recorded in the audit log
   (`operation: "state.promote"`).
3. **Demotion is forbidden.** State written at `app` scope cannot be
   demoted to `project` or `session` scope. The lifetime only widens.
4. **App scope is single-namespace per install.** Two Elf installs on the
   same machine (different OS users) have separate `app`-scope stores.
   Two Elf installs for the same OS user share `app` scope (this is
   why `~/.config/elf/firefly-client/` paths do not embed a per-install id).
5. **Global-profile scope is opt-in per session.** A session binds to
   exactly one `profileId` at attach time; the binding is `session`-scope
   state. Default is `"_default"` (which behaves like `app`).
6. **Scope is part of the cache key, not the cache value.** A
   `project` write from project A is never readable from project B,
   regardless of plugin identity. A `session` write from session S1 is
   never readable from session S2.
7. **The host never trusts a plugin-declared scope.** The host validates
   the declared scope against the broker grant set: a plugin must hold
   `bridge:session-write` for `session` writes, plus `bridge:ui-state-write`
   for `app`-scope UI state, etc. Scope violation = `denied`,
   `errorCode: "scope_violation"`.

### 1.3 Scope precedence and resolution

When the same conceptual state exists in two scopes, resolution follows
Task 10 §2 grant resolution. For non-grant state (e.g. widget layout):

```
effective(session S, project P) = session[S]
                                  ?? project[P]
                                  ?? app
                                  ?? defaultValue
```

`project[P]` is read only when `S.projectDir == P`. `app` is the
default fallback. No scope is skipped silently; skips are logged.

### 1.4 Cross-scope interactions

| From -> To | Allowed? | Mechanism |
|---|---|---|
| `session` -> `project` | yes, with user confirmation | `plugin.<id>.state.promote({ scope: "project" })` tool, broker-audited |
| `session` -> `app` | yes, with user confirmation and operator presence | same tool, higher severity prompt |
| `project` -> `app` | yes, with user confirmation | same tool, prompt lists all sessions that will be affected |
| `project` A -> `project` B | no | separate projects; cross-project read is a capability |
| `app` -> anything | no (demotion forbidden) | rejected at broker |
| `global-profile` X -> `global-profile` Y | yes (rename), with user confirmation | operator tool, broker-audited |
| `global-profile` -> `app` | yes (flatten) | operator tool, audit `operation: "profile.flatten"` |
| `app` -> `global-profile` | no (no automatic demotion) | rejected |

---

## 2. Storage layout <!-- oc:id=sec_ac -->

Firefly follows the XDG Base Directory Specification, matching the existing
Elf automation paths in `apps/desktop/src/main/automation/paths.ts`. Two
roots split the plugin system:

- **Config root** (`~/.config/elf/firefly-client/`): human-editable, low
  write volume, may be source-controlled, may sync via dotfiles. Holds
  grants, trusted publishers, named profiles, and per-project `.elf/`
  files.
- **Data root** (`~/.local/share/elf/firefly-client/`): machine-managed,
  high write volume, append-only for audit, may be large. Holds plugin
  packages, catalog, runtime snapshots, audit logs, and trash.

> **Reconciliation with Task 6 evidence.** Task 6's persistence layout
> used `~/.local/share/elf/plugins/...`. This task elevates the prefix
> to `firefly-client/` so plugin data, grants, audit, and trusted
> publishers all live under one Firefly-owned XDG subtree and do not
> collide with any future `~/.local/share/elf/<other-feature>/`. The
> semantics, files, and lifetimes from Task 6 §7 are preserved 1:1;
> only the directory prefix changes. Migration of the prefix is the
> host's responsibility at first V2 launch; old `plugins/` dirs are
> detected and renamed (see §4.4).

### 2.1 Config root — `~/.config/elf/firefly-client/` <!-- oc:id=sec_ad -->

```
~/.config/elf/firefly-client/
├── grants/
│   ├── app.json                    # app-scope grants (Task 10 §2)
│   └── projects/
│       └── <projectHash>.json      # project-scope grants, one per projectDir
├── trusted-publishers.json         # Ed25519 public keys for signed-third-party
├── profiles/
│   └── <profileId>.json            # named global-profile bundles
├── settings.json                   # user-tunable V2 host settings (provenance, etc.)
└── migrations.json                 # migration log: prefix moves, schema upgrades
```

`<projectHash>` is `sha256(projectDir)` truncated to 16 hex chars. The hash
prevents path-injection in the filename and is the only way the host
identifies a project on disk; the original `projectDir` is stored inside
the file as `projectDir` for debugging only.

### 2.2 Data root — `~/.local/share/elf/firefly-client/` <!-- oc:id=sec_ae -->

```
~/.local/share/elf/firefly-client/
├── packages/
│   ├── built-in/<id>/<version>/                # read-only, host-shipped
│   ├── local-dev/<id>/<version>/               # unsigned, dev install
│   ├── installed/<id>/<version>/               # signed-third-party install
│   └── _trash/<id>/<version>/<ts>/             # soft-deleted packages (30d)
├── state/
│   ├── catalog.json                            # PluginDescriptor per (id, version)
│   ├── global.json                             # per-pluginId global enablement posture
│   ├── quarantine.json                         # per-pluginId quarantine reason + TTL
│   ├── grants-cache.json                       # materialized grant set (denormalized; rebuilt on load)
│   ├── runtime-snapshots/
│   │   └── <sessionId>.json                    # session-scope cache, <512KB per session
│   ├── project-cache/
│   │   └── <projectHash>/                      # project-scope cache, <2MB per project
│   │       ├── <pluginId>.json
│   │       └── _index.json
│   └── rollback/
│       └── <id>/<fromVersion>-<toVersion>/     # previous-version snapshot, 14d
├── audit/
│   ├── plugins.jsonl                           # install/update/enable/disable/quarantine/uninstall
│   └── broker/
│       └── <pluginId>/<yyyy-mm>.ndjson         # capability broker invocations
├── trusted-publishers.cache.json               # resolved publisher key fingerprints w/ last-verify ts
├── host-state.json                             # host version, last clean shutdown, last hot-reload set
└── tmp/                                        # atomic-write staging, never read at runtime
```

### 2.3 Per-project files — `<projectDir>/.elf/` <!-- oc:id=sec_af -->

Project-scope state is colocated with the project so it can be source-controlled
or gitignored per project policy. The host writes these files; the plugin
worker never touches them directly.

```
<projectDir>/.elf/
├── plugins.json                  # per-pluginId per-project enablement posture
├── grants.json                   # per-pluginId per-project grants (denormalized cache)
├── widget-layout.json            # per-sessionId layout (mirrors sessionWidgetLayoutStorageAtom pattern)
└── state-cache/
    └── <pluginId>.json           # project-scope plugin state, <1MB per plugin per project
```

`projectDir/.elf/` files are part of the host's persistence contract. They
are written atomically (tmp-file + rename, per the pattern in
`apps/desktop/src/main/automation/registry.ts:62-78`). Plugin workers
**read only** through the host's broker-mediated API; writes always go
through the host.

### 2.4 File-format and atomicity rules <!-- oc:id=sec_ag -->

| Aspect | Rule |
|---|---|
| Format | JSON (with stable key order, Zod-validated on load) and NDJSON for audit |
| Atomic write | write to `tmp/`, fsync, rename over target (pattern: `apps/desktop/src/main/automation/registry.ts:62-78`) |
| Concurrency | per-file `LockManager` (Node 22 `worker_threads.locks`, per Task 11 §6) for cross-process safety |
| Encryption at rest | `app.json` grants only — via Electron `safeStorage`; project and audit not encrypted by default |
| File permissions | 0600 on grants/trusted-publishers; 0644 on catalog/state; 0755 on package dirs |
| Schema versioning | every JSON file carries `schemaVersion: <semver>`; host migrates or refuses on read |
| Corruption recovery | on parse failure, host renames to `<file>.corrupt-<ts>` and starts fresh; event recorded in audit |

---

## 3. Per-scope persistence rules

Each scope has one durable store and one lifetime. Plugin worker memory is
never durable; the host's broker-mediated API is the only write path.

### 3.1 Session scope

| Aspect | Rule |
|---|---|
| Durable? | no — `runtime-snapshots/<sessionId>.json` is the host's *crash-recovery* snapshot, not the canonical source. Canonical session state is in OpenCode's session record. |
| Owner | host main process (snapshot); OpenCode server (canonical) |
| Plugin worker access | broker-mediated, scope-checked at every call |
| Created | when first plugin attaches to the session (`PluginSessionHandle` is born) |
| Updated | on every broker-mediated write; debounced flush to disk at 250ms or 32 events, whichever first |
| Eviction policy | LRU on disk at 200 sessions; LRU in memory at 50 sessions; never evict the active session |
| Cleared on | session close (deferred 5min for recovery), session replace, host uninstall, or `plugin.<id>.state.purge({ scope: "session" })` |
| Survives | host restart (snapshot), plugin hot-reload (snapshot reloaded by new worker) |
| Does NOT survive | host uninstall of the plugin, uninstall of the host app |
| Quota | 512 KB per session, 200 sessions on disk |

### 3.2 Project scope

| Aspect | Rule |
|---|---|
| Durable? | yes — `<projectDir>/.elf/` is the source of truth for project-scope plugin state |
| Owner | host main process (write); plugin worker (broker-mediated read) |
| Plugin worker access | read+write via broker; broker checks `bridge:session-write` or `bridge:ui-state-write` per call |
| Created | when first plugin is bound to a project that has no `.elf/` yet (host creates the dir) |
| Updated | atomic write through `tmp/`, fsync, rename |
| Cleared on | operator `plugin.<id>.state.purge({ scope: "project" })`, project dir deletion (host detects via path watch), plugin uninstall (configurable, see §4) |
| Survives | host restart, plugin hot-reload, plugin disable, plugin update, host app upgrade |
| Does NOT survive | manual `rm -rf .elf/`, plugin uninstall (configurable), host app uninstall of the OS app bundle |
| Quota | 2 MB per project, 1 MB per plugin per project |
| Source-control | `.elf/plugins.json`, `.elf/grants.json`, `.elf/widget-layout.json` are designed to be source-controllable; `.elf/state-cache/` should be `.elf/state-cache/` gitignored by default |

### 3.3 App scope

| Aspect | Rule |
|---|---|
| Durable? | yes — `~/.config/elf/firefly-client/` (config) and `~/.local/share/elf/firefly-client/state/` (data) are the canonical sources |
| Owner | host main process only; never written by plugin worker |
| Plugin worker access | read+write via broker; `bridge:ui-state-write` for renderer-mutating state, no extra cap for `app.json` grants themselves (broker write is the auth point) |
| Created | on host first-launch V2 detection; if dirs missing, host creates them with mode 0700 |
| Updated | atomic write; broker-mediated; audit-logged |
| Cleared on | operator `plugin.<id>.state.purge({ scope: "app" })`, host "reset plugin data" operator action, OS app uninstall (host detects and asks before purge) |
| Survives | everything except explicit operator action or OS app uninstall |
| Quota | see §5 |
| Encryption | `grants/app.json` only, via Electron `safeStorage` |

### 3.4 Global-profile scope

| Aspect | Rule |
|---|---|
| Durable? | yes — `~/.config/elf/firefly-client/profiles/<profileId>.json` is the source of truth |
| Owner | host main process only |
| Plugin worker access | broker-mediated, only when the session is bound to this `profileId` (binding is `session`-scope state) |
| Created | operator "create profile" action; auto-created as `_default` on first V2 launch |
| Updated | atomic write; audit-logged with `profileId` in audit record |
| Cleared on | operator `profiles.delete`, profile rename to merge into another (with prompt listing affected settings) |
| Survives | host restart, plugin uninstall (profile is host-owned, not plugin-owned) |
| Does NOT survive | OS app uninstall (asks before purge), `host-state.json` reset |
| Quota | 4 MB per profile, 32 profiles per host |
| Default profile | `_default` is implicitly created; `app`-scope writes from sessions with no profile binding are routed to `_default` |

### 3.5 The "host-owned" rule

For every piece of state in the catalog, the host MUST be able to answer
"where is this stored?" and "what is the schema version?" by reading only
host-owned files. Plugin workers, plugin packages, and `node_modules/` of
plugin packages MUST NOT contain durable state. This is the host's
contract for crash recovery, hot-reload, and uninstall.

The host enforces this at runtime: workers that write outside the
broker-mediated API (e.g. via `fs:plugin` outside their package dir) are
denied. Workers that try to write to `~/.config/elf/firefly-client/` or
`~/.local/share/elf/firefly-client/` directly are denied — the broker is
the only writer.

---

## 4. Disable / uninstall / hot-reload retention policy <!-- oc:id=sec_ah -->

This section fixes what survives each lifecycle event from Task 6 §3.
"Survives" is the binding question for crash recovery, upgrade, and
re-install.

### 4.1 Disable <!-- oc:id=sec_ai -->

| Store | Survives? | Reason |
|---|---|---|
| `~/.config/elf/firefly-client/grants/app.json` | yes | grants outlive enable/disable; revocation requires explicit operator action |
| `<projectDir>/.elf/plugins.json` (per-project posture) | yes | disable is a posture change, not a grant revoke |
| `<projectDir>/.elf/grants.json` | yes | same as app grants |
| `~/.local/share/elf/firefly-client/state/global.json` | yes | posture change recorded, not deleted |
| `state/quarantine.json` | yes | independent of disable |
| `state/catalog.json` row | yes | descriptor stays; state moves to `disabled` |
| `state/runtime-snapshots/<sessionId>.json` | **no** — purged | disabled plugin's session cache has no consumer |
| `<projectDir>/.elf/widget-layout.json` for this plugin | **no** — pruned | widget placement for a disabled plugin is invisible UI noise |
| `<projectDir>/.elf/state-cache/<pluginId>.json` | **yes** but marked `disabledAt` | hot-re-enable restores state in place |
| `state/rollback/<id>/` | yes | unrelated to enable/disable |
| package on disk | yes | disable is reversible |
| `audit/plugins.jsonl` entries | yes | append-only |

### 4.2 Uninstall <!-- oc:id=sec_aj -->

| Store | Survives? | Reason |
|---|---|---|
| `grants/app.json` entry for this plugin | **purged** | uninstall revokes all app-scope grants |
| `grants/projects/<projectHash>.json` entry for this plugin | **purged** | uninstall revokes all project-scope grants |
| `<projectDir>/.elf/plugins.json` entry | **purged** | the posture is meaningless without a plugin |
| `<projectDir>/.elf/grants.json` entry | **purged** | same |
| `<projectDir>/.elf/widget-layout.json` for this plugin | **purged** | UI placement is meaningless |
| `<projectDir>/.elf/state-cache/<pluginId>.json` | **purged** unless `retainProjectCacheOnUninstall: true` in host settings (default false) | prevents stale state from being restored if user reinstalls |
| `state/global.json` entry | **purged** | posture deleted |
| `state/quarantine.json` entry | **preserved** with `clearedAt` and reason | quarantine history is part of plugin identity audit |
| `state/catalog.json` row | moved to `removed` with `removedAt` | audit only; not a live row |
| `state/rollback/<id>/` | **purged** | no version to roll back to without a package |
| `packages/installed/<id>/<version>/` | moved to `packages/_trash/<id>/<version>/<ts>/` for 30d | soft-delete window per Task 6 §3.4 |
| `audit/plugins.jsonl` entries | **preserved** (365d retention) | uninstall never clears audit |
| `audit/broker/<pluginId>/` | **preserved** (365d retention) | per-broker audit independent of plugin lifecycle |
| `trusted-publishers.cache.json` entry for this publisher | n/a | publisher is independent of plugin install |

### 4.3 Hot-reload (plugin code changes without version bump) <!-- oc:id=sec_ak -->

Triggered by `apps/desktop/.firefly-client/local-dev/<id>/` file watcher
(per Task 18 dev loop). Re-spawns the plugin worker; preserves all
host-owned state.

| Store | Survives? | Reason |
|---|---|---|
| All `grants/` entries | yes | grants are not affected by code reload |
| All `<projectDir>/.elf/` files | yes | project-scope state is not in the worker |
| `state/global.json`, `state/catalog.json` | yes | host-owned catalog |
| `state/runtime-snapshots/<sessionId>.json` | yes (reloaded by new worker) | the *whole point* of crash-recovery snapshots |
| `<projectDir>/.elf/state-cache/<pluginId>.json` | yes | project-scope cache persists across reloads |
| in-memory plugin worker state | **no** | intentionally cleared; this is the runtime cache, not the source of truth |
| worker transport handle | **no** | new worker = new MessagePort |

Hot-reload is **bounded**: at most 10 hot-reloads per minute per plugin.
Beyond that, host triggers a full `disable -> activating` cycle instead
of teardown-only. This protects against accidental file-watcher loops.

### 4.4 Host version migration <!-- oc:id=sec_al -->

On V2 first-launch detection (no `state/host-state.json` or
`host-state.json.hostVersion` mismatch), the host:

1. Detects old `~/.local/share/elf/plugins/` from Task 6 evidence <!-- oc:id=item_ad -->
1. Renames to `~/.local/share/elf/firefly-client/` (one-way, atomic) <!-- oc:id=item_ae -->
1. Detects old `~/.config/elf/automations/...` and keeps it (it is <!-- oc:id=item_af -->
   not part of V2)
1. Re-validates every catalog row against the new manifest schema <!-- oc:id=item_ag -->
1. Records the migration in `~/.config/elf/firefly-client/migrations.json` <!-- oc:id=item_ah -->
1. On any failure, rolls back the rename and refuses to start V2 mode <!-- oc:id=item_ai -->

### 4.5 The retention matrix <!-- oc:id=sec_am -->

| Event | grants (app) | grants (project) | posture | catalog | audit | runtime snapshot | project state cache | widget layout | package | rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| disable | keep | keep | keep | keep | keep | **purge** | keep, mark `disabledAt` | **prune** | keep | keep |
| uninstall | **purge** | **purge** | **purge** | mark `removed` | keep | **purge** | **purge*** | **purge** | move to `_trash` (30d) | **purge** |
| hot-reload | keep | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| update (same id, new version) | keep | keep | keep | new row | keep | **purge** (worker restart) | keep | keep | new install, old kept 14d | keep old |
| rollback | keep | keep | keep | new row | keep | **purge** (worker restart) | keep | keep | old restored | n/a |
| host restart | keep | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| host upgrade | keep | keep | keep | keep | keep | keep | keep | keep | keep | keep |
| OS app uninstall | **purge** (after confirm) | **purge** (after confirm) | **purge** | **purge** | **purge** (365d log on disk if user opts in) | **purge** | **purge** | **purge** | **purge** | **purge** |

\* unless `retainProjectCacheOnUninstall: true` in host settings; default false

---

## 5. Quotas

Quotas are hard ceilings enforced by the host at the broker layer. A
plugin that exceeds a quota gets `denied`, `errorCode: "quota_exceeded"`,
and the broker increments `firefly-client.broker.<pluginId>.quota.exceeded`.

All quotas are per-scope unless otherwise noted.

### 5.1 Storage quotas

| Quota | Default | Per | Configurable? | Notes |
|---|---|---|---|---|
| Session runtime snapshot | 512 KB | session | yes (host setting) | LRU eviction; never evicts active |
| Project state cache | 2 MB total, 1 MB per plugin | project | yes (host setting) | LRU by last-access |
| Global-profile bundle | 4 MB | profile | yes (host setting) | n/a — global-profile is single-tenant |
| App-scope grants file | 256 KB | host | no (refuse install that would exceed) | one file, append-and-rebuild |
| Project-scope grants file | 64 KB | project | no | one file, append-and-rebuild |
| Catalog | 4 MB | host | no | ref-counted; hard cap = 1024 installed plugins |
| Plugin package on disk | 64 MB | plugin | yes (per trust tier) | oversized install rejected at validation |
| Audit log per plugin per month | 50 MB | plugin/month | yes (host setting) | monthly NDJSON rotation; older months compressed to `.ndjson.gz` |
| Trash dir | 256 MB total | host | yes | eviction by oldest-first when exceeded |
| Rollback dir | 256 MB total, 64 MB per plugin | host | yes | per-plugin N=2 versions retained by default |

### 5.2 Quota enforcement and recovery

| Quota state | Behavior |
|---|---|
| < 80% | normal |
| 80% – 100% | write succeeds; UI shows "approaching quota" badge for that scope |
| 100% | write denied; broker returns `quota_exceeded`; plugin sees standard envelope |
| Persistent overage (3 writes denied in 60s) | host flags the plugin as `quota-pressure`; subsequent writes queue up to 10s; if still over after queue, plugin enters `degraded` posture and operator is notified |

Quota recovery is automatic when the user clears data or when the host
rotates the audit log. There is no auto-eviction of plugin state — the
user is in control of purges (per Task 6 §3.4 uninstall semantics and
per-scope purge tools).

### 5.3 Plugin count quotas

| Resource | Default | Per | Notes |
|---|---|---|---|
| Installed plugins | 256 | host | hard cap; refused at install |
| Active plugin workers | 32 | host | hard cap; `activating` queue if exceeded |
| Quarantined plugins | 64 | host | hard cap; oldest quarantine released on overflow |
| Concurrent sessions with non-default profile | 16 | host | sessions beyond default `_default` profile |
| Profile definitions | 32 | host | hard cap; refuses `profile.create` beyond |
| Trusted publishers | 64 | host | hard cap; refuses `trusted-publishers.add` beyond |
| Concurrent rollback windows | 8 | host | one rollback per slot, FIFO |

### 5.4 Hot-reload rate limits

| Resource | Default | Per |
|---|---|---|
| Hot-reloads | 10 / min | per plugin |
| Activation attempts | 5 / min | per plugin |
| Catalog rescans | 1 / sec | host (batches all file-watcher events) |
| Audit log appends | 10 000 / min | per plugin (broker rate limit) |
| Grant store atomic rewrites | 30 / min | host (debounce all writes to 2s window) |

### 5.5 AI / tool cost attribution

For cost attribution purposes, the plugin's broker audit is the system
of record. Per `firefly-client.broker.<pluginId>.*` telemetry namespace
(Task 10 §5):

| Counter | Source |
|---|---|
| `firefly-client.broker.<pluginId>.invocation.count` | every broker check |
| `firefly-client.broker.<pluginId>.denied.count` | every denial |
| `firefly-client.broker.<pluginId>.bytes.accessed` | `fs:*` and `net` operations |
| `firefly-client.broker.<pluginId>.tool.calls` | every `tool:register`-granted tool call |
| `firefly-client.broker.<pluginId>.ai.calls` | every `ai` capability invocation (cost = tokens × model rate) |
| `firefly-client.broker.<pluginId>.quota.exceeded` | every quota denial |

These counters live in the same audit file but are also projected to the
in-memory telemetry bus (Task 10 §5) for live cost attribution in the
operator UI (Task 24).

---

## 6. Acceptance criteria <!-- oc:id=sec_an -->

Maps to the user-supplied acceptance criteria for this task:

- [x] Session/project/global scope semantics are explicit
  - Four scopes (session, project, app, global-profile) defined in §1
  - Per-scope persistence rules in §3
  - Scope precedence and resolution in §1.3
  - Cross-scope promotion/demotion matrix in §1.4
- [x] Disable/uninstall/hot-reload persistence behavior is defined
  - Disable retention in §4.1
  - Uninstall retention in §4.2
  - Hot-reload retention in §4.3
  - Combined retention matrix in §4.5
  - Bonus: update, rollback, host restart/upgrade, OS uninstall all covered

---

## 7. Downstream handoff

| Task | What it inherits from this document |
|---|---|
| Task 19 (first-party migration) | `<projectDir>/.elf/` source-controllability, retention matrix, `state/runtime-snapshots/` pattern |
| Task 20 (bridge migration) | `audit/broker/<pluginId>/<yyyy-mm>.ndjson` location + shape; `grants/app.json` and `grants/projects/<hash>.json` are the live stores |
| Task 21 (first-party exemplar) | `app.json` grants, `state/runtime-snapshots/<sessionId>.json` pattern, project `.elf/` files |
| Task 22 (third-party exemplar) | trust-tier storage, signed-third-party install path, publisher cache, retention on uninstall |
| Task 24 (lifecycle UI) | quota badges, "approaching quota" UX, retention controls, "purge scope" UX |
| Task 25 (roadmap) | prefix migration from `plugins/` to `firefly-client/` is a Wave 2 readiness gate |
| Task 26 (repo matrix) | XDG helper for the new prefix, mirroring `apps/desktop/src/main/automation/paths.ts`; module split for `host/storage/`, `host/scopes/`, `host/quotas/` |
| Task 27 (risk register) | quota exhaustion, retention bugs, prefix migration failure, cross-scope leakage |
| Task 28 (verification matrix) | `quota_exceeded` test path, retention matrix test path, prefix migration test path |
| Task 29 (performance / quotas) | extends §5 with measured defaults; the telemetry namespace in §5.5 is the input to metering |

---

## 8. Source references <!-- oc:id=sec_ao -->

| Reference | Why it grounds this document |
|---|---|
| Plan §`Session Scope Principle` (lines 225-230) | scope taxonomy and the "session-scoped by default" rule |
| `apps/desktop/src/main/automation/paths.ts` | XDG config/data split pattern; new `firefly-client/` root mirrors this |
| `apps/desktop/src/main/automation/registry.ts:62-78` | atomic write pattern (tmp + rename) for every JSON file in this layout |
| `apps/desktop/src/renderer/atoms/session-widgets.ts:29-32` | session-scope storage pattern with `atomWithStorage` key `elf:session-widget-layouts`; V2 `state-cache` keys follow the same `elf:` namespace convention |
| Task 6 evidence §7 | persistence layout; §5.4 quarantine persistence; §4 enablement scopes |
| Task 7 evidence | `PluginDescriptor` is the source of truth for contributions; nothing about storage is in the manifest except `manifest.state.scopes[]` (declared but not yet in the schema) |
| Task 10 evidence §2 | grant storage paths, scope resolution order, audit path; §5 audit shape |
| Task 11 evidence §4 | quarantine persistence in `quarantine.json`; §3 crash supervision contract that drives hot-reload semantics |