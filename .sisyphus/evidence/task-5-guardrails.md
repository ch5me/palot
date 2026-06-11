# V2 Non-Goals, Guardrails, and Scope Taxonomy <!-- oc:id=sec_aa -->

> Wave 1 / Task 5. Authoritative scope-control document for the V2 plugin system. Every downstream task (7, 8, 9, 10, 12, 19, 23, 25, 27) inherits these guardrails. If a future task proposes work that conflicts with this file, this file wins until the conflict is resolved by an explicit plan amendment.

---

## 1. V2 Non-Goals

V2 is a *bounded* plugin system. The following are explicitly out of scope for V2 itself. They are not forbidden forever, but V2 architecture work must not depend on them, prepare for them, or quietly grow toward them.

1. A general-purpose plugin **marketplace** or discovery product. V2 ships local install, dev install, and signed-package install. Curation, search, ranking, reviews, ratings, and revenue are out.
2. A runtime `vscode` API shim or a hidden VS Code sidecar. VSIX import is a *transpile-time* path. VS Code extensions are statically converted into native V2 plugins. Nothing in the host pretends to be VS Code.
3. A full **theme studio** or design-token authoring platform. V2 supports plugin-contributed theme *data* and host-owned theme *application*. Token editors, contrast checkers, and visual builders are not in scope.
4. A silent privilege path. Every capability grant is declared, visible, and revocable. No capability may be granted implicitly by import, by manifest location, by trust tier alone, or by side-effects of activation.
5. A separate hidden first-party runtime. First-party surfaces use the same manifest/runtime/projection path as third-party plugins. No shadow channels, no "internal-only" tool surface.
6. Arbitrary native dependencies for AI-authored or third-party plugins in V2. Native addons, `node-gyp` builds, custom Electron versions, and platform-specific binaries are not supported. Bundled-only assets and pure JS/TS code are allowed.
7. Generic `fs`, `net`, `shell` capability buckets treated as sufficient authorization. V2 requires Firefly-specific capability classes (`bridge:session-read`, `browser:lane-control`, `theme:apply`, `command:register`, `tool:register`, and so on) so privilege is named, not implied.
8. A managed-server-only bridge that quietly locks out attached OpenCode servers. Attached-server support is a *deferred v2.1 workstream*, written down, not hidden.
9. A generalized cross-project profile scope (`global-profile`) for V2 initial implementation. `session`, `project`, and `app` scopes ship; `global-profile` is reserved.
10. Lifecycle state that lives only in plugin worker memory. Lifecycle, lifecycle metadata, and capability grants must be host-owned and durable enough to survive worker restart.

## 2. Guardrails

Each guardrail below is a hard rule. Every V2 implementation task must answer "yes" to compliance with each item or escalate before merging.

### G1. Process Boundaries

- **G1.1** No plugin code runs in the Electron main process. Plugin code executes in the plugin host, which is a separate process or worker supervised by main.
- **G1.2** Main is the only authority for: plugin catalog, manifest validation, runtime supervision, capability broker, durable storage, OpenCode bridge authority, lifecycle telemetry, and quarantine state.
- **G1.3** Renderer never reaches the plugin host directly. The transport is `renderer <-> main <-> plugin host`. If a future optimization uses `MessagePort`, main still provisions and governs the channel.
- **G1.4** OpenCode reaches the plugin host only through main. The path is `OpenCode <-> main <-> plugin host`. No sidecar, no peer-to-peer transport.

### G2. Renderer Authority

- **G2.1** Plugins do not mutate host DOM directly. Host owns the React tree; plugin UI is reconstructed by a host-approved reconciler or by an explicit, capability-gated iframe/webview escape hatch.
- **G2.2** The renderer has no plugin authority beyond declarative UI inputs and explicit iframe bridge calls. No direct `window.elf` shortcut grants renderer-side privilege to plugin code.
- **G2.3** Current hardcoded registries (`firefly-surface-registry.tsx`, `session-widget-registry.tsx`) become *projections*, not source of truth. They are demoted in V2.
- **G2.4** Side panels and widgets are mounted only into host-defined slots and zones. Plugins do not mint new host chrome areas.

