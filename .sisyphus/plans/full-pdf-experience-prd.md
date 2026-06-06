# Full PDF Experience PRD <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Turn the current stub `pdf-review` tab into a real desktop-first PDF research workspace. Keep side panel as research cockpit, but add a dedicated main-pane PDF workspace for serious reading, highlighting, note-taking, citation review, and agent-assisted analysis.
>
> **Deliverables**:
> - Dedicated PDF workspace product architecture
> - Full product requirements for viewer, annotations, notes, citations, search, projects, and agent workflows
> - Phase plan: MVP, premium v1, later phases
> - Execution plan mapped onto existing Elf/Palot seams
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: product architecture -> viewer stack decision -> durable document model -> workspace shell -> viewer primitives -> annotations/citations/search -> agent workflows

---

## Context

### Original Request
Plan full PDF experience. Need a PDF viewing library, ideally React-powered, supporting highlighting, finding, taking notes, and the best review/edit/research experience possible for researchers, law students, and agent-assisted users.

### Interview Summary
**Key Discussions**:
- Current shipped state is insufficient: slot exists, full experience does not.
- Goal is not "add a PDF tab"; goal is a premium PDF research desk.
- Product must support reading, highlighting, notes, review, search, and agent workflows.
- Planning session should produce a full PRD and execution work plan, not implementation.

