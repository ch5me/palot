# Task 15 — Projects + cross-document chat contract <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define multi-document project grouping, project-scoped retrieval, and cross-document chat behavior where every citation remains explicitly document-aware and verifiable.

## Project grouping model <!-- oc:id=sec_ac -->
### Project root <!-- oc:id=sec_ad -->
Use `PdfReviewProject` as durable grouping record.
Fields already defined:
- `id`
- `name`
- `description?`
- timestamps

### Membership <!-- oc:id=sec_ae -->
Use explicit `PdfProjectDocument` join rows.
Why:
- one document may later appear in multiple project groupings if product expands
- ordering is explicit
- retrieval scope is durable and queryable

## Project-scoped retrieval contract <!-- oc:id=sec_af -->
### Retrieval scope <!-- oc:id=sec_ag -->
Default project chat sees:
- all `PdfReviewDocument` rows joined through `PdfProjectDocument`
- all indexed `PdfDocumentChunk` rows for those docs
- project-local annotation notes and annotation metadata for those docs
- optionally document briefs/starter questions as low-priority support text

### Retrieval output <!-- oc:id=sec_ah -->
Project-level answer generation should return:
- prose answer
- one or more citation tokens
- each citation token carries `documentId` explicitly
- locator remains shared `DocumentLocator`

No project answer may cite an anonymous source span.

## Cross-document answer contract <!-- oc:id=sec_ai -->
### Citation rule <!-- oc:id=sec_aj -->
Each cited span must name:
- `locatorId`
- `documentId`
- degraded `state`
- optional label/page hint

Example:
```text
The baseline differs between the two papers.[[cite:{"locatorId":"loc_a","documentId":"doc_alpha","label":"Alpha p.4","state":"resolved"}]][[cite:{"locatorId":"loc_b","documentId":"doc_beta","label":"Beta p.9","state":"resolved"}]]
```

### Multi-doc provenance rule <!-- oc:id=sec_ak -->
If answer synthesizes multiple docs:
- emit separate citation tokens per source document/span
- do not collapse them into one blended citation blob
- do not omit document identity even when same quote text appears in more than one doc

## Entry points for project chat <!-- oc:id=sec_al -->
Possible project-level surfaces later:
- active `pdf-review` project mode
- project search result follow-up
- project artifact generation flow
- dedicated project chat command seeded from grouped documents

Regardless of entrypoint, retrieval contract stays same: project -> joined docs -> chunk/note corpus -> document-aware citations.

## Jump-to-source flow <!-- oc:id=sec_am -->
### Chunk/citation click <!-- oc:id=sec_an -->
1. click citation token <!-- oc:id=item_aa -->
1. if cited `documentId` is not currently active in viewer, switch active document to cited document <!-- oc:id=item_ab -->
1. load/reuse that document's viewer state <!-- oc:id=item_ac -->
1. run locator resolution for cited locator <!-- oc:id=item_ad -->
1. jump/highlight or degrade safely <!-- oc:id=item_ae -->

### Required state transition <!-- oc:id=sec_ao -->
Viewer/controller must track:
- active project id
- active document id within project
- pending cross-doc jump target

Document switching is part of normal clickback, not an exceptional modal flow.

## Same quote across documents <!-- oc:id=sec_ap -->
### Problem <!-- oc:id=sec_aq -->
Two documents in one project may contain identical or near-identical sentence.

### Rule <!-- oc:id=sec_ar -->
Because every citation carries `documentId`, cross-doc ambiguity starts narrowed to one document before locator resolution even begins.

Then inside that document:
- resolver may still return `ambiguous` if repeated quote appears more than once in same doc
- but ambiguity must never jump across docs because `documentId` is already fixed

This is the core protection against cross-doc false precision.

## Result/citation object suggestion <!-- oc:id=sec_as -->
```ts
export interface PdfProjectCitation {
	locatorId: string
	documentId: string
	documentTitle?: string
	locator: DocumentLocator
	state: "resolved" | "page-fallback" | "ambiguous" | "unresolved" | "missing-text-layer" | "deleted-document"
}
```

For project answer payloads:
```ts
export interface PdfProjectAnswer {
	projectId: string
	answer: string
	citations: PdfProjectCitation[]
}
```

## UI behavior expectations <!-- oc:id=sec_at -->
### In answer rendering <!-- oc:id=sec_au -->
- chips should show enough label to distinguish docs, not just `p.4`
- preferred labels: `Doc title · p.4` or `Alpha p.4`
- if multiple docs cited in one paragraph, chips should remain individually clickable

### In viewer/panel <!-- oc:id=sec_av -->
- current document switch should be visible when clicking cross-doc citation
- annotation/search/artifact side lists should update to active document or clearly indicate project scope

## Degraded behavior <!-- oc:id=sec_aw -->
### Missing cited document from project <!-- oc:id=sec_ax -->
If citation references document not currently available:
- surface `deleted-document` or stale-source state
- do not open wrong fallback document

### Project retrieval without semantic layer <!-- oc:id=sec_ay -->
Project chat may still use lexical/degraded retrieval if semantic unavailable, but citations still need document-aware locators.

### Duplicate quote across docs <!-- oc:id=sec_az -->
No issue at cross-doc layer if citation includes explicit `documentId`; intra-doc ambiguity still handled by resolver.

## Acceptance check <!-- oc:id=sec_ba -->
- project entity and join model defined: yes
- cross-doc answer contract names source document for each citation: yes
- jump-to-source flow covers switching active document when needed: yes

## QA mapping <!-- oc:id=sec_bb -->
### Cross-document answer cites multiple source docs <!-- oc:id=sec_bc -->
Expected proof:
1. ask project question spanning 2 docs <!-- oc:id=item_af -->
1. answer contains citations from both docs <!-- oc:id=item_ag -->
1. clicking each citation switches to correct document and jumps correctly <!-- oc:id=item_ah -->

### Failure path — same quote in multiple docs <!-- oc:id=sec_bd -->
Expected proof:
1. duplicate quote exists across docs <!-- oc:id=item_ai -->
1. citation remains pinned to one `documentId` <!-- oc:id=item_aj -->
1. no cross-doc false jump occurs <!-- oc:id=item_ak -->