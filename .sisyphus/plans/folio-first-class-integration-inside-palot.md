# Folio First-Class Integration Inside Palot <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Make Folio feel native inside Palot by turning it from a federated sibling app into a bundled first-class plugin suite that registers semantic surfaces across the host. Start with the host-owned `nav-sidebar` surface and its `DiscreteTabs` switcher, then expand the same plugin architecture to full pages, settings sections, side-panels, commands, workspace widgets, and runtime/data bridges. This single plan now includes and supersedes the old `nav-sidebar-pluginify-folio.md` phase-1 slice.
>
> **Deliverables**:
> - Host-owned `nav-sidebar` shell with `DiscreteTabs` header and reusable built-in content body
> - Full Folio route/UI/surface inventory with exact file refs and tiering
> - Plugin schema/runtime evolution plan beyond current side-panel assumptions
> - Route/deeplink, provider, auth, runtime, and data bridge contracts
> - Settings, command palette, contextual side-panel, and page integration design
> - Bundled first-class Folio plugin packaging strategy inside Palot
> - Phased rollout from sidebar proof to full first-class citizenship
>
> **Estimated Effort**: XXL
> **Parallel Execution**: YES - 7 waves + final verification
> **Critical Path**: nav-sidebar foundation -> Folio inventory -> host taxonomy -> schema/runtime contract expansion -> route/provider integration -> bundled plugin packaging -> phased rollout proof

---

## Context

### Why This Plan Exists

Palot needs one canonical plan that gets all Folio integration done end-to-end. The prior split between a focused `nav-sidebar` plan and a broader master plan created execution ambiguity.

This plan merges both:
- phase 1: nav-sidebar proof and plugin tab model
- later phases: full page, settings, command, contextual panel, and runtime/data integration

### Supersession

This plan supersedes and absorbs:
- `~/src/ch5/palot/.sisyphus/plans/nav-sidebar-pluginify-folio.md`
- all earlier draft-only planning for sidebar-only Folio integration

Any future Folio surface work should reference this plan only.

### Original Request

Turn Folio into a deeply integrated first-class plugin inside Palot / Firefly client. Major Folio UIs should register as semantic host surfaces, not one-off embeds. `nav-sidebar` tabs are only the beginning; we also need full page, settings, command, and other integration points.

### Interview Summary

**Key Discussions**:
- User wants semantic naming, not positional naming. `nav-sidebar` chosen instead of `left-sidebar`.
- User wants one single plan and one `/start-work` target that gets the whole thing done.
- Full scope includes **all routes/pages/settings/workflows** in Folio, not just the first sidebar proof.
- Design direction: treat major Folio UIs as plugin-registered surface types, similar to how side-panels already behave as a tabbed host surface family.
- Folio should run inside the Palot repo as a bundled first-class plugin suite.

### Research Findings

**Palot-side**:
- Current left sidebar shell/body seam: `apps/desktop/src/renderer/components/sidebar-layout.tsx` + `apps/desktop/src/renderer/components/sidebar.tsx`
- Sidebar override seam already exists via `apps/desktop/src/renderer/components/sidebar-slot-context.tsx`, but it is route-owned, not plugin-catalog-owned.
- Current plugin V2 contracts live in:
  - `apps/desktop/src/shared/firefly-plugin/manifest.ts`
  - `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`
  - `apps/desktop/src/shared/firefly-plugin/descriptor.ts`
  - `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`
- Current plugin projections are specialized around:
  - `panels`
  - `widgets`
  - `commands`
  - `themes`
  - `components`
- Existing `panels` semantics are biased toward current right-side side-panel model and should not be blindly overloaded.
- Current side-panel vocabulary is a static/closed trap:
  - `apps/desktop/src/renderer/atoms/ui.ts`
  - `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`
- Existing migration doctrine says left nav sidebar is host chrome today and cannot simply become plugin-owned wholecloth:
  - `apps/desktop/src/shared/firefly-plugin/first-party-migration.ts:477`
- Existing plugin renderer consumption examples:
  - `apps/desktop/src/main/firefly-plugin/catalog.ts`
  - `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`
  - `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`

**Shared UI / Storybook**:
- Shared `DiscreteTabs` source:
  - `~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx`
- Shared story:
  - `~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.stories.tsx`
- Shared Storybook runtime used for proof:
  - `http://127.0.0.1:10616`

**Folio-side**:
- Folio explicitly frames Firefly host-shell work as belonging in Palot:
  - `~/src/ch5/folio-db/README.md`
- Folio route identity is query-param driven today:
  - `~/src/ch5/folio-db/apps/web/src/documents/route.ts`
- Major UI/workflow signals already proved by tests and sources:
  - workspace shell with sidebar + breadcrumbs: `~/src/ch5/folio-db/tests/e2e/shell-facade-smoke.spec.ts`
  - database table workflow: `~/src/ch5/folio-db/tests/e2e/qa-gate.spec.ts`
  - document/editor workflow: `~/src/ch5/folio-db/tests/e2e/qa-gate.spec.ts`
  - page-to-page sidebar navigation: `~/src/ch5/folio-db/tests/e2e/qa-gate.spec.ts`
  - workspace home: `~/src/ch5/folio-db/apps/web/src/components/WorkspaceHome.tsx`
  - document families / editor: `~/src/ch5/folio-db/apps/web/src/documents/BaseDocumentPage.tsx`, `EditorSurface.tsx`, family page variants
  - database surface and views: `~/src/ch5/folio-db/apps/web/src/databases/table/FolioTable.tsx`, `~/src/ch5/folio-db/apps/web/src/databases/views/ViewSwitcher.tsx`
  - backlinks/comment contextual surfaces: `~/src/ch5/folio-db/apps/web/src/documents/BacklinksPanel.tsx`, `~/src/ch5/folio-db/apps/web/src/components/CommentPanel.tsx`
  - auth/admin surfaces: `~/src/ch5/folio-db/apps/web/src/auth/AuthPage.tsx`, `~/src/ch5/folio-db/apps/web/src/components/OrgAdminPanel.tsx`
  - local-first cache + durable doc state: `~/src/ch5/folio-db/apps/web/src/documents/useDurableDocument.ts`, `local-cache.ts`
  - API client seam: `~/src/ch5/folio-db/packages/client/src/index.ts`
  - sync/runtime seam: `~/src/ch5/folio-db/packages/sync/src/index.ts`
  - backend route groups: `~/src/ch5/folio-db/apps/api/src/trpc/routes/{workspace,documents,databases,links,organizations,auth,health}.ts`

### Metis Review

**Identified Gaps** (addressed):
- Need one merged plan, not two separate execution targets.
- Need semantic host surface taxonomy beyond current side-panel semantics.
- Need explicit route/deeplink contract between Palot host route and Folio inner route identity.
- Need provider/runtime/data/auth ownership matrix so integration does not become implicit glue.
- Need settings, commands, and contextual side-panels included up-front, not deferred invisibly.
- Need runtime/background/data-bridge layer treated as first-class work, not implementation afterthought.
- Need phase ordering that starts with nav-sidebar proof but clearly continues through full Folio citizenship.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->

