# PDF Review Side Panel <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Build a Firefly PDF review side panel as a registry-driven desktop surface, with one shared locator/grounding contract first, then layer citations, selection, annotations, ingest/search, and project-level derived outputs on top.
>
> **Deliverables**:
> - Shared document locator/span contract + resolution engine
> - New PDF review Firefly surface wired into existing side-panel shell
> - Grounded citation streaming path between chat and document viewer
> - Selection, annotation, notes, ingest brief, corpus/project search, artifacts/tables/audio follow-on slices
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Discovery gates -> locator contract -> grounded citation protocol -> viewer/selection integration -> project/search/artifact features

---

## Context

### Original Request
Create a work plan for a Firefly/PALOT PDF review side panel based on OpenPaper-like behavior, but reimplemented clean-room against the CH5 stack and mapped onto Firefly's existing chat + side-panel architecture.

### Interview Summary
**Key Discussions**:
- Scope is desktop plus shared contracts for later mobile/native parity.
- First implementation target is web/Electron first, not native-parity-first.
- Automated test strategy is tests-after, with agent-executed QA scenarios required throughout.
- Most important primitive is one shared locator/span system carrying `documentId` from day one.

**Research Findings**:
- Firefly side-panel surfaces are registry-driven through `apps/desktop/src/renderer/firefly-surface-registry.tsx`, `apps/desktop/src/renderer/components/agent-detail.tsx`, `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`, and `apps/desktop/src/renderer/atoms/ui.ts`.
- Existing proof surfaces establish local precedents: lightweight state (`notes-panel.tsx`), backend seam + fallback (`memory-panel.tsx`, `services/memory-service.ts`), high-density rendering (`review-panel.tsx`), and prompt-context-backed artifacts (`docs/genui-artifact-architecture.md`, `genui-renderer.tsx`, `atoms/chat.ts`).
- Public OpenPaper materials consistently describe split-pane reading, streaming grounded citations, upload brief + starter questions, inline selection menu, annotations as retrieval context, cross-document projects, artifacts, structured tables, and audio summaries.
- External anchoring research supports a multi-selector locator stack: quote + prefix/suffix + text positions + page/structural anchors, resolved with precise-first and fuzzy fallback strategies.
- React Native PDF text selection is materially harder than web/pdf.js-style implementations, so contract-first desktop delivery is the right first cut.

### Metis Review
**Identified Gaps** (addressed):
- Added explicit discovery gate for unresolved masking/retrieval/viewer/storage assumptions before downstream feature work.
- Locked v1 scope to text PDFs, single-user workflow, web/Electron viewer, and shared native contracts only.
- Added durability acceptance for locator survival across reopen, rerender, zoom changes, and minor parser drift.
- Added explicit degraded-path rules for unresolved citations, failed ingest, repeated quotes, and non-selectable PDFs.
- Re-shaped execution into discovery -> shared primitive -> feature lanes -> dependent outputs -> verification.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Ship a desktop-first PDF review side panel inside Firefly's existing shell that keeps document reading and AI chat tightly linked through verifiable source spans, while defining shared contracts that future mobile/native surfaces can reuse without reworking the grounding model.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- New `pdf-review` Firefly side-panel surface definition, flag, persistence path, and shell wiring.
- Shared versioned locator/span contract with `documentId` first-class.
- Resolver engine that supports exact/page/quote/context fallback and degraded unresolved states.
- Desktop PDF/document viewer integration with selection-aware actions and jump-to-span behavior.
- Grounded streaming citation protocol between chat output and document viewer.
- Persisted annotations/highlights/notes model scoped to documents and projects.
- Ingest pipeline plan for extracted text, brief, starter questions, and search indexing.
- Corpus/project retrieval, artifact generation, structured extraction tables, and audio summary slices planned against the shared contract.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] Firefly opens a PDF review surface through the existing side-panel registry path and persists the active tab correctly.
- [ ] Surface restore falls back safely if the PDF review feature flag is later disabled or unavailable.
- [ ] A grounded answer can stream in chat, show inline citations, and jump to the correct document span or a graceful degraded fallback.
- [ ] A selected document span can trigger annotation / ask-AI actions and persist through reopen.
- [ ] Project-scoped retrieval features and derived outputs reference the same locator contract without bespoke span models.
- [ ] QA scenarios cover happy path plus unresolved/failed/ambiguous-path behavior with no human-only verification requirements.

### Must Have <!-- oc:id=sec_ag -->
- Clean-room implementation plan; no AGPL source lifting.
- Shared locator/span system before downstream grounded features.
- Desktop-first implementation with explicit reusable contracts for later native parity.
- Existing Firefly registry/flag/command/persistence path reused.
- Explicit degraded behavior for failed locator resolution, ingest gaps, repeated quotes, non-selectable PDFs, and stale/deleted project documents.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No bespoke side-panel plumbing outside existing Firefly registry/shell.
- No viewer-specific ad hoc anchor model that bypasses the shared locator contract.
- No second notes/annotation/artifact system that duplicates existing surfaces.
- No assumption that masking/retrieval infra already exists locally without discovery proof.
- No scanned-PDF OCR, collaboration, or multi-format document support in v1 unless explicitly added by a later follow-on plan update.
- No native-parity implementation work in v1 beyond shared contracts and seam design.
- No direct copying of OpenPaper source, file structure, prompts, or protocols from AGPL code.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification must be agent-executed.

### Test Decision
- **Infrastructure exists**: Partial. General repo verification exists, but PDF-review-specific tests do not yet exist.
- **Automated tests**: Tests-after
- **Framework**: Existing repo quality gates plus any new task-specific tests added in implementation lanes.
- **If tests are added**: place them alongside the new surface/domain seams and use the repo's existing TypeScript/browser test conventions where applicable.

### QA Policy
Every task must include agent-executed QA scenarios with evidence in `.sisyphus/evidence/task-{N}-*.{ext}`.

- **Frontend/UI**: Use browser automation to open Firefly, switch side-panel tabs, upload/select a PDF, trigger citations, and capture screenshots.
- **Desktop/browser-mode seams**: Use repo dev stack plus renderer-visible proof, not internal-only state inspection.
- **API/backend**: Use HTTP/IPC seam verification for ingest, locator resolution, and search/indexing flows.
- **Data model**: Verify persisted annotations/briefs/rows by reading the authoritative storage/API surface, not just in-memory state.

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 0 (Start Immediately — discovery gates, 4 parallel):
- T1 viewer/runtime decision gate
- T2 storage + sync + scope contract gate
- T3 retrieval/masking/ingest seam audit
- T4 document domain map + existing shell fit audit

Wave 1 (After Wave 0 — shared primitives, 4 parallel):
- T5 shared locator/span contract
- T6 locator resolution engine
- T7 PDF review side-panel shell registration
- T8 document/annotation/project data model