**Research Findings**:
- Current `pdf-review` surface is a stub at `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx`.
- Side-panel shell already exists through `apps/desktop/src/renderer/firefly-surface-registry.tsx`, `apps/desktop/src/renderer/components/agent-detail.tsx`, `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`, and `apps/desktop/src/renderer/atoms/ui.ts`.
- `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx` already previews PDFs through a bare `iframe` and office-to-PDF conversion seam. Good preview precedent. Not a research-grade reader.
- `apps/desktop/src/renderer/components/side-panel/files-panel.tsx` explicitly routes PDF and office preview to Studio instead of handling document review directly.
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx` and `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx` provide workflow precedents, but both are currently session-scoped, not durable document research models.
- Oracle recommendation: serious PDF product needs a dedicated main-pane workspace. Side panel remains cockpit/control surface.
- Metis review: missing guardrails include citation integrity, privacy/local-first handling, accessibility, performance budgets, degraded mode UX, and explicit handling for scans/OCR/repeated quotes/revised editions.

### Metis Review
**Identified Gaps** (addressed):
- Added explicit guardrails for citation fidelity, local-first privacy, accessibility, and performance.
- Added explicit edge cases: scanned PDFs, repeated quotes, two-column/footnote-heavy papers, corrupted/encrypted docs, revised editions.
- Added explicit boundary between side-panel cockpit and full main-pane workspace.
- Added acceptance criteria around degraded behavior and durable anchoring.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Design a best-in-class PDF research and review experience for Elf/Palot that supports deep reading, durable annotations, precise citations, strong search, project organization, and agent-assisted workflows without collapsing the product into a toy side panel.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Product architecture for PDF workspace + side-panel research cockpit.
- Viewer stack recommendation and fallback options.
- Durable domain model for documents, annotations, citations, notes, projects, and derived artifacts.
- UX requirements for readers, law students, researchers, and heavy review users.
- Engineering execution plan sequenced into phases and parallel waves.
- Explicit defaults for stack, privacy posture, and first-scope boundary.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] PRD defines product shape, personas, in-scope subsystems, guardrails, and phase boundaries.
- [ ] Work plan maps product requirements to concrete Elf/Palot files and insertion points.
- [ ] Viewer/library recommendation is explicit with trade-offs.
- [ ] Architecture clearly separates preview, cockpit, and full workspace modes.
- [ ] Acceptance criteria include happy-path and degraded-path behavior for real-world PDFs.

### Must Have <!-- oc:id=sec_ag -->
- Dedicated main-pane PDF workspace.
- Side-panel research cockpit integrated with existing Firefly surface system.
- `react-pdf` + PDF.js hybrid default stack assumption for planning, with custom research interactions layered in app code.
- Text selection, highlights, notes, search, citations, and durable reading state.
- Local-first persistence for PDFs, notes, annotations, provenance metadata, and indexing defaults.
- First durable execution scope locked to single-document reader/search/highlight/ask flows.
- Clear agent boundaries and provenance-rich outputs.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No side-panel-only compromise for premium reading/review workflows.
- No citation claim without source locator + visible snippet + confidence/degraded state.
- No coordinate-only annotation anchors.
- No transient session-only data model for durable document research state.
- No attempt to solve OCR, citation style engines, collaboration, Zotero-grade bibliography, and autonomous legal research in MVP.
- No bypassing existing renderer/backend/preload service seams.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification should be agent-executed when implementation begins.

### Test Decision
- **Infrastructure exists**: Partial. Repo has quality gates and some unit tests, but no dedicated viewer E2E harness today.
- **Automated tests**: Tests-after
- **Framework**: Existing repo lint/typecheck plus new targeted tests and browser automation for viewer workflows.

### QA Policy
Every execution task must define agent-executed QA with evidence in `.sisyphus/evidence/task-{N}-*.{ext}`.

- **UI/Reader flows**: browser automation for workspace open, search, highlight, notes, and citation jumps.
- **Data model**: verify persistence through authoritative storage/API layer, not local component state alone.
- **Parser/locator flows**: verify exact, ambiguous, degraded, and corrupted-document paths.
- **Performance**: capture budgets for first-page render, search latency, highlight creation latency, and giant-doc fallback behavior.

---

## Product PRD <!-- oc:id=sec_ai -->

### Personas <!-- oc:id=sec_aj -->
- **Researcher**: Reads dense papers and source packets, builds literature matrices, and needs durable evidence capture that survives relaunch.
- **Law student / legal reviewer**: Reads opinions, contracts, and filings; needs pincite-grade quote trust, issue spotting, and repeated-quote disambiguation.
- **Knowledge worker / analyst**: Reviews long reports, specs, and decks; wants grounded summaries, action items, risk tables, and exportable brief artifacts.
- **Agent-assisted operator**: Uses AI for extraction and synthesis, but requires editable outputs, explicit provenance, and confirm-before-mutate workflows.

### Product Promise <!-- oc:id=sec_ak -->
Elf PDF Workspace is a local-first research desk where PDFs become durable, searchable, citeable, annotatable knowledge artifacts that agents can assist with — without breaking trust in the underlying source.

### User Problems <!-- oc:id=sec_al -->
- Current PDF support is preview-only and not suitable for deep reading.
- Notes and artifacts are session-scoped, not document-scoped.
- No durable way to highlight, cite, or ask an agent about specific source spans.
- Side-panel-only UX is too cramped for law/research workflows.
- No reliable path from PDF -> note -> citation -> artifact -> follow-up question.

### Experience Model <!-- oc:id=sec_am -->
Three-tier model:
1. **Inline/quick preview** — identify document quickly. <!-- oc:id=item_aa -->
1. **Side-panel research cockpit** — summary, note list, citations, actions, AI chat, related artifacts. <!-- oc:id=item_ab -->
1. **Main-pane PDF workspace** — serious reader with navigation, selection, highlights, notes, search, citation jumps, and split views. <!-- oc:id=item_ac -->

### Product Defaults <!-- oc:id=sec_an -->
- **Viewer stack default**: `react-pdf` + PDF.js hybrid. Use library for page rendering and text layer, keep search indexing, annotation persistence, citation anchoring, and research interactions in app-owned code.
- **Fallback stack**: direct PDF.js custom integration if wrapper constraints block required UX/perf.
- **Commercial path**: commercial SDK remains an evaluated fallback for later escalation, especially for high-end annotation or form requirements, not default planning assumption.
- **Scope default**: MVP is single-document durable reader/search/highlight/ask; project library and cross-document workflows start in premium v1.
- **Privacy default**: local-first explicit opt-in for remote/model-assisted indexing, embeddings, OCR enrichment, or cloud sync.
- **Document type default**: PDF first; office docs convert into PDF workflow through existing conversion seam.
- **Agent default**: agents may suggest/draft/extract; persistent or destructive document-state changes require user confirmation.

### Wave 1 Architecture Defaults <!-- oc:id=sec_wave1a -->
- **Document identity**: `documentId` is content-hash based, not path-based; manifest stores original source path and ingest provenance separately.
- **Annotation authority**: annotations, citations, and reading state share one locator family rooted in `apps/desktop/src/shared/pdf-locator.ts`, extended rather than replaced.
- **Workspace shell**: full reader lives in a dedicated main-pane route under the existing session shell; side-panel `pdf-review` remains cockpit/control surface rather than primary reading surface.
- **Ingestion seam**: local PDFs ingest directly; office docs flow through existing conversion seam and land as first-class PDF workspace documents after manifest/hash registration.
- **Durability seam**: renderer mirrors state, main process owns durable source of truth via preload/backend service boundaries.

### Functional Requirements <!-- oc:id=sec_ao -->

#### 1. Document Ingestion <!-- oc:id=sec_ap -->
- Import local PDFs.
- Import office docs via existing office-to-PDF conversion seam.
- Support session artifact / generated PDF / downloaded source as document sources later.
- Extract metadata, text layer availability, hash, page count, and ingest status.
- Degrade clearly for encrypted, corrupted, unsupported, and scan-only PDFs.
- Register every imported document through a main-process manifest flow keyed by content hash before it becomes addressable in reader, annotations, or citations.
- Persist original source path, derived PDF path, ingest timestamp, and conversion/OCR status separately from reader state so re-open and re-import stay deterministic.

#### 2. Reader Workspace <!-- oc:id=sec_aq -->
- Open document in dedicated workspace mode.
- Page navigation, thumbnails, outline/bookmarks, zoom, fit width/page, rotation.
- Text layer and selectable text.
- Stable reopen state: page, zoom, last selection context, open side surfaces.
- Keyboard-first control path.
- Reader shell lives in a dedicated main-pane route inside existing session shell; side-panel remains auxiliary cockpit for notes, citations, AI actions, and artifact context.
- Restore/focus behavior must preserve active document, side-panel tab, and citation jump target without breaking current session navigation patterns.

#### 3. Search <!-- oc:id=sec_ar -->
- In-document text search with snippets, page jumps, hit navigation.
- Future: project-level and semantic search.
- Search must remain usable on large PDFs.
- If semantic path unavailable, lexical mode must remain explicit and useful.
- Viewer integration should let lexical search ship before semantic/project search, with shared result cards reusable by chat citations and side-panel cockpit surfaces.

#### 4. Annotation Layer <!-- oc:id=sec_as -->
- Highlight text spans.
- Attach note/comment/tag/question to selection.
- Support overlapping or adjacent highlights with deterministic rules.
- All annotations anchored to locator contract with fallback strategy.
- Reopen, reload, and changed-render paths must degrade safely if exact match lost.
- Document model must treat annotation IDs, citation IDs, and note IDs as separate durable entities linked by locator references rather than merged UI-only records.
- Repeated quotes, revised editions, and extraction drift must downgrade through `resolved -> ambiguous -> page-only -> unresolved` rather than breaking silently.

#### 5. Notes and Review <!-- oc:id=sec_at -->
- Document notes.
- Highlight-linked notes.
- Review modes later: issue spot, summarize section, build outline, compare sources, extract holdings/claims.
- Notes must deep-link back to source span.
- Selection actions should reuse existing draft/pane-bus patterns where possible so quote capture, note drafting, and send-to-chat stay consistent with current session workflows.

#### 6. Citation and Provenance <!-- oc:id=sec_au -->
- Every AI answer or artifact claim should reference source page/selection where possible.
- Citation object should retain page, exact quote, locator metadata, confidence tier, and visible fallback state.
- Copy/export action for quote + page + provenance metadata.
- No fake precision.
- Citation jumps must work from chat, notes, artifact cards, and side-panel cockpit surfaces through one shared viewer-open path.

#### 7. Agent Workflows <!-- oc:id=sec_av -->
- Ask about selected text, page, section, full document, later full project corpus.
- Agent may draft notes, summaries, issue lists, matrices, and artifacts.
- Persistent/destructive operations require user confirm.
- All outputs should retain provenance to source spans.
- Quote-bank and artifact generation flows should promote useful session outputs into project/document-scoped stores instead of leaving them trapped in session-only GenUI state.

#### 8. Projects and Multi-Doc Work <!-- oc:id=sec_aw -->
- MVP excludes multi-document project workflows except placeholder architecture hooks.
- Premium v1 adds project libraries, cross-document search/chat, compare workflows, and claim/quote banks across documents.
- Later phases add deeper corpus intelligence, reusable research workspaces, and collaboration-oriented project structures.

#### 9. Derived Artifacts <!-- oc:id=sec_ax -->
- Summaries, briefs, outlines, quote banks, comparison tables, extraction sheets.
- Artifact record stores source documents, locator refs, prompt/model provenance, and timestamps.
- Integrate with existing artifact system without staying session-only.

### Non-Functional Requirements <!-- oc:id=sec_ay -->
- Local-first by default.
- Clear privacy policy for model calls, embeddings, OCR, and indexing.
- Accessibility: keyboard nav, screen-reader text layer, contrast-safe highlights.
- Performance budgets required.
- Browser-mode and Electron parity considered wherever backend seams change.
- Viewer stack must remain Electron-friendly, renderer-safe, and compatible with `services/backend.ts` plus preload/main IPC seams for durable file access.
- Rollout, degraded-state messaging, QA harness, and telemetry must share one vocabulary so feature flags and audit evidence stay aligned.

### Guardrails <!-- oc:id=sec_az -->
- PDF first. Other docs convert into PDF workflow.
- Main-pane reader mandatory. Side panel additive.
- Durable storage mandatory for documents/annotations/notes/provenance.
- Degraded mode explicit for no-text-layer, OCR-needed, corrupted, encrypted, ambiguous match, and repeated quote cases.
- No overreach into full citation-manager or collaboration suite in first execution plan.

### Success Criteria <!-- oc:id=sec_ba -->
- User can open one document, read comfortably, search, highlight, attach notes, and ask grounded questions.
- User trusts quote/page provenance.
- User can recover notes and highlights after relaunch.
- Product scales to premium v1 multi-document work without rewriting the core model.
- Annotation anchors survive exact-match drift through resolved, ambiguous, page-only, and unresolved fallback states instead of silent breakage.

---

## Execution Strategy

### Parallel Execution Waves

Wave 0 (Discovery + product foundations, 4 parallel):
- T1 viewer/library decision
- T2 product scope + persona lock
- T3 durability/privacy/storage contract
- T4 current shell/workspace seam audit

Wave 1 (Core architecture, 5 parallel):
- [x] T5 document domain model
- [x] T6 locator/annotation anchor hardening
- [x] T7 main-pane workspace shell design
- [x] T8 side-panel cockpit role design
- [x] T9 ingestion/import pipeline design

Wave 2 (Reader primitives, 5 parallel):
- [x] T10 viewer integration plan
- [x] T11 search/find-in-document plan
- [x] T12 selection/highlight/note interactions
- [x] T13 citation/provenance interaction model
- [x] T14 reading-state persistence and degraded recovery

Wave 3 (Agent/research workflows, 4 parallel):
- [x] T15 ask-this-document / ask-selection workflows
- [x] T16 artifact generation and quote-bank flows
- [x] T17 project library + cross-doc roadmap
- [x] T18 accessibility + performance + offline plans

Wave 4 (Hardening + rollout, 4 parallel):
- [x] T19 edge-case matrix
- [x] T20 QA/evidence plan
- [x] T21 migration path from current stub/studio preview
- [x] T22 rollout flags / staged launch / telemetry

Wave FINAL (After all tasks — 4 parallel reviews):
- [x] F1 plan compliance audit
- [x] F2 code/architecture quality review readiness
- [x] F3 full QA scenario coverage audit
- [x] F4 scope fidelity + creep check

Critical Path: T1 -> T5 -> T6 -> T7 -> T10 -> T12 -> T13 -> T15 -> T20 -> F1-F4
Max Concurrent: 5

### Dependency Matrix
- **T1**: None -> T7, T10, T12, T18, T21
- **T2**: None -> T8, T15, T16, T17, T19
- **T3**: None -> T5, T9, T14, T17, T18, T22
- **T4**: None -> T7, T8, T10, T21
- **T5**: T3 -> T6, T9, T13, T14, T15, T16, T17
- **T6**: T5 -> T12, T13, T14, T15, T19
- **T7**: T1, T4 -> T10, T11, T12, T13, T14, T21
- **T8**: T2, T4 -> T13, T15, T16, T22
- **T9**: T3, T5 -> T10, T14, T17, T19
- **T10**: T1, T4, T7, T9 -> T11, T12, T13, T14, T18, T21
- **T11**: T7, T10 -> T15, T18, T19, T20
- **T12**: T1, T6, T7, T10 -> T13, T14, T15, T19, T20
- **T13**: T5, T6, T7, T8, T10, T12 -> T15, T16, T17, T19, T20
- **T14**: T3, T5, T6, T7, T9, T10, T12 -> T18, T19, T20, T21
- **T15**: T2, T5, T6, T8, T11, T12, T13 -> T16, T17, T20, T22
- **T16**: T2, T5, T8, T13, T15 -> T17, T20, T22
- **T17**: T2, T3, T5, T9, T13, T15, T16 -> T22
- **T18**: T1, T3, T10, T11, T14 -> T19, T20, T22
- **T19**: T2, T6, T9, T11, T12, T13, T14, T18 -> T20, F1-F4
- **T20**: T11, T12, T13, T14, T15, T16, T18, T19 -> F1-F4
- **T21**: T1, T4, T7, T10, T14 -> F1-F4
- **T22**: T3, T8, T15, T16, T17, T18 -> F1-F4

### Agent Dispatch Summary
- **Wave 0**: 4 agents — T1 `deep`, T2 `writing`, T3 `unspecified-high`, T4 `quick`
- **Wave 1**: 5 agents — T5 `deep`, T6 `deep`, T7 `visual-engineering`, T8 `writing`, T9 `unspecified-high`
- **Wave 2**: 5 agents — T10 `visual-engineering`, T11 `quick`, T12 `visual-engineering`, T13 `deep`, T14 `unspecified-high`
- **Wave 3**: 4 agents — T15 `deep`, T16 `writing`, T17 `deep`, T18 `unspecified-high`
- **Wave 4**: 4 agents — T19 `deep`, T20 `unspecified-high`, T21 `quick`, T22 `unspecified-high`
- **FINAL**: 4 agents — F1 `deep`, F2 `unspecified-high`, F3 `visual-engineering`, F4 `deep`

---

## TODOs <!-- oc:id=sec_ba -->

- [x] 1. Viewer/library decision

  **What to do**:
  - Compare strongest React/Electron-friendly PDF stacks.
  - Choose default stack and fallback path.
  - Decide whether annotation layer comes from library, custom layer, or hybrid approach.

  **Must NOT do**:
  - Do not pick stack on render-only criteria alone.
  - Do not ignore license/commercial constraints.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: architectural choice with product and licensing consequences.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T7, T10, T12, T18, T21
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx` - current PDF preview baseline.
  - `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx` - current stub and intended direction notes.
  - External comparison research from librarian lane.

  **Acceptance Criteria**:
  - [ ] One recommended stack named with rationale.
  - [ ] License/commercial constraints documented.
  - [ ] Annotation/search/text-layer fit documented.
  - [ ] Fallback option named.

  **QA Scenarios**:
  ```
  Scenario: Stack decision grounded in repo constraints
    Tool: Read
    Preconditions: comparison note drafted
    Steps:
      1. Check decision references actual renderer/Electron architecture constraints.
      2. Verify licensing and annotation/search tradeoffs are explicit.
    Expected Result: Stack choice is evidence-based, not vibes-based.
    Evidence: .sisyphus/evidence/task-1-viewer-stack.md

  Scenario: Failure path — no single stack satisfies all needs
    Tool: Read
    Preconditions: comparison exposes gaps
    Steps:
      1. Record hybrid fallback.
      2. Define what is library-owned vs custom-owned.
    Expected Result: Clear hybrid path, not hidden compromise.
    Evidence: .sisyphus/evidence/task-1-viewer-stack-fallback.md
  ```

  **Commit**: NO