Embed all major Folio user-facing surfaces inside Palot through semantic plugin host surfaces so Folio feels native, routable, inspectable, persistent, and operationally safe inside the Firefly client without surrendering host authority.

### Concrete Deliverables <!-- oc:id=sec_ae -->

- Host-owned `nav-sidebar` header + content outlet in `apps/desktop/src/renderer/components/sidebar-layout.tsx`
- Reusable built-in nav-sidebar body component extracted from current sidebar implementation
- Full Folio route/UI/surface inventory with exact file refs and tiering
- Semantic host surface taxonomy for Folio inside Palot
- Plugin schema/runtime evolution plan beyond current `panels/widgets/commands/themes/components`
- Explicit host route + Folio route identity contract
- Provider/runtime/data/auth/storage ownership matrix
- Settings, command palette, and side-panel integration design
- Bundled Folio plugin packaging strategy inside Palot
- Phased rollout from sidebar proof to full first-class citizenship

### Definition of Done <!-- oc:id=sec_af -->

- [x] Existing Palot left sidebar is converted into a host-owned `nav-sidebar` shell with a top `DiscreteTabs` switcher
- [x] Built-in sidebar content becomes tab one and duplicate tab two proves shared outlet switching
- [x] Every major Folio route/page/settings/workflow family is inventoried
- [x] Every inventoried Folio surface is mapped to a semantic Palot host surface type
- [x] Schema/runtime evolution path is specified with exact Palot files to change
- [x] Route/deeplink model is explicit enough to implement without guesswork
- [x] Provider/runtime/data/auth/storage ownership is explicit
- [x] Settings, commands, contextual side-panels, and page surfaces are included in first-class architecture
- [x] Bundled Folio plugin packaging strategy is explicit and reusable
- [x] Verification plan proves full first-class citizenship, not just compilation or one sidebar tab

### Must Have <!-- oc:id=sec_ag -->

- Semantic host surface taxonomy (`nav-sidebar`, `page`, `settings-section`, etc.)
- Host chrome ownership preserved everywhere
- Folio route identity preserved as canonical inner content identity
- Host route authority preserved as outer navigation authority
- Explicit provider ownership matrix
- Explicit fail-loud runtime model
- Bounded rollout tiers from proof to full parity
- Reusable architecture for future bundled apps, not Folio-only hacks

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->

- Do not treat Folio as iframe-first or browser-embed-first architecture
- Do not overload current right-side `side-panel` semantics to stand in for all future surfaces
- Do not collapse host route and Folio route identity into one ambiguous string model
- Do not let plugins own Palot host chrome, sidebar shell, settings shell, or page shell
- Do not make Folio a permanent special-case code path outside normal plugin/catalog authority
- Do not hide auth/runtime/storage assumptions behind “adapter later” placeholders
- Do not interpret duplicate-tab proof as equivalent to full Folio architecture

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Bun test + Folio E2E evidence + Palot schema/runtime tests + Storybook proof where applicable
- **Storybook proof**: shared Storybook in `~/src/ch5/ch5-packages`; Folio also has local Storybook surface inventory in `~/src/ch5/folio-db/apps/storybook/stories`

### QA Policy
Every task below includes executable QA scenarios and evidence targets. Evidence path convention:
`.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`

- **Folio inventory**: grep/read/test-file audits
- **Schema/runtime**: Bun tests on manifest/descriptor/projection/catalog modules
- **UI integration**: agent-browser + local Palot runtime + Storybook proof surfaces
- **Runtime/data**: explicit fail-loud checks + adapter contract review

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

```text
Wave 1 (nav-sidebar foundation)
├── T1 Host nav-sidebar architecture note + source map
├── T2 Extract built-in sidebar inner/body seam design
├── T3 Define nav-sidebar manifest/schema contract
├── T4 Define nav-sidebar projection/runtime contract
├── T5 Storybook/discrete-tabs embedding spec
└── T6 Host nav-sidebar state model + persistence

Wave 2 (host shell proof)
├── T7 Host nav-sidebar header shell with DiscreteTabs
├── T8 Built-in sidebar body extraction + wrapper design
├── T9 Temporary duplicate second-tab proof path
├── T10 Host availability/fallback/error UX for nav-sidebar tabs
├── T11 Telemetry / focus / keyboard model
└── T12 Local nav-sidebar proof verification

Wave 3 (Folio inventory + host taxonomy)
├── T13 Route and page inventory
├── T14 Workspace shell and nav inventory
├── T15 Settings/admin surface inventory
├── T16 Runtime/provider/service inventory
├── T17 Host surface taxonomy draft
└── T18 MVP-vs-full integration tiering

Wave 4 (schema and host contract design)
├── T19 Surface-family architecture decision
├── T20 page surface contract
├── T21 settings-section contract
├── T22 side-panel/contextual surface contract
├── T23 command/action contract
└── T24 background-service/data-bridge contract

Wave 5 (routing, identity, and provider boundaries)
├── T25 Host route + Folio route identity contract
├── T26 Breadcrumb/history/deeplink model
├── T27 Provider ownership matrix
├── T28 Auth/session bridge contract
├── T29 API/storage/cache/sync bridge contract
└── T30 Failure-state and fail-loud runtime model

Wave 6 (surface-by-surface integration design)
├── T31 Workspace shell integration design
├── T32 Document/page surface integration design
├── T33 Database/view surface integration design
├── T34 Settings/admin integration design
├── T35 Command palette and keyboard integration design
└── T36 Contextual side-panel integration design

Wave 7 (packaging, safety, and rollout)
├── T37 Bundled plugin packaging strategy
├── T38 Capability, crash-isolation, and telemetry model
├── T39 Phase rollout plan
├── T40 Verification matrix and proof plan
└── T41 Future bundled-app generalization

Wave FINAL
├── F1 Master-plan compliance audit
├── F2 Schema/runtime architecture review
├── F3 Surface-coverage review against Folio inventory
└── F4 Scope fidelity and one-plan audit
```

### Dependency Matrix <!-- oc:id=sec_ak -->

