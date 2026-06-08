# Firefly Plugin System V2 <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Replace the old Firefly plugin plan with a stricter V2 architecture where plugin contributions are the single source of truth for UI and agent/runtime behavior. Side panels, session widgets, commands, and themes all ship through one manifest/runtime path, and every plugin surface also exports Zod-backed, session-scoped tools so OpenCode can inspect and control the same plugin runtime.
>
> **Deliverables**:
> - Unified V2 plugin manifest and contribution model
> - Plugin host/runtime architecture and capability broker
> - Renderer projection model for panels, widgets, commands, and themes
> - OpenCode projection model for plugin tools, introspection, and control
> - First-party migration plan that replaces hardcoded registries with plugin-derived projections
> - Trust/isolation/lifecycle plan for local, built-in, and third-party plugins
> - VS Code import classifier/transpile architecture stance
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 5 waves + final verification
> **Critical Path**: inventory and source-of-truth model -> manifest/contracts -> runtime/broker/tool projection -> first-party migration -> exemplars -> roadmap and release gates

---

## Context

### Original Request
Create an entire Firefly plugin system V2 plan that supersedes the old plugin planning system. Include side panels, session widgets, commands, and themes in the initial plan. OpenCode control is integrated into the architecture: anything a plugin contributes to the UI or runtime must also be controllable/queryable through agent-facing, Zod-backed tools.

### Interview Summary
**Key Decisions Made:**
- This is a single V2 plan that supersedes the older Firefly plugin plan.
- Use `firefly-client` as the target architecture name, while grounding implementation references in current `palot` / `elf` code.
- Phase-1 architecture includes all four contribution families: side panels, session widgets, commands, and themes.
- Every plugin surface must also expose OpenCode/agent-controllable, session-scoped Zod-backed tools.
- One plugin manifest/runtime path must cover first-party, locally-authored, AI-authored, and imported/transpiled plugins.
- Main process remains host-only; plugin code never runs in main.
- Host owns DOM and rendering primitives by default; iframe/webview is explicit escape hatch only.

**Current Repo Reality:**
- `apps/desktop/src/renderer/firefly-surface-registry.tsx` already acts like a first-party side-panel contribution registry.
- `apps/desktop/src/renderer/session-widget-registry.tsx` already acts like a widget contribution registry.
- `apps/desktop/.opencode/plugins/palot-bridge.js` already acts like a plugin-side tool/hook bundle for OpenCode.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` already centralizes Zod-backed bridge payloads and tool argument schemas.
- `apps/desktop/src/preload/index.ts` and `apps/desktop/src/preload/api.d.ts` already define a typed main-to-renderer capability seam.
- `apps/desktop/src/renderer/lib/themes.ts` plus `apps/desktop/src/renderer/hooks/use-theme.ts` already define a host-driven theme runtime.
- `apps/desktop/src/renderer/components/command-palette.tsx` already exposes many host commands and feature toggles, but not through a generalized plugin command contribution contract.
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx` is currently a posture/inventory surface for skills, commands, and MCP, not a real plugin lifecycle UI.

**Research Findings:**
- Electron `utilityProcess` + per-plugin `worker_thread` is validated precedent for plugin isolation outside main.
- `react-reconciler` is viable for a host-owned custom plugin UI tree; `isPrimaryRenderer: false` matters if the host React tree remains canonical.
- VS Code and Theia validate contribution-point manifests, lazy activation, capability tiers, and facade-based API reimplementation.
- Open VSX is viable source for themes and extension imports, but importer trust/scanning/rate limits remain our responsibility.
- VSIX import should stay classifier/transpile-only; no runtime `vscode` shim and no hidden VS Code sidecar.
- Sparse JSONC theme ingestion plus host token fallback chains is the right theme compatibility model.

### Metis Review
**Gaps addressed in this V2 plan:**
- Versioning, lifecycle, install/enable/disable/update/uninstall, and trust tiers are explicit.
- Session-scoped tool naming, collision policy, denial behavior, and timeout/cancel semantics are explicit workstreams.
- Current managed-server-only Palot/OpenCode seam is treated as a first-class architectural caveat, not hidden.
- Acceptance criteria now require one first-party and one third-party vertical slice through the same runtime.
- Scope creep is constrained: no marketplace product buildout, no runtime vscode shim, no full theme studio.
- Renderer registries are treated as projections of plugin contributions, not canonical sources of truth.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Design Firefly plugin system V2 so plugin contributions become the canonical source of truth for user-visible surfaces and agent-visible capabilities. The same plugin object must project into renderer UI, OpenCode tool definitions, capability enforcement, lifecycle control, and theme application without parallel hardcoded registries.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- A V2 plugin manifest/schema covering panels, widgets, commands, themes, tools, activation, capabilities, lifecycle metadata, and bridge metadata.
- A plugin host/runtime architecture with isolation, supervision, hot reload, crash quarantine, and capability brokering.
- A renderer projection model that derives side panels, session widgets, commands, and themes from plugin contributions.
- An OpenCode projection model that derives Zod-backed, session-scoped tools and introspection APIs from the same plugin contributions.
- A first-party migration plan that replaces current hardcoded registries with plugin-derived projections.
- A trust/lifecycle/install/update/rollback design for built-in, local-dev, and third-party plugins.
- A bounded VS Code import plan based on classifier + transpiler, not runtime compatibility.
- A concrete first-party side-panel migration matrix covering every current first-party side panel.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] V2 plan names one canonical source-of-truth object for plugin contributions and shows every projection derived from it.
- [ ] Side panels, session widgets, commands, and themes are all covered in initial architecture.
- [ ] Every existing first-party side panel has an explicit migration disposition and target plugin shape.
- [ ] Every plugin surface has a paired OpenCode/agent tool contract with Zod-backed validation and session-scope rules.
- [ ] The plan explicitly supersedes current hardcoded registries and the old V1-ish planning assumptions.
- [ ] Managed-server-only bridge caveat is explicitly resolved for V2 initial scope: either unsupported with written rationale, or scheduled as explicit implementation workstream.
- [ ] First-party and third-party plugin vertical slices both use the same manifest/runtime path.
- [ ] A concrete first-party side-panel migration matrix exists for every current `SidePanelTabId`.

### Must Have <!-- oc:id=sec_ag -->
- One manifest/runtime path for first-party and third-party plugins.
- One unified contribution model for panels, widgets, commands, themes, and tools.
- All existing first-party side panels migrate onto the plugin system as part of V2 rollout, not as a later optional follow-up.
- Host-owned DOM/rendering by default.
- Zod-backed agent tool schemas and bridge payloads.
- Session-scoped plugin control semantics for OpenCode.
- Clear capability broker and deny-by-default authority model.
- Firefly-specific capabilities for bridge/session/UI/browser/theme control are explicitly modeled, not implied under generic fs/net/shell.
- Migration path from current registries and Palot bridge.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No plugin code in main process.
- No direct plugin DOM mutation in host renderer.
- No separate hidden first-party runtime that bypasses the plugin manifest path.
- No runtime `vscode` API shim or hidden VS Code sidecar.
- No generic marketplace/discovery product scope in V2 architecture work.
- No full theme-studio/platform rewrite; theme support stays constrained to contribution + mapping/runtime application.
- No arbitrary native dependency support for AI-authored plugins in V2.
- No agent tool path that bypasses plugin capabilities, session scope, or Zod validation.

---

## V2 Architecture

### Source Of Truth Model
V2 defines one canonical source of truth, but four concrete runtime objects:

1. **`PluginManifest`**
- Static disk artifact shipped by built-in, local-dev, or third-party plugin package.
- Pure declaration only: identity, version, activation, contributions, capabilities, compatibility, trust hints.
- Never holds runtime state.

1. **`PluginDescriptor`**
- Host-owned validated/normalized form of the manifest.
- Produced after Zod parse + host normalization.
- Becomes the canonical contribution source of truth used for all projections.
- Contains no live process handles.

1. **`PluginInstance`**
- Host-owned runtime lifecycle record for one activated plugin worker.
- Holds activation status, crash counters, quarantine status, granted capabilities, transport handles, and health telemetry.
- Never becomes source of truth for declarative contributions.

1. **`PluginSessionHandle`**
- Host-owned session-scoped view of one plugin for one OpenCode session.
- Holds session availability, per-session tool exposure, session state references, and tool dispatch metadata.
- This is how panels/widgets/tools become session-aware without mutating manifest shape.

Every surface is projected from `PluginDescriptor` plus `PluginInstance` / `PluginSessionHandle` state:
- **Renderer projection** -> side-panel tabs, session widgets, command palette commands, theme catalog.
- **OpenCode projection** -> `tool.{name}.execute` entries, introspection tools, system-context summaries, capability-filtered tool availability.
- **Lifecycle projection** -> enabled/disabled/quarantined/installing/updating status, trust tier, grants, crash counters.
- **Policy projection** -> permissions prompts, broker allow/deny rules, scope boundaries, per-plugin metering.

