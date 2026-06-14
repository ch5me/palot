# Stable Host Split Dock Workspace

## TL;DR
> **Summary**: Rebuild Palot session workspace around a three-zone split shell (`main`, `right`, `bottom`) where Dockview manages tab chrome only, while Palot owns heavyweight content lifetime through a stable-host runtime. This removes remount-on-move for protected panels like chat and creates the identity/routing model needed for future side-by-side multi-session chat.
> **Deliverables**:
> - stable-host workspace runtime and host/viewport attachment model
> - three-zone split shell for session workspaces
> - logical panel / instance / slot data model and persistence contract
> - registry evolution from render-factory rows to descriptor-backed host policies
> - transfer bridge, focus routing, and multi-session chat-ready command model
> **Effort**: XL
> **Parallel**: YES - 6 waves
> **Critical Path**: State contract → stable host runtime → shell cutover → routing/commands → persistence → multi-session proof

## Context
### Original Request
- Adopt style from Storybook prototype `shells-workspace-primitives--agent-detail-split-dock-instances`
- Use 3 split plane layout with buttons to control docks and tabs that transfer
- Make it reusable for Palot
- Build full stable-host version from the start so moving heavy tabs does not destroy/recreate React trees
- Architect it well enough that two chat panels from two sessions can sit side by side later, ideally without redesign

### Interview Summary
- User explicitly rejected a destroy/remount architecture for heavy tabs like long chat sessions.
- User prefers the ideal stable-host version now rather than a simpler intermediate design.
- User wants future support for two live chats from different sessions side by side, which forces the plan to separate content identity from dock slot identity.
- Existing Palot registries for Firefly surfaces and session widgets must remain the source of truth.
- High-accuracy research recommends `react-reverse-portal` as the default first implementation path for movable mounted subtree attachment, but wrapped behind a Palot-owned host runtime abstraction so the library can be swapped later.

### Metis Review (gaps addressed)
- Current app still assumes one side panel and one active surface; the plan therefore starts with contract/state changes before visible dock cutover.
- Current `agent-detail` remounts dock shell on layout toggles; stable-host invariants now explicitly forbid layout-driven key resets.
- Current registries are render-factory registries, not instance/host descriptors; plan now adds descriptor evolution as a first-class workstream.
- Multi-session side-by-side chat requires host-instance scoped focus/input/command routing; plan now includes that identity model and proof criteria.

## Work Objectives
### Core Objective
- Replace Palot's single-session dock/singleton side-panel model with a reusable three-zone split-dock workspace architecture where protected heavyweight panels remain mounted while moving between zones, and where the command/state/routing model supports multiple concurrently visible session chats.

### Deliverables
- `StablePanelHostRuntime` architecture and implementation seam
- `SplitDockWorkspaceShell` architecture and implementation seam
- logical panel / host instance / dock slot / zone state model
- descriptor evolution plan for built-in, plugin, and widget surfaces
- transfer bridge contract that changes placement without remounting protected hosts
- host-scoped focus, commands, app-bar, and pane-bus routing model
- persistence schema for layout, instances, and placement restore
- manual proof plan for protected chat preservation and multi-session side-by-side readiness
- explicit workspace-instance and focus-authority model for multi-workspace safety
- surface transport abstraction with `react-reverse-portal` first and future `moveBefore()` upgrade path

### Definition of Done (verifiable conditions with commands)
- Workspace state model no longer relies on singleton side-panel tab semantics for session workspaces, verified by source review and type-check.
- A protected chat host can move between `main`, `right`, and `bottom` without subtree remount, proven by instrumentation/evidence capture in manual verification run.
- Toggling dock visibility or resizing zones does not remount protected hosts, proven in manual verification run.
- Registry-backed surfaces/widgets resolve through the same canonical registries after shell cutover, proven by tests/type-check.
- Layout persistence restores logical panel instances into correct zones and slots after relaunch, proven by manual verification run.
- Architecture supports two visible chat hosts from two sessions with independent focus/input ownership, proven by manual verification run or targeted harness.
- `bun run lint`
- `bun run check-types`