### G3. Capability and Privilege

- **G3.1** Deny by default. A plugin has no capability until the broker grants one, with visible user consent where the capability is dangerous.
- **G3.2** No silent privilege path. Capability grants are explicit, scoped, revocable, and logged.
- **G3.3** Firefly-specific capabilities are first-class. Generic buckets like `fs`/`net`/`shell` are never the only authority for a Firefly action. Example Firefly capability classes: `bridge:session-read`, `bridge:session-write`, `bridge:ui-state-read`, `bridge:ui-state-write`, `browser:lane-control`, `theme:apply`, `theme:preview`, `command:register`, `tool:register`, `widget:mount`, `panel:register`.
- **G3.4** Plugin tool calls go through the broker. There is no host shortcut, no renderer IPC escape, and no OpenCode bridge bypass that lets a tool fire without capability check, session scope, and Zod validation.
- **G3.5** Capability revocation is immediate. Revoking `theme:apply` while a plugin is mid-apply causes the next call to fail with `denied` and the in-flight call to terminate.

### G4. Manifest and Source of Truth

- **G4.1** `PluginManifest` is the only on-disk authoritative declaration. It is pure data, parseable by Zod, versioned, and never holds runtime state.
- **G4.2** `PluginDescriptor` (host-validated) is the only canonical source of truth for projections. `PluginInstance` and `PluginSessionHandle` carry runtime state but never become canonical for declarative contributions.
- **G4.3** Built-in, local-dev, AI-authored, and third-party plugins all use the same manifest schema and the same runtime path. There is no "internal" version of the manifest.
- **G4.4** No projection reads from disk. Renderer, OpenCode, lifecycle, and policy projections are all computed in main from the four canonical runtime objects.

### G5. OpenCode and Agent Tool Path

- **G5.1** Every plugin surface (panel, widget, command, theme) exposes a paired Zod-backed tool surface. Tools are projections, not hand-written bridge glue.
- **G5.2** Tool result envelopes use the canonical shape: `status`, `errorCode`, `errorMessage`, `data`, `uiHints`, `provenance`, `retryable`.
- **G5.3** Default scope is `session`. Per-project and app state exist only behind explicit declared scope.
- **G5.4** Tool call lifecycle is pinned to the 9-state machine in the plan (`queued`, `dispatching`, `running`, `timeout`, `completed`, `failed`, `denied`, `unavailable`, `cancelled`). Every terminal state has a canonical error code. `cancelled` is reachable from any non-terminal state.
- **G5.5** Default host timeout ceilings: `dispatching -> running` 5 seconds, `running` 60 seconds. Both are overridable per plugin via manifest, never per call.

### G6. Lifecycle and Isolation

- **G6.1** Each active plugin runs in its own worker. One worker per plugin, supervised by main, with heartbeat, crash counter, and quarantine policy.
- **G6.2** Quarantine is durable. A plugin that crashes N times in M seconds is automatically disabled and remains disabled across app restarts until the operator re-enables it.
- **G6.3** Hot reload is implemented as a full worker teardown and restart, not as a module-cache mutation in place.
- **G6.4** Disable/uninstall/rollback teardown is defined for: an open side panel owned by the plugin, a mounted widget zone, an active command registration, and an in-flight tool call. Teardown semantics are explicit, not implied.

### G7. Themes

- **G7.1** Theme contributions are data only. Application and precedence are host-owned.
- **G7.2** Plugins cannot set the applied theme directly. The host applies according to the precedence matrix: user pick > active plugin theme > imported theme > bundled default. `plugin.theme.preview` renders without mutating applied theme.
- **G7.3** No theme studio, no token editor, no visual builder. Import compatibility is JSONC ingestion plus host fallback chain, not a full token authoring workflow.

### G8. Commands and Tool Registration