This replaces the current split reality where:
- side panels are hardcoded in `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- widgets are hardcoded in `apps/desktop/src/renderer/session-widget-registry.tsx`
- OpenCode tools live separately in `apps/desktop/.opencode/plugins/palot-bridge.js`
- themes live separately in `apps/desktop/src/renderer/lib/themes.ts`

#### Projection input/output matrix

| Projection | Required inputs | Optional inputs | Exists before activation? | Output |
|---|---|---|---|---|
| Renderer projection | `PluginDescriptor` | `PluginInstance`, `PluginSessionHandle` | yes, partial (declarative surfaces render in disabled/empty state) | projected side-panel defs, widget defs, command defs, theme defs |
| OpenCode projection | `PluginDescriptor`, `PluginSessionHandle` | `PluginInstance` | introspection yes, executable tools no | tool definitions, introspection summaries, system-context blocks |
| Lifecycle projection | `PluginDescriptor`, `PluginInstance` | host policy state | lifecycle metadata yes, live crash counters no | enabled/disabled/quarantined/installing/updating status, trust tier, grants, crash counters |
| Policy projection | `PluginDescriptor`, host policy state, capability grants | `PluginInstance` | static capability map yes, runtime allow/deny no | permissions prompts, broker allow/deny rules, scope boundaries, per-plugin metering |

No projection reads from disk. All projections are computed in main process from the four canonical runtime objects.

### Plugin Contribution Families
V2 contribution families:
- `panels` — side-panel or main-pane surfaces; default host-rendered reconciler, optional iframe/webview escape hatch.
- `widgets` — session-scoped widget surfaces placed into host-defined zones.
- `commands` — command palette, menus, keybindings, contextual actions.
- `themes` — theme definitions, compatibility imports, runtime-precedence metadata.
- `tools` — agent/OpenCode-callable capabilities with Zod schema, permission requirements, scope semantics.
- `activation` — startup / command / panel open / session attach / tool call / theme apply triggers.
- `capabilities` — file/network/shell/clipboard/ai/host-ui/host-commands/tool-registration plus Firefly-specific bridge/UI capabilities.
- `bridge` metadata — OpenCode-facing schema version, introspection labels, session binding expectations, optional context injection blocks.

Family constraints:
- Plugins may choose from host-defined panel slots and widget zones; they do not mint arbitrary new host chrome areas in V2.
- Widget zones remain host-owned vocabulary. Current seed is `above-chat` and `chat-inline-right` from `apps/desktop/src/renderer/atoms/session-widgets.ts`.
- Theme contributions are data-only. Theme application stays host-owned.
- Tool contributions declare the superset statically in manifest; runtime may narrow availability per session.

### Layered Runtime Ownership
**Main process owns:**
- plugin catalog/index
- manifest validation and version gating
- runtime supervision
- capability broker
- durable storage and grants
- OpenCode bridge authority
- lifecycle telemetry and quarantine state
- the only authoritative path for renderer-unsafe or privilege-bearing actions

**Plugin host owns:**
- plugin execution runtime
- one plugin worker per active plugin
- plugin-local orchestration and state cache
- host API facade injection
- hot reload teardown/restart
- no direct access to renderer DOM or Electron main globals

**Renderer owns:**
- reconstruction of host-approved plugin UI trees
- rendering plugin-derived panels/widgets/commands/themes
- user-facing lifecycle and permission UX
- no plugin authority beyond declarative UI inputs and explicit iframe bridge
- no direct plugin host access unless explicitly mediated through host-approved transport

**OpenCode bridge owns:**
- serializing active plugin tool definitions
- session-scoped tool dispatch routing
- capability-filtered tool availability
- plugin introspection and state-query surfaces
- system prompt or context enrichment using plugin state summaries where declared

Transport rule:
- default rule is `renderer <-> main <-> plugin host` and `OpenCode <-> main <-> plugin host`.
- if MessagePort optimization is later adopted for renderer/plugin-host communication, main still provisions and governs the channel; no ad hoc direct transport is allowed.

### Session Scope Principle
Default plugin runtime scope for agent control is **session-scoped**.
That means:
- plugin tool invocations receive `sessionID` / session context by default
- panel/widget state queries resolve against active or target session
- per-project and global state exist, but only behind explicit declared scope
- themes are app-scoped for actual application state; theme tools may be called from sessions, but they inspect/request changes against app scope rather than creating per-session themes

Scope taxonomy:
- `session` — state owned per OpenCode session; default for panel/widget/tool runtime state
- `project` — state shared across sessions in same working directory/project
- `app` — Firefly-wide local state such as current applied theme, plugin lifecycle settings, and capability grants
- `global-profile` — optional future cross-project profile scope; not required for V2 initial implementation

### Plugin Surface = Tool Surface Principle
Every interactive contribution family must expose paired tool surfaces:
- panel -> `plugin.panel.state`, `plugin.panel.open`, panel-specific action/query tools
- widget -> `plugin.widget.list`, `plugin.widget.state`, widget-specific tools
- command -> `plugin.command.run`, `plugin.command.list`
- theme -> `plugin.theme.list`, `plugin.theme.apply`, `plugin.theme.reset`, optional `plugin.theme.preview`

These tools are not hand-written ad hoc bridge glue. They are derived from plugin contributions plus optional plugin-implemented handlers.

Tool ownership table:

| Tool class | Declared in manifest | Implemented by plugin | Generated by host | Session-scoped | Notes |
|---|---|---|---|---|---|
| Introspection (`plugins.list`, `plugins.describe`, `plugins.tools`, etc.) | No | No | Yes | Usually yes/read-only | Host derives from `PluginDescriptor` + runtime state |
| Surface inventory (`plugin.panel.list`, `plugin.widget.list`, `plugin.command.list`, `plugin.theme.list`) | Optional metadata only | No | Yes | Yes except theme list may read app scope | Host projection of contributions |
| Surface control wrappers (`plugin.panel.open`, `plugin.theme.apply`) | Yes | Mixed | Mixed | Yes for panel, app for theme | Host validates scope/capability, may call plugin handler or host adapter |
| Plugin business tools (`plugin.<id>.*`) | Yes | Yes | No | Default yes | Plugin provides Zod schema and handler |
| Dynamic session tools | Superset declared statically | Yes | Host may gate availability | Yes | Runtime may hide/disable per session, but names stay in declared namespace |

Standard tool result envelope:
- `status`: `completed | failed | denied | unavailable | queued | cancelled`
- `errorCode`: optional stable machine code
- `errorMessage`: optional human-readable explanation
- `data`: typed result payload
- `uiHints`: optional UI follow-up hints such as `openPanel`, `focusWidget`, `refreshProjection`
- `provenance`: plugin id, tool id, scope, capability set used
- `retryable`: boolean when relevant

### Introspection Is First-Class
V2 includes host-managed introspection tools so the agent can reason about installed plugins:
- `plugins.list`
- `plugins.describe`
- `plugins.tools`
- `plugins.panels`
- `plugins.widgets`
- `plugins.commands`
- `plugins.themes`
- `plugins.state`
- `plugins.permissions`
- `plugins.lifecycle`

These avoid forcing the model to guess what Firefly can do.

Reserved namespaces:
- Plugin ids: reverse-domain or org-scoped normalized ids; host reserves built-in ids under Firefly-owned namespace
- Tool ids: host reserves `plugins.*`; plugins use `plugin.<pluginId>.*` or namespaced equivalent
- Command ids: host reserves core prefixes like `firefly.` / `surface.` / lifecycle prefixes; plugins must not shadow them
- Theme ids: global unique within host catalog; collision rejects activation
- Panel/widget ids: unique within plugin + contribution family; projected global ids are host-namespaced

---

## Verification Strategy <!-- oc:id=sec_ai -->

> Planning-only session. Verification here means plan quality, source grounding, and agent-executable future validation.

### Test Decision <!-- oc:id=sec_aj -->
- **Infrastructure exists**: YES, uneven across repo
- **Automated tests**: tests-after implementation
- **Framework**: Bun test + lint/typecheck + targeted runtime proofs
- **Agent-Executed QA**: mandatory for future implementation tasks
- **Junior-implementation rule**: any section that introduces new runtime objects, lifecycles, namespaces, or scopes must include concrete tables/state machines/matrices so implementation does not depend on inference

### QA Policy <!-- oc:id=sec_ak -->
Every implementation task in this plan includes:
- concrete file/module references
- acceptance criteria tied to observable runtime behavior
- at least one happy-path and one failure/edge-path scenario
- evidence artifact path

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Start immediately — source of truth + reality inventory)
├── Task 1: Inventory current contribution registries and hardcoded sources [deep]
├── Task 2: Inventory current Palot/OpenCode bridge and session-scoped tool seams [deep]
├── Task 3: Inventory current command surfaces and activation paths [quick]
├── Task 4: Inventory current theme runtime and precedence model [quick]
├── Task 5: Define V2 non-goals, guardrails, and scope taxonomy [writing]
└── Task 6: Define plugin identity, lifecycle, and trust tiers [deep]

Wave 2 (After Wave 1 — canonical contracts)
├── Task 7: Define V2 manifest/schema and source-of-truth object [deep]
├── Task 8: Define contribution family contracts for panels/widgets/commands/themes [deep]
├── Task 9: Define Zod-backed OpenCode tool projection model [deep]
├── Task 10: Define capability broker, grants, and denial semantics [deep]
├── Task 11: Define plugin host isolation, crash supervision, and quarantine [unspecified-high]
└── Task 12: Define API tiering, versioning, and manifest evolution rules [writing]

Wave 3 (After Wave 2 — projection and runtime ownership)
├── Task 13: Define renderer projection architecture [visual-engineering]
├── Task 14: Define OpenCode bridge projection architecture [deep]
├── Task 15: Define storage/state scopes and persistence ownership [unspecified-high]
├── Task 16: Define theme contribution pipeline and precedence model [quick]
├── Task 17: Define command/menu/keybinding projection path [quick]
└── Task 18: Define plugin runtime hot reload and dev loop [quick]

Wave 4 (After Wave 3 — migration and exemplars)
├── Task 19: Build first-party migration plan from hardcoded registries to plugins [deep]
├── Task 20: Build bridge migration plan from current palot-bridge to V2 tool/runtime system [deep]
├── Task 21: First-party exemplar plugin vertical slice [quick]
├── Task 22: Third-party / AI-authored exemplar plugin vertical slice [deep]
├── Task 23: VS Code import classifier + transpile architecture [writing]
└── Task 24: Plugin lifecycle UI / operator surface plan [visual-engineering]

Wave 5 (After Wave 4 — rollout and release discipline)
├── Task 25: Unified phased roadmap and milestones [deep]
├── Task 26: Repo implementation matrix and package/module split [writing]
├── Task 27: Risk register and mitigations [writing]
├── Task 28: Verification matrix and release gates [unspecified-high]
└── Task 29: Performance, quotas, and plugin metering plan [unspecified-high]

Wave FINAL
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Source-reference and repo-reality audit [unspecified-high]
├── Task F3: Tool/schema/QA adequacy audit [deep]
└── Task F4: Scope fidelity / anti-creep audit [deep]
```