Wave 2 (After Wave 1 — core interactive slice, 5 parallel):
- T9 desktop viewer integration
- T10 grounded citation streaming protocol
- T11 selection action menu
- T12 annotations + notes integration
- T13 upload ingest brief + starter questions

Wave 3 (After Wave 2 — retrieval + multi-doc lanes, 4 parallel):
- T14 corpus search
- T15 projects + cross-doc chat contract
- T16 artifact generation from sources
- T17 audio summary pipeline

Wave 4 (After Wave 3 — structured extraction + hardening, 4 parallel):
- T18 grounded data tables
- T19 degraded-state/error handling hardening
- T20 performance/virtualization/caching hardening
- T21 native-contract boundary package-up

Wave FINAL (After all tasks — 4 parallel reviews):
- F1 plan compliance audit
- F2 code quality review
- F3 full QA scenario execution
- F4 scope fidelity check

Critical Path: T1 -> T5 -> T6 -> T10 -> T15 -> T18 -> F1-F4
Parallel Speedup: high, because viewer shell, data contract, ingest, retrieval, and derived-output lanes split cleanly once locator/domain seams exist.
Max Concurrent: 5

### Dependency Matrix <!-- oc:id=sec_ak -->
- **T1**: None -> T9, T10, T11, T20
- **T2**: None -> T8, T12, T13, T15, T18, T21
- **T3**: None -> T10, T13, T14, T15, T16, T17, T19
- **T4**: None -> T7, T8, T9
- **T5**: T1, T4 -> T6, T8, T10, T11, T12, T14, T15, T16, T18, T21
- **T6**: T5 -> T9, T10, T12, T14, T15, T16, T18, T19, T20
- **T7**: T4 -> T9, T10, T11, T12, T13, T14, T15, T16, T17, T18
- **T8**: T2, T4, T5 -> T12, T13, T14, T15, T16, T17, T18, T21
- **T9**: T1, T6, T7 -> T10, T11, T12, T19, T20
- **T10**: T3, T5, T6, T7, T9 -> T15, T16, T18, T19, T20
- **T11**: T5, T7, T9 -> T12, T16
- **T12**: T2, T5, T6, T7, T8, T9, T11 -> T14, T15, T16, T18, T19
- **T13**: T2, T3, T7, T8 -> T14, T15, T17, T19
- **T14**: T3, T5, T6, T7, T8, T12, T13 -> T15, T16, T18, T19, T20
- **T15**: T2, T3, T5, T6, T7, T8, T10, T12, T13, T14 -> T16, T17, T18, T19, T21
- **T16**: T3, T5, T6, T8, T10, T11, T12, T14, T15 -> T19, T21
- **T17**: T3, T7, T8, T13, T15 -> T19, T20
- **T18**: T2, T5, T6, T7, T8, T10, T12, T14, T15 -> T19, T20, T21
- **T19**: T3, T6, T9, T10, T12, T13, T14, T15, T16, T17, T18 -> F1-F4
- **T20**: T1, T6, T9, T10, T14, T17, T18 -> F1-F4
- **T21**: T2, T5, T8, T15, T16, T18 -> F1-F4

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 0**: 4 agents — T1 `unspecified-high`, T2 `unspecified-high`, T3 `deep`, T4 `quick`
- **Wave 1**: 4 agents — T5 `deep`, T6 `deep`, T7 `quick`, T8 `unspecified-high`
- **Wave 2**: 5 agents — T9 `visual-engineering`, T10 `deep`, T11 `visual-engineering`, T12 `unspecified-high`, T13 `unspecified-high`
- **Wave 3**: 4 agents — T14 `deep`, T15 `deep`, T16 `writing`, T17 `quick`
- **Wave 4**: 4 agents — T18 `deep`, T19 `unspecified-high`, T20 `visual-engineering`, T21 `unspecified-high`
- **FINAL**: 4 agents — F1 `deep`, F2 `unspecified-high`, F3 `visual-engineering`, F4 `deep`

---

## TODOs

- [x] 1. Viewer/runtime decision gate

  **What to do**:
  - Compare concrete desktop-first viewer options for PALOT's renderer surface and choose one canonical v1 path.
  - Verify selectable-text support, overlay/highlight feasibility, page navigation hooks, and browser-mode parity needs.
  - Produce a short decision note naming chosen viewer substrate, rejected alternatives, and implications for later native parity.

  **Must NOT do**:
  - Do not start implementing a native/mobile viewer.
  - Do not assume existing PDF support in the repo covers text selection/highlighting.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: architectural decision with practical implementation consequences.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `runtime-config-contract`: not core yet unless new surface env contracts appear.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with T2, T3, T4)
  - **Blocks**: T5, T9, T20
  - **Blocked By**: None

  **References**:
  - `docs/firefly-surface-playbook.md` - Firefly side-panel-first surface policy and shell constraints.
  - `apps/desktop/src/renderer/components/side-panel/files-panel.tsx` - existing file preview/document handling surface to inspect for preview integration and reuse boundaries.
  - `apps/desktop/src/preload/api.d.ts` - existing preload-exposed preview/document-related APIs and any file-preview contracts.
  - `README.md` - confirms current desktop/browser-mode runtime split and supported attachment context.

  **Acceptance Criteria**:
  - [ ] Canonical desktop-first viewer path chosen and written into plan-execution notes.
  - [ ] Decision explicitly covers selectable text, jump-to-span support, browser-mode parity, and native parity implications.
  - [ ] Rejected alternatives documented with reason.

  **QA Scenarios**:
  ```
  Scenario: Decision note grounded in real repo/runtime constraints
    Tool: Bash + Read
    Preconditions: repo available locally
    Steps:
      1. Read cited runtime/surface files and compare candidate viewer options against real shell constraints.
      2. Produce decision note listing chosen path and rejected paths.
      3. Verify note references concrete repo files and not abstract guesses.
    Expected Result: One chosen viewer path with evidence-backed tradeoff note.
    Failure Indicators: Note relies on assumptions only, or ignores browser-mode/selection constraints.
    Evidence: .sisyphus/evidence/task-1-viewer-decision.md

  Scenario: Failure path — no viable viewer proves selectable text support
    Tool: Bash + Read
    Preconditions: candidate viewer gaps discovered
    Steps:
      1. Record missing selectable-text capability or blocking unknown.
      2. Mark downstream viewer tasks blocked on proof-of-concept rather than silently continuing.
    Expected Result: Explicit blocker captured, not hidden.
    Evidence: .sisyphus/evidence/task-1-viewer-blocker.md
  ```

  **Commit**: NO

