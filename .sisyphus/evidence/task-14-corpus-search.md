# Task 14 — Corpus search <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define grounded corpus search across uploaded documents, annotations, and notes, using shared locator contract for every clickable result.

## Searchable corpus scope <!-- oc:id=sec_ac -->
### Included sources <!-- oc:id=sec_ad -->
1. document extracted text chunks (`PdfDocumentChunk`) <!-- oc:id=item_aa -->
1. annotation note bodies (`PdfAnnotationNote`) <!-- oc:id=item_ab -->
1. annotation quote/locator metadata (`PdfAnnotation`) <!-- oc:id=item_ac -->
1. optional document briefs and starter questions as low-priority auxiliary text <!-- oc:id=item_ad -->

### Excluded from primary corpus <!-- oc:id=sec_ae -->
- raw UI drafts from `NotesPanel`
- transient selections
- viewer-only state
- artifact props unless explicitly indexed later as derived outputs

Why:
- search should query durable knowledge surfaces only
- avoids mixing operator scratchpad with source-backed corpus by default

## Indexing units <!-- oc:id=sec_af -->
### Primary unit: chunk-level text span <!-- oc:id=sec_ag -->
Use `PdfDocumentChunk` as main lexical/semantic search unit.
Fields:
- `documentId`
- `pageIndex`
- `chunkId`
- `normalizedText`
- `textStart/textEnd`
- locator projection

This gives stable, grounded retrieval with direct clickback.

### Secondary unit: annotation note hit <!-- oc:id=sec_ah -->
Index note bodies separately as note-scoped results linked back through parent annotation locator.
Useful when user searches their own highlights/comments.

### Tertiary unit: brief/question support text <!-- oc:id=sec_ai -->
Optional lower-rank support unit for onboarding/discovery queries.
These results should still click back to owning document, but they should not outrank exact chunk hits on core content unless query clearly matches brief/question phrasing.

## Result object <!-- oc:id=sec_aj -->
Every result must include source locator.

```ts
export interface PdfCorpusSearchResult {
	id: string
	kind: "chunk" | "annotation-note" | "annotation" | "brief" | "starter-question"
	projectId: string
	documentId: string
	title: string
	snippet: string
	score: number
	matchMode: "lexical" | "semantic" | "hybrid" | "degraded-lexical"
	locator: DocumentLocator
	annotationId?: string
	noteId?: string
}
```

## Ranking policy <!-- oc:id=sec_ak -->
### If hybrid search available <!-- oc:id=sec_al -->
Combine:
1. exact lexical match score <!-- oc:id=item_ae -->
1. semantic similarity score <!-- oc:id=item_af -->
1. document/page proximity bonuses <!-- oc:id=item_ag -->
1. annotation/user-note recency bonus only for note-specific hits <!-- oc:id=item_ah -->

Priority order should favor:
- exact chunk hits
- chunk hits with matching page/context
- annotation note hits when query clearly matches user-authored note text
- brief/question support hits last

### If only lexical search available <!-- oc:id=sec_am -->
Rank by:
1. exact phrase matches <!-- oc:id=item_ai -->
1. token overlap <!-- oc:id=item_aj -->
1. density of matches in chunk <!-- oc:id=item_ak -->
1. shorter distance between matched terms <!-- oc:id=item_al -->
1. annotation note/title exactness bonus when appropriate <!-- oc:id=item_am -->

Be explicit in UI that result mode is lexical/degraded if semantic path unavailable.

## Clickback path <!-- oc:id=sec_an -->
### Chunk result <!-- oc:id=sec_ao -->
1. click result <!-- oc:id=item_an -->
1. open `pdf-review` <!-- oc:id=item_ao -->
1. set active document if needed <!-- oc:id=item_ap -->
1. run locator jump <!-- oc:id=item_aq -->
1. scroll to page/span and pulse highlight if resolved <!-- oc:id=item_ar -->

### Annotation note result <!-- oc:id=sec_ap -->
1. click result <!-- oc:id=item_as -->
1. open document at annotation locator <!-- oc:id=item_at -->
1. also focus associated annotation row/note thread <!-- oc:id=item_au -->

### Brief/question result <!-- oc:id=sec_aq -->
1. open owning document <!-- oc:id=item_av -->
1. land on best available page or top-of-document fallback <!-- oc:id=item_aw -->
1. optionally highlight associated supporting locator if one exists later <!-- oc:id=item_ax -->

## Degraded behavior <!-- oc:id=sec_ar -->
### Semantic unavailable <!-- oc:id=sec_as -->
If no semantic index exists:
- search still works in lexical mode
- set `matchMode = "degraded-lexical"`
- UI should show transparent indicator like `Lexical only`
- do not pretend hybrid ranking quality exists

### Chunk text missing for document <!-- oc:id=sec_at -->
If document failed extraction or has no text layer:
- chunk search unavailable for that document
- annotation note search may still work if notes exist
- document can be omitted from text search with explicit limitation note

### Locator degraded <!-- oc:id=sec_au -->
If result locator resolves only to page fallback:
- still allow clickback
- show page-level fallback indicator
- no fake exact highlight

## Search scopes <!-- oc:id=sec_av -->
### Default scope <!-- oc:id=sec_aw -->
Project-scoped corpus.
- all project documents
- all project annotations/notes
- durable project outputs tied back to documents

### Document-local refinement <!-- oc:id=sec_ax -->
UI can later filter to one active document, but core contract stays project-first.

## Existing seam reuse <!-- oc:id=sec_ay -->
### From `memory-service.ts` <!-- oc:id=sec_az -->
Reuse conceptually:
- fetch vs recall split
- `query` argument shape
- local/remote/hybrid thinking

Do not reuse directly:
- memory item schema
- body-only dedupe logic

### From corpus/domain model <!-- oc:id=sec_ba -->
Use durable chunk + annotation records and derive `DocumentLocator` for each result.

## Suggested indexing ownership <!-- oc:id=sec_bb -->
- local-first index built from `PdfDocumentChunk` and `PdfAnnotationNote`
- optional remote/semantic augmentation later
- source-of-truth stays durable document store, not ad hoc message caches

## Acceptance check <!-- oc:id=sec_bc -->
- search index units and scopes defined: yes
- result object includes source locator: yes
- degraded ranking mode documented: yes
- clickback path to document source defined: yes

## QA mapping <!-- oc:id=sec_bd -->
### Query returns clickable grounded results <!-- oc:id=sec_be -->
Expected proof:
1. query known corpus term <!-- oc:id=item_ay -->
1. ranked results include snippet + source label <!-- oc:id=item_az -->
1. click result <!-- oc:id=item_ba -->
1. document opens and jump path runs <!-- oc:id=item_bb -->

### Failure path — semantic unavailable <!-- oc:id=sec_bf -->
Expected proof:
1. run query with semantic path absent <!-- oc:id=item_bc -->
1. results still appear in lexical/degraded mode or limitation shown explicitly <!-- oc:id=item_bd -->