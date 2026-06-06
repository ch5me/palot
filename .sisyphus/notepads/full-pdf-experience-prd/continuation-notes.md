# Full PDF Experience PRD Notes <!-- oc:id=sec_aa -->

## Worktree setup <!-- oc:id=sec_ab -->
- Working inside `/Users/hassoncs/src/ch5/palot-worktrees/full-pdf-experience-prd` on branch `full-pdf-experience-prd`.
- Main repo retains separate in-flight Palette browser work; do not mix with this branch.

## Initial findings <!-- oc:id=sec_ac -->
- Current `pdf-review` side-panel is still a contract/stub preview, not a reader: `apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx`.
- Current real PDF preview precedent is `StudioPanel`, which uses office-to-PDF conversion and bare iframe preview: `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx`.
- `FilesPanel` routes PDFs and office docs into preview flows, useful ingestion precedent but not durable review UX: `apps/desktop/src/renderer/components/side-panel/files-panel.tsx`.
- Side-panel surface registry and host already exist via `firefly-surface-registry.tsx`, `agent-detail.tsx`, and `session-side-panel.tsx`.
- Current Notes and Artifacts surfaces are session-scoped renderer state only; this is key migration pressure for durable PDF research state.
- Router currently has no dedicated document workspace route; adding main-pane reader will need explicit route/shell insertion.

## Wave 0 refinements <!-- oc:id=sec_ad -->
- Personas tightened around concrete jobs: literature matrix, pincite trust, analyst brief generation, and confirm-before-mutate AI workflows.
- Scope boundary now explicit: MVP = single-document durable reader/search/highlight/ask; premium v1 = project library and cross-document workflows; later = deeper corpus intelligence and collaboration structures.
- Product defaults now explicitly call out local-first opt-in for embeddings, OCR enrichment, and cloud sync.
- Multi-document section now states MVP exclusion, premium v1 inclusion, and later-phase expansion.

## Shell and seam notes <!-- oc:id=sec_ae -->
- Current PDF surface is registered as optional side-panel tab `pdf-review`, default OFF, with Cmd+K discoverability and persisted last-tab state through `firefly-surface-registry.tsx`, `atoms/feature-flags.ts`, `atoms/ui.ts`, and `command-palette.tsx`.
- Surface playbook says full-route surfaces only when scope exceeds side panel and data model is proven; PDF workspace now clearly meets that threshold.
- Current shell entrypoint is `SessionRoute -> SessionView -> AgentDetail`; dedicated reader route will need explicit router + layout insertion, not only side-panel registration.
- `services/backend.ts` is required seam for renderer access; native file/conversion capabilities already exist in main via `files.ts` and IPC handlers.

## Wave 0 completion state <!-- oc:id=sec_af -->
- T1 done at planning level: default stack stays `react-pdf` + PDF.js hybrid; direct PDF.js remains fallback; commercial SDK stays later escalation path.
- T2 done at planning level: personas and phase boundaries now sharper and implementation-aware.
- T4 done at planning level: shell audit confirms current `pdf-review` is side-panel proof surface and full reader needs dedicated route/shell insertion through router plus session shell.

## Storage and privacy contract <!-- oc:id=sec_ag -->
- Durable source of truth moves to main-process XDG-backed storage, not renderer session atoms.
- Scope ladder now explicit: `session` for in-flight UI state, `document` for annotations/citations/reading state, `project` for notes/artifacts/search indexes, later `workspace` for corpus features.
- Default privacy posture is local-only for bytes, OCR, and embeddings; any remote OCR/embedding/sync path must be explicit opt-in with audit logging.
- Migration path is clear from current session-scoped `notes-panel` drafts and GenUI artifacts into main-owned project/document stores.