- **T1**: — -> T6, T8
- **T2**: — -> T8, T9
- **T3**: — -> T4, T19, T37
- **T4**: — -> T10, T19, T37
- **T5**: — -> T7, T12
- **T6**: T1 -> T7, T9, T11
- **T7**: T5, T6 -> T9, T10, T12
- **T8**: T1, T2 -> T9, T37
- **T9**: T6, T7, T8 -> T12
- **T10**: T4, T7 -> T12, T38
- **T11**: T6 -> T12, T38
- **T12**: T7, T9, T10, T11 -> T39, FINAL
- **T13**: — -> T18, T25, T32, T33
- **T14**: — -> T17, T31, T35
- **T15**: — -> T21, T34
- **T16**: — -> T24, T27, T28, T29, T30
- **T17**: — -> T19, T20, T21, T22, T23, T24
- **T18**: T13 -> T39
- **T19**: T17 + T3/T4 -> T20, T21, T22, T23, T24, T37
- **T20**: T17, T19 -> T25, T32, T37
- **T21**: T15, T17, T19 -> T34, T37
- **T22**: T17, T19 -> T36, T37
- **T23**: T17, T19 -> T35, T37
- **T24**: T16, T17, T19 -> T28, T29, T37, T38
- **T25**: T13, T20 -> T26, T32, T33
- **T26**: T25 -> T31, T32, T33, T35
- **T27**: T16 -> T28, T29, T37
- **T28**: T16, T24, T27 -> T37, T38
- **T29**: T16, T24, T27 -> T37, T38, T40
- **T30**: T16, T24 -> T38, T40
- **T31**: T14, T26 -> T39, T40
- **T32**: T13, T20, T25, T26 -> T39, T40
- **T33**: T13, T25, T26 -> T39, T40
- **T34**: T15, T21 -> T39, T40
- **T35**: T14, T23, T26 -> T39, T40
- **T36**: T22 -> T39, T40
- **T37**: T19, T20, T21, T22, T23, T24, T27, T28, T29 -> T38, T39, T40, T41
- **T38**: T10, T11, T24, T28, T29, T30, T37 -> T40, FINAL
- **T39**: T12, T18, T31, T32, T33, T34, T35, T36, T37 -> FINAL
- **T40**: T29, T30, T31, T32, T33, T34, T35, T36, T37, T38 -> FINAL
- **T41**: T37, T39, T40 -> FINAL

### Agent Dispatch Summary <!-- oc:id=sec_al -->

- **Wave 1-2**: nav-sidebar foundation/proof -> `visual-engineering` + `deep`
- **Wave 3**: inventory/taxonomy -> `unspecified-high` + `deep`
- **Wave 4-5**: contracts/runtime -> `deep`
- **Wave 6**: surface integration design -> `deep` with `visual-engineering` for UI-heavy surfaces
- **Wave 7**: packaging/safety/rollout -> `deep` / `writing`
- **Final**: F1 -> `oracle`; F2/F3/F4 -> `deep`

---

## TODOs

- [x] 1. Host nav-sidebar architecture note + source map

  **What to do**:
  - Document exact host-owned files and current authority boundaries for sidebar shell, sidebar body, collapse state, route slot override, and app-bar interaction.
  - Name the future stable seams: host shell, built-in content provider, plugin contribution outlet, persistence layer.
  - Record why `nav-sidebar` is semantic host vocabulary, not positional CSS naming.

  **Must NOT do**:
  - Do not merge this with broader page/runtime schema work.
  - Do not assume plugin family shape before reading current host-only migration notes.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`
  - `apps/desktop/src/renderer/components/sidebar.tsx`
  - `apps/desktop/src/renderer/components/sidebar-slot-context.tsx`
  - `apps/desktop/src/shared/firefly-plugin/first-party-migration.ts:477`

  **Acceptance Criteria**:
  - [x] Architecture note names shell/body/outlet/persistence seams with file refs.
  - [x] Host-only authority boundary is explicit and aligns with migration note.

  **QA Scenarios**:
  ```text
  Scenario: Architecture seams are fully mapped
    Tool: Bash (grep/read)
    Steps:
      1. Read cited files and verify each seam exists where documented
      2. Compare host-only rationale in first-party-migration.ts with proposed seam note
      3. Assert no seam is described without a concrete file/type reference
    Expected Result: every seam has exact file proof and no authority ambiguity remains
    Evidence: .sisyphus/evidence/task-1-seam-map.md
  ```

  **Commit**: NO

- [x] 2. Extract built-in sidebar inner/body seam design

  **What to do**:
  - Identify which pieces of current `AppSidebarContent` should become reusable inner body vs host wrapper/header/footer.
  - Define a reusable built-in body unit that can render both tab one and temporary duplicate tab two.
  - Preserve current interactions: section expansion, search, rename/delete/pin/fork actions, settings footer, server indicator behavior.

  **Must NOT do**:
  - Do not redesign actual sidebar information architecture.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **References**:
  - `apps/desktop/src/renderer/components/sidebar.tsx`
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`

  **Acceptance Criteria**:
  - [x] Exact extraction boundary defined for reusable built-in inner content.
  - [x] All existing sidebar user actions are accounted for in extracted interface.

  **QA Scenarios**:
  ```text
  Scenario: Built-in body preserves all current capabilities
    Tool: Bash (read checklist)
    Steps:
      1. Enumerate current sidebar actions from sidebar.tsx
      2. Map each action to extracted body props/context dependency
      3. Assert no feature is lost in decomposition
    Expected Result: 1:1 mapping between current features and extracted body contract
    Evidence: .sisyphus/evidence/task-2-body-contract.md
  ```

  **Commit**: NO

- [x] 3. Define nav-sidebar manifest/schema contract

  **What to do**:
  - Decide and document semantic contract shape for plugin-declared nav-sidebar contributions.
  - Recommended path: add a new contribution family `navSidebars` or a new discriminated `surface` kind, instead of overloading `panels`.
  - Define ids, titles, icon names, ordering hints, default state, persistence key semantics, render modes, capability gates, activation triggers, and host-owned chrome constraints.

  **Must NOT do**:
  - Do not overload `defaultZone: side-panel` to mean nav-sidebar.
  - Do not let nav-sidebar contribution ids depend on `SidePanelTabId`.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/shared/firefly-plugin/manifest.ts`
  - `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`
  - `apps/desktop/src/shared/firefly-plugin/descriptor.ts`

  **Acceptance Criteria**:
  - [x] Chosen contract documented with rationale against overloading existing panels.
  - [x] Host-owned chrome constraint explicitly encoded.

  **QA Scenarios**:
  ```text
  Scenario: nav-sidebar contract is semantically distinct from side-panel
    Tool: Bash (read/compare)
    Steps:
      1. Compare nav-sidebar contract fields against current panel contract
      2. Verify no field reuses side-panel-only vocabulary unchanged
    Expected Result: nav-sidebar semantics stand on their own
    Evidence: .sisyphus/evidence/task-3-nav-sidebar-contract.md
  ```

  **Commit**: NO

- [x] 4. Define nav-sidebar projection/runtime contract

  **What to do**:
  - Specify how manifest data becomes descriptor data, then projected renderer data, then host-renderable tab descriptors.
  - Define capability/availability state shape, collision handling, and projection ids for nav-sidebar contributions.
  - Decide how nav-sidebar entries live in catalog summaries and preload inspection APIs.

  **Must NOT do**:
  - Do not copy side-panel merge logic unchanged.
  - Do not depend on static canonical tab order as a closed enum.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/main/firefly-plugin/catalog.ts`
  - `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`
  - `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`
  - `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`

  **Acceptance Criteria**:
  - [x] Projection pipeline documented from manifest to renderer tab descriptor.
  - [x] Collision policy for duplicate nav-sidebar ids/order explicitly defined.

  **QA Scenarios**:
  ```text
  Scenario: Projection pipeline is end-to-end complete
    Tool: Bash (read)
    Steps:
      1. Walk manifest -> descriptor -> catalog -> renderer path in the spec
      2. Verify each stage names exact files/types to edit
    Expected Result: executor can implement without re-planning dataflow
    Evidence: .sisyphus/evidence/task-4-projection-pipeline.md
  ```

  **Commit**: NO