### Dependency Matrix
- **1**: — -> 7, 8, 13, 19, 25, 26
- **2**: — -> 7, 9, 10, 14, 20, 25, 26
- **3**: — -> 8, 17, 19, 24, 25
- **4**: — -> 8, 16, 19, 23, 25, 26
- **5**: — -> 7, 8, 9, 10, 12, 19, 23, 25, 27
- **6**: — -> 7, 10, 11, 12, 22, 24, 25, 27
- **7**: 1,2,5,6 -> 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 25
- **8**: 1,3,4,5,7 -> 9, 13, 16, 17, 19, 21, 22, 23, 24, 25
- **9**: 2,5,7,8 -> 14, 20, 21, 22, 25, 28, 29
- **10**: 2,5,6,7 -> 14, 15, 18, 20, 21, 22, 24, 25, 27, 28, 29
- **11**: 6,7,10 -> 18, 22, 24, 25, 27, 28, 29
- **12**: 5,6,7 -> 18, 23, 25, 27
- **13**: 1,7,8 -> 19, 21, 24, 25, 26, 28
- **14**: 2,7,9,10 -> 20, 21, 22, 25, 26, 28, 29
- **15**: 10 -> 19, 20, 21, 22, 24, 25, 26, 27, 28
- **16**: 4,8 -> 19, 21, 23, 24, 25, 26, 28
- **17**: 3,8 -> 19, 21, 24, 25, 26
- **18**: 10,11,12 -> 21, 22, 24, 25, 28, 29
- **19**: 1,3,4,8,13,15,16,17 -> 21, 25, 26, 27, 28
- **20**: 2,9,10,14,15 -> 21, 22, 25, 26, 27, 28, 29
- **21**: 7,8,9,10,13,14,15,16,17,19,20 -> 25, 26, 28, 29
- **22**: 6,7,8,9,10,11,14,15,18,20 -> 24, 25, 26, 27, 28, 29
- **23**: 4,5,7,8,12,16 -> 25, 26, 27, 28
- **24**: 3,6,8,10,11,13,15,17,18,22 -> 25, 26, 28
- **25**: 1-24 -> F1, F2, F3, F4
- **26**: 1-24 -> F2, F4
- **27**: 5,6,10,11,15,19,20,22,23,24,29 -> F1, F4
- **28**: 9,10,11,14,18,20,21,22,24 -> F1, F3
- **29**: 9,10,11,18,20,21,22 -> F1, F3, F4

---

## TODOs <!-- oc:id=sec_al -->

- [ ] 1. Inventory current contribution registries and hardcoded sources

  **What to do**:
  - Map all current hardcoded sources for side panels, session widgets, commands, themes, and plugin-ish surfaces.
  - Classify each as canonical source, projection, or incidental consumer.
  - Produce source-of-truth diagram for current system.

  **Must NOT do**:
  - Do not assume current registries are already plugin-ready.
  - Do not collapse commands/themes into side-panel-only thinking.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 13, 19, 25, 26
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - hardcoded side-panel registry
  - `apps/desktop/src/renderer/session-widget-registry.tsx` - hardcoded widget registry
  - `apps/desktop/src/renderer/atoms/session-widgets.ts` - persisted widget placement model
  - `apps/desktop/src/renderer/components/command-palette.tsx` - command surface and feature-toggle command behavior
  - `apps/desktop/src/renderer/lib/themes.ts` - current theme definitions
  - `apps/desktop/src/renderer/hooks/use-theme.ts` - theme runtime application path

  **Acceptance Criteria**:
  - [ ] Every current contribution family has file-backed source inventory.
  - [ ] Each current source is classified as canonical/projection/consumer.

  **QA Scenarios**:
  ```text
  Scenario: Contribution families fully inventoried
    Tool: Bash (grep/read)
    Preconditions: Repo readable
    Steps:
      1. Enumerate files matching surface, widget, command, theme, plugin patterns.
      2. Compare artifact against actual registry/runtime files.
    Expected Result: No side-panel/widget/command/theme source omitted.
    Failure Indicators: Missing one of the four required families.
    Evidence: .sisyphus/evidence/task-1-contribution-inventory.txt

  Scenario: Source classification complete
    Tool: Bash
    Preconditions: Inventory artifact exists
    Steps:
      1. Inspect every inventoried row.
      2. Assert canonical/projection/consumer column exists for each.
    Expected Result: No unclassified source remains.
    Evidence: .sisyphus/evidence/task-1-source-classification.txt
  ```

  **Commit**: NO

- [ ] 2. Inventory current Palot/OpenCode bridge and session-scoped tool seams

  **What to do**:
  - Map all current OpenCode-facing plugin seams, bridge schemas, resolver flows, dispatch paths, and session-bound state contracts.
  - Identify what already behaves like session-scoped plugin tooling and what remains ad hoc.

  **Must NOT do**:
  - Do not treat bridge docs as if they already describe a generalized plugin system.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 9, 10, 14, 20, 25, 26
  - **Blocked By**: None

  **References**:
  - `docs/palot-opencode-plugin-bridge.md` - canonical current seam narrative
  - `apps/desktop/.opencode/plugins/palot-bridge.js` - current OpenCode-side plugin hooks/tools
  - `apps/desktop/src/shared/palot-bridge-schemas.ts` - current Zod schemas
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts` - minimal plugin loader
  - `apps/desktop/src/preload/index.ts` - preload bridge entrypoints
  - `apps/desktop/src/preload/api.d.ts` - shared bridge types
  - `apps/desktop/src/renderer/services/backend.ts:245` - renderer wrapper for Palot bridge calls

  **Acceptance Criteria**:
  - [ ] Current bridge seams and session-scoped tools are fully mapped.
  - [ ] Managed-server-only caveat and attached-server limitation are explicit in output.

  **QA Scenarios**:
  ```text
  Scenario: All current bridge paths represented
    Tool: Bash (grep/read)
    Preconditions: Repo readable
    Steps:
      1. Enumerate bridge/plugin/shim/schema files.
      2. Compare against seam inventory artifact.
    Expected Result: All current bridge paths appear in artifact.
    Evidence: .sisyphus/evidence/task-2-bridge-seams.txt

  Scenario: Session-scope caveats explicit
    Tool: Bash
    Preconditions: Seam inventory artifact exists
    Steps:
      1. Search artifact for managed-server-only and attached-server behavior.
    Expected Result: Current runtime caveats are written plainly.
    Evidence: .sisyphus/evidence/task-2-caveats.txt
  ```

  **Commit**: NO

- [ ] 3. Inventory current command surfaces and activation paths

  **What to do**:
  - Catalog all command-like surfaces: command palette items, slash-style entrypoints if relevant, feature toggles, and contextual open/toggle actions.
  - Classify static vs dynamic activation and what should become plugin-contributed commands.

  **Must NOT do**:
  - Do not limit command analysis to command palette render code only.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 17, 19, 24, 25
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/command-palette.tsx`
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - `commandIds` already attached to surfaces
  - `apps/desktop/src/renderer/atoms/feature-flags.ts` - command-toggled feature flags

  **Acceptance Criteria**:
  - [ ] Current command families and activation styles are enumerated.
  - [ ] V2 candidates for plugin-contributed commands are called out.

  **QA Scenarios**:
  ```text
  Scenario: Surface-linked commands represented
    Tool: Bash
    Steps:
      1. Compare `commandIds` in surface registry with command inventory.
    Expected Result: No current surface command missing.
    Evidence: .sisyphus/evidence/task-3-command-links.txt

  Scenario: Activation styles classified
    Tool: Bash
    Steps:
      1. Inspect inventory rows for static/dynamic/user-triggered activation markers.
    Expected Result: Command activation modes are explicit.
    Evidence: .sisyphus/evidence/task-3-activation.txt
  ```

  **Commit**: NO