- [x] 2. Storage + sync + scope contract gate

  **What to do**:
  - Decide authoritative scopes for document, annotation, note, project, artifact, and table records.
  - Define what is session-scoped vs document-scoped vs project-scoped vs user-scoped.
  - Establish desktop-first persistence expectation plus shared contract for future native clients.

  **Must NOT do**:
  - Do not let annotations or notes inherit ad hoc session-only scope if they need document/project durability.
  - Do not create duplicate storage models for the same concept.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: data ownership and persistence boundaries affect all later tasks.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T8, T12, T13, T15, T18, T21
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/services/memory-service.ts` - precedent for local/remote/hybrid scope handling.
  - `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx` - UX precedent for durable records with degraded fallback.
  - `docs/genui-artifact-architecture.md` - explicit discussion of session-scoped artifacts and future persistence expansion.
  - `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx` - current session-draft-only notes precedent to avoid overusing for durable paper notes.

  **Acceptance Criteria**:
  - [ ] Scope table exists for each core entity.
  - [ ] Authoritative persistence layer identified for v1.
  - [ ] Native/mobile contract implications documented.
  - [ ] No entity has conflicting scopes.

  **QA Scenarios**:
  ```
  Scenario: Scope matrix is internally consistent
    Tool: Read
    Preconditions: storage/scope contract drafted
    Steps:
      1. Inspect matrix for document, annotation, note, project, artifact, table, and audio entities.
      2. Verify each entity names one source of truth and one durability scope.
      3. Verify future native parity notes exist where renderer-only state would otherwise leak.
    Expected Result: Clean scope table with no contradictory ownership.
    Failure Indicators: Same entity listed as both session-only and document-durable, or no native boundary note.
    Evidence: .sisyphus/evidence/task-2-scope-matrix.md

  Scenario: Failure path — unresolved persistence ownership
    Tool: Read
    Preconditions: persistence decision incomplete
    Steps:
      1. Mark unresolved entities explicitly.
      2. Block dependent tasks from assuming storage shape.
    Expected Result: Unresolved scope is surfaced as a blocker.
    Evidence: .sisyphus/evidence/task-2-scope-blockers.md
  ```

  **Commit**: NO

- [x] 3. Retrieval/masking/ingest seam audit

  **What to do**:
  - Audit what PALOT/Firefly already has for ingest jobs, search/retrieval, embeddings, masking proxy boundaries, and async background processing.
  - Separate confirmed reusable seams from unknowns and net-new work.
  - Define safe defaults where proof is missing, especially around masked quote offsets and grounded citation resolution.

  **Must NOT do**:
  - Do not assume existing hybrid retrieval or masking pipelines are already wired in this repo.
  - Do not let quote resolution depend on masked text without explicit verification.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: cross-cutting investigation with uncertain reuse assumptions.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T10, T13, T14, T15, T16, T17, T19
  - **Blocked By**: None

  **References**:
  - User-provided spec text in draft/plan context - states masking proxy and hoped-for retrieval reuse, but not confirmed locally.
  - `apps/desktop/src/renderer/services/memory-service.ts` - current local/remote memory pattern as nearest retrieval-adjacent local precedent.
  - `apps/desktop/src/renderer/atoms/chat.ts` - prompt augmentation precedent relevant to grounded context injection.

  **Acceptance Criteria**:
  - [ ] Audit distinguishes confirmed reuse, probable reuse, and net-new implementation areas.
  - [ ] Masking/quote-offset risk explicitly documented.
  - [ ] Ingest/background job seam named for desktop/browser-mode path.

  **QA Scenarios**:
  ```
  Scenario: Audit classifies assumptions honestly
    Tool: Read
    Preconditions: audit note drafted
    Steps:
      1. Review each claimed reuse seam.
      2. Tag as confirmed, probable, or unknown based on actual repo evidence.
      3. Verify masking/quote-offset risk is called out.
    Expected Result: No unsupported reuse claims remain unqualified.
    Failure Indicators: Unknown seam described as existing fact, or masking risk omitted.
    Evidence: .sisyphus/evidence/task-3-reuse-audit.md

  Scenario: Failure path — no existing retrieval/masking seam found
    Tool: Read
    Preconditions: audit shows missing infrastructure
    Steps:
      1. Record missing seam.
      2. Add explicit net-new tasks/default behavior notes.
    Expected Result: Missing seam becomes scoped net-new work instead of hidden dependency.
    Evidence: .sisyphus/evidence/task-3-net-new-seams.md
  ```

  **Commit**: NO

- [x] 4. Document domain map + existing shell fit audit

  **What to do**:
  - Map how PDF review concepts fit existing Firefly shell pieces: registry, side-panel tab persistence, chat width behavior, widgets, and command palette discoverability.
  - Identify exact insertion points for new surface wiring and user navigation paths.

  **Must NOT do**:
  - Do not invent a second shell route unless side-panel-first proof fails.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded local architecture mapping.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T5, T7, T8
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - source-of-truth for registered side-panel surfaces.
  - `apps/desktop/src/renderer/components/agent-detail.tsx` - split-pane composition and available-tab calculation.
  - `apps/desktop/src/renderer/components/chat/chat-view.tsx` - chat width behavior when side panel is open.
  - `apps/desktop/src/renderer/atoms/ui.ts` - active-tab persistence and side-panel route state.
  - `apps/desktop/src/renderer/components/command-palette.tsx` - discoverability/toggle entry precedent.

  **Acceptance Criteria**:
  - [ ] Exact files to touch for shell integration are listed.
  - [ ] Open/close/focus/discoverability path documented.
  - [ ] No shell duplication proposed.

  **QA Scenarios**:
  ```
  Scenario: Shell integration map is concrete
    Tool: Read
    Preconditions: shell fit note drafted
    Steps:
      1. Verify each integration seam names concrete file paths.
      2. Confirm open/close/focus/discoverability paths are all covered.
    Expected Result: Executor can wire the surface without rediscovering shell architecture.
    Failure Indicators: Vague references like "update the shell" with no file path.
    Evidence: .sisyphus/evidence/task-4-shell-map.md

  Scenario: Failure path — side-panel-first proof does not fit shell
    Tool: Read
    Preconditions: shell conflict found
    Steps:
      1. Record exact shell limitation.
      2. Propose minimal route/surface escalation only if necessary.
    Expected Result: Escalation justified with evidence.
    Evidence: .sisyphus/evidence/task-4-shell-escalation.md
  ```

  **Commit**: NO

- [x] 5. Shared locator/span contract

  **What to do**:
  - Define versioned locator object and related shared types used by citations, annotations, notes, search hits, project chat, artifacts, and table cells.
  - Make `documentId` first-class and include page, quote, positions, and optional structural anchors.
  - Specify serialization rules, schema versioning, and degraded-state fields.

  **Must NOT do**:
  - Do not let any downstream feature invent its own anchor shape.
  - Do not omit `documentId`.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: foundational contract with many dependents.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential foundation in Wave 1
  - **Blocks**: T6, T8, T10, T11, T12, T14, T15, T16, T18, T21
  - **Blocked By**: T1, T4

  **References**:
  - User-provided locator strawman in request text.
  - `apps/desktop/src/renderer/lib/types.ts` - likely home for cross-surface shared types; inspect current renderer domain typing patterns.
  - `docs/genui-artifact-architecture.md` - good precedent for stable IDs, scope rules, and source linkage.
  - External research summary from Hypothesis/W3C/Readium captured in draft.

  **Acceptance Criteria**:
  - [ ] Single versioned locator contract defined.
  - [ ] Covers single-doc and multi-doc cases.
  - [ ] Covers resolved and unresolved/degraded states.
  - [ ] Named consumers listed so no downstream team forks the schema.

  **QA Scenarios**:
  ```
  Scenario: Locator contract covers all consumers
    Tool: Read
    Preconditions: locator schema drafted
    Steps:
      1. Check citations, annotations, search hits, project answers, artifact references, and table cells against the schema.
      2. Verify each can express its needed anchor without adding extra ad hoc fields.
    Expected Result: One schema fits all listed consumers.
    Failure Indicators: Any consumer needs a separate bespoke anchor object.
    Evidence: .sisyphus/evidence/task-5-locator-contract.md

  Scenario: Failure path — unresolved locator cannot degrade safely
    Tool: Read
    Preconditions: schema lacks degraded state fields
    Steps:
      1. Attempt to model unresolved quote/page-only state.
      2. Add missing fields or flag blocker.
    Expected Result: Schema handles unresolved cases explicitly.
    Evidence: .sisyphus/evidence/task-5-locator-degraded.md
  ```

  **Commit**: NO

- [x] 6. Locator resolution engine

  **What to do**:
  - Define resolver algorithm order: precise structural/page/position anchors first, then quote/context-first fuzzy matching, then page fallback.
 - Specify required extracted-text normalization and repeat-quote disambiguation strategy.
  - Define durability checks across reopen, rerender, zoom, and minor extraction drift.

  **Must NOT do**:
  - Do not promise exact resolution in all cases.
  - Do not hide ambiguous matches.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: algorithmic core with edge-case-heavy behavior.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T7, T8 after T5 exists)
  - **Blocks**: T9, T10, T12, T14, T15, T16, T18, T19, T20
  - **Blocked By**: T5

  **References**:
  - Draft research summary of Hypothesis fuzzy anchoring approach.
  - User request text describing OpenPaper's string-match baseline and degraded page fallback.
  - `apps/desktop/src/renderer/genui/genui-renderer.tsx` - precedent for incremental parsing and pending/degraded render states.

  **Acceptance Criteria**:
  - [ ] Resolver algorithm order documented.
  - [ ] Ambiguous/repeated quote handling documented.
  - [ ] Degraded outcomes produce explicit states, not silent mislinks.
  - [ ] Durability requirements listed.

  **QA Scenarios**:
  ```
  Scenario: Resolver handles exact and fuzzy paths
    Tool: Read
    Preconditions: resolver spec drafted with sample locators
    Steps:
      1. Walk one exact-anchor case, one structure-drift case, and one quote-only case through the algorithm.
      2. Verify each reaches a deterministic state: resolved, ambiguous, or page fallback.
    Expected Result: Resolution path is explicit for each case.
    Failure Indicators: Resolver spec handwaves repeated quotes or drift cases.
    Evidence: .sisyphus/evidence/task-6-resolver-walkthrough.md

  Scenario: Failure path — repeated quote produces false precision
    Tool: Read
    Preconditions: sample repeated text exists in spec examples
    Steps:
      1. Evaluate repeated quote case.
      2. Confirm ambiguous state is allowed instead of wrong jump.
    Expected Result: False precision prevented.
    Evidence: .sisyphus/evidence/task-6-ambiguity.md
  ```

  **Commit**: NO

- [x] 7. PDF review side-panel shell registration

  **What to do**:
  - Add the PDF review surface to the Firefly registry path in the plan, including tab ID, flag default, command IDs, persistence key, telemetry namespace, and spawn location.
  - Decide whether v1 should default on or off.
  - Define discoverability through command palette and app bar state.

  **Must NOT do**:
  - Do not bypass `firefly-surface-registry.tsx` or `atoms/ui.ts`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: straightforward shell wiring once architecture is known.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T9, T10, T11, T12, T13, T14, T15, T16, T17, T18
  - **Blocked By**: T4

  **References**:
  - `docs/firefly-surface-playbook.md` - required registry path and flag policy.
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - source-of-truth shape.
  - `apps/desktop/src/renderer/atoms/feature-flags.ts` - flag defaults and toggle pattern.
  - `apps/desktop/src/renderer/components/command-palette.tsx` - toggle/discoverability precedent.

  **Acceptance Criteria**:
  - [ ] Shell registration path fully specified.
  - [ ] Default flag policy justified.
  - [ ] Restore/focus safety called out when surface unavailable.

  **QA Scenarios**:
  ```
  Scenario: Surface registration follows house path
    Tool: Read
    Preconditions: shell registration notes drafted
    Steps:
      1. Check tab ID, flag, command IDs, persistence key, telemetry namespace, and spawn file are all named.
      2. Verify command palette/discoverability path is included.
    Expected Result: Surface can be wired without bespoke shell behavior.
    Failure Indicators: Missing one or more registry fields.
    Evidence: .sisyphus/evidence/task-7-surface-registration.md

  Scenario: Failure path — surface disabled after being last active
    Tool: Read
    Preconditions: restore behavior described
    Steps:
      1. Verify fallback-to-valid-tab rule is covered.
      2. Ensure no startup break from disabled persisted tab.
    Expected Result: Safe restore path documented.
    Evidence: .sisyphus/evidence/task-7-restore-safety.md
  ```

  **Commit**: NO

- [x] 8. Document/annotation/project data model

  **What to do**:
  - Define core entities and relations: document, extracted text/chunks, annotation, note, project, project-document join, artifact, table schema, table row/cell, audio summary, ingest status.
  - Mark which entities need versioning or migration support.
  - Ensure all span-bearing entities reference the shared locator contract.

  **Must NOT do**:
  - Do not mix UI-only state with durable domain state.
  - Do not leave project/document ownership implicit.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: substantial domain modeling with persistence implications.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T12, T13, T14, T15, T16, T17, T18, T21
  - **Blocked By**: T2, T4, T5

  **References**:
  - `apps/desktop/src/renderer/lib/types.ts` - current domain typing patterns.
  - `docs/genui-artifact-architecture.md` - record/source-link/pin/scope modeling precedent.
  - `apps/desktop/src/renderer/services/memory-service.ts` - durable record conversion precedent.

  **Acceptance Criteria**:
  - [ ] Entity map includes all requested features.
  - [ ] Relationships are explicit.
  - [ ] Versioned/migratable entities identified.
  - [ ] No span-bearing entity bypasses the locator contract.

  **QA Scenarios**:
  ```
  Scenario: Domain model covers requested product surface
    Tool: Read
    Preconditions: entity-relationship note drafted
    Steps:
      1. Check each requested feature maps to one or more entities.
      2. Verify ownership and joins are explicit.
    Expected Result: No feature depends on an unmodeled entity.
    Failure Indicators: Artifacts/tables/audio/ingest missing durable representation.
    Evidence: .sisyphus/evidence/task-8-domain-model.md

  Scenario: Failure path — span-bearing entity bypasses locator contract
    Tool: Read
    Preconditions: model drafted
    Steps:
      1. Inspect annotation, citation, table cell, search hit, artifact reference entities.
      2. Confirm each references shared locator.
    Expected Result: Zero ad hoc span references.
    Evidence: .sisyphus/evidence/task-8-span-integrity.md
  ```

  **Commit**: NO

- [x] 9. Desktop viewer integration

  **What to do**:
  - Plan the chosen desktop viewer integration into the PDF review surface.
  - Define page navigation, text layer, jump-to-span, scroll/flash behavior, zoom/re-render considerations, and browser-mode parity expectations.
  - Ensure the viewer can surface selection rects/actions without breaking shell responsiveness.

  **Must NOT do**:
  - Do not conflate viewer rendering with locator logic.
  - Do not require hidden internal state access to prove behavior.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: viewer surface, selection UX, and responsive shell behavior are UI-heavy.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T11, T12, T19, T20
  - **Blocked By**: T1, T6, T7

  **References**:
  - T1 decision note.
  - `apps/desktop/src/renderer/components/agent-detail.tsx` - split-pane host.
  - `apps/desktop/src/renderer/components/chat/chat-view.tsx` - side-panel-open width behavior to preserve.
  - `apps/desktop/src/renderer/components/review/review-panel.tsx` - precedent for high-density side-panel rendering and graceful performance controls.

  **Acceptance Criteria**:
  - [ ] Viewer can open document, navigate to page/span, and render selection layer.
  - [ ] Side panel remains performant and readable.
  - [ ] Reopen/rerender/zoom behavior accounted for.

  **QA Scenarios**:
  ```
  Scenario: Jump-to-span works from side panel UI
    Tool: Playwright
    Preconditions: dev stack running with sample text PDF loaded in PDF review surface
    Steps:
      1. Open session with PDF review tab active.
      2. Trigger a known citation or annotation jump.
      3. Assert viewer scrolls to correct page area and temporary highlight appears.
    Expected Result: Document lands on expected location without shell breakage.
    Failure Indicators: Wrong page, no highlight, or side panel becomes unusable.
    Evidence: .sisyphus/evidence/task-9-jump-to-span.png

  Scenario: Failure path — zoom/re-render loses current anchor
    Tool: Playwright
    Preconditions: document open with known anchor visible
    Steps:
      1. Change zoom or force rerender.
      2. Re-trigger same anchor jump.
    Expected Result: Anchor still resolves or degrades explicitly.
    Evidence: .sisyphus/evidence/task-9-rerender-anchor.png
  ```

  **Commit**: NO

- [x] 10. Grounded citation streaming protocol

  **What to do**:
  - Define message annotation syntax, incremental parser behavior, citation chip rendering, and lazy resolution path for grounded answers.
  - Reuse the local streaming/parser pattern where possible.
  - Ensure unresolved citations render as degraded source references, never false exact jumps.

  **Must NOT do**:
  - Do not buffer the full answer just to post-process citations.
  - Do not let citations imply exact source match when unresolved.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: protocol design + streaming behavior + grounding semantics.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T15, T16, T18, T19, T20
  - **Blocked By**: T3, T5, T6, T7, T9

  **References**:
  - `apps/desktop/src/renderer/genui/genui-renderer.tsx` - existing incremental fence parser and pending/degraded render behavior.
  - `apps/desktop/src/renderer/atoms/chat.ts` - prompt augmentation precedent.
  - User request text describing OpenPaper's streaming-while-grounded requirement.

  **Acceptance Criteria**:
  - [ ] Citation annotation syntax specified.
  - [ ] Stream parser behavior specified for partial/incomplete tags.
  - [ ] Click path to resolver defined.
  - [ ] Unresolved state UI specified.

  **QA Scenarios**:
  ```
  Scenario: Answer streams with inline citations before completion
    Tool: Playwright
    Preconditions: sample question returns grounded answer
    Steps:
      1. Submit question against loaded PDF.
      2. Observe streamed answer while still in progress.
      3. Assert citation chips appear before final message completion.
    Expected Result: Streaming and grounding coexist.
    Failure Indicators: No citations until end, or entire answer buffered.
    Evidence: .sisyphus/evidence/task-10-streaming-citations.mp4

  Scenario: Failure path — unresolved citation degrades safely
    Tool: Playwright
    Preconditions: sample citation intentionally unresolved
    Steps:
      1. Click unresolved citation.
      2. Assert UI shows degraded fallback like source not found/page fallback, not a wrong jump.
    Expected Result: No false precision.
    Evidence: .sisyphus/evidence/task-10-unresolved-citation.png
  ```

  **Commit**: NO

- [x] 11. Selection action menu

  **What to do**:
  - Define text-selection UX, action registry, anchored floating menu behavior, and integration with chat and annotation flows.
  - Include actions for highlight, note, ask AI, and explain, with extensibility for future actions.

  **Must NOT do**:
  - Do not hardwire action behavior directly into viewer internals.
  - Do not ignore multi-line, multi-page, or overlapping selection cases.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: anchored selection UI and ergonomic interaction design.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T12, T16
  - **Blocked By**: T5, T7, T9

  **References**:
  - User request text describing inline highlight action menu.
  - `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx` - send-to-chat interaction precedent.
  - `apps/desktop/src/renderer/atoms/pane-bus.ts` - writer/composer integration seam to inspect for chat insertion patterns.

  **Acceptance Criteria**:
  - [ ] Menu anchor behavior specified.
  - [ ] Action registry shape specified.
  - [ ] Ask-AI path feeds grounded context into chat.
  - [ ] Edge cases for scroll/deselect/overlap covered.

  **QA Scenarios**:
  ```
  Scenario: Text selection opens anchored action menu
    Tool: Playwright
    Preconditions: selectable text visible in PDF review surface
    Steps:
      1. Drag-select a known sentence.
      2. Assert floating menu appears near selection.
      3. Click Ask AI.
      4. Assert selected text is inserted into chat/request context.
    Expected Result: Selection menu behaves in-flow and action pipes context correctly.
    Failure Indicators: Menu detached, selection lost, or chat context missing selection.
    Evidence: .sisyphus/evidence/task-11-selection-menu.png

  Scenario: Failure path — scroll while menu open
    Tool: Playwright
    Preconditions: menu open on selection
    Steps:
      1. Scroll document.
      2. Assert menu repositions or closes safely.
    Expected Result: No orphaned floating UI.
    Evidence: .sisyphus/evidence/task-11-scroll-close.png
  ```

  **Commit**: NO

- [x] 12. Annotations + notes integration

  **What to do**:
  - Plan persisted highlights, note attachment, reopen/jump behavior, and AI-context integration.
  - Reuse existing notes/artifact patterns where sensible while moving from session drafts to document/project durability.
  - Define overlapping annotation behavior and sync semantics.

  **Must NOT do**:
  - Do not leave notes as session-only drafts if they are meant to persist with documents.
  - Do not create a second disconnected notes model.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: mixes data durability, UI behavior, and AI-context implications.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T14, T15, T16, T18, T19
  - **Blocked By**: T2, T5, T6, T7, T8, T9, T11

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx` - local note UX precedent to extend, not duplicate.
  - `apps/desktop/src/renderer/services/memory-service.ts` - durable record pattern.
  - User request text describing highlight persistence, note attachment, cross-device sync, and AI awareness.

  **Acceptance Criteria**:
  - [ ] Annotation entity and note linkage specified.
  - [ ] Reopen and jump-to-annotation path specified.
  - [ ] AI context inclusion policy specified.
  - [ ] Overlap/sync semantics specified.

  **QA Scenarios**:
  ```
  Scenario: Highlight persists and reopens on same document
    Tool: Playwright
    Preconditions: document loaded, durable store available
    Steps:
      1. Create highlight with note.
      2. Close and reopen document/session.
      3. Assert highlight and note still appear and can be navigated to.
    Expected Result: Annotation durability works end-to-end.
    Failure Indicators: Highlight disappears or note detaches.
    Evidence: .sisyphus/evidence/task-12-highlight-reopen.png

  Scenario: Failure path — overlapping or repeated highlight conflict
    Tool: Playwright
    Preconditions: one highlight already exists
    Steps:
      1. Create overlapping selection/highlight.
      2. Assert UI handles overlap deterministically.
    Expected Result: Overlap is represented or blocked explicitly, not corrupted.
    Evidence: .sisyphus/evidence/task-12-overlap.png
  ```

  **Commit**: NO

