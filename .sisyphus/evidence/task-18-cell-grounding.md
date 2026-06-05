# Task 18 — Grounded data tables <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define schema builder, extraction job shape, grounded row/cell storage, and CSV export behavior where every extracted datum remains traceable to source locators.

## Core model <!-- oc:id=sec_ac -->
### Schema builder <!-- oc:id=sec_ad -->
Use `PdfExtractionTable` as saved extraction definition.

```ts
export interface PdfExtractionTable {
	id: string
	projectId: string
	name: string
	columns: PdfExtractionColumn[]
	status: "draft" | "running" | "ready" | "failed"
	createdAt: number
	updatedAt: number
}

export interface PdfExtractionColumn {
	id: string
	key: string
	label: string
	description?: string
	valueType: "text" | "number" | "boolean" | "date"
}
```

### Job shape <!-- oc:id=sec_ae -->
Extraction runs against one project + one schema definition.

```ts
export interface PdfExtractionJob {
	id: string
	projectId: string
	tableId: string
	status: "queued" | "running" | "ready" | "failed"
	documentBatchCursor?: string
	errorMessage?: string
	createdAt: number
	updatedAt: number
}
```

This can be job metadata layered beside table rows even if not yet codified in domain model docs.

## Row/cell storage <!-- oc:id=sec_af -->
### Row model <!-- oc:id=sec_ag -->
```ts
export interface PdfExtractionRow {
	id: string
	tableId: string
	sourceDocumentId?: string
	orderIndex: number
	createdAt: number
	updatedAt: number
}
```

### Cell model <!-- oc:id=sec_ah -->
```ts
export interface PdfExtractionCell {
	id: string
	rowId: string
	columnId: string
	value: string
	locators: DocumentLocator[]
	confidence?: number
	createdAt: number
	updatedAt: number
}
```

## Provenance rule <!-- oc:id=sec_ai -->
Every cell must store:
- extracted value
- one or more shared locators
- optional confidence

Never store bare value without locator-backed provenance.

### Why multiple locators <!-- oc:id=sec_aj -->
One cell may synthesize from:
- multiple passages in one doc
- evidence across multiple docs in a project

So `locators[]` is correct, not single locator only.

## Extraction semantics <!-- oc:id=sec_ak -->
### Document-scoped row <!-- oc:id=sec_al -->
If one row represents one document:
- `sourceDocumentId` set
- cells may still cite multiple locators inside that doc

### Cross-document row <!-- oc:id=sec_am -->
If one row synthesizes across docs:
- `sourceDocumentId` may be null
- cells may include locators from many docs
- each locator still carries `documentId`, preserving cross-doc provenance

## Cell clickback behavior <!-- oc:id=sec_an -->
Clicking a cell should:
1. inspect `locators[]` <!-- oc:id=item_aa -->
1. if one locator, jump directly to source span <!-- oc:id=item_ab -->
1. if multiple locators, show source list or choose primary locator first with disclosure of additional sources <!-- oc:id=item_ac -->
1. switch active document first when source doc differs from current doc <!-- oc:id=item_ad -->

This keeps every visible datum verifiable.

## CSV export rules <!-- oc:id=sec_ao -->
### Exported visible values <!-- oc:id=sec_ap -->
CSV export includes:
- one column per schema column
- visible extracted `value` strings

### Provenance in CSV <!-- oc:id=sec_aq -->
Two acceptable approaches:
1. sidecar export (preferred later): `table.csv` + `table-provenance.json` <!-- oc:id=item_ae -->
1. hidden/system columns in CSV (acceptable for v1): append `${columnKey}__sources` with serialized locator/document labels <!-- oc:id=item_af -->

Minimum rule:
- do not drop provenance entirely during export path design
- exported plain CSV may stay user-friendly, but provenance must remain available somewhere in same export workflow

## Cost/batching controls <!-- oc:id=sec_ar -->
### Why needed <!-- oc:id=sec_as -->
Extraction cost scales with:
- number of documents
- number of chunks per document
- number of schema columns
- complexity of per-cell synthesis

### Recommended control strategy <!-- oc:id=sec_at -->
- batch by document subsets
- optionally batch by schema column groups for wide tables
- persist partial rows between batches
- stop/guard when project too large for one pass

Detailed guard wording recorded in `.sisyphus/evidence/task-18-cost-guard.md`.

## UI states <!-- oc:id=sec_au -->
- draft schema
- running extraction
- ready table
- failed extraction
- guarded/too-large extraction

## Existing contract reuse <!-- oc:id=sec_av -->
- `DocumentLocator` for every cell provenance record
- `PdfReviewProject` / `PdfProjectDocument` for project scope
- project retrieval contract from T15 for cross-document evidence gathering

## Non-goals <!-- oc:id=sec_aw -->
Do not:
- store only confidence score without source locators
- tie cells to viewport coordinates
- promise unlimited project/schema scale
- invent a second provenance model separate from locators

## Acceptance check <!-- oc:id=sec_ax -->
- schema, row, and cell model defined: yes
- each cell includes provenance: yes
- cost/batching controls documented: yes
- CSV export behavior documented clearly: yes

## QA mapping <!-- oc:id=sec_ay -->
### Data table cell links back to source span <!-- oc:id=sec_az -->
Expected proof:
1. open generated table <!-- oc:id=item_ag -->
1. click known cell <!-- oc:id=item_ah -->
1. source doc opens and locator jump runs <!-- oc:id=item_ai -->

### Failure path — extraction cost guard engages <!-- oc:id=sec_ba -->
Expected proof:
1. oversized project/schema triggers guard <!-- oc:id=item_aj -->
1. batching/guard behavior explicit, not silent runaway <!-- oc:id=item_ak -->