- [ ] 4. Inventory current theme runtime and precedence model

  **What to do**:
  - Map current theme definitions, persistence, apply/revert flow, class toggles, CSS var injection, and native-theme sync behavior.
  - Identify what must become plugin contributions versus host-owned theme application machinery.

  **Must NOT do**:
  - Do not turn this into a broad design-system rewrite.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 16, 19, 23, 25, 26
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/lib/themes.ts`
  - `apps/desktop/src/renderer/hooks/use-theme.ts`
  - `apps/desktop/src/renderer/atoms/preferences.ts`
  - `packages/ui/src/styles/globals.css`

  **Acceptance Criteria**:
  - [ ] Theme runtime source and precedence path are documented.
  - [ ] V2 split between plugin-contributed theme data and host-owned apply logic is explicit.

  **QA Scenarios**:
  ```text
  Scenario: Theme flow completely mapped
    Tool: Bash/read
    Steps:
      1. Trace theme selection from persisted preference to DOM/runtime apply.
    Expected Result: End-to-end theme flow artifact exists.
    Evidence: .sisyphus/evidence/task-4-theme-flow.txt

  Scenario: Host-vs-plugin split justified
    Tool: Bash
    Steps:
      1. Inspect artifact for explicit data/runtime boundary.
    Expected Result: Theme contribution and application responsibilities are separated.
    Evidence: .sisyphus/evidence/task-4-theme-boundary.txt
  ```

  **Commit**: NO

- [ ] 5. Define V2 non-goals, guardrails, and scope taxonomy

  **What to do**:
  - Write explicit V2 guardrails and anti-creep rules.
  - Define `host-only`, `built-in plugin`, `third-party-ready`, and `defer` taxonomy.
  - Lock in: no vscode runtime shim, no marketplace product buildout, no silent privilege path, no theme-studio sprawl.

  **Must NOT do**:
  - Do not leave core scope choices implicit.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 9, 10, 12, 19, 23, 25, 27
  - **Blocked By**: None

  **References**:
  - user request in current session
  - `.sisyphus/drafts/firefly-client-plugin-architecture.md`
  - Metis review output

  **Acceptance Criteria**:
  - [ ] Guardrails are explicit and reusable in downstream tasks.
  - [ ] Taxonomy is stable enough to classify every future contribution.

  **QA Scenarios**:
  ```text
  Scenario: V2 guardrails appear consistently downstream
    Tool: Bash/text search
    Steps:
      1. Search plan for contradictory scope language.
    Expected Result: No downstream task violates defined guardrails.
    Evidence: .sisyphus/evidence/task-5-guardrail-consistency.txt

  Scenario: Taxonomy is complete
    Tool: Bash
    Steps:
      1. Inspect taxonomy section for all four categories.
    Expected Result: All requested taxonomy labels exist.
    Evidence: .sisyphus/evidence/task-5-taxonomy.txt
  ```

  **Commit**: NO

- [ ] 6. Define plugin identity, lifecycle, and trust tiers

  **What to do**:
  - Define plugin ID/version rules, install/update/uninstall/enable/disable/rollback lifecycle, and built-in/local-dev/signed-third-party trust tiers.
  - Include per-project vs global enablement and quarantine behavior.

  **Must NOT do**:
  - Do not inflate into marketplace UX work.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 10, 11, 12, 22, 24, 25, 27
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
  - Metis review output
  - external precedent research

  **Acceptance Criteria**:
  - [ ] Lifecycle states cover install through quarantine and rollback.
  - [ ] Trust tiers define signature, capability, and consent expectations.

  **QA Scenarios**:
  ```text
  Scenario: Lifecycle complete
    Tool: Bash/checklist
    Steps:
      1. Inspect lifecycle for install, enable, disable, update, uninstall, rollback, quarantine.
    Expected Result: No major lifecycle state missing.
    Evidence: .sisyphus/evidence/task-6-lifecycle.txt

  Scenario: Trust tiers operational
    Tool: Bash
    Steps:
      1. Inspect each tier for concrete policy, not label only.
    Expected Result: Built-in, local-dev, signed-third-party expectations are explicit.
    Evidence: .sisyphus/evidence/task-6-trust.txt
  ```

  **Commit**: NO

- [x] 7. Define V2 manifest/schema and source-of-truth object

  **What to do**:
  - Design the V2 Zod manifest and its runtime-hydrated `PluginDescriptor` source-of-truth object.
  - Cover identity, versions, activation, contribution families, capabilities, bridge metadata, trust hints, and evolution rules.
  - Ensure one schema supports built-in and third-party plugins.

  **Must NOT do**:
  - Do not leave bridge/tool metadata as sidecar-only concepts.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 9, 10, 11, 12, 13, 14, 21, 22, 23, 25
  - **Blocked By**: 1, 2, 5, 6

  **References**:
  - user-provided architecture spec
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
  - `apps/desktop/src/shared/palot-bridge-schemas.ts`

  **Acceptance Criteria**:
  - [ ] One schema cleanly covers all contribution families and bridge/tool metadata.
  - [ ] Source-of-truth object and projection boundaries are explicit.

  **QA Scenarios**:
  ```text
  Scenario: Schema covers all planned contribution families
    Tool: Bash/checklist
    Steps:
      1. Compare schema fields against side panels, widgets, commands, themes, tools, activation, capabilities.
    Expected Result: No planned family lacks schema representation.
    Evidence: .sisyphus/evidence/task-7-schema-coverage.txt

  Scenario: Source-of-truth object explicit
    Tool: Bash
    Steps:
      1. Inspect manifest/runtime section for canonical object and derived projections.
    Expected Result: One canonical runtime object is named and described.
    Evidence: .sisyphus/evidence/task-7-source-of-truth.txt
  ```

  **Commit**: NO

- [x] 8. Define contribution family contracts for panels/widgets/commands/themes

  **What to do**:
  - Define declarative contract per contribution family.
  - Specify placement, activation, default state, availability, persistence, and host rendering expectations.
  - State which contribution families allow iframe/webview escape hatch and under what rules.

  **Must NOT do**:
  - Do not let one family dominate the model.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 13, 16, 17, 19, 21, 22, 23, 24, 25
  - **Blocked By**: 1, 3, 4, 5, 7

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - `apps/desktop/src/renderer/session-widget-registry.tsx`
  - `apps/desktop/src/renderer/atoms/session-widgets.ts`
  - `apps/desktop/src/renderer/components/command-palette.tsx`
  - `apps/desktop/src/renderer/lib/themes.ts`

  **Acceptance Criteria**:
  - [ ] Each family has a clear declarative contract.
  - [ ] Host-rendered path and escape-hatch rules are explicit.

  **QA Scenarios**:
  ```text
  Scenario: All four contribution families covered
    Tool: Bash/checklist
    Steps:
      1. Verify dedicated contract text exists for panels, widgets, commands, themes.
    Expected Result: No family omitted.
    Evidence: .sisyphus/evidence/task-8-family-coverage.txt

  Scenario: Escape hatch rules explicit
    Tool: Bash
    Steps:
      1. Search for iframe/webview policy and family applicability.
    Expected Result: Escape hatch is constrained, not vague.
    Evidence: .sisyphus/evidence/task-8-escape-hatch.txt
  ```

  **Commit**: NO

- [x] 9. Define Zod-backed OpenCode tool projection model

  **What to do**:
  - Define how contributions project into agent-facing tools.
  - Cover declarative `contributes.tools`, optional imperative dynamic tools, session scope, naming/collision rules, introspection tools, timeout/cancel, and error semantics.
  - Ensure every plugin surface can expose inspect/query/control tools.
  - Add a concrete tool-call state machine that pins the lifecycle of a single tool call. The standard tool result envelope already lists `status: completed | failed | denied | unavailable | queued | cancelled`; this state machine pins how a call moves between those states.

  | State | Trigger to enter | Allowed transitions out | Terminal? | User-observable indicator |
  |---|---|---|---|---|
  | `queued` | host accepts tool call, awaits plugin worker dispatch | `dispatching` (worker ready) / `denied` (capability missing) / `cancelled` (agent cancels) | no | "queued" badge in tool card |
  | `dispatching` | host hands call to plugin worker | `running` (worker begins execute) / `failed` (worker immediate error) / `cancelled` (agent or host cancels) / `unavailable` (worker offline) | no | "dispatching…" with no progress yet |
  | `running` | worker execute starts | `completed` (success) / `failed` (thrown or non-retryable) / `cancelled` (agent or host cancels) / `timeout` (host timer exceeded) | no | progress bar / streaming token output |
  | `timeout` | host timer fires while still in `running` | `failed` (timeout converted to failed) / `cancelled` (host cancels remaining) | no | "timed out" badge |
  | `completed` | worker execute resolves successfully | (none) | yes | success badge, result rendered |
  | `failed` | worker throws or non-retryable error | (none) | yes | error badge, error code/message |
  | `denied` | capability broker rejects before dispatch | (none) | yes | "denied: <capability>" badge |
  | `unavailable` | plugin worker or plugin disabled at dispatch time | (none) | yes | "plugin unavailable" badge |
  | `cancelled` | agent or host cancels during `queued`/`dispatching`/`running`/`timeout` | (none) | yes | "cancelled" badge |

  Default host timeout policy:
  - `dispatching` -> `running` ceiling: 5 seconds, then `timeout`
  - `running` ceiling: 60 seconds, then `timeout`
  - both ceilings are host policy and overridable per plugin via manifest

  - "Every non-terminal state is cancellable by host or agent. Every terminal state produces a final `errorCode` or successful `data` payload."

  **Must NOT do**:
  - Do not keep tools as ad hoc bridge-only glue.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 14, 20, 21, 22, 25, 28, 29
  - **Blocked By**: 2, 5, 7, 8

  **References**:
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/shared/palot-bridge-schemas.ts`
  - `docs/palot-opencode-plugin-bridge.md`

  **Acceptance Criteria**:
  - [ ] Every contribution family has corresponding tool projection semantics.
  - [ ] Introspection tools and collision rules are explicit.
  - [ ] Tool cancel/timeout state machine locks every state transition, including terminal `cancelled` and `denied` semantics, and ties each terminal state to a canonical error code.
  - [ ] Tool-call state machine lists all 9 states with allowed transitions.
  - [ ] `cancelled` reachable from any non-terminal state.
  - [ ] Default host timeout ceilings declared and overridable per plugin.

  **QA Scenarios**:
  ```text
  Scenario: Surface-tool symmetry explicit
    Tool: Bash/checklist
    Steps:
      1. Compare family contracts to tool projection section.
    Expected Result: Panels, widgets, commands, themes all have paired tool semantics.
    Evidence: .sisyphus/evidence/task-9-symmetry.txt

  Scenario: Session scope and error rules explicit
    Tool: Bash
    Steps:
      1. Inspect tool projection section for scope, timeout, cancel, and validation failure semantics.
    Expected Result: Runtime semantics are explicit.
    Evidence: .sisyphus/evidence/task-9-runtime-semantics.txt

  Scenario: Tool state machine deterministic
    Tool: Bash
    Steps:
      1. For each terminal state, assert canonical error code is present.
      1. For each non-terminal transition, assert reversibility is impossible.
    Expected Result: State machine has no ambiguous transitions and no missing error codes.
    Evidence: .sisyphus/evidence/task-9-tool-state-machine.txt

  Scenario: Tool-call state machine deterministic
    Tool: Bash
    Steps:
      1. For each of the 9 states, assert transition row exists with allowed next states.
    Expected Result: No state is unreachable or lacks transitions.
    Evidence: .sisyphus/evidence/task-9-tool-state-machine.txt
  ```

  **Commit**: NO