- [x] 13. Upload ingest brief + starter questions

  **What to do**:
  - Plan upload -> text extraction -> metadata/brief/starter-question generation -> persistence -> reopen flow.
  - Include ingest status model and partial-failure behavior.
  - Keep grounding tied to the locator contract where possible.

  **Must NOT do**:
  - Do not make reopen depend on re-running the model every time.
  - Do not hide ingest failures.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: async ingest pipeline + persisted AI-derived outputs.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T14, T15, T17, T19
  - **Blocked By**: T2, T3, T7, T8

  **References**:
  - User request text describing upload brief + starter questions.
  - `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx` - async load/error state precedent.

  **Acceptance Criteria**:
  - [ ] Ingest states defined.
  - [ ] Brief/questions persisted and reopened instantly.
  - [ ] Partial failure path specified.
  - [ ] Starter questions have a direct chat-seeding path.

  **QA Scenarios**:
  ```
  Scenario: New upload produces persisted brief and starter questions
    Tool: Playwright + Bash
    Preconditions: sample text PDF available
    Steps:
      1. Upload PDF.
      2. Wait for ingest completion state.
      3. Assert brief and 3-5 starter questions render.
      4. Reload/reopen and assert they appear without regeneration delay.
    Expected Result: Ingest-derived opening context is durable.
    Failure Indicators: No starter questions, or reopen triggers visible regeneration dependency.
    Evidence: .sisyphus/evidence/task-13-ingest-brief.png

  Scenario: Failure path — extraction fails or PDF has no text
    Tool: Playwright
    Preconditions: problematic/scanned PDF fixture
    Steps:
      1. Upload problematic file.
      2. Assert ingest status surfaces failure/degraded state clearly.
    Expected Result: Failure visible, not silent.
    Evidence: .sisyphus/evidence/task-13-ingest-failure.png
  ```

  **Commit**: NO