### Must Have
- Keep `dockview`
- Keep three-zone shell shape
- Keep registry-driven truth for surfaces/widgets
- Stable-host runtime for heavyweight panels from day one
- Explicit identity separation: descriptor vs logical instance vs stable host vs workspace instance vs dock slot
- Forward-compatible design for multi-session side-by-side chat
- Default first implementation path uses `react-reverse-portal` or an equivalent abstraction hidden behind Palot runtime; no direct library leakage into surface code
- Dockview panel lifecycle must never be treated as heavy surface lifetime authority

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT copy Storybook transfer bridge literally from `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx:629`
- Must NOT let Dockview panel ids become content identity
- Must NOT use layout-driven React `key` churn to rebuild dock shells or protected hosts
- Must NOT duplicate title/icon/availability metadata outside canonical registries
- Must NOT silently reroute or drop unavailable restored panels; show inert explanatory shell instead
- Must NOT conflate “hidden but mounted” with “moved between dock instances”; `renderer: "always"` is insufficient for move preservation
- Must NOT ship initial shell with singleton command/open/focus semantics still targeting one side panel
- Must NOT let surface-specific logic bypass a shared transport/lifecycle contract

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after + existing Bun/typecheck stack; no TDD mandate because renderer lacks broad test coverage today, but every task includes agent-executed QA scenarios.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: state/contract groundwork and instrumentation
Wave 2: stable-host runtime and attachment lifecycle
Wave 3: split shell and dock adapter cutover
Wave 4: command/focus/pane-bus/multi-instance routing
Wave 5: persistence, restoration, and registry/plugin convergence
Wave 6: multi-session chat proof, regression hardening, and docs/tests

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 6, 7, 8, 9, 10, 11
- 2 blocks 4, 8, 10
- 3 blocks 4, 5, 8, 10
- 4 blocks 9, 10
- 5 blocks 8
- 6 blocks 7, 8, 9
- 7 blocks 8, 9, 10
- 8 blocks 9, 10
- 9 blocks 10, 11
- 10 blocks 11
- 11 feeds Final Verification Wave

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → `unspecified-high`, `deep`
- Wave 2 → 2 tasks → `deep`, `visual-engineering`
- Wave 3 → 2 tasks → `visual-engineering`, `unspecified-high`
- Wave 4 → 2 tasks → `unspecified-high`, `deep`
- Wave 5 → 1 task → `unspecified-high`
- Wave 6 → 1 task → `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Define workspace identity and placement contract

  **What to do**: Introduce the canonical data model for split-dock workspaces. Define distinct types/interfaces for `WorkspacePanelDescriptor`, `WorkspacePanelInstance`, `StableHostInstance`, `WorkspaceInstance`, `DockSlotAttachment`, `DockZoneId`, and placement/open/focus commands. Replace singleton side-panel mental model in type layer first, while preserving backward-compatible adapters until cutover. Include explicit host policy (`stable`, `remount-ok`) and multiplicity policy (`singleton`, `multi-instance`) in descriptors. Add focus-authority ownership semantics now so app bar and command/input routing do not invent them later. Document how chat, Firefly surfaces, widgets, and future PM/browser/editor panels map into this model.
  **Must NOT do**: Must NOT hardcode Dockview panel ids as canonical ids. Must NOT bake side-panel-only concepts into new state model. Must NOT change visible UI yet.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the core architecture contract and mistakes will poison later phases.
  - Skills: [`architecture-patterns`] — needed for clean separation of identity, placement, and runtime ownership.
  - Omitted: [`frontend-ui-ux`] — not needed for pure state/contract design.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 6, 7, 8, 9, 10, 11 | Blocked By: none

  **References**:
  - Pattern: `apps/desktop/src/renderer/atoms/ui.ts:33` — current singleton `PaneRoutingState` proves old routing shape must be replaced.
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:84` — current hardcoded dock ids show why logical ids and slot ids must diverge.
  - Pattern: `apps/desktop/src/renderer/firefly-surface-registry.tsx:47` — existing descriptor metadata available for evolution.
  - Pattern: `apps/desktop/src/renderer/lib/types.ts:185` — current `FireflySurfaceTarget` is hardwired to singleton side-panel semantics and must evolve.
  - Pattern: `apps/desktop/src/renderer/session-widget-registry.tsx:12` — widget registry shape to evolve alongside surfaces.
  - Pattern: `apps/desktop/src/renderer/atoms/session-widgets.ts:6` — existing internal widget zone model must be reconciled with new workspace placement model.
  - External: `https://dockview.dev/docs/core/state/save/` — layout persistence captures dock structure, not app-level logical identity.

  **Acceptance Criteria**:
  - [ ] New workspace contract types clearly distinguish descriptor, logical instance, host instance, workspace instance, and slot attachment.
  - [ ] Side-panel singleton assumptions are isolated behind compatibility adapters, not reused as canonical model.
  - [ ] Descriptor contract includes host policy and multiplicity policy.
  - [ ] Focus authority is represented explicitly in the contract.
  - [ ] Contract compiles cleanly via `bun run check-types`.

  **QA Scenarios**:
  ```
  Scenario: Contract compiles and replaces singleton assumptions
    Tool: Bash
    Steps: Run `bun run check-types`; inspect affected workspace state/types for logical instance, host instance, and slot attachment definitions.
    Expected: Type-check passes and source shows explicit separation of ids/placement semantics.
    Evidence: .sisyphus/evidence/task-1-workspace-contract.txt

  Scenario: Backward-compatible adapter still resolves old open-side-panel style callers
    Tool: Bash
    Steps: Search for `openSidePanelTab`, `sidePanelActiveTabAtom`, and related consumers after contract update; verify compatibility layer exists and no unresolved imports/types remain.
    Expected: Old callers compile through adapter path, with no broken references.
    Evidence: .sisyphus/evidence/task-1-workspace-contract-adapter.txt
  ```

  **Commit**: YES | Message: `feat(renderer): define split dock workspace contract` | Files: `apps/desktop/src/renderer/atoms/ui.ts`, `apps/desktop/src/renderer/lib/types.ts`, new workspace state/type files