- [x] 5. Storybook/discrete-tabs embedding spec

  **What to do**:
  - Define compact nav-sidebar header usage of `DiscreteTabs`: size, container chrome, icon/label behavior, active-tab callback, spacing, overflow, and reduced-motion expectations.
  - Record how header should look in narrow/collapsed sidebar states.

  **Must NOT do**:
  - Do not turn Storybook story wrapper chrome into production UI verbatim without adaptation.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **References**:
  - `~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx`
  - `~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.stories.tsx`

  **Acceptance Criteria**:
  - [x] Header embedding spec includes size/container/responsive behavior.
  - [x] Reduced-motion and collapsed-sidebar behavior defined.

  **QA Scenarios**:
  ```text
  Scenario: DiscreteTabs production embedding is specified, not guessed
    Tool: Bash (read source/story)
    Steps:
      1. Verify spec cites actual props/behavior from discrete-tabs.tsx
      2. Verify size choice and container chrome are adapted for nav-sidebar width
    Expected Result: embedding plan matches source capabilities and host context
    Evidence: .sisyphus/evidence/task-5-discrete-tabs-spec.md
  ```

  **Commit**: NO

- [x] 6. Host nav-sidebar state model + persistence

  **What to do**:
  - Define nav-sidebar open/active-tab/persisted-preference atoms or equivalent host state.
  - Separate nav-sidebar state from current side-panel state model.
  - Define persistence keys and default-active behavior when plugin tabs appear/disappear.

  **Must NOT do**:
  - Do not piggyback on `sidePanelActiveTabAtom`.
  - Do not persist temporary duplicate tab id in a way that blocks future plugin replacement.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/renderer/atoms/ui.ts`
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`

  **Acceptance Criteria**:
  - [x] Distinct nav-sidebar state model documented.
  - [x] Dynamic tab disappearance/arrival behavior specified.

  **QA Scenarios**:
  ```text
  Scenario: nav-sidebar state is independent from side-panel state
    Tool: Bash (read)
    Steps:
      1. Compare proposed atoms/state to existing sidePanel atoms
      2. Assert no type alias or persistence key reuse
    Expected Result: clean state separation
    Evidence: .sisyphus/evidence/task-6-state-separation.md
  ```

  **Commit**: NO

- [x] 7. Host nav-sidebar header shell with DiscreteTabs

  **What to do**:
  - Design host-owned top header component that renders `DiscreteTabs` above nav-sidebar outlet.
  - Include built-in tab plus dynamic contribution tabs.
  - Define width, borders, padding, focus ring, and collapsed-state behavior.

  **Must NOT do**:
  - Do not let plugins inject arbitrary tab-shell layout.
  - Do not place tab shell in app-bar.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **References**:
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`
  - `~/src/ch5/ch5-packages/packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx`

  **Acceptance Criteria**:
  - [x] Header shell placement and styling spec complete.
  - [x] Dynamic tab list contract for host shell documented.

  **QA Scenarios**:
  ```text
  Scenario: Header shell lives in host sidebar, not global chrome
    Tool: Bash (read layout spec)
    Steps:
      1. Verify insertion point is inside sidebar shell above content outlet
      2. Verify app-bar remains unchanged except optional later affordances
    Expected Result: nav-sidebar shell location unambiguous
    Evidence: .sisyphus/evidence/task-7-shell-placement.md
  ```

  **Commit**: NO

- [x] 8. Built-in sidebar body extraction + wrapper design

  **What to do**:
  - Specify concrete component extraction from current sidebar file into reusable built-in nav-sidebar body.
  - Keep host header/tab shell outside; keep content body reusable for tab one and temporary duplicate tab two.

  **Must NOT do**:
  - Do not duplicate sidebar business logic in two components.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **References**:
  - `apps/desktop/src/renderer/components/sidebar.tsx`
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`

  **Acceptance Criteria**:
  - [x] Reusable body extraction plan names exact component boundaries and props.

  **QA Scenarios**:
  ```text
  Scenario: Built-in body extraction avoids duplicated logic
    Tool: Bash (read)
    Steps:
      1. Verify one shared body component serves both default and duplicate tab
      2. Verify no copied session/project action logic remains in wrapper
    Expected Result: single source of truth for built-in body behavior
    Evidence: .sisyphus/evidence/task-8-single-body-plan.md
  ```

  **Commit**: NO

- [x] 9. Temporary duplicate second-tab proof path

  **What to do**:
  - Define temporary second tab as separate contribution id rendering the same built-in body through the new outlet.
  - Make this path architecturally identical to future plugin tab switching so later replacement is surgical.

  **Must NOT do**:
  - Do not special-case second tab in a way future plugin path cannot reuse.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Acceptance Criteria**:
  - [x] Duplicate tab path uses same outlet/selection machinery as future plugin tabs.

  **QA Scenarios**:
  ```text
  Scenario: Duplicate tab proves switching architecture, not throwaway branch
    Tool: Bash (read)
    Steps:
      1. Verify second tab is modeled as contribution-like item with id/label/icon/renderer
      2. Verify active-tab switch uses shared rendering outlet
    Expected Result: future plugin replacement requires swapping source item only
    Evidence: .sisyphus/evidence/task-9-duplicate-proof.md
  ```

  **Commit**: NO

