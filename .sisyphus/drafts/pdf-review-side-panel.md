# Draft: PDF Review Side Panel <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Build work plan for Firefly PDF review side panel in existing side-panel system.
- Feature set source combines OpenPaper marketing site plus README details.
- Must stay clean-room and concept-only because OpenPaper is AGPL-3.0.
- Target surface: Firefly existing chat pane + Notion-like PDF/document pane layout.
- Existing stack assumptions from user spec: TS, React Native / Expo, Cloudflare Workers + Hono, D1, R2, Drizzle, BetterAuth, TanStack Query, NativeWind, masking proxy.
- Most important primitive: shared locator/span system with first-class `documentId`.
- Eleven requested capability areas: grounded citation protocol, on-upload brief + starter questions, inline highlight action menu, annotations, in-context notes/markdown, audio summary, corpus search, projects, artifact generation, structured extraction tables, locator/span system.
- Need Firefly/PALOT-specific plan mapped onto existing side-panel architecture.

## Technical Decisions <!-- oc:id=sec_ac -->
- Use existing Firefly side-panel registry path, not one-off shell wiring.
- Treat PDF review as side-panel-first proof surface, per `docs/firefly-surface-playbook.md`.
- Reuse streaming parser / GenUI artifact / prompt augmentation patterns where possible.
- Carry `documentId` in locator from day one to avoid multi-doc refactor.
- Keep AGPL boundary explicit in agent prompts and plan guardrails.

## Research Findings <!-- oc:id=sec_ad -->
- Side-panel system is registry-driven via `apps/desktop/src/renderer/firefly-surface-registry.tsx`, `apps/desktop/src/renderer/components/agent-detail.tsx`, `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`, `apps/desktop/src/renderer/atoms/ui.ts`.
- Existing proof surfaces show expected shape: `notes-panel.tsx`, `memory-panel.tsx`, `artifacts-panel.tsx`, `review-panel.tsx`.
- Chat shell already adapts width when side panel open via `apps/desktop/src/renderer/components/chat/chat-view.tsx` and `SessionWidgetWorkspace`.
- GenUI system already has streaming fence parser and artifact capture in `apps/desktop/src/renderer/genui/genui-renderer.tsx` and `apps/desktop/src/renderer/atoms/chat.ts`.
- Artifact architecture doc strongly prefers registry-driven, session-scoped, prompt-context-backed surfaces in `docs/genui-artifact-architecture.md`.
- Feature flags and persisted surface toggles live in `apps/desktop/src/renderer/atoms/feature-flags.ts`.
- No obvious local matches yet for masking proxy / retrieval / PDF-specific infra inside this repo; pending deeper agent results.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: planning PDF review side panel and dependencies required to support requested behaviors.
- INCLUDE: sequencing, shared primitives, shell integration points, backend seams, data model, QA plan.
- EXCLUDE: lifting OpenPaper code or protocol details from AGPL source.
- EXCLUDE: implementation itself.

## Open Questions <!-- oc:id=sec_af -->
- Should plan assume browser/Electron web PDF surface first, or true React Native/Expo parity from first slice?
- What test strategy should plan assume here: tests-after, TDD, or no automated tests?
- Need pending research results on masking/retrieval/document infra in repo.

## User Answers
- Scope target: desktop plus shared contracts for future mobile/native parity.

## External Research Findings
- OpenPaper public materials consistently center split-pane reading: paper visible beside chat so AI augments reading without context switching.
- Grounded citation behavior: responses stream while carrying inline citations that jump to exact source passages. Public README/blog admit string-matching locator baseline is imperfect but fast enough.
- Upload flow includes automatic brief plus starter questions before first prompt.
- Highlighting opens inline menu with actions like ask AI, annotate, save quote; highlights/annotations become first-class retrieval context.
- Projects are multi-document workspaces with cross-paper chat, grounded citations across sources, generated artifacts, audio summaries, and structured extraction tables.
- Data tables use user-defined schemas; each extracted cell links back to source text and CSV export is first-class.
- Recommended locator pattern from standards/prior art: combine exact quote + prefix/suffix context + text positions + structural/page anchors, then resolve with fast-to-fuzzy fallback chain.
- W3C/Hypothesis prior art suggests selector stack: range selector, text position selector, text quote selector, fuzzy reattachment when document structure/text drifts.
- Readium prior art reinforces locator object carrying progression/position plus format-specific anchors rather than one brittle identifier.
- React Native text selection on PDFs is materially harder than web/pdf.js; parity should likely come through shared contracts first, native UX later.