- [x] 2. Product scope + persona lock

  **What to do**:
  - Lock MVP, premium v1, and later phases.
  - Define core personas and jobs-to-be-done.
  - Prevent PDF reader from turning into a bibliography manager or collaboration suite too early.

  **Must NOT do**:
  - Do not blur MVP and premium v1.
  - Do not leave persona needs generic.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: PRD scope and persona definition.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T8, T15, T16, T17, T19
  - **Blocked By**: None

  **References**:
  - User request.
  - Oracle recommendations.
  - Metis persona/edge-case concerns.

  **Acceptance Criteria**:
  - [ ] Personas explicit.
  - [ ] MVP/premium/later boundaries explicit.
  - [ ] Scope creep traps documented.

  **QA Scenarios**:
  ```
  Scenario: Scope ladder is crisp
    Tool: Read
    Preconditions: PRD scope section drafted
    Steps:
      1. Compare MVP, premium v1, later phases.
      2. Verify each feature belongs to one phase only.
    Expected Result: No ambiguous phase ownership.
    Evidence: .sisyphus/evidence/task-2-scope-ladder.md

  Scenario: Failure path — scope inflation appears
    Tool: Read
    Preconditions: phase list drafted
    Steps:
      1. Flag features that push MVP toward citation-manager/collab suite territory.
      2. Move them outward or justify them.
    Expected Result: MVP remains credible and narrow.
    Evidence: .sisyphus/evidence/task-2-scope-creep.md
  ```

  **Commit**: NO