- [x] 10. Define capability broker, grants, and denial semantics

  **What to do**:
  - Design broker APIs, permission prompts, deny-by-default behavior, revocation, audit logging, grant storage, and scope-aware authorization.
  - Cover file/network/ai/shell/clipboard/renderer-ui/command registration/tool registration powers.
  - Add Firefly-specific capability classes for current repo reality such as `bridge:session-read`, `bridge:ui-state-read`, `bridge:ui-state-write`, `browser:lane-control`, `theme:apply`, `command:register`, and `tool:register`.

  **Must NOT do**:
  - Do not allow plugin tools to bypass broker through host shortcuts.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11, 14, 15, 18, 20, 21, 22, 24, 25, 27, 28, 29
  - **Blocked By**: 2, 5, 6, 7

  **References**:
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/preload/api.d.ts`
  - `apps/desktop/src/main/ipc-handlers.ts`
  - Metis review output

  **Acceptance Criteria**:
  - [ ] Broker model covers all dangerous capabilities.
  - [ ] Denial behavior is defined for UI and agent/tool callers.

  **QA Scenarios**:
  ```text
  Scenario: Capability coverage complete
    Tool: Bash/checklist
    Steps:
      1. Compare permission model against all declared capability classes.
    Expected Result: No declared capability lacks broker semantics.
    Evidence: .sisyphus/evidence/task-10-capabilities.txt

  Scenario: Denial paths explicit
    Tool: Bash
    Steps:
      1. Inspect UI denial and agent/tool denial response shapes.
    Expected Result: Permission denial semantics are concrete.
    Evidence: .sisyphus/evidence/task-10-denials.txt
  ```

  **Commit**: NO

- [x] 11. Define plugin host isolation, crash supervision, and quarantine

  **What to do**:
  - Specify utility-process runtime, per-plugin worker model, heartbeat, crash counters, backoff, quarantine, cleanup, and manual recovery.
  - Include behavior for hung workers and partial activation failures.

  **Must NOT do**:
  - Do not leave crash handling for later phases.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 18, 22, 24, 25, 27, 28, 29
  - **Blocked By**: 6, 7, 10

  **References**:
  - external precedent research
  - `apps/desktop/src/main/index.ts`

  **Acceptance Criteria**:
  - [ ] Isolation and supervision cover startup, runtime, crash, hang, and quarantine.
  - [ ] Recovery and operator override path are explicit.

  **QA Scenarios**:
  ```text
  Scenario: Failure classes covered
    Tool: Bash/checklist
    Steps:
      1. Inspect design for init crash, runtime crash, hang, and disable flows.
    Expected Result: No major failure class omitted.
    Evidence: .sisyphus/evidence/task-11-failure-classes.txt

  Scenario: Quarantine survives restart
    Tool: Bash
    Steps:
      1. Inspect quarantine persistence and re-enable semantics.
    Expected Result: Quarantine is operational, not conceptual only.
    Evidence: .sisyphus/evidence/task-11-quarantine.txt
  ```

  **Commit**: NO

- [x] 12. Define API tiering, versioning, and manifest evolution rules

  **What to do**:
  - Define stable/proposed/internal tiers, host-plugin compatibility rules, schema negotiation, deprecation policy, and codemod expectations.
  - Include bridge/tool schema evolution policy.

  **Must NOT do**:
  - Do not leave API drift management informal.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 18, 23, 25, 27
  - **Blocked By**: 5, 6, 7

  **References**:
  - external VS Code/Theia research
  - manifest task outputs

  **Acceptance Criteria**:
  - [ ] Every contribution family has corresponding tool projection semantics.
  - [ ] Introspection tools and collision rules are explicit.
  - [ ] Tool-call state machine lists all 9 states with allowed transitions.
  - [ ] `cancelled` reachable from any non-terminal state.
  - [ ] Default host timeout ceilings declared and overridable per plugin.

  **QA Scenarios**:
  ```text
  Scenario: Surface-tool symmetry explicit
    Tool: Bash/checklist
    Steps:
      1. Compare family contracts to tool projection section.
    Expected Result: Panels, widgets, commands, themes all have paired tool semantics.
    Evidence: .sisyphus/evidence/task-9-symmetry.txt

  Scenario: Session scope and error rules explicit
    Tool: Bash
    Steps:
      1. Inspect tool projection section for scope, timeout, cancel, and validation failure semantics.
    Expected Result: Runtime semantics are explicit.
    Evidence: .sisyphus/evidence/task-9-runtime-semantics.txt

  Scenario: Tool-call state machine deterministic
    Tool: Bash
    Steps:
      1. For each of the 9 states, assert transition row exists with allowed next states.
    Expected Result: No state is unreachable or lacks transitions.
    Evidence: .sisyphus/evidence/task-9-tool-state-machine.txt
  ```

  **Commit**: NO

- [x] 13. Define renderer projection architecture

  **What to do**:
  - Design how plugin contributions project into renderer data structures and React surfaces.
  - Replace hardcoded side-panel and widget registries with plugin-derived registries.
  - Include availability, persistence keys, telemetry namespaces, render factories, and async/loading/error state handling.

  **Must NOT do**:
  - Do not keep renderer registries canonical in V2.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 19, 21, 24, 25, 26, 28
  - **Blocked By**: 1, 7, 8

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - `apps/desktop/src/renderer/session-widget-registry.tsx`
  - `apps/desktop/src/renderer/atoms/session-widgets.ts`
  - `docs/genui-artifact-architecture.md`

  **Acceptance Criteria**:
  - [ ] Renderer registries become projections, not source of truth.
  - [ ] Loading/error/availability semantics exist for projected surfaces.

  **QA Scenarios**:
  ```text
  Scenario: Current registries demoted to projections
    Tool: Bash/checklist
    Steps:
      1. Inspect renderer projection section for source-of-truth ownership.
    Expected Result: Hardcoded registries no longer described as canonical.
    Evidence: .sisyphus/evidence/task-13-projections.txt

  Scenario: Async surface behavior defined
    Tool: Bash
    Steps:
      1. Inspect section for loading, availability, and failure UI states.
    Expected Result: Projected surfaces have explicit runtime states.
    Evidence: .sisyphus/evidence/task-13-async-states.txt
  ```

  **Commit**: NO

- [ ] 14. Define OpenCode bridge projection architecture

  **What to do**:
  - Design how the canonical plugin descriptor projects into OpenCode-visible hooks, tool definitions, system-context blocks, and dispatch pathways.
  - Explicitly decide V2 initial stance for attached/pre-existing OpenCode servers: unsupported with rationale, or covered by a dedicated generalized plugin installation path.
  - Cover managed server, attached server, direct callback, and bridge-transport behavior.

  **Server-mode behavior matrix (V2 initial stance, decided)**:

  | Server mode | Plugin install | Tool projection | Introspection | Context injection | Lifecycle controls | Operator UX status | Canonical error code |
  |---|---|---|---|---|---|---|---|
  | Managed (Palot-spawned) | Yes | Yes | Yes | Yes | Full | Normal | none |
  | Attached existing server, no V2 bridge install path applied | No | No | No | No | Disabled | "Bridge unsupported on attached server" badge | `bridge_unsupported_server` |
  | Attached existing server, after V2 generalized plugin install path (deferred to v2.1) | Yes (restricted to manifests declaring install pathway) | Yes | Yes | Yes | Full | Normal | none |
  | Offline / no OpenCode server | N/A | Empty (no tool surface) | Empty | N/A | Plugin controls gated | "No active server" badge | `no_active_server` |
  | Reconnect after server loss | N/A | Re-derives after reconnect | Empty mid-reconnect, recovers after | Paused | Re-derives `PluginSessionHandle` | "Session lost, reconnecting…" | `session_lost` |

  V2 initial rollout is managed-server-only; the attached-server generalized-install pathway is explicitly deferred to v2.1 with a dedicated workstream.

  **Must NOT do**:
  - Do not ignore current attached-server limitation.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 20, 21, 22, 25, 26, 28, 29
  - **Blocked By**: 2, 7, 9, 10

  **References**:
  - `docs/palot-opencode-plugin-bridge.md`
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/shared/palot-bridge-schemas.ts`
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts`

  **Acceptance Criteria**:
  - [ ]  projection path is explicit for both tool calls and context/introspection.
  - [ ] Managed vs attached server behavior is planned explicitly.
  - [ ] Managed, attached, offline, and reconnect server modes each have a deterministic matrix row with status badge string and error code.

  **QA Scenarios**:
  ```text
  Scenario: Current bridge categories covered in V2 projection
    Tool: Bash/checklist
    Steps:
      1. Compare existing browser/ui/discovery tool categories to V2 projection section.
    Expected Result: Existing bridge affordances all map into V2 categories.
    Evidence: .sisyphus/evidence/task-14-bridge-categories.txt

  Scenario: Attached-server behavior explicit
    Tool: Bash
    Steps:
      1. Search V2 section for attached/pre-existing server handling.
    Expected Result: Attached-server limitations or path-forward are explicit.
    Evidence: .sisyphus/evidence/task-14-attached-server.txt

  Scenario: Server mode matrix deterministic
    Tool: Bash
    Steps:
      1. For each server mode in matrix, assert the matrix row has non-null status badge string and error code.
    Expected Result: No server mode lacks badge or error code.
    Evidence: .sisyphus/evidence/task-14-server-mode-matrix.txt
  ```

  **Commit**: NO

- [ ] 15. Define storage/state scopes and persistence ownership

  **What to do**:
  - Define session/project/global scopes for plugin state.
  - Separate host-owned durable storage from plugin runtime cache.
  - Cover disable/uninstall/hot-reload persistence behavior and quotas.

  **Must NOT do**:
  - Do not let plugin worker memory become durable source of truth.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 19, 20, 21, 22, 24, 25, 26, 27, 28
  - **Blocked By**: 10

  **References**:
  - `apps/desktop/src/renderer/atoms/session-widgets.ts`
  - `docs/genui-artifact-architecture.md`
  - `apps/desktop/src/main/automation/registry.ts` - host-owned durable registry pattern

  **Acceptance Criteria**:
  - [ ] Theme contribution path and host precedence rules are explicit.
  - [ ] Import compatibility stance is bounded and realistic.
  - [ ] Theme precedence matrix exists with explicit winner per row.
  - [ ] User-picked theme always wins over plugin/imported/default.
  - [ ] `plugin.theme.preview` never mutates applied theme.

  **QA Scenarios**:
  ```text
  Scenario: Theme precedence explicit
    Tool: Bash/checklist
    Steps:
      1. Inspect theme section for user preference vs plugin vs default precedence.
    Expected Result: Deterministic precedence exists.
    Evidence: .sisyphus/evidence/task-16-precedence.txt

  Scenario: Import scope bounded
    Tool: Bash
    Steps:
      1. Search for Open VSX/theme import references.
    Expected Result: Compatibility path is present without token-studio scope creep.
    Evidence: .sisyphus/evidence/task-16-import-scope.txt

  Scenario: Theme precedence matrix deterministic
    Tool: Bash
    Steps:
      1. For each precedence row, assert the matrix has explicit winner and apply path.
    Expected Result: No precedence row lacks a winner.
    Evidence: .sisyphus/evidence/task-16-theme-precedence.txt
  ```

  **Commit**: NO

- [ ] 16. Define theme contribution pipeline and precedence model

  **What to do**:
  - Define how plugins contribute themes, how host validates/applies them, precedence vs user preferences, and rollback/reset behavior.
  - Include VS Code/Open VSX theme import compatibility stance and fallback-chain mapping concept.
  - Add a concrete precedence matrix. Theme contributions are data-only; the host applies them. The matrix pins exactly which source wins for the host's currently applied theme.

  | Precedence (highest wins) | Source | Apply path | User-observable result |
  |---|---|---|---|
  | 1 | explicit user pick persisted in `themeAtom` | host apply | theme wins regardless of plugin or import |
  | 2 | active plugin-provided theme (when no user pick yet) | host apply | plugin theme shown |
  | 3 | imported theme (VS Code / Open VSX converted) when no plugin/user pick | host apply | imported theme shown |
  | 4 | bundled system default | host apply | default shown |
  | fallback | preview-only request from agent `plugin.theme.preview` | host renders preview without changing applied theme | preview pane only; applied theme unchanged |

  - "Plugins cannot set the applied theme directly. They declare theme data; the host picks and applies according to the matrix above."

  **Must NOT do**:
  - Do not drift into full token-studio scope.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 19, 21, 23, 24, 25, 26, 28
  - **Blocked By**: 4, 8

  **References**:
  - `apps/desktop/src/renderer/lib/themes.ts`
  - `apps/desktop/src/renderer/hooks/use-theme.ts`
  - external theme research

  **Acceptance Criteria**:
  - [ ] Theme contribution path and host precedence rules are explicit.
  - [ ] Import compatibility stance is bounded and realistic.
  - [ ] Theme precedence matrix locks the exact ordering across reset / user-pick / session-preview / imported-fallback / built-in default, with explicit fallback rules for uninstalled picked themes.
  - [ ] Theme precedence matrix exists with explicit winner per row.
  - [ ] User-picked theme always wins over plugin/imported/default.
  - [ ] `plugin.theme.preview` never mutates applied theme.

  **QA Scenarios**:
  ```text
  Scenario: Theme precedence explicit
    Tool: Bash/checklist
    Steps:
      1. Inspect theme section for user preference vs plugin vs default precedence.
    Expected Result: Deterministic precedence exists.
    Evidence: .sisyphus/evidence/task-16-precedence.txt

  Scenario: Import scope bounded
    Tool: Bash
    Steps:
      1. Search for Open VSX/theme import references.
    Expected Result: Compatibility path is present without token-studio scope creep.
    Evidence: .sisyphus/evidence/task-16-import-scope.txt

  Scenario: Theme precedence deterministic
    Tool: Bash
    Steps:
      1. For each layer in theme precedence matrix, assert the layer is reachable and order is locked.
    Expected Result: Every layer has deterministic precedence and a defined fallback for uninstall.
    Evidence: .sisyphus/evidence/task-16-theme-precedence.txt

  Scenario: Theme precedence matrix deterministic
    Tool: Bash
    Steps:
      1. For each precedence row, assert the matrix has explicit winner and apply path.
    Expected Result: No precedence row lacks a winner.
    Evidence: .sisyphus/evidence/task-16-theme-precedence.txt
  ```

  **Commit**: NO

- [ ] 17. Define command/menu/keybinding projection path

  **What to do**:
  - Design how plugin commands appear in command palette, menus, and keybindings.
  - Cover static declarations, dynamic visibility, session-aware enable/disable conditions, reserved prefixes, and collision policy.

  **Must NOT do**:
  - Do not reduce command contributions to side-panel open/toggle commands only.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 19, 21, 24, 25, 26
  - **Blocked By**: 3, 8

  **References**:
  - `apps/desktop/src/renderer/components/command-palette.tsx`
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`

  **Acceptance Criteria**:
  - [ ] Commands, menus, and keybindings are covered together.
  - [ ] Dynamic visibility/enablement semantics are explicit.

  **QA Scenarios**:
  ```text
  Scenario: Command contribution surfaces all covered
    Tool: Bash/checklist
    Steps:
      1. Verify command palette, menus, and keybindings appear in section.
    Expected Result: No command-related surface omitted.
    Evidence: .sisyphus/evidence/task-17-command-surfaces.txt

  Scenario: Visibility semantics explicit
    Tool: Bash
    Steps:
      1. Inspect section for availability/enablement/context rules.
    Expected Result: Dynamic command conditions are defined.
    Evidence: .sisyphus/evidence/task-17-visibility.txt
  ```

  **Commit**: NO