- [x] 10. Host availability/fallback/error UX for nav-sidebar tabs

  **What to do**:
  - Define UX for disabled, quarantined, unavailable, or crashing nav-sidebar plugin tabs.
  - Specify whether unavailable tabs stay visible/disabled or hide.
  - Provide exact host-owned empty/error states.

  **Must NOT do**:
  - Do not silently remove user-selected tab without fallback messaging.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`
  - `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`

  **Acceptance Criteria**:
  - [x] Behavior for disabled/quarantined/error states fully documented.

  **QA Scenarios**:
  ```text
  Scenario: Error-state UX is deterministic
    Tool: Bash (state matrix)
    Steps:
      1. Enumerate plugin disabled, quarantined, render crash, capability missing, unloaded
    Expected Result: each state has visible host behavior and fallback target
    Evidence: .sisyphus/evidence/task-10-error-state-matrix.md
  ```

  **Commit**: NO

- [x] 11. Telemetry / focus / keyboard model

  **What to do**:
  - Define telemetry namespace, tab-switch events, plugin render crash events, persistence restore events.
  - Define keyboard navigation and focus-restoration behavior for nav-sidebar tab switching.

  **Must NOT do**:
  - Do not inherit side-panel-specific hotkeys unless intentionally chosen.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx`
  - `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`

  **Acceptance Criteria**:
  - [x] Telemetry and focus rules specified.

  **QA Scenarios**:
  ```text
  Scenario: Telemetry events cover key lifecycle points
    Tool: Bash (read)
    Steps:
      1. Verify open, switch, fallback, crash, restore events are all named
    Expected Result: event coverage is complete
    Evidence: .sisyphus/evidence/task-11-telemetry.md
  ```

  **Commit**: NO

- [x] 12. Local nav-sidebar proof verification

  **What to do**:
  - Define integrated proof path for host shell, built-in tabs, duplicate second tab, and shared outlet switching.

  **Must NOT do**:
  - Do not rely only on unit tests or manifest parsing.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Acceptance Criteria**:
  - [x] Integrated nav-sidebar smoke path fully specified with exact checks/evidence.

  **QA Scenarios**:
  ```text
  Scenario: Built-in nav-sidebar tabs switch in runtime
    Tool: agent-browser / local app surface
    Steps:
      1. Open Palot main surface
      2. Locate nav-sidebar header tablist
      3. Click built-in tab one and tab two
      4. Assert same body content switches through same outlet and no layout collapse occurs
    Expected Result: switching works with stable shell
    Evidence: .sisyphus/evidence/task-12-built-in-switch.png
  ```

  **Commit**: NO

- [x] 13. Route and page inventory

  **What to do**:
  - Inventory every major Folio route identity and primary page/view family.
  - Cover workspace home, document/page routes, database routes, sheet/row-adjacent routes, auth/admin/settings flows.
  - Produce exact source map with file refs and current UX purpose.

  **Must NOT do**:
  - Do not stop at API routes only.
  - Do not treat Storybook stories as substitute for live route inventory.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **References**:
  - `~/src/ch5/folio-db/apps/web/src/documents/route.ts`
  - `~/src/ch5/folio-db/tests/e2e/qa-gate.spec.ts`
  - `~/src/ch5/folio-db/tests/e2e/shell-facade-smoke.spec.ts`
  - `~/src/ch5/folio-db/README.md`

  **Acceptance Criteria**:
  - [x] Every major Folio route/page family is listed with exact file refs.
  - [x] Each route is tagged as MVP, later, or unsupported for first-class Palot integration.

  **QA Scenarios**:
  ```text
  Scenario: Route inventory is exhaustive enough for architecture work
    Tool: Bash (grep/read)
    Steps:
      1. Read route.ts, e2e route tests, and key page entry files
      2. Build route family table with exact file refs
      3. Assert every route family referenced in tests has a matching row in the inventory
    Expected Result: no route family appears in evidence without inventory coverage
    Evidence: .sisyphus/evidence/task-13-route-inventory.md
  ```

  **Commit**: NO

- [x] 14. Workspace shell and nav inventory

  **What to do**:
  - Inventory Folio workspace shell, sidebar/tree, breadcrumbs, workspace home, and navigation primitives.
  - Identify what should become `nav-sidebar` content vs what should become `page` or host breadcrumb/navigation state.

  **Must NOT do**:
  - Do not assume Folio sidebar can be copied wholesale into Palot without decomposition.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **References**:
  - `~/src/ch5/folio-db/tests/e2e/shell-facade-smoke.spec.ts`
  - `~/src/ch5/folio-db/apps/web/src/components/WorkspaceHome.tsx`
  - `~/src/ch5/folio-db/apps/storybook/stories/Sidebar.stories.tsx`
  - `~/src/ch5/folio-db/apps/storybook/stories/Shell.stories.tsx`

  **Acceptance Criteria**:
  - [x] Workspace shell pieces are split into host-owned chrome vs Folio-owned content/navigation.

  **QA Scenarios**:
  ```text
  Scenario: Shell decomposition is explicit
    Tool: Bash (read)
    Steps:
      1. List shell components and their ownership
      2. Verify no shell element is left unclassified
    Expected Result: host-vs-folio shell split is explicit
    Evidence: .sisyphus/evidence/task-14-shell-inventory.md
  ```

  **Commit**: NO

- [x] 15. Settings/admin surface inventory

  **What to do**:
  - Inventory Folio auth, organizations, admin, workspace settings, runtime settings, and other operator surfaces.
  - Group into future `settings-section`, `page`, or `command` targets.

  **Must NOT do**:
  - Do not bury settings in “later maybe” bucket without explicit rationale.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **References**:
  - `~/src/ch5/folio-db/apps/api/src/trpc/routes/auth.ts`
  - `~/src/ch5/folio-db/apps/api/src/trpc/routes/organizations.ts`
  - `~/src/ch5/folio-db/apps/web/src/auth/AuthPage.tsx`
  - `~/src/ch5/folio-db/apps/web/src/components/OrgAdminPanel.tsx`

  **Acceptance Criteria**:
  - [x] All major settings/admin surfaces are mapped to host integration targets.

  **QA Scenarios**:
  ```text
  Scenario: Settings/admin coverage is complete
    Tool: Bash (grep/read)
    Steps:
      1. Gather auth/org/admin entry files
      2. Map each to settings-section/page/command
      3. Assert no admin/auth surface lacks a target family
    Expected Result: complete settings/admin inventory
    Evidence: .sisyphus/evidence/task-15-settings-admin.md
  ```

  **Commit**: NO

- [x] 16. Runtime, provider, and service inventory

  **What to do**:
  - Inventory provider stacks, auth/session systems, API client seams, local cache, sync/realtime, storage, background services.
  - Tag each as host-owned, Folio-owned, or adapter-owned.

  **Must NOT do**:
  - Do not leave provider ownership implicit.
  - Do not ignore local-first cache/runtime behavior.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - `~/src/ch5/folio-db/README.md`
  - `~/src/ch5/folio-db/apps/web/src/documents/useDurableDocument.ts`
  - `~/src/ch5/folio-db/apps/web/src/documents/local-cache.ts`
  - `~/src/ch5/folio-db/packages/client/src/index.ts`
  - `~/src/ch5/folio-db/packages/sync/src/index.ts`

  **Acceptance Criteria**:
  - [x] Every major provider/service is ownership-classified.
  - [x] Hidden singleton collision risks are called out.

  **QA Scenarios**:
  ```text
  Scenario: Provider inventory covers critical runtime seams
    Tool: Bash (read)
    Steps:
      1. Enumerate providers/stores/services from source files
      2. Assign ownership tag to each
      3. Flag unclassified items as failures
    Expected Result: complete provider/runtime ownership matrix
    Evidence: .sisyphus/evidence/task-16-provider-matrix.md
  ```

  **Commit**: NO