- [x] 3. Durability/privacy/storage contract

  **What to do**:
  - Define document, note, annotation, citation, artifact, and project storage scopes.
  - Set local-first and privacy defaults.
  - Define remote/embedding/model-call boundaries.

  **Must NOT do**:
  - Do not leave durable research data in transient session atoms.
  - Do not leave cloud data handling implicit.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: data policy + architecture + trust.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T5, T9, T14, T17, T18, T22
  - **Blocked By**: None

  **References**:
  - `docs/genui-artifact-architecture.md` - session-scoped artifact precedent and limits.
  - `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx` - session-scoped draft precedent.
  - Oracle + Metis guidance on privacy and durability.

  **Acceptance Criteria**:
  - [ ] Source-of-truth defined per entity.
  - [ ] Local-first policy explicit.
  - [ ] Remote call/embedding policy explicit.
  - [ ] Migration path from session-scoped precedents noted.

  **QA Scenarios**:
  ```
  Scenario: Storage matrix has one owner per entity
    Tool: Read
    Preconditions: storage contract drafted
    Steps:
      1. Inspect entities for ownership, scope, and durability.
      2. Verify no entity lives only in transient session state if durable.
    Expected Result: Clean storage matrix.
    Evidence: .sisyphus/evidence/task-3-storage-matrix.md

  Scenario: Failure path — privacy policy implicit
    Tool: Read
    Preconditions: contract drafted
    Steps:
      1. Check whether embeddings/model calls/indexing say local vs remote.
      2. Flag missing defaults.
    Expected Result: Privacy posture explicit.
    Evidence: .sisyphus/evidence/task-3-privacy-defaults.md
  ```

  **Commit**: NO