- [x] 14. Corpus search

  **What to do**:
  - Define searchable corpus across uploaded documents, annotations, and notes.
  - Specify indexing units, result ranking policy, and source-span clickback using the shared locator contract.
  - Include degraded behavior when only lexical or only semantic indexing is available.

  **Must NOT do**:
  - Do not couple search result anchors to viewer-only transient positions.
  - Do not promise sophisticated ranking before seam audit proves infrastructure.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: retrieval design plus clickback grounding.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T15, T16, T18, T19, T20
  - **Blocked By**: T3, T5, T6, T7, T8, T12, T13

  **References**:
  - User request text describing hybrid retrieval hopes and corpus search behavior.
  - T3 audit output.
  - `apps/desktop/src/renderer/services/memory-service.ts` - search/fetch mode precedent.

  **Acceptance Criteria**:
  - [ ] Search index units and scopes defined.
  - [ ] Result object includes source locator.
  - [ ] Degraded ranking mode documented.
  - [ ] Clickback path to document source defined.

  **QA Scenarios**:
  ```
  Scenario: Query returns clickable grounded results across corpus
    Tool: Playwright
    Preconditions: at least two documents plus annotations/notes indexed
    Steps:
      1. Run known search query.
      2. Assert ranked results include source labels and click targets.
      3. Click result and verify document jump works.
    Expected Result: Search result acts as grounded navigation, not plain text only.
    Failure Indicators: Result lacks source locator or jump fails.
    Evidence: .sisyphus/evidence/task-14-corpus-search.png

  Scenario: Failure path — semantic index unavailable
    Tool: Playwright + Bash
    Preconditions: semantic path disabled/unavailable
    Steps:
      1. Run same query.
      2. Assert lexical/degraded mode still returns transparent results or explicit limitation.
    Expected Result: Search degrades honestly.
    Evidence: .sisyphus/evidence/task-14-search-degraded.png
  ```

  **Commit**: NO

