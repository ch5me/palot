# CLOUD000-174 Palette 3-Pane Finish

## TL;DR
> **Summary**: Foundation landed on `main`, but finish work remains around state contract, runtime proof, Storybook parity, defaults cleanup, and closeout. Complete the shell by hardening doc-vs-utility routing, proving the bridge/service path, and capturing final verification evidence.
> **Deliverables**:
> - durable 3-pane routing contract
> - cleaned feature/default/toggle behavior
> - Palot-specific Storybook story for nested right docks
> - runtime/bridge proof for `studio` and `pdf-review`
> - browser + Electron manual verification evidence
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: state contract decision -> layout hardening -> Storybook/runtime proof -> final verification

## Context
### Original Request
Chris asked what work remains to fully finish the Palette redesign after the direct-to-`main` merge, including services, three splits, Storybook story, and proof that the layout works.

### Interview Summary
- Direct merge to `main` is the repo policy; no PR flow.
- Nested right-dock implementation is already on `main`.
- Remaining ask is a concrete finish plan, not more speculative design.

### Metis Review (gaps addressed)
- Decide whether doc lane state stays derived from `sidePanelActiveTab` or becomes explicit durable UI state.
- Replace hardcoded doc-surface helper with durable registry metadata.
- Add bridge/runtime proof for doc surfaces, not just utility surfaces.
- Add Palot-specific Storybook proof, not only generic workspace example.
- Reconcile defaults/toggles so registry, feature flags, and visible surfaces agree.

## Work Objectives
### Core Objective
Finish CLOUD000-174 so Palette's three working panes are not only merged, but durable, provable, and documented across renderer, runtime bridge, Storybook, and service restore behavior.

### Deliverables
- explicit final contract for document lane behavior
- hardened renderer implementation for doc vs utility surfaces
- cleaned command-palette/default-surface behavior
- Storybook story mirroring Palot's real nested-pane shell
- runtime tests and manual evidence for browser + Electron flows
- ticket-closeout note with accepted risks or none

### Definition of Done
- `apps/desktop` passes `bun run check-types`
- `apps/desktop` passes `bun run lint`
- document lane opens correctly for `studio` and `pdf-review` from command palette and bridge/runtime path
- utility pane and doc pane coexist without state loss or wrong-pane opening
- Storybook contains a Palot-facing story that demonstrates sidebar + chat + doc lane + utility lane
- restore behavior for unavailable/disabled doc surfaces is explicit and tested
- verification evidence exists for browser mode and Electron mode

### Must Have
- single durable classification seam for document surfaces
- exact verification for command palette, bridge open, restore, and tab switching
- defaults/toggles aligned with intended rollout
- no unproven "should work" claims

### Must NOT Have
- no new ad hoc hardcoded surface special-casing outside the chosen seam
- no proof limited to utility-pane behavior while calling doc lane done
- no generic Storybook-only proof that skips Palot integration
- no lingering duplicate toggles or stale surface defaults if product intent says otherwise

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed unless explicit manual browser/Electron evidence capture is required. Even then, the agent drives the commands and records artifacts.
- Test decision: tests-after using existing `tsgo`, Biome, existing runtime tests, and targeted new tests
- QA policy: every task includes exact scenarios and evidence paths
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1: state-contract + defaults cleanup + Storybook scaffold
Wave 2: runtime/bridge proof + doc-lane behavior tests + browser/Electron verification harness
Wave 3: final manual proof matrix + closeout docs/ticket note + review wave

### Dependency Matrix
- Task 1 blocks Tasks 2, 4, 5, 6
- Task 2 blocks Tasks 5 and 6
- Task 3 can run after Task 1
- Task 4 depends on Task 1 and Task 2
- Task 5 depends on Tasks 1, 2, 4
- Task 6 depends on Tasks 1, 2, 3
- Task 7 depends on Tasks 4, 5, 6
- Final verification depends on all prior tasks

### Agent Dispatch Summary
- Wave 1 -> 3 tasks -> unspecified-high, visual-engineering, writing
- Wave 2 -> 3 tasks -> unspecified-high, quick, deep
- Wave 3 -> 1 task -> unspecified-high

## TODOs