- [ ] 18. Define plugin runtime hot reload and dev loop

  **What to do**:
  - Define plugin build/watch pipeline, hot reload teardown/restart, state preservation boundaries, and dev-mode unsigned behavior.
  - Include how OpenCode tool projections and renderer projections refresh together.

  **Must NOT do**:
  - Do not rely on module cache hacks instead of process restart.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 21, 22, 24, 25, 28, 29
  - **Blocked By**: 10, 11, 12

  **References**:
  - `apps/desktop/electron.vite.config.ts`
  - `AGENTS.md` devmux/runtime guidance
  - external precedent research

  **Acceptance Criteria**:
  - [ ] Edit -> rebuild -> restart -> reprojection loop is explicit.
  - [ ] Renderer and OpenCode projections refresh coherently.

  **QA Scenarios**:
  ```text
  Scenario: End-to-end reload flow defined
    Tool: Bash/checklist
    Steps:
      1. Inspect dev loop for full edit-to-ready cycle.
    Expected Result: Full hot-reload cycle is present.
    Evidence: .sisyphus/evidence/task-18-reload-cycle.txt

  Scenario: Projection refresh coherence explicit
    Tool: Bash
    Steps:
      1. Inspect section for renderer/tool projection synchronization.
    Expected Result: Hot reload refreshes both projections coherently.
    Evidence: .sisyphus/evidence/task-18-projection-refresh.txt
  ```

  **Commit**: NO