- [x] 17. Host surface taxonomy draft

  **What to do**:
  - Define semantic host surface taxonomy for Folio inside Palot:
    - `nav-sidebar`
    - `page`
    - `settings-section`
    - `side-panel`
    - `command`
    - `workspace-widget`
    - `background-service`
    - `data-bridge`
  - Decide which are conceptual only vs actual plugin manifest families in first implementation.

  **Must NOT do**:
  - Do not collapse all surfaces into current `side-panel` semantics.
  - Do not choose positional naming.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **References**:
  - this plan
  - `apps/desktop/src/shared/firefly-plugin/manifest.ts`
  - `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`

  **Acceptance Criteria**:
  - [x] Every Folio UI category has one clear host surface target.
  - [x] Taxonomy names are semantic and future-safe.

  **QA Scenarios**:
  ```text
  Scenario: Taxonomy covers all inventoried Folio surfaces
    Tool: Bash (compare docs)
    Steps:
      1. Compare route/UI inventory against taxonomy buckets
      2. Assert no Folio surface remains unassigned
    Expected Result: all inventoried surfaces map to a taxonomy bucket
    Evidence: .sisyphus/evidence/task-17-taxonomy.md
  ```

  **Commit**: NO

- [x] 18. MVP-vs-full integration tiering

  **What to do**:
  - Split Folio surfaces into:
    - Phase 1 proof
    - MVP first-class integration
    - later/full parity
  - Keep one narrow slice for execution and broader roadmap for full citizenship.

  **Must NOT do**:
  - Do not let “all routes/pages” force all-at-once implementation.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Each Folio surface family has explicit tier assignment and rationale.

  **QA Scenarios**:
  ```text
  Scenario: Tiering is bounded and credible
    Tool: Bash (read)
    Steps:
      1. Verify each inventory item has phase/tier assignment
      2. Verify phase-1 remains narrower than MVP and full parity
    Expected Result: bounded rollout tiers with no hidden all-at-once scope
    Evidence: .sisyphus/evidence/task-18-tiering.md
  ```

  **Commit**: NO

- [x] 19. Surface-family architecture decision

  **What to do**:
  - Decide between:
    - new manifest family per host surface type
    - unified `surface` family with discriminated `kind`
  - Compare tradeoffs for Palot + future bundled apps.

  **Must NOT do**:
  - Do not decide schema shape by convenience alone.
  - Do not optimize only for Folio special casing.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Chosen schema direction has explicit reasons and rejected alternative documented.

  **QA Scenarios**:
  ```text
  Scenario: Architecture decision is justified
    Tool: Bash (read)
    Steps:
      1. Compare both options against all host surface needs
      2. Ensure selected option explains why rejected path loses
    Expected Result: durable schema decision with rationale
    Evidence: .sisyphus/evidence/task-19-surface-family-decision.md
  ```

  **Commit**: NO

- [x] 20. page surface contract

  **What to do**:
  - Define how a plugin registers first-class page surfaces in Palot.
  - Cover route identity, title, icon, breadcrumbs, persistence, and host page container behavior.

  **Must NOT do**:
  - Do not reuse `side-panel` assumptions for full page surfaces.
  - Do not let page surfaces own outer host routing.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Page surface registration contract is explicit and host-owned.

  **QA Scenarios**:
  ```text
  Scenario: Page contract preserves host routing authority
    Tool: Bash (read)
    Steps:
      1. Validate outer host route vs inner Folio route identity semantics
      2. Assert page contribution cannot own app shell/routing globally
    Expected Result: clean page surface contract
    Evidence: .sisyphus/evidence/task-20-page-contract.md
  ```

  **Commit**: NO

- [x] 21. settings-section contract

  **What to do**:
  - Define how plugins register first-class settings sections inside Palot settings shell.
  - Cover ordering, categories, visibility, permissions, and persistence.

  **Must NOT do**:
  - Do not let plugins own the settings shell itself.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Settings-section integration model is explicit and reusable.

  **QA Scenarios**:
  ```text
  Scenario: Settings-shell ownership is preserved
    Tool: Bash (read)
    Steps:
      1. Check settings-section registration rules
      2. Verify host owns shell/search/nav and plugin owns section content only
    Expected Result: clean settings integration contract
    Evidence: .sisyphus/evidence/task-21-settings-contract.md
  ```

  **Commit**: NO

- [x] 22. side-panel/contextual surface contract

  **What to do**:
  - Define which Folio contextual surfaces belong in Palot side-panels.
  - Clarify how they differ from full pages and nav-sidebar items.

  **Must NOT do**:
  - Do not turn every drill-in into a full page by default.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Contextual Folio surfaces are classified and mapped.

  **QA Scenarios**:
  ```text
  Scenario: Contextual surfaces are intentionally chosen
    Tool: Bash (read)
    Steps:
      1. Map backlinks/comments/inspectors/previews to side-panel or page
      2. Verify rationale exists for each mapping
    Expected Result: side-panel usage is selective and justified
    Evidence: .sisyphus/evidence/task-22-side-panel-classification.md
  ```

  **Commit**: NO

- [x] 23. command/action contract

  **What to do**:
  - Define how Folio surfaces register command palette actions and context-aware commands.
  - Cover new page, new database, open object, navigate, and settings/admin actions.

  **Must NOT do**:
  - Do not keep Folio navigation dependent on sidebar clicks only.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Folio command/action model is explicit and host-integrated.

  **QA Scenarios**:
  ```text
  Scenario: Command model covers primary user flows
    Tool: Bash (read)
    Steps:
      1. Verify create/open/navigate/settings/admin commands all have host targets
      2. Check command palette and contextual action integration
    Expected Result: complete command/action contract
    Evidence: .sisyphus/evidence/task-23-command-contract.md
  ```

  **Commit**: NO

- [x] 24. background-service / data-bridge contract

  **What to do**:
  - Define plugin/runtime contract for non-visual Folio integrations:
    - auth/session bridge
    - API client bridge
    - sync/cache lifecycle
    - storage/runtime seams

  **Must NOT do**:
  - Do not leave runtime dependencies as implicit “adapter later” notes.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Background/runtime integration model is explicit and fail-loud.

  **QA Scenarios**:
  ```text
  Scenario: Non-visual integration contract is explicit
    Tool: Bash (read)
    Steps:
      1. Enumerate non-visual Folio seams
      2. Verify each one has host/runtime contract and failure behavior
    Expected Result: complete data-bridge and background-service contract
    Evidence: .sisyphus/evidence/task-24-runtime-contract.md
  ```

  **Commit**: NO