- [x] 15. Projects + cross-document chat contract

  **What to do**:
  - Define project grouping, project-document joins, project-scoped retrieval, and cross-document chat behavior.
  - Ensure citations remain document-aware and verifiable across multiple sources.
  - Specify project entry points and how document context is selected or switched during citation jumps.

  **Must NOT do**:
  - Do not reuse single-doc locators without `documentId`.
  - Do not make cross-doc answers opaque about which document was used.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: multi-document retrieval and grounding semantics.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16, T17, T18, T19, T21
  - **Blocked By**: T2, T3, T5, T6, T7, T8, T10, T12, T13, T14

  **References**:
  - User request text describing project grouping and cross-document chat.
  - `apps/desktop/src/renderer/lib/types.ts` - inspect existing project/session typing patterns.

  **Acceptance Criteria**:
  - [ ] Project entity and join model defined.
  - [ ] Cross-doc answer contract names source document for each citation.
  - [ ] Jump-to-source flow covers switching active document when needed.

  **QA Scenarios**:
  ```
  Scenario: Cross-document answer cites multiple source documents
    Tool: Playwright
    Preconditions: project contains at least two documents with known contrasting content
    Steps:
      1. Ask project-level question spanning both documents.
      2. Assert answer contains citations referencing more than one document.
      3. Click each citation and verify correct document opens/jumps.
    Expected Result: Cross-doc grounding stays verifiable.
    Failure Indicators: Citations lose document identity or jump into wrong document.
    Evidence: .sisyphus/evidence/task-15-cross-doc-chat.png

  Scenario: Failure path — same quote exists in multiple docs
    Tool: Playwright
    Preconditions: project contains duplicate quote across docs
    Steps:
      1. Ask question triggering duplicate text.
      2. Assert answer/citation retains document-specific target or degrades explicitly.
    Expected Result: No cross-doc false precision.
    Evidence: .sisyphus/evidence/task-15-duplicate-quote.png
  ```

  **Commit**: NO