- [ ] 19. Build first-party migration plan from hardcoded registries to plugins

  **What to do**:
  - Plan migration order for side panels, widgets, commands, and themes from current hardcoded sources into built-in plugins.
  - Explicitly migrate all existing first-party side panels into the plugin system as part of V2 rollout so first-party usage proves runtime completeness.
  - Define which surfaces remain host-only wrappers and which become built-in unremovable plugins.
  - For every current side panel, record: current file, target plugin id, target contribution family, target tool surface, required capabilities, and rollout phase.
  - State teardown behavior for disabling/uninstalling a plugin that currently owns an open side panel, mounted widget, active command registration, or in-flight tool call.

  **Must NOT do**:
  - Do not leave any current first-party side panel outside the plugin runtime except narrowly justified host-only wrappers with written rationale.
  - Do not assume every current surface becomes third-party-extensible in phase 1.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 21, 25, 26, 27, 28
  - **Blocked By**: 1, 3, 4, 8, 13, 15, 16, 17

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - `apps/desktop/src/renderer/session-widget-registry.tsx`
  - `apps/desktop/src/renderer/components/command-palette.tsx`
  - `apps/desktop/src/renderer/lib/themes.ts`

  **Acceptance Criteria**:
  - [ ] Every current hardcoded family has migration disposition.
  - [ ] Every existing first-party side panel has a plugin migration row with target plugin/tool/capability mapping.
  - [ ] Built-in plugin vs host-only decisions are explicit.

  **QA Scenarios**:
  ```text
  Scenario: Hardcoded families all get migration path
    Tool: Bash/checklist
    Steps:
      1. Compare current source inventory against migration plan.
    Expected Result: No current family lacks migration decision.
    Evidence: .sisyphus/evidence/task-19-family-migration.txt

  Scenario: Every first-party side panel mapped into plugin runtime
    Tool: Bash/checklist
    Steps:
      1. Enumerate side-panel ids from `apps/desktop/src/renderer/firefly-surface-registry.tsx`.
      1. Cross-check each id against migration matrix rows.
      1. Assert each row includes target plugin id, tool surface, and capability set.
    Expected Result: Every first-party side panel is accounted for in plugin migration.
    Evidence: .sisyphus/evidence/task-19-side-panel-matrix.txt

  Scenario: Host-only exceptions explicit
    Tool: Bash
    Steps:
      1. Search migration section for host-only wrappers or exemptions.
    Expected Result: Exceptions are documented, not implicit.
    Evidence: .sisyphus/evidence/task-19-host-only.txt
  ```

  **Commit**: NO

- [ ] 20. Build bridge migration plan from current palot-bridge to V2 tool/runtime system

  **What to do**:
  - Define how current `palot-bridge` and shim/bridge transport evolve into generalized plugin tool/runtime projection.
  - Preserve working browser/UI control while removing special-case assumptions.

  **Must NOT do**:
  - Do not strand current browser tools outside V2.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 21, 22, 25, 26, 27, 28, 29
  - **Blocked By**: 2, 9, 10, 14, 15

  **References**:
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/shared/palot-bridge-schemas.ts`
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
  - `docs/palot-opencode-plugin-bridge.md`

  **Acceptance Criteria**:
  - [ ] Current bridge tools and hooks have explicit V2 landing points.
  - [ ] Special-case Palot bridge assumptions are reduced or bounded.

  **QA Scenarios**:
  ```text
  Scenario: Existing bridge functions have V2 landing points
    Tool: Bash/checklist
    Steps:
      1. Cross-check current discovery/browser/ui tools against migration section.
    Expected Result: No current bridge category is orphaned.
    Evidence: .sisyphus/evidence/task-20-landing-points.txt

  Scenario: Bridge special-casing reduced
    Tool: Bash
    Steps:
      1. Inspect migration section for generalized runtime/projection strategy.
    Expected Result: V2 reduces one-off bridge logic where possible.
    Evidence: .sisyphus/evidence/task-20-generalization.txt
  ```

  **Commit**: NO

- [x] 21. First-party exemplar plugin vertical slice

  **What to do**:
  - Pick one first-party plugin that proves the full V2 path.
  - It must contribute at least one panel or widget, at least one command, and at least one tool, and interact with host storage/capabilities.

  **Must NOT do**:
  - Do not pick a trivial example that dodges real runtime seams.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 25, 26, 28, 29
  - **Blocked By**: 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 20

  **References**:
  - likely candidate from current `browser`, `artifacts`, or `plugins` surfaces
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - `docs/genui-artifact-architecture.md`

  **Acceptance Criteria**:
  - [ ] Exemplar hits contribution, tool, capability, and persistence layers.
  - [ ] Exemplar can serve as implementation template for later built-ins.

  **QA Scenarios**:
  ```text
  Scenario: Exemplar spans full V2 path
    Tool: Bash/checklist
    Steps:
      1. Compare exemplar against manifest, renderer projection, tool projection, and broker sections.
    Expected Result: Exemplar touches all major V2 layers.
    Evidence: .sisyphus/evidence/task-21-first-party-exemplar.txt

  Scenario: Exemplar non-triviality verified
    Tool: Bash
    Steps:
      1. Inspect exemplar for real runtime dependencies and state/tool interactions.
    Expected Result: Exemplar is representative, not toy.
    Evidence: .sisyphus/evidence/task-21-representative.txt
  ```

  **Commit**: NO

- [ ] 22. Third-party / AI-authored exemplar plugin vertical slice

  **What to do**:
  - Define one realistic third-party or AI-authored plugin that exercises trust, permissions, UI contribution, OpenCode tool control, isolation, and lifecycle surfaces.
  - Keep it inside V2 guardrails: no arbitrary native deps.

  **Must NOT do**:
  - Do not use an example that only proves built-in privilege.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 24, 25, 26, 27, 28, 29
  - **Blocked By**: 6, 7, 8, 9, 10, 11, 14, 15, 18, 20

  **References**:
  - user goal for AI-authored and third-party plugins
  - trust/lifecycle/runtime tasks above

  **Acceptance Criteria**:
  - [ ] Exemplar spans trust, permissions, UI, tools, and isolation.
  - [ ] Exemplar respects V2 non-goals.

  **QA Scenarios**:
  ```text
  Scenario: Third-party concerns fully exercised
    Tool: Bash/checklist
    Steps:
      1. Compare exemplar against trust, broker, runtime, and projection sections.
    Expected Result: Major third-party concerns are all covered.
    Evidence: .sisyphus/evidence/task-22-third-party-exemplar.txt

  Scenario: V2 guardrails respected
    Tool: Bash
    Steps:
      1. Inspect exemplar assumptions for forbidden native/runtime behavior.
    Expected Result: Example stays inside V2 constraints.
    Evidence: .sisyphus/evidence/task-22-guardrails.txt
  ```

  **Commit**: NO

- [ ] 23. VS Code import classifier + transpile architecture

  **What to do**:
  - Define classifier rubric for GREEN/YELLOW/ORANGE/RED extension import feasibility.
  - Define transpile-only architecture using `vscode.d.ts` as semantic contract.
  - Keep runtime shim and hidden VS Code sidecar explicitly out of scope.

  **Must NOT do**:
  - Do not promise runtime compatibility.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 25, 26, 27, 28
  - **Blocked By**: 4, 5, 7, 8, 12, 16

  **References**:
  - VS Code import research output
  - external classifier rubric findings

  **Acceptance Criteria**:
  - [ ] Import path is classifier/transpile-only.
  - [ ] Feasibility tiers and rejection reasons are explicit.

  **QA Scenarios**:
  ```text
  Scenario: Runtime shim excluded
    Tool: Bash
    Steps:
      1. Search VS Code import section for runtime shim/hidden VS Code language.
    Expected Result: Section clearly rejects runtime shim approach.
    Evidence: .sisyphus/evidence/task-23-no-runtime-shim.txt

  Scenario: Feasibility tiers complete
    Tool: Bash/checklist
    Steps:
      1. Verify GREEN/YELLOW/ORANGE/RED rubric appears with criteria.
    Expected Result: Classifier rubric is explicit.
    Evidence: .sisyphus/evidence/task-23-rubric.txt
  ```

  **Commit**: NO

- [ ] 24. Plugin lifecycle UI / operator surface plan

  **What to do**:
  - Plan the user/operator-facing plugin management surfaces: install status, enable/disable, permission review, quarantine, logs, dev reload, and basic inventory.
  - Replace current inventory-only Plugins panel posture with real lifecycle semantics.
  - Include required operator fields: trust tier, granted capabilities, active session bindings, exposed tools, last crash reason/time, quarantine status, and current applied theme ownership when relevant.

  **Must NOT do**:
  - Do not build full marketplace browse/discover UX.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 25, 26, 28
  - **Blocked By**: 3, 6, 8, 10, 11, 13, 15, 17, 18, 22

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx`
  - current feature-flag and surface panel patterns

  **Acceptance Criteria**:
  - [ ] Operator surfaces cover lifecycle and trust basics.
  - [ ] Scope remains bounded: lifecycle/inventory, not marketplace product.

  **QA Scenarios**:
  ```text
  Scenario: Lifecycle operations represented in UI plan
    Tool: Bash/checklist
    Steps:
      1. Inspect UI plan for enable, disable, quarantine, permissions, logs, reload.
    Expected Result: Core operator actions are present.
    Evidence: .sisyphus/evidence/task-24-ui-ops.txt

  Scenario: Scope bounded to lifecycle
    Tool: Bash
    Steps:
      1. Search section for marketplace browse/rank/discover product scope.
    Expected Result: No marketplace sprawl appears.
    Evidence: .sisyphus/evidence/task-24-bounded.txt
  ```

  **Commit**: NO