- [x] 25. Host route + Folio route identity contract

  **What to do**:
  - Define two-layer route model:
    - Palot host route
    - Folio inner route identity
  - Cover restore, refresh, deep links, copy/paste URLs, and browser history.

  **Must NOT do**:
  - Do not collapse both route layers into one ambiguous string.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Route/deeplink model is explicit enough to implement without guesswork.

  **QA Scenarios**:
  ```text
  Scenario: Route-layer contract is unambiguous
    Tool: Bash (read)
    Steps:
      1. Verify host route and Folio route identity each have explicit ownership
      2. Verify refresh and deep-link restore behavior
    Expected Result: route model implementation-ready
    Evidence: .sisyphus/evidence/task-25-route-contract.md
  ```

  **Commit**: NO

- [x] 26. Breadcrumb/history/deeplink model

  **What to do**:
  - Define how breadcrumbs, back/forward, and deep links should work once Folio pages live inside Palot.
  - Specify which layer owns breadcrumb construction.

  **Must NOT do**:
  - Do not leave history behavior to emergent browser defaults.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] History and breadcrumb ownership is explicit.

  **QA Scenarios**:
  ```text
  Scenario: Breadcrumb/history model is coherent
    Tool: Bash (read)
    Steps:
      1. Verify owner of breadcrumbs, back/forward, and deep-link reconstruction
      2. Verify no conflict with host shell navigation
    Expected Result: coherent navigation contract
    Evidence: .sisyphus/evidence/task-26-breadcrumb-history.md
  ```

  **Commit**: NO

- [x] 27. Provider ownership matrix

  **What to do**:
  - Produce final matrix of host-owned, Folio-owned, and adapter-owned providers/stores/services.

  **Must NOT do**:
  - Do not allow any provider to remain unclassified.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Ownership matrix covers all critical providers and services.

  **QA Scenarios**:
  ```text
  Scenario: No provider remains unowned
    Tool: Bash (read)
    Steps:
      1. Compare provider inventory against final matrix
      2. Fail if any provider/store/service is not tagged
    Expected Result: complete ownership matrix
    Evidence: .sisyphus/evidence/task-27-provider-ownership.md
  ```

  **Commit**: NO

- [x] 28. Auth/session bridge contract

  **What to do**:
  - Define exact Palot ↔ Folio auth/session integration model.
  - Cover hosted vs local, Better Auth bridge period, delegated identity assumptions, and session restoration.

  **Must NOT do**:
  - Do not assume auth cutover is already complete.
  - Do not hide partial-config failure modes.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Auth/session integration path is explicit and fail-loud.

  **QA Scenarios**:
  ```text
  Scenario: Auth bridge is explicit and honest
    Tool: Bash (read)
    Steps:
      1. Verify bridge-period assumptions and config requirements
      2. Verify failure behavior for missing/partial config
    Expected Result: auth/session contract is implementation-ready and fail-loud
    Evidence: .sisyphus/evidence/task-28-auth-bridge.md
  ```

  **Commit**: NO

- [x] 29. API/storage/cache/sync bridge contract

  **What to do**:
  - Define how Folio API client, local cache, durable document state, and sync runtime live inside Palot.
  - Cover initialization, teardown, offline behavior, and conflict surfaces.

  **Must NOT do**:
  - Do not treat local-first behavior as a simple fetch-only integration.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Data/runtime bridge contract covers startup, active use, and recovery.

  **QA Scenarios**:
  ```text
  Scenario: Local-first runtime seam is fully covered
    Tool: Bash (read)
    Steps:
      1. Verify cache, sync, API, and offline behavior all appear in bridge contract
      2. Verify startup and teardown semantics exist
    Expected Result: runtime/data contract is complete
    Evidence: .sisyphus/evidence/task-29-runtime-bridge.md
  ```

  **Commit**: NO

- [x] 30. Failure-state and fail-loud runtime model

  **What to do**:
  - Enumerate failure states:
    - missing auth
    - missing workspace
    - API unavailable
    - cache unavailable
    - sync failure
    - plugin disabled/quarantined
    - unsupported route
  - Define host UX and typed runtime behavior for each.

  **Must NOT do**:
  - Do not permit silent fallback behavior.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Failure-state matrix exists and is exhaustive enough for MVP.

  **QA Scenarios**:
  ```text
  Scenario: Failure-state matrix is explicit
    Tool: Bash (read)
    Steps:
      1. Verify all key runtime failure states are present
      2. Verify each has host UX + typed behavior + fallback target if any
    Expected Result: full fail-loud model
    Evidence: .sisyphus/evidence/task-30-failure-matrix.md
  ```

  **Commit**: NO

- [x] 31. Workspace shell integration design

  **What to do**:
  - Define how Folio workspace shell pieces decompose into:
    - `nav-sidebar`
    - `page`
    - host breadcrumbs/header context
  - Decide what stays Palot-owned vs Folio-owned.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Workspace shell integration is explicit and non-duplicative.

  **QA Scenarios**:
  ```text
  Scenario: Workspace shell decomposition is executable
    Tool: Bash (read)
    Steps:
      1. Verify every shell piece has a host surface target and ownership
    Expected Result: implementation-ready workspace shell design
    Evidence: .sisyphus/evidence/task-31-workspace-shell.md
  ```

  **Commit**: NO

- [x] 32. Document/page surface integration design

  **What to do**:
  - Define integration of Folio page/document/editor surfaces into Palot page host.
  - Cover route handling, editor loading, page titles, contextual panels, and state restoration.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Document/page surface plan is implementation-ready.

  **QA Scenarios**:
  ```text
  Scenario: Document surface design is implementation-ready
    Tool: Bash (read)
    Steps:
      1. Verify route, title, editor, restore, and panel hooks are all specified
    Expected Result: executor can wire a Folio page surface without re-planning
    Evidence: .sisyphus/evidence/task-32-document-surface.md
  ```

  **Commit**: NO

- [x] 33. Database/view surface integration design

  **What to do**:
  - Define how database home, table view, and future database views register as first-class page surfaces.
  - Cover saved views, row opening, and view switching.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Database/view surface integration path is explicit.

  **QA Scenarios**:
  ```text
  Scenario: Database surface design covers current and future views
    Tool: Bash (read)
    Steps:
      1. Verify table/home now, other view families later, with same page surface contract
    Expected Result: coherent database/view integration plan
    Evidence: .sisyphus/evidence/task-33-database-surface.md
  ```

  **Commit**: NO

- [x] 34. Settings/admin integration design

  **What to do**:
  - Define how Folio settings/admin surfaces become Palot-native settings sections or supporting pages.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Settings/admin surface integration is explicit and host-owned.

  **QA Scenarios**:
  ```text
  Scenario: Settings/admin surfaces fit Palot settings model
    Tool: Bash (read)
    Steps:
      1. Verify shell ownership, section mapping, visibility, and command access paths
    Expected Result: settings/admin integration model is complete
    Evidence: .sisyphus/evidence/task-34-settings-integration.md
  ```

  **Commit**: NO

