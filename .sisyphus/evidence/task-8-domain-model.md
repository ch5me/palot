# Task 8 — Document / annotation / project data model <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define durable core entities for PDF review, grounded outputs, and project-level retrieval without mixing in UI-only state.

## Design rules <!-- oc:id=sec_ac -->
- Durable domain entities live outside session-only Jotai panel/widget state.
- Every span-bearing entity references shared locator contract.
- Project/document ownership must be explicit.
- IDs are system-generated, never model-generated.
- Session-specific presentation state stays elsewhere.

## Entity map <!-- oc:id=sec_ad -->
### 1. `PdfReviewDocument` <!-- oc:id=sec_ae -->
Primary durable source record.
```ts
export interface PdfReviewDocument {
	id: string
	projectId: string
	title: string
	sourceUri: string | null
	mimeType: string
	checksum: string | null
	pageCount: number | null
	textLayerStatus: "ready" | "missing" | "failed" | "pending"
	ingestStatusId: string
	createdAt: number
	updatedAt: number
}
```
Why:
- document belongs to exactly one primary project in v1
- keeps file identity separate from ingest outputs and annotations

### 2. `PdfDocumentChunk` <!-- oc:id=sec_af -->
Normalized extracted text unit for locator resolution and search.
```ts
export interface PdfDocumentChunk {
	id: string
	documentId: string
	pageIndex: number
	orderIndex: number
	text: string
	normalizedText: string
	textStart: number
	textEnd: number
	blockLabel?: string
	createdAt: number
}
```
Why:
- supports structure + position + quote recovery
- chunk ids can feed `locator.selectors.structure.chunkId`

### 3. `PdfDocumentIngestStatus` <!-- oc:id=sec_ag -->
Tracks extraction and derived-output readiness.
```ts
export interface PdfDocumentIngestStatus {
	id: string
	documentId: string
	status: "queued" | "extracting" | "ready" | "partial" | "failed"
	errorCode?: string
	errorMessage?: string
	textExtracted: boolean
	briefGenerated: boolean
	starterQuestionsGenerated: boolean
	indexed: boolean
	updatedAt: number
}
```
Why:
- avoids hiding partial failures
- gives one source of truth for readiness

### 4. `PdfAnnotation` <!-- oc:id=sec_ah -->
Durable highlight / anchored note root.
```ts
export interface PdfAnnotation {
	id: string
	documentId: string
	projectId: string
	kind: "highlight" | "note" | "question" | "bookmark"
	locator: DocumentLocator
	color?: string
	status: "active" | "resolved" | "archived"
	createdAt: number
	updatedAt: number
}
```
Why:
- annotation belongs to both document and project context
- locator required for jump/reopen behavior

### 5. `PdfAnnotationNote` <!-- oc:id=sec_ai -->
Text/comment body attached to annotation.
```ts
export interface PdfAnnotationNote {
	id: string
	annotationId: string
	body: string
	authorRole: "user" | "assistant" | "system"
	createdAt: number
	updatedAt: number
}
```
Why:
- avoids overloading annotation core row with long note history
- keeps notes tied to annotation, not free-floating session drafts

### 6. `PdfReviewProject` <!-- oc:id=sec_aj -->
Group of related documents and derived outputs.
```ts
export interface PdfReviewProject {
	id: string
	name: string
	description?: string
	createdAt: number
	updatedAt: number
}
```

### 7. `PdfProjectDocument` <!-- oc:id=sec_ak -->
Explicit join row for project membership and ordering.
```ts
export interface PdfProjectDocument {
	id: string
	projectId: string
	documentId: string
	orderIndex: number
	addedAt: number
}
```
Why:
- supports multi-doc projects cleanly
- avoids implicit ownership through arrays on one side only

### 8. `PdfGroundedArtifact` <!-- oc:id=sec_al -->
Durable artifact record for project/document-derived outputs.
```ts
export interface PdfGroundedArtifact {
	id: string
	projectId: string
	documentId?: string
	title: string
	component: string
	props: Record<string, unknown>
	sourceRefs: PdfArtifactSourceRef[]
	createdAt: number
	updatedAt: number
}
```

### 9. `PdfArtifactSourceRef` <!-- oc:id=sec_am -->
Locator-backed claim/source link inside artifact.
```ts
export interface PdfArtifactSourceRef {
	id: string
	artifactId: string
	label?: string
	locator: DocumentLocator
}
```
Why:
- keeps grounding explicit
- allows one artifact to cite many documents/spans

### 10. `PdfExtractionTable` <!-- oc:id=sec_an -->
Schema-level extraction definition.
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