- **G8.1** Reserved namespaces are not shadowable. Host reserves `firefly.*`, `surface.*`, lifecycle prefixes, and `plugins.*` introspection. Plugins use `plugin.<pluginId>.*` for tools and namespace-scoped command ids.
- **G8.2** Collision rejects activation. A plugin that tries to install a command or theme id already in the catalog fails activation with a stable error code, not silent shadowing.
- **G8.3** Dynamic command visibility is declared, not arbitrary. A plugin's "when" clauses are evaluated against host-provided context; the plugin never directly inspects renderer state.

### G9. VS Code / Open VSX Import

- **G9.1** VSIX import is classifier + transpile, not runtime. The classifier produces a GREEN/YELLOW/ORANGE/RED feasibility label; the transpiler rewrites the extension's source into a V2 manifest. There is no `vscode` namespace at runtime.
- **G9.2** No VS Code sidecar. No bundled VS Code runtime. No "open in VS Code" path that rehydrates the original extension in a hidden process.
- **G9.3** Imported extensions are treated as third-party plugins for trust, capability, and lifecycle purposes. Importing does not elevate trust.

### G10. Anti-Creep Rules

These are explicit fail-safes against the most common V2 drift patterns. Reject proposals that:

- **G10.1** Add a "quick internal-only" tool surface, bridge, or registry that bypasses the manifest/runtime path. The path is one and only one.
- **G10.2** Hide capability grants behind trust tier, manifest location, or activation side-effect. All grants are explicit and visible.
- **G10.3** Expand scope to a marketplace, theme studio, or VS Code runtime shim. Those are out of V2.
- **G10.4** Mint a new privilege class that is not in the broker. New privilege means a new explicit capability class, not a clever reuse of an existing one.
- **G10.5** Move lifecycle, grants, or canonical contribution data into plugin worker memory. The host owns durable truth.
- **G10.6** Promise runtime compatibility with VS Code, JetBrains, Cursor, or any foreign runtime. V2 imports them; it does not become them.
- **G10.7** Add a hardcoded renderer registry entry that is not also a contribution in a plugin manifest. Hardcoded entries are projections of contributions, never their own canonical source.
- **G10.8** Treat `global-profile` scope as available. It is reserved and out of V2 initial implementation.

## 3. Scope Taxonomy

Every V2 contribution is classified into exactly one of four categories at design time. The classification drives manifest requirements, capability expectations, lifecycle behavior, and test depth.

### 3.1 `host-only`

A surface that must remain in host code and is never exposed as a plugin contribution. Justification is required: a `host-only` surface is allowed only when the surface manages the host's own meta-systems, identity, or plugin/broker/runtime authority, where making it a plugin would create a circular dependency or split the source of truth.

- Lives in `apps/desktop/src/main/*` or `apps/desktop/src/renderer/*` as host code.
- Is not declared in any plugin manifest.
- Does not project through the plugin host or OpenCode bridge.
- Is reachable only through host chrome (sidebar rails, command palette root, settings panels, broker UI).
- Examples: plugin manager chrome, capability/grant manager chrome, broker console, manifest editor.

### 3.2 `built-in plugin`

A first-party contribution shipped in the same repository as the host, declared through the same manifest/runtime path as any third-party plugin, and *not* user-removable in V2 initial release. Built-ins prove the runtime works and migrate hardcoded first-party surfaces onto the plugin path.

- Has a manifest, contribution families, capabilities, and a built-in trust tier.
- Uses the same broker, projection, and lifecycle machinery as third parties.
- Is greppable as a contribution, not as a hardcoded renderer entry.
- May be hidden by default but is never absent from the catalog.
- Examples: review/changes panel, files panel, terminal panel, artifacts panel, voice panel, oracle roster, claude compat panel, ch5pm dashboard, pdf-review, notes, pulse, memory, crm, studio, editor.

### 3.3 `third-party-ready`

A surface whose contribution contract is open from V2 day 1 so that third parties can ship equivalent or alternative plugins. The first-party implementation is a built-in plugin, but the *category* of surface is open: the manifest fields, capability classes, and projection slots are designed for outside authors.