- [x] 16. Artifact generation from sources

  **What to do**:
  - Define how project or document sources generate editable artifacts inside Firefly.
  - Ensure claims in generated artifacts retain source linkage via locator references.
  - Decide artifact scope and how it integrates with the existing GenUI/artifact surface without duplicating systems.

  **Must NOT do**:
  - Do not create a disconnected artifact subsystem.
  - Do not strip grounding when moving from answer to editable artifact.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: output artifact behavior and editable-document flow design.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T21
  - **Blocked By**: T3, T5, T6, T8, T10, T11, T12, T14, T15

  **References**:
  - `docs/genui-artifact-architecture.md` - artifact capture, stable IDs, scope, and side-panel/session-widget behavior.
  - `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx` - existing artifact browsing surface.
  - `apps/desktop/src/renderer/atoms/chat.ts` - artifact prompt-context injection precedent.

  **Acceptance Criteria**:
  - [ ] Artifact scope and source-link model defined.
  - [ ] Existing artifact surface integration path defined.
  - [ ] Generated artifact claims can reference source locators.

  **QA Scenarios**:
  ```
  Scenario: Generated artifact preserves source linkage
    Tool: Playwright
    Preconditions: project with enough source material for artifact generation
    Steps:
      1. Generate artifact from project sources.
      2. Assert artifact appears in expected Firefly artifact surface.
      3. Trigger source-link interaction for one claim.
    Expected Result: Artifact remains grounded and integrated with existing surface.
    Failure Indicators: Artifact appears as disconnected text blob with no source linkage.
    Evidence: .sisyphus/evidence/task-16-artifact-grounding.png

  Scenario: Failure path — artifact surface integration conflict
    Tool: Read + Playwright
    Preconditions: existing artifact surface active
    Steps:
      1. Generate artifact while existing artifacts already present.
      2. Assert no duplicate artifact systems or invisible records appear.
    Expected Result: One coherent artifact path.
    Evidence: .sisyphus/evidence/task-16-artifact-coherence.png
  ```

  **Commit**: NO

- [x] 17. Audio summary pipeline

  **What to do**:
  - Decide whether audio summaries generate on-demand or during ingest for v1.
  - Define summary source, caching, regeneration policy, and project-vs-document scope.
  - Keep this independent from core grounding path except where source summary provenance matters.

  **Must NOT do**:
  - Do not let audio summary block core reader/citation delivery.
  - Do not generate uncached expensive summaries on every reopen.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded feature with clear cache/cost decisions.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T20
  - **Blocked By**: T3, T7, T8, T13, T15

  **References**:
  - User request text describing audio summary and existing TTS hopes.

  **Acceptance Criteria**:
  - [ ] Scope and trigger policy decided.
  - [ ] Cache key/source defined.
  - [ ] Failure and regeneration behavior defined.

  **QA Scenarios**:
  ```
  Scenario: Audio summary generates and replays from cache
    Tool: Playwright + Bash
    Preconditions: document/project summary path enabled
    Steps:
      1. Trigger audio summary generation.
      2. Wait for ready state.
      3. Reopen same document/project and assert ready state returns without full regeneration.
    Expected Result: Cached playback path works.
    Failure Indicators: Summary regenerates every reopen.
    Evidence: .sisyphus/evidence/task-17-audio-cache.png

  Scenario: Failure path — audio generation timeout
    Tool: Playwright
    Preconditions: simulated timeout/failure
    Steps:
      1. Trigger summary.
      2. Assert UI shows retryable failure state.
    Expected Result: Audio failure does not poison rest of reader experience.
    Evidence: .sisyphus/evidence/task-17-audio-failure.png
  ```

  **Commit**: NO

- [x] 18. Grounded data tables

  **What to do**:
  - Define custom schema builder, extraction job shape, row/cell storage, cell grounding, and CSV export rules.
  - Ensure each cell stores value plus source locator(s).
  - Decide batching/cost-control behavior for project size and extraction prompts.

  **Must NOT do**:
  - Do not store bare values without provenance.
  - Do not promise unlimited project scale without cost controls.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: structured extraction design plus provenance and cost concerns.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T19, T20, T21
  - **Blocked By**: T2, T5, T6, T7, T8, T10, T12, T14, T15

  **References**:
  - User request text describing custom schema extraction, grounded cells, and CSV export.
  - T15 project retrieval contract.

  **Acceptance Criteria**:
  - [ ] Schema, row, and cell model defined.
  - [ ] Each cell includes provenance.
  - [ ] Cost/batching controls documented.
  - [ ] CSV export behavior documented clearly.

  **QA Scenarios**:
  ```
  Scenario: Data table cell links back to source span
    Tool: Playwright
    Preconditions: project with extracted table rows ready
    Steps:
      1. Open generated table.
      2. Click a known cell.
      3. Assert source document opens at relevant span.
    Expected Result: Every visible extracted datum stays verifiable.
    Failure Indicators: Cell has no source link or jumps incorrectly.
    Evidence: .sisyphus/evidence/task-18-cell-grounding.png

  Scenario: Failure path — extraction cost guard engages
    Tool: Bash + Read
    Preconditions: project exceeds defined batch threshold
    Steps:
      1. Trigger extraction over oversized project/schema.
      2. Assert batching/guardrail behavior is explicit.
    Expected Result: Controlled extraction, not silent runaway cost.
    Evidence: .sisyphus/evidence/task-18-cost-guard.md
  ```

  **Commit**: NO