### 11. `PdfExtractionRow` <!-- oc:id=sec_ao -->
Row instance in grounded table.
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

### 12. `PdfExtractionCell` <!-- oc:id=sec_ap -->
Grounded cell value with provenance.
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
Why:
- every extracted datum stays verifiable
- one cell may cite multiple source spans

### 13. `PdfAudioSummary` <!-- oc:id=sec_aq -->
Cached audio/summary output.
```ts
export interface PdfAudioSummary {
	id: string
	projectId: string
	documentId?: string
	scope: "document" | "project"
	textSummary: string
	audioCacheKey?: string
	status: "ready" | "generating" | "failed"
	errorMessage?: string
	createdAt: number
	updatedAt: number
}
```

### 14. `PdfStarterQuestion` <!-- oc:id=sec_ar -->
Persisted ingest-derived opener.
```ts
export interface PdfStarterQuestion {
	id: string
	documentId: string
	question: string
	orderIndex: number
	createdAt: number
}
```

### 15. `PdfDocumentBrief` <!-- oc:id=sec_as -->
Persisted ingest-derived brief.
```ts
export interface PdfDocumentBrief {
	id: string
	documentId: string
	body: string
	createdAt: number
	updatedAt: number
}
```

## Relationship map <!-- oc:id=sec_at -->
- `PdfReviewProject 1 -> many PdfProjectDocument`
- `PdfReviewDocument 1 -> many PdfProjectDocument`
- `PdfReviewDocument 1 -> many PdfDocumentChunk`
- `PdfReviewDocument 1 -> 1 PdfDocumentIngestStatus`
- `PdfReviewDocument 1 -> many PdfAnnotation`
- `PdfAnnotation 1 -> many PdfAnnotationNote`
- `PdfReviewProject 1 -> many PdfGroundedArtifact`
- `PdfGroundedArtifact 1 -> many PdfArtifactSourceRef`
- `PdfReviewProject 1 -> many PdfExtractionTable`
- `PdfExtractionTable 1 -> many PdfExtractionRow`
- `PdfExtractionRow 1 -> many PdfExtractionCell`
- `PdfReviewDocument 1 -> many PdfStarterQuestion`
- `PdfReviewDocument 1 -> 1 PdfDocumentBrief`
- `PdfReviewProject or PdfReviewDocument 1 -> many PdfAudioSummary`

## Span-bearing entities that must use shared locator <!-- oc:id=sec_au -->
These must reference `DocumentLocator` and nothing ad hoc:
- `PdfAnnotation.locator`
- `PdfArtifactSourceRef.locator`
- `PdfExtractionCell.locators[]`
- future `PdfSearchHit.locator`
- future `PdfChatCitation.locator`

## Entities that need versioning / migration support <!-- oc:id=sec_av -->
Strong candidates:
- `PdfReviewDocument` — ingest/status evolution
- `PdfDocumentChunk` — text extraction or chunking version changes
- `PdfAnnotation` — locator schema version already nested; row may need migration
- `PdfGroundedArtifact` — artifact prop/source-ref shape may evolve
- `PdfExtractionTable` / `PdfExtractionCell` — schema changes likely
- `PdfAudioSummary` — cache strategy or provider changes likely

Simpler entities can usually ride table migrations without special version fields:
- `PdfAnnotationNote`
- `PdfStarterQuestion`
- `PdfDocumentBrief`
- `PdfProjectDocument`

## Explicit non-entities <!-- oc:id=sec_aw -->
Do not model as durable domain rows:
- side-panel open tab
- active page in viewer
- current text selection
- floating action menu visibility
- widget pin placement
- playback controls state

Those remain UI/session state.

## Product-surface coverage check <!-- oc:id=sec_ax -->
| Feature | Backing entities |
| --- | --- |
| document viewer + reopen | `PdfReviewDocument`, `PdfDocumentChunk`, `PdfDocumentIngestStatus` |
| annotations + notes | `PdfAnnotation`, `PdfAnnotationNote` |
| upload brief + starter questions | `PdfDocumentBrief`, `PdfStarterQuestion`, `PdfDocumentIngestStatus` |
| corpus search | `PdfDocumentChunk`, future search-hit projection |
| projects + cross-doc chat | `PdfReviewProject`, `PdfProjectDocument` |
| artifacts | `PdfGroundedArtifact`, `PdfArtifactSourceRef` |
| grounded tables | `PdfExtractionTable`, `PdfExtractionRow`, `PdfExtractionCell` |
| audio summary | `PdfAudioSummary` |

## Verdict <!-- oc:id=sec_ay -->
Requested product surface is fully covered with explicit ownership and joins. Durable domain model stays separate from session-only shell state.