- [x] 1. Lock Doc-Lane State Contract

  **What to do**: Decide and implement the final contract for doc-lane openness. Preferred default: keep doc lane derived from `sidePanelActiveTab` only if restore behavior, disabled-surface fallback, and runtime bridge behavior are fully specified and tested. If that cannot be made unambiguous, promote doc lane state into explicit UI snapshot state alongside utility pane state.
  **Must NOT do**: Do not leave the contract half-derived/half-explicit. Do not introduce a second hidden active-tab source.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross-cutting state/routing work
  - Skills: [`software-design-principles`] — clarify durable state seam
  - Omitted: [`hassoncs-developer-soul`] — not needed for repo-specific contract

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,4,5,6 | Blocked By: none

  **References**:
  - Pattern: `apps/desktop/src/renderer/atoms/ui.ts:33` — current pane-routing state only models utility side panel
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx` — current nested right-dock implementation
  - Pattern: `apps/desktop/src/renderer/services/backend.ts` — bridge consumers rely on stable UI contract paths

  **Acceptance Criteria**:
  - [ ] Contract is explicit in code and comments where needed
  - [ ] Restore behavior for last-active doc surface is deterministic
  - [ ] Disabled/unavailable doc surface fallback path is deterministic

  **QA Scenarios**:
  ```text
  Scenario: Restore active doc tab
    Tool: Bash
    Steps: run desktop typecheck and targeted tests after forcing last active tab to a doc surface in persisted preferences fixture
    Expected: app restores valid doc lane or explicit fallback, no crash
    Evidence: .sisyphus/evidence/task-1-doc-state-contract.txt

  Scenario: Disabled doc surface fallback
    Tool: Bash
    Steps: disable `pdf-review` or `studio`, simulate restore/open path
    Expected: utility pane remains valid; doc lane closes or falls back explicitly
    Evidence: .sisyphus/evidence/task-1-doc-state-fallback.txt
  ```

  **Commit**: YES | Message: `refactor(palette): lock doc lane state contract` | Files: renderer atoms/layout/runtime snapshot files

- [x] 2. Replace Hardcoded Doc-Surface Classification

  **What to do**: Move doc-lane membership from `isDocumentSurfaceId()` hardcoding to durable surface metadata in the registry/catalog seam. Best shape: add lane/form metadata to `FireflySurfaceDef` and derived tab descriptors, then filter by metadata rather than surface ID string list.
  **Must NOT do**: Do not keep the helper as the long-term authority. Do not add duplicate metadata in multiple modules.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: registry/typing/routing seam
  - Skills: [`software-design-principles`] — keeps source of truth DRY
  - Omitted: [`architecture-patterns`] — overkill for this seam

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5,6 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/src/renderer/firefly-surface-registry.tsx:47` — surface definition authority
  - Pattern: `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx:160` — catalog-projected tabs must align with registry semantics
  - Pattern: `apps/desktop/src/shared/firefly-surface-ids.ts:12` — ids remain renderer-free authority

  **Acceptance Criteria**:
  - [ ] Doc-vs-utility routing uses metadata, not hardcoded id checks
  - [ ] Registry and catalog surface tabs expose the same lane concept
  - [ ] Adding a future doc surface requires one metadata declaration only

  **QA Scenarios**:
  ```text
  Scenario: Known doc surfaces route by metadata
    Tool: Bash
    Steps: run affected unit/type tests for registry and renderer surface derivation
    Expected: `studio` and `pdf-review` both route to doc lane without string-list special casing
    Evidence: .sisyphus/evidence/task-2-doc-metadata.txt

  Scenario: Future-surface regression guard
    Tool: Bash
    Steps: add or exercise a fixture surface with document lane metadata in test only
    Expected: routing picks doc lane without any helper edits
    Evidence: .sisyphus/evidence/task-2-doc-metadata-regression.txt
  ```

  **Commit**: YES | Message: `refactor(palette): drive doc lane from surface metadata` | Files: registry, derived tabs, tests