- [x] 2. Build stable host runtime for protected panels

  **What to do**: Implement `StablePanelHostRuntime` in renderer scope. Hosts must mount once per `hostInstanceId`, survive zone moves, and expose attachment lifecycle (`attach`, `detach`, `visibility change`, `resize`). Define explicit host states (`detached`, `attaching`, `attached`, `suspended`, `unavailable`) and rules for when hidden zones keep hosts attached versus suspended. Build a transport abstraction named `SurfaceTransport` beneath the runtime, and ship `ReversePortalTransport` backed by `react-reverse-portal` as the default first implementation. Keep a feature-detectable future path for `MoveBeforeTransport` using `Element.moveBefore()` without changing surface code. Add lightweight instrumentation that detects/remembers remount of protected hosts and logs/fails in dev/test proof paths.
  **Must NOT do**: Must NOT rely on Dockview `renderer: "always"` as move-preservation mechanism. Must NOT physically remount protected subtree on zone transfer. Must NOT intermingle business surface logic with runtime core.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: tricky runtime/lifecycle system with correctness and performance implications.
  - Skills: [`architecture-patterns`] — needed to keep runtime generic and surface-agnostic.
  - Omitted: [`frontend-ui-ux`] — runtime-first task.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 4, 8, 10 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:413` — current key-based remount behavior to eliminate.
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:437` — current memoized panel component record is a second remount vector when content closures change.
  - Pattern: `apps/desktop/src/renderer/components/chat/chat-view.tsx:123` — chat has scroll/measurement behavior that must survive attachment changes.
  - Pattern: `apps/desktop/src/renderer/components/side-panel/editor-panel.tsx:24` — editor-like panel needs attach/resize lifecycle thought.
  - Pattern: `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:106` — browser panel owns iframe/lane state and is a candidate future protected host.
  - External: `https://dockview.dev/docs/core/panels/rendering/` — `renderer: "always"` only preserves hidden tabs, not cross-instance moves.

  **Acceptance Criteria**:
  - [ ] Protected host runtime can keep a mounted subtree alive while visible target attachment changes.
  - [ ] Runtime exposes explicit attach/detach/resize hooks.
  - [ ] Runtime includes dev/test observability for protected remount detection.
  - [ ] Runtime does not require Dockview to own heavy component lifetime.
  - [ ] Runtime host states and suspension rules are explicit and test-covered.
  - [ ] Runtime ships `SurfaceTransport` plus `ReversePortalTransport` as the default first implementation, or replaces them with an explicitly justified equivalent.

  **QA Scenarios**:
  ```
  Scenario: Protected host survives attachment move without remount
    Tool: Bash
    Steps: Run targeted renderer/unit test or harness that mounts a protected test host, reattaches it between two containers, and asserts mount count remains 1.
    Expected: Mount count stays 1; attachment target changes successfully.
    Evidence: .sisyphus/evidence/task-2-stable-host-runtime.txt

  Scenario: Resize and visibility lifecycle events fire on attachment changes
    Tool: Bash
    Steps: Run targeted harness/test that attaches protected host, toggles hidden/visible state, resizes container, and records lifecycle callbacks.
    Expected: Attach/detach/visibility/resize callbacks fire in expected order without remount.
    Evidence: .sisyphus/evidence/task-2-stable-host-lifecycle.txt
  ```

  **Commit**: YES | Message: `feat(renderer): add stable panel host runtime` | Files: new stable-host runtime files under `apps/desktop/src/renderer/components/workspace-dock/` or `lib/`

  **Implementation Note**: Default to `react-reverse-portal` first. Only replace it if implementation uncovers a concrete blocker around focus, iframe behavior, or attachment lifecycle that the runtime abstraction cannot mask cleanly.

