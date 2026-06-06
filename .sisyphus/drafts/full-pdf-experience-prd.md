# Draft: Full PDF Experience PRD <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- User wants a full PDF experience, not a stub side panel.
- Need planning for a premium PDF viewer and research/review workflow.
- Audience includes researchers, law students, and heavy note/review users.
- Must cover viewing, highlighting, notes, search, review, and agent workflows.
- Deliverable should include a full PRD and work plan foundation.

## Technical Decisions <!-- oc:id=sec_ac -->
- Existing side-panel registry should remain control surface, not sole reading surface.
- Full PDF experience should be planned as dedicated main-pane PDF workspace plus supporting side-panel cockpit.
- Existing shipped `pdf-review` tab should be treated as bridge/proof surface, not final product shape.
- Product must be local-first and durable: document, annotations, notes, citations, and artifacts cannot live only in transient session state.

## Research Findings <!-- oc:id=sec_ad -->
- Existing shipped work only includes pdf-review registry slot + locator contract + stub panel.
- No actual embedded PDF viewer shipped yet.
- Firefly shell rules already say side-panel proof surfaces come first, and full-route surfaces only when clearly larger than a side panel and data model is proven.
- `agent-detail.tsx` already owns split-pane composition, side-panel open/close state, available-tab filtering, and panel width management.
- `notes-panel.tsx` gives a local draft + send-to-chat precedent, but only session-scoped notes today.
- `artifacts-panel.tsx` gives a side-panel inventory precedent, but artifacts are session-scoped GenUI records today.
- Studio panel already previews PDFs through a bare `iframe` and office-to-PDF conversion seam; this is preview-only, not a research-grade viewer.
- Files panel explicitly routes PDF/office preview to Studio instead of handling PDF review itself.
- Oracle recommendation: side-panel-only is insufficient for premium researcher/law-student workflows; best architecture is full main-pane workspace with side-panel support.
- Must-have subsystems called out by Oracle: viewer, annotation layer, notes/review surface, search, ingestion pipeline, citation system, agentic review flows, artifact system, and durable persistence.
- Recommended product ladder: MVP = one-document reading/search/highlight/ask; premium v1 = projects, cross-doc search, semantic indexing, robust annotations, provenance-rich artifacts.
- Metis gap review added missing guardrails around citation integrity, privacy/local-first handling, accessibility, performance budgets, degraded-mode UX, and no side-panel-only compromise.
- Metis also flagged missing edge cases: scanned/OCR PDFs, repeated quotes, revised editions, two-column/footnote-heavy papers, encrypted/corrupt docs, and offline/confidential workflows.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: product requirements, architecture, phases, validation needs, UX requirements.
- EXCLUDE: implementation in this session.

## Open Questions <!-- oc:id=sec_af -->
- Exact MVP vs v1 premium boundary.
- Whether office-doc conversion outputs should be first-class durable research artifacts or import-only stepping stones.

## User Answers
- Viewer stack default: `react-pdf` + PDF.js hybrid.
- First durable scope: single-document reader first.
- Privacy/indexing default: local-first explicit opt-in.