- [x] 3. Add Palot Storybook Proof Story

  **What to do**: Create a Palot-specific Storybook story that mirrors the actual `agent-detail` shell: left sidebar, center chat, inner doc pane, outer utility pane. Include toggles for `studio`, `pdf-review`, and one utility surface. Story must reference current nested `SplitPane` composition, not only generic workspace contract examples.
  **Must NOT do**: Do not point to generic `SplitDockExample` and call it done. Do not create a toy layout that diverges from Palot structure.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: Storybook/demo surface work
  - Skills: [`react-best-practices`] — preserve renderer conventions
  - Omitted: [`visual-tdd`] — not required unless pixel diff loop is needed

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 1

  **References**:
  - Pattern: `../ch5-packages/packages/workspace/contract/src/SplitDockExample.stories.tsx:126` — canonical nested right-dock shape
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx` — real shell to mirror
  - Pattern: `packages/ui/src/stories/*` — repo Storybook conventions

  **Acceptance Criteria**:
  - [ ] Story exists and runs in repo Storybook surface
  - [ ] Story shows utility pane and doc pane independently
  - [ ] Story demonstrates tab switch between `studio` and `pdf-review`

  **QA Scenarios**:
  ```text
  Scenario: Story renders nested panes
    Tool: Bash
    Steps: ensure Storybook service, load story URL, capture rendered state
    Expected: left/sidebar + center/chat + doc pane + utility pane visible in story composition
    Evidence: .sisyphus/evidence/task-3-storybook-proof.png

  Scenario: Story tab switch preserves doc subtree
    Tool: Bash
    Steps: automate story control or interaction to switch active doc surface
    Expected: pane updates without layout collapse and without mount-reset symptom in story harness
    Evidence: .sisyphus/evidence/task-3-storybook-switch.txt
  ```

  **Commit**: YES | Message: `feat(storybook): add palot 3-pane palette story` | Files: Storybook story and support fixtures

- [x] 4. Clean Defaults, Toggles, and Discoverability

  **What to do**: Reconcile registry defaults, feature-flag defaults, and command-palette toggles. Remove duplicate PDF Review toggle row. Hide or keep CRM/browser/other surfaces only according to final rollout intent. Ensure user-visible affordances match actual supported lanes.
  **Must NOT do**: Do not leave registry and feature flags disagreeing. Do not leave duplicate command entries.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: bounded cleanup with product-facing impact
  - Skills: []
  - Omitted: [`software-design-principles`] — not necessary for this cleanup slice alone

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/src/renderer/firefly-surface-registry.tsx` — registry defaults
  - Pattern: `apps/desktop/src/renderer/atoms/feature-flags.ts` — flag defaults
  - Pattern: `apps/desktop/src/renderer/components/command-palette.tsx:658` — duplicate PDF Review toggles to clean

  **Acceptance Criteria**:
  - [ ] Registry defaults and flag defaults align
  - [ ] Duplicate PDF Review command is removed
  - [ ] Command palette only exposes intended surfaces/toggles

  **QA Scenarios**:
  ```text
  Scenario: Command palette surface hygiene
    Tool: Bash
    Steps: open command palette surface list in test harness or rendered capture
    Expected: no duplicate PDF Review toggle; surfaces match rollout policy
    Evidence: .sisyphus/evidence/task-4-command-palette.txt

  Scenario: Default visibility consistency
    Tool: Bash
    Steps: inspect feature-flag and registry-derived visible surface set in tests
    Expected: default set is consistent across sources
    Evidence: .sisyphus/evidence/task-4-defaults.txt
  ```

  **Commit**: YES | Message: `fix(palette): align surface defaults and toggles` | Files: registry, flags, command palette

- [x] 5. Add Runtime and Bridge Proof for Doc Surfaces

  **What to do**: Extend runtime/plugin/main-process verification so `openSidePanel("studio")` and `openSidePanel("pdf-review")` prove document-lane behavior through the real bridge path. Cover browser mode and the runtime event path, not only renderer click paths.
  **Must NOT do**: Do not rely solely on utility-pane tests. Do not assert only "tab became active" if doc-lane open semantics are different.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: cross renderer/main/runtime verification
  - Skills: []
  - Omitted: [`investigate`] — not a debugging-first task unless tests fail

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1,2

  **References**:
  - Pattern: `apps/desktop/src/main/palot-browser-ipc.test.ts` — existing bridge-open testing shape
  - Pattern: `apps/desktop/src/main/palot-managed-runtime-verification.test.ts` — managed runtime verification seam
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx` — doc-vs-utility open semantics

  **Acceptance Criteria**:
  - [ ] Bridge/runtime tests cover `studio`
  - [ ] Bridge/runtime tests cover `pdf-review`
  - [ ] Tests distinguish doc-lane behavior from utility-pane behavior

  **QA Scenarios**:
  ```text
  Scenario: Bridge opens studio doc lane
    Tool: Bash
    Steps: run targeted main/renderer tests for `openSidePanel("studio")`
    Expected: doc tab becomes active and utility pane semantics remain correct
    Evidence: .sisyphus/evidence/task-5-bridge-studio.txt

  Scenario: Bridge opens pdf-review doc lane
    Tool: Bash
    Steps: run targeted main/renderer tests for `openSidePanel("pdf-review")`
    Expected: doc lane opens with correct active surface and no incorrect utility toggle
    Evidence: .sisyphus/evidence/task-5-bridge-pdf-review.txt
  ```

  **Commit**: YES | Message: `test(palette): prove doc lane bridge routing` | Files: main/runtime/renderer tests

- [x] 6. Run Browser and Electron Manual Proof Matrix

  **What to do**: Verify the shipped user-facing paths in both browser-mode dev and Electron dev. Exercise `studio`, `pdf-review`, switching between them, switching to utility surfaces, changing sessions, and unavailable-surface fallback. Record screenshots/logs.
  **Must NOT do**: Do not claim done from static tests only. Do not skip Electron just because browser mode works.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: user-facing path proof across two runtimes
  - Skills: [`magic-browser`] — if browser/workflow help is needed
  - Omitted: [`ghost-browser`] — only if a bound lane is unavailable; use actual repo runtime path first

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: 1,2,3

  **References**:
  - Pattern: `AGENTS.md` runtime policy — use devmux service commands, not ad hoc local process ownership
  - Pattern: `apps/desktop/src/renderer/components/agent-detail.tsx` — actual lane composition
  - Pattern: `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx` and `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx` — doc surfaces under proof

  **Acceptance Criteria**:
  - [ ] Browser-mode proof captured
  - [ ] Electron-mode proof captured
  - [ ] Session switch / unavailable tab fallback captured

  **QA Scenarios**:
  ```text
  Scenario: Browser mode three-pane workflow
    Tool: interactive_bash
    Steps: start repo services via devmux, open a session, activate `studio`, then `pdf-review`, then a utility surface
    Expected: chat remains center, doc pane updates correctly, utility pane remains independent
    Evidence: .sisyphus/evidence/task-6-browser-proof.md

  Scenario: Electron mode restore and fallback
    Tool: interactive_bash
    Steps: start desktop service, persist active doc tab, restart or switch session with unavailable doc surface
    Expected: explicit fallback behavior, no broken empty pane state
    Evidence: .sisyphus/evidence/task-6-electron-proof.md
  ```

  **Commit**: NO | Message: `n/a` | Files: evidence only unless code fix emerges

- [x] 7. Final Cleanup and Ticket Closeout

  **What to do**: Remove any leftover noise from this slice, update the narrowest durable docs if contract changed, and prepare final ticket closeout note with exact shipped behavior, verification evidence, and any accepted limitations. If a doc-lane limitation remains intentional, state it explicitly.
  **Must NOT do**: Do not leave undocumented accepted risk. Do not leave `.sisyphus/evidence` implicit or unreferenced.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: final closeout artifact and evidence summary
  - Skills: []
  - Omitted: [`summarize-meeting`] — not a meeting recap task

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final verification | Blocked By: 3,4,5,6

  **References**:
  - Pattern: `docs/session-debugging.md` or nearby runtime docs if contract changes need repo doc updates
  - Pattern: `.sisyphus/evidence/*` generated by prior tasks
  - Pattern: ticket/work summary style already used in repo durable notes

  **Acceptance Criteria**:
  - [ ] Final note summarizes shipped behavior and proof
  - [ ] Any intentional limitation is documented explicitly
  - [ ] Ticket update text is ready to paste/send

  **QA Scenarios**:
  ```text
  Scenario: Closeout completeness audit
    Tool: Bash
    Steps: verify all referenced evidence files exist and all verification commands passed
    Expected: ticket note references only real evidence and real landed behavior
    Evidence: .sisyphus/evidence/task-7-closeout-audit.txt

  Scenario: Doc update presence
    Tool: Bash
    Steps: verify any changed contract docs are included in git diff if contract changed
    Expected: no silent contract drift remains undocumented
    Evidence: .sisyphus/evidence/task-7-doc-audit.txt
  ```

  **Commit**: YES | Message: `docs(palette): close out 3-pane rollout` | Files: docs/evidence summary if changed

## Final Verification Wave
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ browser/Electron runtime proof)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit after Tasks 1, 2, 3, 4, 5, and 7 if those tasks change tracked files.
- Task 6 is proof-only unless bugs are found; if bugs appear, fix in separate coherent commits.
- Merge directly into `main`; no PR.

## Success Criteria
- Palette has durable three-pane behavior, not just merged layout code.
- Doc surfaces are classified and routed by a stable contract.
- Storybook proves the Palot-specific shell.
- Runtime bridge/service path proves doc-lane open behavior.
- Browser and Electron evidence exist.
- Defaults/toggles match rollout intent.
- Ticket closeout is evidence-backed and ready.