- [x] 3. Evolve surface and widget registries into descriptor-backed host policies

  **What to do**: Refactor Firefly surface and session widget registries so canonical metadata remains in one place but no longer assumes “render immediately by `spawn()`/`render()`.” Add descriptor fields for host policy, multiplicity, logical kind, default zone, title/icon/availability adapters, and a runtime entrypoint descriptor separate from raw React render closures. Reuse and extend the existing `renderMode` seam in plugin surfaces instead of inventing a parallel policy model. Ensure plugin-catalog served surfaces integrate through the same descriptor path.
  **Must NOT do**: Must NOT duplicate manifest metadata in a new registry. Must NOT break plugin surface merge semantics or canonical ordering.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: substantial refactor across registry seams with strong type and compatibility constraints.
  - Skills: [`architecture-patterns`] — helpful for descriptor/runtime separation.
  - Omitted: [`frontend-ui-ux`] — no visual design emphasis.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5, 8, 10 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/src/renderer/firefly-surface-registry.tsx:62` — current `spawn` render-factory seam to replace/adapt.
  - Pattern: `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts:66` — existing `renderMode` discriminator is proto-host-policy and should be extended, not bypassed.
  - Pattern: `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts:89` — canonical merge path that must remain intact.
  - Pattern: `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx:172` — catalog surface tab construction to adapt into descriptor flow.
  - Pattern: `apps/desktop/src/renderer/session-widget-registry.tsx:17` — current widget `render` seam.

  **Acceptance Criteria**:
  - [ ] Firefly and widget registries emit canonical descriptors usable by host runtime.
  - [ ] Plugin/catalog surfaces participate in the same descriptor path.
  - [ ] Canonical order and availability logic remain unchanged unless explicitly intended.
  - [ ] Type-check and registry parity tests pass.

  **QA Scenarios**:
  ```
  Scenario: Registry parity remains intact after descriptor evolution
    Tool: Bash
    Steps: Run `bun test apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts apps/desktop/src/renderer/firefly-plugin-surface-merge.test.ts apps/desktop/src/renderer/firefly-plugin-surfaces.test.tsx`
    Expected: Existing registry parity and merge semantics still pass.
    Evidence: .sisyphus/evidence/task-3-registry-parity.txt

  Scenario: Descriptor path resolves built-in and plugin-served surfaces uniformly
    Tool: Bash
    Steps: Run targeted source audit or test harness for one built-in surface and one catalog-served surface to inspect descriptor output.
    Expected: Both produce normalized descriptor shape with host policy metadata.
    Evidence: .sisyphus/evidence/task-3-registry-descriptors.txt
  ```

  **Commit**: YES | Message: `refactor(renderer): normalize workspace panel descriptors` | Files: `firefly-surface-registry.tsx`, `firefly-plugin-surfaces.tsx`, `firefly-plugin-surface-merge.ts`, `session-widget-registry.tsx`

- [x] 4. Create reusable three-zone split dock shell and dock adapters

  **What to do**: Build `SplitDockWorkspaceShell` using nested split shell composition validated by prototype and external research. Use three initial zones (`main`, `right`, `bottom`) backed by adapter-managed dock surfaces, each likely implemented with its own Dockview instance. Shell owns zone geometry and visibility only; it consumes logical placements and attaches viewports from stable-host runtime. Replace the current imperative `addPanel()` + `DockPanel` wrapper flow with dock adapters that understand stable hosts and remount-safe slots. Add protected-panel policy at shell/dock adapter level so lone protected chat cannot be dragged into invalid state.
  **Must NOT do**: Must NOT reintroduce one monolithic Dockview tree. Must NOT let shell own content metadata. Must NOT use remount-prone keys for visibility changes.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: shell composition and Dockview integration are frontend-structural and spatial.
  - Skills: [`frontend-ui-ux`] — useful for turning prototype shape into coherent production shell without generic slop.
  - Omitted: [`architecture-patterns`] — less central once contract/runtime are defined.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 9, 10 | Blocked By: 1, 2, 3

  **References**:
  - Pattern: `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx:524` — prototype shell composition and zone structure.
  - Pattern: `ch5-packages/packages/workspace/contract/src/panes/index.ts:1` — reusable pane exports available.
  - Pattern: `apps/desktop/src/renderer/components/sidebar-layout.tsx:150` — existing outer sidebar shell that must remain outside session dock shell.
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:456` — current imperative Dockview panel creation flow to replace.
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:494` — current `DockPanel` wrapper is the concrete seam to supersede with host-aware dock adapters.
  - External: Grapefruit pattern summary — shell splitters outer, dock inner, separate persistence channels.

  **Acceptance Criteria**:
  - [ ] Session workspace renders `main`, `right`, and `bottom` dock zones under a reusable shell.
  - [ ] Toggling zone visibility does not remount protected hosts.
  - [ ] Dock adapters accept logical placements and viewports from runtime rather than raw surface render factories.
  - [ ] Protected drag constraints are enforced for invalid movements.

  **QA Scenarios**:
  ```
  Scenario: Three-zone shell renders and toggles without protected remount
    Tool: Bash
    Steps: Start app, open target session workspace, toggle right and bottom docks repeatedly while remount instrumentation is active.
    Expected: Shell responds correctly; protected host remount counter does not increase.
    Evidence: .sisyphus/evidence/task-4-shell-toggle.txt

  Scenario: Protected panel drag constraint blocks invalid orphaning
    Tool: Bash
    Steps: Attempt to drag the only protected main chat tab into an invalid state or empty orphan condition.
    Expected: Drag is prevented with expected overlay/behavior; workspace remains valid.
    Evidence: .sisyphus/evidence/task-4-protected-drag.txt
  ```

  **Commit**: YES | Message: `feat(renderer): add split dock workspace shell` | Files: new shell/dock adapter files, `agent-detail.tsx`

- [ ] 5. Extract or reauthor Dockview transfer bridge as placement-state bridge

  **What to do**: Implement cross-zone drag/transfer based on Dockview external drop events, but make the bridge modify placement/attachment state instead of creating/destroying heavy content. For remount-safe panels, bridge may still create/remove slot wrappers, but protected hosts must only change attachment target. Add clear MIME/descriptor validation, source/target zone guards, and future-safe support for clone-vs-move policy.
  **Must NOT do**: Must NOT use the Storybook `addPanel` + `close()` flow as actual content lifetime model. Must NOT allow transfer bridge to become source of truth for title/icon/payload.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: nuanced integration of drag events, placement state, and runtime semantics.
  - Skills: [`architecture-patterns`] — helps keep bridge thin and state-driven.
  - Omitted: [`frontend-ui-ux`] — secondary.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 8 | Blocked By: 3, 4

  **References**:
  - Pattern: `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx:629` — inspiration only for event hooks and drag payload structure.
  - External: `https://dockview.dev/docs/core/dnd/external/` — official cross-instance drag/drop pattern.
  - External: `https://dockview.dev/docs/core/events/` — `onWillDragPanel`, `onUnhandledDragOverEvent`, `onDidDrop`, move events.

  **Acceptance Criteria**:
  - [ ] Cross-zone transfer updates placement state without remounting protected hosts.
  - [ ] Drag payload validation prevents malformed/unsupported moves.
  - [ ] Bridge supports future extension for clone/new-instance semantics without redesign.
  - [ ] Bridge only changes Dockview slot placement or attachment target; it never recreates heavyweight surfaces.

  **QA Scenarios**:
  ```
  Scenario: Protected host moves across zones without remount
    Tool: Bash
    Steps: Drag protected chat panel from main to right/bottom test target while remount instrumentation is active.
    Expected: Placement updates, target zone shows host, remount counter remains unchanged.
    Evidence: .sisyphus/evidence/task-5-protected-transfer.txt

  Scenario: Invalid payload or unsupported move is rejected safely
    Tool: Bash
    Steps: Trigger malformed or unsupported transfer attempt via harness or guarded drag path.
    Expected: Move is rejected cleanly; source placement remains intact; no runtime error.
    Evidence: .sisyphus/evidence/task-5-transfer-guard.txt
  ```

  **Commit**: YES | Message: `feat(renderer): add state-driven dock transfer bridge` | Files: transfer bridge/runtime integration files