- [x] 4. Current shell/workspace seam audit

  **What to do**:
  - Map where full-route/main-pane PDF workspace should plug in.
  - Identify side-panel cockpit seams, route seams, app bar seams, and restore/focus behavior implications.

  **Must NOT do**:
  - Do not assume side-panel substrate alone is enough.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded local architecture mapping.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0
  - **Blocks**: T7, T8, T10, T21
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/agent-detail.tsx`
  - `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`
  - `apps/desktop/src/renderer/router.tsx`
  - `docs/firefly-surface-playbook.md`

  **Acceptance Criteria**:
  - [ ] Exact workspace insertion points listed.
  - [ ] Side-panel/main-pane interplay documented.
  - [ ] Restore/focus/flag implications listed.

  **QA Scenarios**:
  ```
  Scenario: Shell map names concrete files
    Tool: Read
    Preconditions: seam audit drafted
    Steps:
      1. Check each major seam has file references.
      2. Verify main-pane and side-panel roles are both covered.
    Expected Result: Executor can start without rediscovering shell.
    Evidence: .sisyphus/evidence/task-4-workspace-seams.md

  Scenario: Failure path — workspace route not justified
    Tool: Read
    Preconditions: route proposal drafted
    Steps:
      1. Verify why side-panel-only fails.
      2. Ensure main-pane route/addition is justified by product size.
    Expected Result: Route-level escalation justified.
    Evidence: .sisyphus/evidence/task-4-route-justification.md
  ```

  **Commit**: NO

## Final Verification Wave <!-- oc:id=sec_be -->

- [x] F1. **Plan Compliance Audit** — `deep`
  Verify PRD covers personas, architecture, phases, guardrails, and concrete repo seams.

- [x] F2. **Code/Architecture Readiness Review** — `unspecified-high`
  Verify proposed execution plan matches existing renderer/preload/main boundaries and does not smuggle implementation assumptions.

- [x] F3. **QA Coverage Audit** — `visual-engineering`
  Verify every major subsystem has happy-path and degraded-path verification scenarios.

- [x] F4. **Scope Fidelity Check** — `deep`
  Verify MVP, premium v1, and later phases remain cleanly separated.

---

## Commit Strategy 

- Planning artifact only. No code commit required unless user asks to ship planning docs.

## Success Criteria 

### Final Checklist 
- [x] Main-pane workspace requirement explicit
- [x] Side-panel cockpit role explicit
- [x] Viewer/library recommendation explicit
- [x] Durable storage/privacy defaults explicit
- [x] Annotation/citation/search workflows explicit
- [x] MVP vs premium v1 boundaries explicit
- [x] Edge cases and degraded behavior explicit