- Has a stable contribution contract with versioning, deprecation policy, and migration codemod expectations.
- Exposes a Firefly-specific capability class (never hidden behind a generic `fs`/`net`/`shell` grant).
- Ships an exemplar third-party plugin during V2 to prove the contract.
- Examples: browser lane (uses `browser:lane-control`), theme contributions (data-only, host-applied), generic command palette entries, panel contributions in any reserved slot.

### 3.4 `defer`

A surface or capability that is acknowledged but explicitly parked for a later milestone (v2.1, v2.2, and so on). Defer is not a synonym for "skip" or "out of scope forever." Each defer must carry a written rationale, a target milestone, and an exit condition that promotes it out of defer.

- Has a written rationale in this document or a successor.
- Has a target milestone and an exit condition (concrete acceptance criteria that, when met, reclassify it as `built-in` or `third-party-ready`).
- Is not implemented in V2 architecture. It may be sketched, but no runtime code, no manifest field, and no capability class is shipped for it.
- Example defer items: attached-server generalized plugin install pathway (v2.1), arbitrary native dependency support for third-party plugins (v3+), `global-profile` scope (v2.2+), general-purpose marketplace UX (product decision, not V2).

## 4. First-Party Side-Panel Classification

Every current first-party `SidePanelTabId` (per `apps/desktop/src/renderer/firefly-surface-registry.tsx` and `apps/desktop/src/renderer/atoms/ui.ts`) is classified below. The classification is the migration disposition for the V2 rollout: a panel tagged `built-in plugin` must ship as a built-in plugin manifest; a panel tagged `host-only` keeps host code with a written rationale; a panel tagged `third-party-ready` must expose a stable contract that allows outside authors to ship alternatives. The `defer` row is included for completeness even though V2 ships all 18 panels on the plugin runtime per the plan's DoD.

| SidePanelTabId | Title | Classification | Rationale |
|---|---|---|---|
| `plugins` | Plugins | `host-only` | Plugin manager chrome. Cannot itself be a plugin (circular). |
| `bridges` | Bridges | `host-only` | MCP/capability grant manager chrome. Lives with host policy. |
| `browser` | Browser | `third-party-ready` | Uses `browser:lane-control` capability; contract is open from day 1. |
| `review` | Changes | `built-in plugin` | First-party review/diff, intrinsic to session flow. |
| `notes` | Notes | `built-in plugin` | First-party knowledge surface, content-type. |
| `pulse` | Pulse | `built-in plugin` | First-party activity/telemetry surface. |
| `memory` | Memory | `built-in plugin` | First-party hosted memory viewer. |
| `files` | Files | `built-in plugin` | First-party project file browser. |
| `terminal` | Terminal | `built-in plugin` | First-party PTY terminal. |
| `editor` | Editor | `built-in plugin` | First-party code editor surface. |
| `crm` | Contacts / CRM | `built-in plugin` | First-party contact store surface. |
| `studio` | Studio / Office | `built-in plugin` | First-party studio/office surface. |
| `voice` | Voice | `built-in plugin` | First-party voice control surface. |
| `oracle` | Oracle Roster | `built-in plugin` | First-party AI agent roster surface. |
| `claude` | Claude Code | `built-in plugin` | First-party Claude Code compat surface. |
| `ch5pm` | CH5PM Dashboard | `built-in plugin` | First-party project management surface. |
| `artifacts` | Artifacts | `built-in plugin` | First-party artifact registry surface. |
| `pdf-review` | PDF Review | `built-in plugin` | First-party PDF review surface. |
| *n/a* | *future v2.x surfaces* | `defer` | Reserved for parked V2 contributions with written rationale. |

## 5. Reuse Contract for Downstream Tasks

Tasks 7, 8, 9, 10, 12, 19, 23, 25, and 27 must each open with a one-line guardrail compliance statement that maps to this file. Suggested template:

> "This task inherits guardrails G1-G10 from `.sisyphus/evidence/task-5-guardrails.md`. New privilege classes: `<list or none>`. New scope: `<host-only | built-in plugin | third-party-ready | defer>`."

The template forces every downstream contributor to either name the inherited guardrails they touch or surface a conflict before implementation. Conflicts are resolved by amending this file, not by ignoring it.