- [ ] 25. Unified phased roadmap and milestones

  **What to do**:
  - Combine all prior tasks into implementation roadmap with milestones, dependency gates, and defer points.
  - Make source-of-truth model and first vertical slice the two key early milestones.

  **Must NOT do**:
  - Do not flatten architecture into ambiguous backlog.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: 1-24

  **References**:
  - all prior task outputs

  **Acceptance Criteria**:
  - [ ] Roadmap reflects source-of-truth-first architecture sequence.
  - [ ] Deferred items and non-goals stay explicit.

  **QA Scenarios**:
  ```text
  Scenario: All prerequisite planning areas incorporated
    Tool: Bash/checklist
    Steps:
      1. Compare roadmap against tasks 1-24.
    Expected Result: No major planning area omitted.
    Evidence: .sisyphus/evidence/task-25-roadmap.txt

  Scenario: Early milestones make architectural sense
    Tool: Bash
    Steps:
      1. Inspect first two milestones for source-of-truth and vertical-slice focus.
    Expected Result: Early sequence is architecture-first, not random feature-first.
    Evidence: .sisyphus/evidence/task-25-milestones.txt
  ```

  **Commit**: NO

- [ ] 26. Repo implementation matrix and package/module split

  **What to do**:
  - Convert V2 plan into likely repo touch points and new module/package splits.
  - Separate main runtime, preload/shared schemas, renderer projections, SDK/runtime host, and plugin examples.

  **Must NOT do**:
  - Do not invent paths with no repo grounding.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: F2, F4
  - **Blocked By**: 1-24

  **References**:
  - all inventory and architecture tasks

  **Acceptance Criteria**:
  - [ ] Matrix references real repo areas plus clearly-marked new modules/packages.
  - [ ] Package/module boundaries align with clean seams.

  **QA Scenarios**:
  ```text
  Scenario: Paths grounded in repo reality
    Tool: Bash/checklist
    Steps:
      1. Validate every path in matrix against real repo areas or explicit new-module labels.
    Expected Result: No bogus path references.
    Evidence: .sisyphus/evidence/task-26-paths.txt

  Scenario: Domain split explicit
    Tool: Bash
    Steps:
      1. Inspect matrix grouping for main/preload/shared/renderer/sdk/runtime separation.
    Expected Result: Domain boundaries are clear.
    Evidence: .sisyphus/evidence/task-26-domains.txt
  ```

  **Commit**: NO

- [ ] 27. Risk register and mitigations

  **What to do**:
  - Consolidate major technical, trust, runtime, UI, and scope risks.
  - Include mitigation, fallback, detection, and defer options.
  - Explicitly cover: bridge version skew, React singleton drift, crash loops, permission fatigue, theme precedence bugs, and attached-server ambiguity.

  **Must NOT do**:
  - Do not bury known risks in prose.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: F1, F4
  - **Blocked By**: 5, 6, 10, 11, 15, 19, 20, 22, 23, 24, 29

  **References**:
  - Metis output
  - external research findings

  **Acceptance Criteria**:
  - [ ] High-severity known risks are all present.
  - [ ] Every high-severity risk has mitigation and fallback.

  **QA Scenarios**:
  ```text
  Scenario: Known critical risks present
    Tool: Bash/checklist
    Steps:
      1. Confirm bridge skew, React duplication, crash loops, permission fatigue, theme precedence, attached-server ambiguity exist in register.
    Expected Result: Known critical risks are not omitted.
    Evidence: .sisyphus/evidence/task-27-known-risks.txt

  Scenario: Every high risk has mitigation
    Tool: Bash
    Steps:
      1. Inspect all high-severity rows for mitigation/fallback.
    Expected Result: No high-severity risk lacks response plan.
    Evidence: .sisyphus/evidence/task-27-mitigations.txt
  ```

  **Commit**: NO

- [ ] 28. Verification matrix and release gates

  **What to do**:
  - Define local, pre-merge, and release confidence gates for plugin runtime, bridge projection, renderer projection, and theme contributions.
  - Match gates to repo reality, not imaginary test infrastructure.

  **Must NOT do**:
  - Do not assume E2E infrastructure already exists.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: F1, F3
  - **Blocked By**: 9, 10, 11, 13, 14, 18, 20, 21, 22, 24, 25, 27

  **References**:
  - repo command inventory
  - `AGENTS.md`
  - runtime-critical tasks above

  **Acceptance Criteria**:
  - [ ] Gates differentiate local, pre-merge, and release confidence.
  - [ ] Plugin runtime, bridge, renderer, and themes each have explicit obligations.

  **QA Scenarios**:
  ```text
  Scenario: Workstreams all have gates
    Tool: Bash/checklist
    Steps:
      1. Compare gate matrix against runtime, bridge, renderer, and theme workstreams.
    Expected Result: No major workstream lacks gates.
    Evidence: .sisyphus/evidence/task-28-gates.txt

  Scenario: Gate realism respected
    Tool: Bash
    Steps:
      1. Compare gate expectations against current repo verification reality.
    Expected Result: Gates are ambitious but realistic.
    Evidence: .sisyphus/evidence/task-28-reality.txt
  ```

  **Commit**: NO

- [ ] 29. Performance, quotas, and plugin metering plan

  **What to do**:
  - Define plugin count assumptions, worker limits, memory/cpu quotas, event fan-out policy, AI metering, and per-plugin telemetry.
  - Include command/theme/panel/widget projection scaling assumptions.

  **Must NOT do**:
  - Do not leave AI/tool cost attribution as future nice-to-have.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: F1, F3, F4
  - **Blocked By**: 9, 10, 11, 14, 18, 20, 21, 22

  **References**:
  - external worker/runtime research
  - current telemetry namespaces in `apps/desktop/src/renderer/firefly-surface-registry.tsx`

  **Acceptance Criteria**:
  - [ ] Runtime quotas and metering are explicit.
  - [ ] Per-plugin AI/tool cost attribution is included.

  **QA Scenarios**:
  ```text
  Scenario: Resource limits cover abuse cases
    Tool: Bash/checklist
    Steps:
      1. Inspect quotas for workers, events, AI calls, and broker load.
    Expected Result: Major abuse/perf risks are addressed.
    Evidence: .sisyphus/evidence/task-29-quotas.txt

  Scenario: Cost attribution explicit
    Tool: Bash
    Steps:
      1. Search section for per-plugin AI/tool metering.
    Expected Result: Cost attribution is designed, not deferred.
    Evidence: .sisyphus/evidence/task-29-metering.txt
  ```

  **Commit**: NO

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify V2 still satisfies must-haves: one source-of-truth plugin model, all four contribution families, session-scoped Zod-backed tools, unified first-/third-party path, host-owned DOM, and explicit Palot/OpenCode bridge treatment.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT`

- [ ] F2. **Source-Reference / Repo-Reality Audit** — `unspecified-high`
  Check every referenced repo file and module grouping against actual repo structure. Confirm no invented paths and no weakly justified module splits.
  Output: `References [N/N valid] | Weak refs [N] | VERDICT`

- [ ] F3. **Tool / Schema / QA Adequacy Audit** — `deep`
  Review all V2 tasks for executable acceptance criteria, Zod/tool symmetry, and concrete QA scenarios with both happy path and failure path coverage.
  Output: `Tasks [N/N adequate] | Weak QA [N] | VERDICT`

- [ ] F4. **Scope Fidelity / Anti-Creep Audit** — `deep`
  Check the plan for drift into marketplace product, runtime vscode shim, full theme-studio rewrite, or hidden first-party bypass paths.
  Output: `Scope [CLEAN/ISSUES] | V2 guardrails [PASS/FAIL] | VERDICT`

---

## Commit Strategy <!-- oc:id=sec_am -->

- No commit during planning. Executor commits verified implementation slices during work waves.

---

## Success Criteria

### Verification Commands
```bash
bun run lint
bun run check-types
cd packages/configconv && bun test
bun run svc:status
```

### Final Checklist
- [ ] Old Firefly plugin plan superseded by this V2 plan
- [ ] One canonical plugin model named and used throughout
- [ ] Side panels, session widgets, commands, and themes all integrated into initial architecture
- [ ] Every plugin surface has OpenCode/agent tool projection semantics
- [ ] Palot/OpenCode bridge migration is explicit, not hidden
- [ ] First-party and third-party vertical slices both use same runtime path
- [ ] Scope remains architectural, not marketplace-product or vscode-runtime sprawl