# Task 13 — Upload ingest brief + starter questions <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define upload-to-ingest pipeline that extracts document text, generates durable brief + starter questions, and reopens instantly without rerunning generation every time.

## Pipeline stages <!-- oc:id=sec_ac -->
### 1. Upload / attach document <!-- oc:id=sec_ad -->
Input sources:
- native PDF file
- office doc converted to PDF through existing conversion seam

On successful add:
- create `PdfReviewDocument`
- create `PdfDocumentIngestStatus` with `status = "queued"`
- persist immediately before any extraction work begins

### 2. Text extraction <!-- oc:id=sec_ae -->
Worker/process extracts text corpus and chunk records:
- populate `PdfDocumentChunk[]`
- set `textExtracted = true` on success
- if no extractable text, mark partial/failed explicitly

### 3. Derived metadata generation <!-- oc:id=sec_af -->
Once text exists, run two bounded derived tasks:
- generate `PdfDocumentBrief`
- generate 3–5 `PdfStarterQuestion` rows

These should store durable outputs directly, not remain transient panel state.

### 4. Indexing / ready state <!-- oc:id=sec_ag -->
If extraction + derived outputs succeed:
- mark `briefGenerated = true`
- mark `starterQuestionsGenerated = true`
- mark `status = "ready"`
- optionally mark `indexed = true` if search indexing also completes

If extraction succeeds but brief/question generation fails:
- mark `status = "partial"`
- preserve extracted text and any successful outputs
- record failure reason on ingest status

## Ingest status model <!-- oc:id=sec_ah -->
Use `PdfDocumentIngestStatus` as single source of truth.

Recommended semantics:
- `queued`: document persisted, work not started
- `extracting`: extraction/chunking in progress
- `partial`: some durable outputs available, some failed
- `ready`: text + brief + starter questions available
- `failed`: extraction or pipeline failed before useful outputs persisted

Supporting booleans already defined in T8:
- `textExtracted`
- `briefGenerated`
- `starterQuestionsGenerated`
- `indexed`

This lets UI show honest partial completion rather than one opaque status string.

## Persistence rules <!-- oc:id=sec_ai -->
### Durable records <!-- oc:id=sec_aj -->
Persist separately:
- `PdfReviewDocument`
- `PdfDocumentIngestStatus`
- `PdfDocumentChunk[]`
- `PdfDocumentBrief`
- `PdfStarterQuestion[]`

### Reopen behavior <!-- oc:id=sec_ak -->
On reopen:
- load ingest status first
- if brief/question rows already exist, render them immediately
- do not re-run model generation unless user explicitly retries failed/missing outputs
- spinner/regeneration only for rows still actually pending

## Starter question constraints <!-- oc:id=sec_al -->
- generate 3–5 concise, document-specific openers
- each question is durable row with `orderIndex`
- questions should be clickable to seed chat composer directly
- questions should be grounded by document context, even if they do not each carry explicit locator rows in v1

## Direct chat-seeding path <!-- oc:id=sec_am -->
Clicking a starter question should:
1. resolve active chat composer via `paneWriters` <!-- oc:id=item_aa -->
1. insert question text into composer <!-- oc:id=item_ab -->
1. optionally prepend compact document cue such as document title/id <!-- oc:id=item_ac -->
1. not auto-send in v1 <!-- oc:id=item_ad -->

This mirrors `NotesPanel` send-to-chat ergonomics while keeping questions durable.

## Partial failure behavior <!-- oc:id=sec_an -->
### Extraction failure / no text <!-- oc:id=sec_ao -->
- `status = "failed"` or `"partial"` depending on whether any fallback metadata exists
- `textExtracted = false`
- no fake brief or starter questions
- UI shows explicit degraded state with retry option

### Brief generation failure but questions succeed <!-- oc:id=sec_ap -->
- persist successful starter questions
- `briefGenerated = false`, `starterQuestionsGenerated = true`
- `status = "partial"`
- render available questions immediately and show brief failure notice

### Questions generation failure but brief succeeds <!-- oc:id=sec_aq -->
- persist brief
- `briefGenerated = true`, `starterQuestionsGenerated = false`
- `status = "partial"`
- show retry path for missing starter questions only

## Grounding discipline <!-- oc:id=sec_ar -->
- extraction corpus stays source of truth for later locator resolution/search
- brief/questions derive from extracted text, not raw file preview only
- if document has no text layer, starter questions should not pretend grounded reading exists

## Existing pattern reuse <!-- oc:id=sec_as -->
### From `MemoryPanel` <!-- oc:id=sec_at -->
Reuse:
- async load/error state surface pattern
- explicit fallback messaging

Do not reuse:
- memory item schema or hybrid merge semantics directly

### From domain model <!-- oc:id=sec_au -->
Use dedicated brief/question rows, not session drafts or artifacts as storage backend.

## UX states to expose <!-- oc:id=sec_av -->
- queued
- extracting
- ready
- partial
- failed
- no-text / scanned fallback

UI should always answer:
- is extraction done?
- is brief available?
- are starter questions available?
- can user retry missing piece?

## Acceptance check <!-- oc:id=sec_aw -->
- ingest states defined: yes
- brief/questions persisted and reopened instantly: yes
- partial failure path specified: yes
- starter questions direct chat-seeding path: yes

## QA mapping <!-- oc:id=sec_ax -->
### New upload produces persisted brief/questions <!-- oc:id=sec_ay -->
Expected proof:
1. upload text PDF <!-- oc:id=item_ae -->
1. ingest finishes <!-- oc:id=item_af -->
1. brief and 3–5 starter questions render <!-- oc:id=item_ag -->
1. reopen session/document <!-- oc:id=item_ah -->
1. brief/questions appear immediately without regeneration delay <!-- oc:id=item_ai -->

### Failure path — extraction fails or PDF has no text <!-- oc:id=sec_az -->
Expected proof:
1. upload problematic/scanned file <!-- oc:id=item_aj -->
1. ingest status shows failed/partial/no-text state clearly <!-- oc:id=item_ak -->
1. no silent absence of outputs <!-- oc:id=item_al -->