- [ ] 6. Replace singleton side-panel commands and APIs with logical panel placement routing

  **What to do**: Evolve command palette, backend open/focus APIs, and routing atoms so callers target logical panel actions (`focus existing`, `reveal in preferred zone`, `create new instance` where allowed) instead of “open side panel tab X.” Preserve compatibility for old side-panel callers via adapter mapping. Update UI state, command palette surface actions, and Palot bridge inputs accordingly.
  **Must NOT do**: Must NOT break existing external/plugin commands without compatibility layer. Must NOT keep canonical semantics tied to one global side panel.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting state/API/routing change with user-visible consequences.
  - Skills: [`architecture-patterns`] — useful for maintaining clear contracts.
  - Omitted: [`frontend-ui-ux`] — no visual novelty needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 8, 9 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/command-palette.tsx:689` — current surface commands still call `openSidePanelTab`.
  - Pattern: `apps/desktop/src/renderer/services/backend.ts:276` — current `openSidePanel` external contract.
  - Pattern: `apps/desktop/src/shared/palot-bridge-schemas.ts` and `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` — external schema surfaces that need evolution.

  **Acceptance Criteria**:
  - [ ] Command/API contract supports focus-existing vs create/reveal semantics by logical panel id.
  - [ ] Compatibility adapter preserves old side-panel open callers.
  - [ ] Command palette still exposes surface actions without broken behavior.
  - [ ] External schema migration/versioning path is explicit where bridge callers cannot upgrade atomically.

  **QA Scenarios**:
  ```
  Scenario: Command palette opens logical panel through placement routing
    Tool: Bash
    Steps: Open command palette, trigger open action for a registry-backed surface, inspect resulting logical panel placement/focus.
    Expected: Surface opens/focuses through new routing model; no singleton side-panel dependency required.
    Evidence: .sisyphus/evidence/task-6-command-routing.txt

  Scenario: Legacy open-side-panel caller still works through adapter
    Tool: Bash
    Steps: Trigger existing `openSidePanel` path via backend/bridge and inspect resulting logical panel reveal.
    Expected: Legacy caller resolves successfully via compatibility mapping.
    Evidence: .sisyphus/evidence/task-6-legacy-adapter.txt
  ```

  **Commit**: YES | Message: `refactor(renderer): route surfaces by logical placement` | Files: `command-palette.tsx`, `services/backend.ts`, shared schemas/manifests, related atoms

- [ ] 7. Scope app bar, focus ownership, and pane-bus registrations to host instances

  **What to do**: Replace assumptions of one globally viewed session and one app-bar payload. App bar must reflect focused host instance, not just current route. Pane-bus writer/submitter/handle registration must avoid collisions when two chat hosts for same or different sessions coexist. Update focus tokens, viewed-session semantics, and input ownership rules so each visible chat host is independently operable.
  **Must NOT do**: Must NOT leave global maps keyed only by session id where multiple hosts may coexist. Must NOT leave app bar “last mounted wins.”

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: focus and input ownership are correctness-critical and subtle.
  - Skills: [`architecture-patterns`] — helps keep host-instance ownership explicit.
  - Omitted: [`frontend-ui-ux`] — structure > visuals.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 8, 9, 10 | Blocked By: 1, 6

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/session-view.tsx:52` — current `viewedSessionIdAtom` write path.
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:158` — current app-bar content source.
  - Pattern: `apps/desktop/src/renderer/atoms/pane-bus.ts:16` — global writer/submitter maps likely to collide in multi-host world.
  - Pattern: `apps/desktop/src/renderer/components/app-bar.tsx:31` — current single app-bar context consumption.

  **Acceptance Criteria**:
  - [ ] Focused host instance drives app-bar content and command ownership.
  - [ ] Two visible chat hosts can coexist without pane-bus collisions.
  - [ ] Session-scoped actions route to correct host/session pair.

  **QA Scenarios**:
  ```
  Scenario: Two visible chat hosts keep independent input/focus ownership
    Tool: Bash
    Steps: Open two chat hosts from different sessions, focus each in turn, type draft text, invoke host-specific actions.
    Expected: Each host retains its own draft/focus context; actions route to focused host's session.
    Evidence: .sisyphus/evidence/task-7-multi-host-focus.txt

  Scenario: App bar follows focused host instead of last-mounted host
    Tool: Bash
    Steps: With two visible hosts open, change focus between them and observe app bar content/actions.
    Expected: App bar updates to match focused host consistently.
    Evidence: .sisyphus/evidence/task-7-app-bar-focus.txt
  ```

  **Commit**: YES | Message: `refactor(renderer): scope host focus and pane bus state` | Files: `session-view.tsx`, `app-bar-context.tsx`, `app-bar.tsx`, `pane-bus.ts`, related hooks

- [ ] 8. Cut over AgentDetail workspace to descriptor-driven split-dock shell

  **What to do**: Replace current `SessionDockviewShell` in `AgentDetail` with the new descriptor-driven three-zone workspace. Use stable-host runtime for protected chat, descriptor-backed placements for surfaces/widgets, and shell controls for right/bottom visibility. Preserve current session behaviors (send/approve/deny/fork/revert/delete) through existing session data flow while moving visual shell to new architecture.
  **Must NOT do**: Must NOT keep old remount-prone key-based dock shell. Must NOT leave old singleton side-panel path as active primary renderer for session workspaces.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: this is the main user-facing shell cutover.
  - Skills: [`frontend-ui-ux`] — useful to keep resulting shell coherent and intentional.
  - Omitted: [`architecture-patterns`] — architecture should already be decided by prior tasks.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 9, 10 | Blocked By: 2, 3, 5, 6, 7

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx:424` — current dock shell to replace.
  - Pattern: `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx:21` — current surface renderer to adapt/migrate.
  - Pattern: `apps/desktop/src/renderer/components/session-widgets/session-widget-shell.tsx:51` — current widget zone behavior that may conflict with right-dock design.

  **Acceptance Criteria**:
  - [ ] `AgentDetail` uses new split-dock shell as primary workspace renderer.
  - [ ] Protected chat no longer remounts on dock visibility or transfer changes.
  - [ ] Existing session actions remain functional.
  - [ ] Old key-driven remount shell path is removed or fully retired for primary session route.

  **QA Scenarios**:
  ```
  Scenario: AgentDetail shell cutover preserves session workflow
    Tool: Bash
    Steps: Open a session, send a message, toggle docks, move protected chat, interact with one surface and one widget-backed panel.
    Expected: Session workflow still works; shell uses three-zone model; no protected remount occurs.
    Evidence: .sisyphus/evidence/task-8-agent-detail-cutover.txt

  Scenario: Review/pulse/widget interactions still work after shell migration
    Tool: Bash
    Steps: Open representative registry-backed surfaces and widgets through new shell; verify content renders and actions remain usable.
    Expected: Registry-backed panels function after shell cutover.
    Evidence: .sisyphus/evidence/task-8-surface-widget-regression.txt
  ```

  **Commit**: YES | Message: `feat(renderer): migrate agent detail to split dock workspace` | Files: `agent-detail.tsx`, related shell/runtime wiring files

