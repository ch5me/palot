# Task 2 — Storage, sync, and scope contract gate <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define one authoritative scope and persistence expectation for each core PDF review entity, using existing PALOT patterns where possible and avoiding duplicate storage models.

## Repo precedents <!-- oc:id=sec_ac -->
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx:18` uses `useDraft` with key `notes:${agent.sessionId}`. Good precedent for session-draft text only, bad precedent for durable document annotations.
- `docs/genui-artifact-architecture.md:180` explicitly keeps GenUI artifacts session-scoped in renderer state for v1.
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts:40` persists session artifacts in local storage per session, not per document/project.
- `apps/desktop/src/renderer/services/memory-service.ts:15` already models local / hybrid / remote durability tiers.
- `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx:56` shows async load + fallback behavior for durable-ish records.

## Scope matrix <!-- oc:id=sec_ad -->
| Entity | Authoritative scope | Persistence owner v1 | Why |
| --- | --- | --- | --- |
| `document` | project-scoped | durable local app store / future backend seam | document must survive session changes and be reusable across project chat, annotations, ingest, search |
| `document binary path / source ref` | user-scoped reference, resolved into project-scoped document record | durable local app store | same local file can be reopened later; source path is user-machine specific, but document record belongs to project workflow |
| `document ingest status` | document-scoped | durable local app store | upload/extract/failed/ready must survive reopen without rerunning blindly |
| `extracted text / chunks` | document-scoped | durable local app store or backend index seam | needed by locator resolution, search, grounded citations, starter questions |
| `locator/span` | shared value object, embedded in owning entity | stored with owning durable entity | locator is not standalone state; citations/annotations/search hits reference same contract |
| `annotation` | document-scoped | durable local app store | highlight belongs to source document first; can later surface in project views |
| `annotation note` | annotation-scoped, therefore document-scoped | same store as annotation | avoid separate notes model for review comments |
| `selection draft` | session-scoped UI state | renderer atom only | transient active selection/menu state should vanish safely |
| `ask-AI grounded selection payload` | session-scoped request context | chat send path only | ephemeral prompt context, not durable record |
| `project` | project-scoped | durable local app store | groups multiple documents and derived outputs |
| `project-document join` | project-scoped | durable local app store | required for cross-document retrieval and source switching |
| `search index metadata` | project-scoped with document-level units | durable local app store and/or backend index seam | corpus behavior spans docs in one project |
| `search result` | session-scoped derived view over project/doc data | computed, not persisted | reproducible from index + query |
| `grounded citation on chat message` | session-scoped message artifact referencing durable locator/doc ids | stored with message/session data if needed, but source authority remains document/project records | chat message is session object; citation target must remain durable via locator |
| `starter questions` | document-scoped | durable local app store | should reopen instantly for same document |
| `ingest brief / summary` | document-scoped | durable local app store | same reason as starter questions |
| `artifact generated from document/project` | project-scoped durable domain record, optionally mirrored into session artifact UI | durable local app store, integrated with existing GenUI/artifact surface | avoid second artifact system; source grounding outlives one chat turn |
| `artifact pin placement/UI edits` | session-scoped presentation state | existing renderer artifact/session widget atoms | visual placement belongs to current session layout, not source-of-truth artifact content |
| `table schema` | project-scoped | durable local app store | extraction intent spans project documents |
| `table row / cell` | project-scoped | durable local app store | extracted facts must survive reopen/export |
| `table cell provenance` | cell-scoped shared locator refs | same durable table store | each cell must remain grounded |
| `audio summary` | document-scoped or project-scoped depending origin | durable local app store with cache metadata | should reopen from cache, not regenerate each time |
| `audio playback UI state` | session-scoped | renderer atom only | play/pause/progress is transient UI |

## Rules by scope <!-- oc:id=sec_ae -->
### Session-scoped only <!-- oc:id=sec_af -->
Use renderer atoms or `useDraft` when state is transient, interaction-only, or tied to one open composer/view.
- active text selection
- selection menu open/close
- current highlight pulse target
- unsent chat grounding payload
- artifact pin placement / widget placement
- audio playback controls

### Document-scoped durable <!-- oc:id=sec_ag -->
Store with document identity, independent of one session.
- ingest state
- extracted text/chunks
- annotations
- annotation notes
- starter questions
- ingest brief
- document-level audio summary

### Project-scoped durable <!-- oc:id=sec_ah -->
Store when concept spans multiple documents or project review workflow.
- document membership in project
- cross-doc retrieval/index metadata
- generated project artifacts
- extraction tables
- project-level audio summary

### User-scoped durable preferences <!-- oc:id=sec_ai -->
Only for operator preferences, not review content.
- default panel widths / last active side-panel tab
- feature flags
- optional file source preferences

## Recommended v1 persistence shape <!-- oc:id=sec_aj -->
- Keep shell state in existing renderer atoms (`atoms/ui.ts`, widget layout atoms).
- Do **not** store durable PDF review notes/annotations in `useDraft` or session-only artifact atoms.
- Introduce one new durable review store for project/document entities. Desktop-first can start local, but schema must separate:
  - `documents`
  - `projects`
  - `projectDocuments`
  - `annotations`
  - `annotationNotes`
  - `ingestOutputs`
  - `artifacts`
  - `tables`
  - `audioSummaries`
- If browser mode needs parity, expose same operations through `services/backend.ts` rather than importing Node directly into renderer.

## Native/mobile boundary note <!-- oc:id=sec_ak -->
Future native clients should reuse:
- document ids
- project ids
- locator schema
- annotation/table/artifact/audio durable models

They should not inherit:
- Jotai atom layout state
- side-panel open tab persistence
- PDF.js viewport math fields
- session widget placement records

## Anti-duplication decisions <!-- oc:id=sec_al -->
- Existing `NotesPanel` remains session scratchpad. Do not stretch it into durable paper notes.
- Existing GenUI artifact atoms remain session presentation layer. Do not make them the source of truth for grounded PDF review artifacts.
- Memory service is precedent for local/remote/hybrid seam design, not storage schema for annotations.

## Verdict <!-- oc:id=sec_am -->
Authoritative durable path for PDF review content should be document/project scoped local app storage behind backend service seams. Session-only atoms stay for UI ephemera and draft interactions.