## Locator seam notes <!-- oc:id=sec_ah -->
- Shared locator contract already exists in `apps/desktop/src/shared/pdf-locator.ts` with four resolution states: `resolved`, `ambiguous`, `page-only`, `unresolved`.
- Future annotation/citation design should extend this seam, not replace it; repeated-quote and extraction-drift behavior can build directly on existing degraded states.
- Current tests already assert schema versioning and degraded-state enum coverage in `apps/desktop/src/shared/pdf-locator.test.ts`.

## Wave 1 intake <!-- oc:id=sec_ai -->
- Domain model pass should build on existing `pdf-locator` seam, not invent a second anchoring contract.
- Ingestion pass should reuse `convertOfficeToPdf` and main-process file/IPC seams, then add manifest/hash registration and durable cache policy.
- Workspace-shell pass should add a dedicated main-pane route inside existing session shell, with side-panel `pdf-review` kept as cockpit surface.

## Wave 1 synthesis <!-- oc:id=sec_aj -->
- T5/T6: document identity now centers on content-hash manifest plus shared `pdf-locator` authority; annotations, citations, and notes stay separate durable entities linked by locator refs.
- T7/T8: reader belongs in dedicated main-pane session route; side-panel `pdf-review` becomes cockpit surface for citations, notes, AI actions, and artifact context, not primary reading surface.
- T9: ingestion now explicitly requires main-process manifest registration, source-vs-derived path tracking, and conversion/OCR status separate from reader state.
- Existing seams to extend stay stable: `router.tsx`, `SessionRoute -> SessionView -> AgentDetail`, `firefly-surface-registry.tsx`, `services/backend.ts`, `main/files.ts`, and `ipc-handlers.ts`.

## Wave 2 intake <!-- oc:id=sec_ak -->
- Chat seams already support PDF attachments, prompt mentions, draft persistence, and GenUI artifact capture; Wave 2 should route PDF-specific grounded actions through those existing shells instead of inventing parallel chat surfaces.
- `pane-bus`, `use-draft`, `genui-artifacts`, and `session-widget-registry` are key precedents for note injection, ephemeral session state, and artifact promotion.
- Wave 2 should keep viewer/search/selection logic app-owned while reusing current session shell, widget shell, and prompt tooling.

## Wave 2/3/4 synthesis intake <!-- oc:id=sec_al -->
- Wave 2 should sequence viewer/search/selection before broader agent/project flows: lexical search first, semantic later; citation jumps should resolve through one shared open path from chat, notes, and artifacts.
- Wave 3 should promote quote-bank and artifact outputs out of session-only GenUI state into project/document-scoped stores, while reusing current chat/prompt injection seams.
- Wave 4 should unify degraded-state vocabulary, QA evidence, migration toggles, and telemetry under one flag-controlled rollout surface.
- Existing reusable seams: `chat-view.tsx`, `chat-input.tsx`, `prompt-attachments.tsx`, `pane-bus.ts`, `use-draft.ts`, `genui-artifacts.ts`, `session-widget-registry.tsx`.

## Final audit intake <!-- oc:id=sec_am -->
- Final pass now checking four things only: plan compliance, architecture readiness, QA coverage completeness, and scope fidelity.
- Current expectation: no new product scope, only contradiction cleanup or explicit blocker notes.

## Final audit outcome <!-- oc:id=sec_an -->
- F1/F4 pass at planning level: personas, phases, guardrails, and repo seams are covered and MVP vs premium vs later boundaries stay clean.
- F2 pass at planning level: route shell, side-panel substrate, preload/main/backend seams, and XDG storage assumptions align with current repo architecture.
- F3 pass with caveat: QA coverage matrix is broad, but existing evidence still includes placeholder artifacts and at least one known runtime blocker note; runtime truth still depends on executing the planned QA lane later.

## Plan hygiene <!-- oc:id=sec_ao -->
- Directive required immediate check-marking of last completed checklist; final checklist now marked complete because PRD text already satisfies it.
- Wave 0 complete.
- Wave 1 complete in execution section.
- Wave 2-4 synthesis landed into PRD.
- Final audits complete.