- [ ] 9. Add persistence, restore, and unavailable-panel fallback behavior

  **What to do**: Persist shell splits, dock layouts, logical panel instances, and placement state with clear ownership boundaries. Restore layouts per session/workspace while preserving host instance semantics. Define restore precedence explicitly: descriptor availability check -> logical instance restore -> host reuse eligibility -> dock slot reattachment. Implement safe fallback when a restored panel is unavailable (flag off, plugin removed, session missing): keep logical instance record where appropriate and show inert explanatory shell instead of silently dropping content. Version the persistence schema. Treat Dockview JSON as layout input only, never as logical identity authority.
  **Must NOT do**: Must NOT let shell and Dockview fight over same persistence boundary. Must NOT silently discard restored panels. Must NOT persist raw ephemeral slot ids as sole restore authority.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: persistence touches multiple state systems and restore edge cases.
  - Skills: [`architecture-patterns`] — useful for versioned schema/ownership boundaries.
  - Omitted: [`frontend-ui-ux`] — fallback shell copy only secondary.

  **Parallelization**: Can Parallel: YES | Wave 5 | Blocks: 10, 11 | Blocked By: 4, 6, 7, 8

  **References**:
  - Pattern: `apps/desktop/src/renderer/atoms/preferences.ts:47` — current preferences persistence too narrow.
  - Pattern: `apps/desktop/src/renderer/atoms/ui.ts:42` — current open/closed bit and last-tab model.
  - External: `https://dockview.dev/docs/core/state/save/` — Dockview `toJSON()`/`fromJSON()` scope and limitations.
  - External: resizable shell research — shell splits, visibility, and dock layouts should persist independently.

  **Acceptance Criteria**:
  - [ ] Layout restore brings logical instances back into correct zones/slots.
  - [ ] Unavailable restored panels render explanatory inert shells, not silent disappearance.
  - [ ] Persistence schema is versioned and bounded by clear shell-vs-dock ownership.
  - [ ] Restore precedence is documented and reflected in tests.
  - [ ] Dockview serialized layout stores only lightweight slot references; heavy surface state persists separately.

  **QA Scenarios**:
  ```
  Scenario: Workspace layout restores after relaunch
    Tool: Bash
    Steps: Arrange multi-zone workspace, persist layout, reload app/session view, inspect restored placements and focused tabs.
    Expected: Layout and logical instances restore correctly without protected remount surprises.
    Evidence: .sisyphus/evidence/task-9-layout-restore.txt

  Scenario: Restored unavailable panel shows inert explanatory shell
    Tool: Bash
    Steps: Persist a layout containing a panel, then disable/remove underlying surface availability and restore layout.
    Expected: Panel shell restores with explanation; app does not crash or silently drop it.
    Evidence: .sisyphus/evidence/task-9-unavailable-restore.txt
  ```

  **Commit**: YES | Message: `feat(renderer): persist split dock workspace layout` | Files: workspace state/persistence files, restore paths