- [x] 35. Command palette and keyboard integration design

  **What to do**:
  - Define palette actions, keyboard shortcuts, and contextual commands for Folio.
  - Include navigation and object creation/opening flows.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Folio command model is native to Palot command UX.

  **QA Scenarios**:
  ```text
  Scenario: Command integration covers core Folio flows
    Tool: Bash (read)
    Steps:
      1. Verify create/open/navigate/settings/admin actions are covered
      2. Verify keyboard and contextual paths are addressed
    Expected Result: native command integration plan
    Evidence: .sisyphus/evidence/task-35-command-integration.md
  ```

  **Commit**: NO

- [x] 36. Contextual side-panel integration design

  **What to do**:
  - Define which Folio surfaces become side-panel inspectors/previews/backlinks/details.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Side-panel use is selective and justified per surface.

  **QA Scenarios**:
  ```text
  Scenario: Side-panel candidates are justified
    Tool: Bash (read)
    Steps:
      1. Verify each side-panel candidate has rationale vs page/nav-sidebar placement
    Expected Result: contextual surfaces use side-panel intentionally
    Evidence: .sisyphus/evidence/task-36-side-panel-integration.md
  ```

  **Commit**: NO

- [x] 37. Bundled plugin packaging strategy

  **What to do**:
  - Decide one bundled Folio plugin vs umbrella suite vs modular bundled plugins.
  - Define ids, manifest placement, catalog inclusion, component/page registries.

  **Must NOT do**:
  - Do not leave Folio as permanent special-case code path.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Packaging strategy is explicit and reusable.

  **QA Scenarios**:
  ```text
  Scenario: Packaging strategy uses normal catalog authority
    Tool: Bash (read)
    Steps:
      1. Verify manifest source, registry, projection, and render paths remain normal plugin paths
    Expected Result: Folio packaging is first-class, not bespoke
    Evidence: .sisyphus/evidence/task-37-packaging.md
  ```

  **Commit**: NO

- [x] 38. Capability, crash-isolation, and telemetry model

  **What to do**:
  - Define capability gates, crash boundaries, telemetry, persistence, quarantine rules for Folio surfaces across all host surface families.

  **Recommended Agent Profile**:
  - **Category**: `deep`

  **Acceptance Criteria**:
  - [x] Safety and observability model covers all major surface families.

  **QA Scenarios**:
  ```text
  Scenario: Safety model covers all host surface families
    Tool: Bash (read)
    Steps:
      1. Check nav-sidebar/page/settings/side-panel/command/background-service each have safety notes
    Expected Result: complete crash/capability/telemetry model
    Evidence: .sisyphus/evidence/task-38-safety-model.md
  ```

  **Commit**: NO

- [x] 39. Phase rollout plan

  **What to do**:
  - Turn architecture into phased execution:
    - phase 1 nav-sidebar proof
    - phase 2 core page surfaces
    - phase 3 settings/commands/panels
    - phase 4 runtime depth
    - phase 5 full citizenship

  **Recommended Agent Profile**:
  - **Category**: `writing`

  **Acceptance Criteria**:
  - [x] Rollout sequencing minimizes risk and preserves reusable architecture.

  **QA Scenarios**:
  ```text
  Scenario: Rollout sequence is credible
    Tool: Bash (read)
    Steps:
      1. Verify each phase depends on validated earlier contracts
      2. Verify no phase skips core runtime assumptions
    Expected Result: phased rollout is low-risk and cumulative
    Evidence: .sisyphus/evidence/task-39-rollout.md
  ```

  **Commit**: NO

- [x] 40. Verification matrix and proof plan

  **What to do**:
  - Define proof for every surface family:
    - nav-sidebar
    - page
    - settings-section
    - side-panel
    - command
    - background/data bridge

  **Recommended Agent Profile**:
  - **Category**: `writing`

  **Acceptance Criteria**:
  - [x] Verification plan proves full first-class citizenship, not only compilation.

  **QA Scenarios**:
  ```text
  Scenario: Verification matrix covers all surface families
    Tool: Bash (read)
    Steps:
      1. Compare taxonomy against verification rows
      2. Assert no surface family lacks proof method
    Expected Result: complete verification matrix
    Evidence: .sisyphus/evidence/task-40-verification-matrix.md
  ```

  **Commit**: NO

- [x] 41. Future bundled-app generalization

  **What to do**:
  - Extract lessons from Folio so next app can become first-class plugin without custom reinvention.

  **Recommended Agent Profile**:
  - **Category**: `writing`

  **Acceptance Criteria**:
  - [x] Architecture is not Folio-only; reusable host doctrine is captured.

  **QA Scenarios**:
  ```text
  Scenario: Architecture generalizes beyond Folio
    Tool: Bash (read)
    Steps:
      1. Verify plan names reusable host/plugin patterns separate from Folio-specific content
    Expected Result: future bundled-app doctrine exists
    Evidence: .sisyphus/evidence/task-41-generalization.md
  ```

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_am -->

- [x] F1. **Master-Plan Compliance Audit** — `oracle`
  Validate that every promised Folio surface family, runtime seam, and rollout phase is covered by concrete tasks.

- [x] F2. **Schema/Runtime Architecture Review** — `deep`
  Review whether chosen plugin-surface evolution is clean, non-overloaded, and reusable beyond Folio.

- [x] F3. **Surface-Coverage Review Against Folio Inventory** — `unspecified-high`
  Compare full Folio route/UI inventory against this plan and assert no significant surface family is omitted.

- [x] F4. **Scope Fidelity and One-Plan Audit** — `deep`
  Confirm this merged plan remains the single canonical execution target and that no superseded plan is still needed.

---

## Commit Strategy

- Plan-only phase. No implementation commits in this document.

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
bun run svc:status                         # Expected: Palot web/server healthy
hush run -- pnpm run storybook             # Expected: shared Storybook on :10616
pnpm --filter @ch5me/folio-* test          # Expected: Folio contract/runtime tests pass when relevant changes land
bun test <targeted palot plugin tests>     # Expected: schema/descriptor/catalog/projection tests pass after implementation
```

### Final Checklist <!-- oc:id=sec_ap -->
- [x] Existing Palot sidebar is transformed into a host-owned `nav-sidebar`
- [x] Built-in tab proof works and flows into plugin-driven nav-sidebar architecture
- [x] Full Folio surface inventory exists
- [x] All inventoried surfaces map to semantic host surface families
- [x] Route/deeplink model is explicit
- [x] Provider/runtime/auth/storage ownership is explicit
- [x] Settings, commands, contextual side-panels, and full pages are included
- [x] Bundled plugin packaging strategy is explicit
- [x] Architecture is reusable beyond Folio