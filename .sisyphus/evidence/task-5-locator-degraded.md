# Task 5 — Locator degraded-state coverage <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Prove the shared locator schema can represent unresolved, ambiguous, page-only, and missing-text-layer cases without false precision.

## Required degraded cases <!-- oc:id=sec_ac -->
### 1. Page-only fallback <!-- oc:id=sec_ad -->
When ingestion or selection only knows page location:
```ts
{
	version: "v1",
	documentId: "doc_1",
	anchorKind: "page",
	selectors: {
		page: { pageIndex: 3, pageLabel: "4" },
	},
	resolution: {
		state: "page-fallback",
		matchedPageIndex: 3,
		reason: "Exact quote or region unavailable",
	},
}
```
This is enough for:
- citation fallback click
- stale re-resolution fallback
- no-text document degraded UX

### 2. Quote exists but repeated, ambiguous target <!-- oc:id=sec_ae -->
```ts
{
	version: "v1",
	documentId: "doc_1",
	anchorKind: "text",
	selectors: {
		page: { pageIndex: 7 },
		quote: {
			quote: "Results were statistically significant.",
			prefix: "Across both baselines,",
			suffix: "under the final evaluation pass.",
		},
	},
	resolution: {
		state: "ambiguous",
		candidateCount: 2,
		reason: "Quote matched multiple locations after normalization",
	},
}
```
This prevents wrong exact jumps while keeping useful provenance.

### 3. Missing text layer / scanned PDF <!-- oc:id=sec_af -->
```ts
{
	version: "v1",
	documentId: "doc_scan_1",
	anchorKind: "page",
	selectors: {
		page: { pageIndex: 0 },
	},
	resolution: {
		state: "missing-text-layer",
		matchedPageIndex: 0,
		reason: "No extractable text available for quote grounding",
	},
}
```
This lets UI say:
- document found
- exact span unavailable
- page fallback only

### 4. Deleted or stale source document <!-- oc:id=sec_ag -->
```ts
{
	version: "v1",
	documentId: "doc_deleted_1",
	anchorKind: "text",
	selectors: {
		quote: { quote: "Original source text" },
	},
	resolution: {
		state: "deleted-document",
		reason: "Document record no longer available",
	},
}
```
This cleanly distinguishes missing document from unresolved quote.

### 5. Fully unresolved after re-resolution attempt <!-- oc:id=sec_ah -->
```ts
{
	version: "v1",
	documentId: "doc_1",
	anchorKind: "text",
	selectors: {
		page: { pageIndex: 5 },
		quote: { quote: "A formerly valid sentence" },
		position: { start: 2012, end: 2037 },
	},
	resolution: {
		state: "unresolved",
		reason: "Quote and stored range no longer match extracted text",
	},
}
```

## Why schema is sufficient <!-- oc:id=sec_ai -->
The contract can express:
- exact text span
- exact region rects
- coarse page target
- duplicate-quote ambiguity
- no-text degradation
- deleted source
- stale/unresolved re-resolution

No extra ad hoc fields are needed per feature.

## Shared UI semantics implied by `resolution.state` <!-- oc:id=sec_aj -->
| state | UI implication |
| --- | --- |
| `resolved` | exact jump/highlight allowed |
| `page-fallback` | jump to page, show fallback badge |
| `ambiguous` | do not auto-jump to exact span; require user disambiguation or show warning |
| `unresolved` | show source-not-found within document |
| `deleted-document` | show stale/deleted source message |
| `missing-text-layer` | show no-text/page-only fallback |

## Verdict <!-- oc:id=sec_ak -->
Degraded coverage is sufficient. Shared schema does not need separate fallback locator types for citations, annotations, search, or tables.