- [ ] 10. Prove multi-session side-by-side chat readiness and graduate selected heavy surfaces

  **What to do**: Add explicit support for multiple visible chat hosts from different sessions, with independent focus/input state and shared underlying session streams. Verify whether browser/editor/terminal should also be promoted into protected stable-host class in initial release or clearly marked remount-safe. Add regression tests/harnesses for the heaviest supported classes. Update docs for architecture and operator debugging. Treat arbitrary clone/duplicate panel UX as a non-goal for first pass; only support move + reveal existing + create where descriptor multiplicity explicitly allows it.
  **Must NOT do**: Must NOT claim multi-session readiness without actual simultaneous-host proof. Must NOT leave host-instance collisions unresolved in pane-bus or app-bar.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: combines interaction model, session routing, performance, and proof.
  - Skills: [`architecture-patterns`] — for consistent host-instance scoping.
  - Omitted: [`frontend-ui-ux`] — behavior proof over style.

  **Parallelization**: Can Parallel: YES | Wave 6 | Blocks: 11 | Blocked By: 2, 3, 7, 8, 9

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/session-view.tsx:37` — current session-scoped view model.
  - Pattern: `apps/desktop/src/renderer/atoms/pane-bus.ts:28` — current scope model can inform new host-instance scoping.
  - Pattern: `apps/desktop/src/renderer/components/command-palette.tsx` — will need multi-session host-aware actions.
  - Architecture note: stable-host recommendation from Oracle review durable record.

  **Acceptance Criteria**:
  - [ ] Two visible chat hosts from different sessions work side by side with isolated input/focus and correct routing.
  - [ ] Heavy-surface classification is explicit and documented.
  - [ ] At least one additional heavy surface class is evaluated and either promoted or intentionally deferred with rationale.
  - [ ] Architecture docs reflect stable-host and multi-session constraints.
  - [ ] Surface-specific lifecycle handling is documented for chat, Monaco/editor, terminal, and browser/iframe classes.

  **QA Scenarios**:
  ```
  Scenario: Two session chats visible side by side
    Tool: Bash
    Steps: Open two different session chat hosts simultaneously, type distinct drafts, send messages from each, switch focus, and observe app bar/command routing.
    Expected: Sessions remain isolated; drafts and actions do not bleed; focused host owns controls.
    Evidence: .sisyphus/evidence/task-10-two-chat-hosts.txt

  Scenario: Heavy surface classification and behavior proof
    Tool: Bash
    Steps: Open chat plus one additional candidate heavy surface (browser/editor/terminal), move between zones, and inspect whether chosen host policy behaves as documented.
    Expected: Promoted heavy surface preserves required state, or deferred surface clearly remains remount-safe with documented rationale.
    Evidence: .sisyphus/evidence/task-10-heavy-surface-proof.txt
  ```

  **Commit**: YES | Message: `feat(renderer): prove multi-session split dock readiness` | Files: host/runtime routing files, docs/tests/harnesses

- [ ] 11. Harden verification, regression coverage, and operator docs

  **What to do**: Add focused tests and docs around the new workspace system: placement reducers/state, host runtime mount preservation, registry descriptor invariants, transfer bridge validation, persistence restore behavior, and host-focused routing. Update relevant architecture docs or add new durable docs explaining host runtime, logical identities, persistence schema, and debugging steps for focus/move/restore issues.
  **Must NOT do**: Must NOT leave stable-host behavior as implicit tribal knowledge. Must NOT rely only on manual proof for remount guarantees.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: docs plus targeted verification design.
  - Skills: [] — no specialized skill required beyond repo conventions.
  - Omitted: [`frontend-ui-ux`] — not a visual task.

  **Parallelization**: Can Parallel: NO | Wave 6 | Blocks: Final Verification Wave | Blocked By: 1, 9, 10

  **References**:
  - Pattern: `docs/genui-artifact-architecture.md` — good example of renderer-first durable architecture documentation.
  - Pattern: `docs/firefly-surface-playbook.md` — existing guidance around shell and registry path.
  - Tests: `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts`, `apps/desktop/src/renderer/firefly-plugin-surface-merge.test.ts`, `apps/desktop/src/renderer/lib/pane-routing.test.ts`

  **Acceptance Criteria**:
  - [ ] New workspace architecture has durable documentation in repo.
  - [ ] Targeted tests cover mount-preservation and placement semantics.
  - [ ] Operator/debugging docs include remount detection, focus routing, and restore troubleshooting.

  **QA Scenarios**:
  ```
  Scenario: Verification suite covers stable-host core invariants
    Tool: Bash
    Steps: Run targeted renderer/unit tests for placement reducers, host runtime, transfer bridge, and persistence restore.
    Expected: All targeted tests pass and cover no-remount/placement invariants.
    Evidence: .sisyphus/evidence/task-11-verification-suite.txt

  Scenario: Operator docs match implemented runtime
    Tool: Bash
    Steps: Read final architecture/debug docs and compare named runtime components/state with implemented files and exported symbols.
    Expected: Docs accurately describe runtime and troubleshooting path.
    Evidence: .sisyphus/evidence/task-11-operator-docs.txt
  ```

  **Commit**: YES | Message: `docs(renderer): document stable host split dock workspace` | Files: docs and targeted tests

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit after each coherent wave or sub-wave, especially after contract changes, runtime introduction, shell cutover, routing cutover, persistence, and multi-session proof.
- Keep commits aligned to architecture layers:
  - contract/state
  - host runtime
  - shell/adapter
  - routing/command/focus
  - persistence/restore
  - docs/tests/proof
- Do not batch unrelated surface migrations into one commit.

## Success Criteria
- Palot session workspaces use a three-zone split-dock shell.
- Protected chat hosts no longer remount during zone moves, visibility toggles, or shell resize.
- Registry truth remains canonical for built-in and plugin-contributed surfaces.
- Workspace routing no longer depends on a singleton side-panel model.
- Multi-session side-by-side chat is architecturally real and behaviorally proven.
- Layout persistence restores logical panels safely, including unavailable-panel fallbacks.
- Verification artifacts demonstrate no-remount behavior and correct multi-session routing.