- [x] 19. Degraded-state and error-handling hardening

  **What to do**:
  - Consolidate degraded behaviors across unresolved citations, no-text PDFs, repeated quotes, ingest failure, search gaps, audio failure, and stale/deleted project documents.
  - Define user-visible states and retry/escape hatches.

  **Must NOT do**:
  - Do not leave failure behavior implicit per feature.
  - Do not allow silent false precision.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: cross-feature quality hardening.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: T3, T6, T9, T10, T12, T13, T14, T15, T16, T17, T18

  **References**:
  - All prior task specs, especially T6/T10/T13/T15/T18.
  - `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx` - simple error-state precedent.
  - `apps/desktop/src/renderer/genui/genui-renderer.tsx` - pending/error/degraded render precedent.

  **Acceptance Criteria**:
  - [ ] Shared degraded-state matrix exists.
  - [ ] Every major failure mode maps to visible UX and retry/fallback action.
  - [ ] No false-exactness path remains.

  **QA Scenarios**:
  ```
  Scenario: Degraded-state matrix covers all planned failure modes
    Tool: Read
    Preconditions: matrix drafted
    Steps:
      1. Cross-check tasks T6/T10/T13/T15/T17/T18 against matrix.
      2. Verify each has visible state + recovery path.
    Expected Result: No major failure mode omitted.
    Failure Indicators: A task-level failure case has no global degraded-state rule.
    Evidence: .sisyphus/evidence/task-19-degraded-matrix.md

  Scenario: Failure path — stale/deleted project document citation
    Tool: Playwright
    Preconditions: citation points to removed/stale doc fixture
    Steps:
      1. Trigger citation jump.
      2. Assert visible stale-source message and recovery option.
    Expected Result: Broken source surfaced safely.
    Evidence: .sisyphus/evidence/task-19-stale-doc.png
  ```

  **Commit**: NO

- [x] 20. Performance, virtualization, and caching hardening

  **What to do**:
  - Plan performance controls for large PDFs, long chats with many citations, large search result sets, and repeated viewer rerenders.
  - Define when to virtualize, defer, cache, collapse, or lazily resolve.
  - Preserve shell responsiveness with side panel open.

  **Must NOT do**:
  - Do not assume small files only.
  - Do not do eager global resolution of every citation/span if lazy resolution is enough.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: perceived performance and rendering responsiveness dominate this surface.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: T1, T6, T9, T10, T14, T17, T18

  **References**:
  - `apps/desktop/src/renderer/components/review/review-panel.tsx` - strong precedent for virtualization, gated loading, and worker offload.
  - `apps/desktop/src/renderer/components/chat/chat-view.tsx` - shell width/scroll behavior to preserve.
  - `apps/desktop/src/renderer/components/session-widgets/session-widget-shell.tsx` - side-panel-open layout interplay.

  **Acceptance Criteria**:
  - [ ] Performance gates specified for large docs and large result sets.
  - [ ] Lazy resolution/caching policy specified.
  - [ ] Side-panel responsiveness preserved as explicit requirement.

  **QA Scenarios**:
  ```
  Scenario: Large document remains usable in side panel
    Tool: Playwright
    Preconditions: large text PDF fixture loaded
    Steps:
      1. Open PDF review surface.
      2. Scroll, search, and click citations repeatedly.
      3. Observe responsiveness and visible gating/lazy behavior.
    Expected Result: UI remains responsive with visible lazy/deferred behavior where needed.
    Failure Indicators: frozen shell, eager render spikes, or unusable panel.
    Evidence: .sisyphus/evidence/task-20-large-doc.mp4

  Scenario: Failure path — eager citation resolution overload
    Tool: Playwright + perf logs
    Preconditions: message with many citations
    Steps:
      1. Open message with many citations.
      2. Assert citations do not all pre-resolve synchronously before interaction.
    Expected Result: Lazy resolution policy holds.
    Evidence: .sisyphus/evidence/task-20-lazy-citations.md
  ```

  **Commit**: NO

- [x] 21. Native-contract boundary package-up

  **What to do**:
  - Package shared contracts and seam boundaries so future native/mobile implementation can swap viewer/input/storage without rewriting grounding semantics.
  - Explicitly mark desktop-only implementation details vs shared domain contracts.

  **Must NOT do**:
  - Do not let desktop viewer quirks leak into shared contracts.
  - Do not overbuild native implementation now.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: architecture packaging and future-proofing.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: T2, T5, T8, T15, T16, T18

  **References**:
  - Scope decision from interview: desktop plus contracts.
  - T5/T8/T15/T18 outputs.

  **Acceptance Criteria**:
  - [ ] Shared-vs-desktop-specific seams are documented.
  - [ ] Native/mobile future path is credible without overcommitting implementation.
  - [ ] No desktop-only field leaks into shared contract unless intentionally versioned.

  **QA Scenarios**:
  ```
  Scenario: Shared contract package excludes desktop-only quirks
    Tool: Read
    Preconditions: seam document drafted
    Steps:
      1. Inspect shared domain contracts.
      2. Verify viewer/UI implementation details are isolated to desktop-specific seams.
    Expected Result: Future native teams can reuse contracts without inheriting Electron-specific state.
    Failure Indicators: Shared contract depends on renderer-only concepts.
    Evidence: .sisyphus/evidence/task-21-native-boundary.md

  Scenario: Failure path — desktop-only behavior leaks into shared schema
    Tool: Read
    Preconditions: seam review
    Steps:
      1. Identify any field or interface that only exists for desktop viewer behavior.
      2. Mark for relocation or versioned exception.
    Expected Result: Leak detected explicitly.
    Evidence: .sisyphus/evidence/task-21-desktop-leaks.md
  ```

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_am -->

- [x] F1. **Plan Compliance Audit** — `deep`
  Read implemented work against this plan. Verify every must-have exists, every must-not-have remains absent, and evidence files exist for every task QA scenario.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run repo quality gates applicable to touched areas, inspect changed files for duplicated shell plumbing, ad hoc locator shapes, hidden false-precision states, and performance regressions.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [PASS/FAIL] | VERDICT`

- [ ] F3. **Real QA Scenario Execution** — `visual-engineering`
  Execute all task-level QA scenarios end-to-end using browser automation and supporting commands. Save final evidence under `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N] | Integration [N/N] | Edge cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  Compare final diff to planned scope. Verify desktop-plus-contracts scope held, native implementation did not sprawl, AGPL clean-room guardrails held, and no duplicate artifact/notes/panel systems were introduced.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- Group 1: discovery gates + shared contract scaffolding
- Group 2: shell registration + viewer + citation/selection core
- Group 3: annotations + ingest + search/projects
- Group 4: artifacts/tables/audio + hardening + contract packaging

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
bun run lint
bun run check-types
bun run dev
```

### Final Checklist <!-- oc:id=sec_ap -->
- [ ] All must-have capabilities planned through concrete tasks
- [ ] Shared locator contract introduced before dependent features
- [ ] Desktop-first scope held with explicit native contract boundaries
- [ ] Degraded-state handling exists for all critical grounding failures
- [ ] Firefly registry/shell path preserved with no bespoke panel plumbing