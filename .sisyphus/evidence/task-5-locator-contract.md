# Task 5 — Shared locator/span contract <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define one shared, versioned locator contract that all grounded PDF-review features use:
- citations
- annotations
- notes
- search hits
- project chat
- artifact references
- table cells

`documentId` must be first-class. Contract must cover resolved and degraded cases. No PDF.js or desktop-only leakage.

## Design principles <!-- oc:id=sec_ac -->
1. `documentId` first. Multi-doc flows only work if every locator names its source document explicitly. <!-- oc:id=item_aa -->
1. One contract, many selectors. No single selector is trusted forever. <!-- oc:id=item_ab -->
1. Stored coordinates are document-space, not viewport-space. <!-- oc:id=item_ac -->
1. Resolution state is explicit. Never imply exactness when unresolved or ambiguous. <!-- oc:id=item_ad -->
1. Shared schema stays viewer-agnostic. PDF.js adapters can derive viewport rects later. <!-- oc:id=item_ae -->

## Proposed TypeScript shape <!-- oc:id=sec_ad -->
```ts
export type DocumentLocatorVersion = "v1"

export type DocumentAnchorKind = "text" | "point" | "region" | "page"

export type DocumentResolutionState =
	| "resolved"
	| "page-fallback"
	| "ambiguous"
	| "unresolved"
	| "deleted-document"
	| "missing-text-layer"

export interface TextQuoteSelector {
	quote: string
	prefix?: string
	suffix?: string
}

export interface TextPositionSelector {
	start: number
	end: number
}

export interface PageSelector {
	pageIndex: number
	pageLabel?: string
}

export interface RegionRect {
	x1: number
	y1: number
	x2: number
	y2: number
	unit: "pdf-points"
}

export interface RegionSelector {
	pageIndex: number
	rects: RegionRect[]
}

export interface StructuralSelector {
	blockId?: string
	chunkId?: string
	textLayerVersion?: string
}

export interface DocumentLocator {
	version: DocumentLocatorVersion
	documentId: string
	anchorKind: DocumentAnchorKind
	selectors: {
		page?: PageSelector
		quote?: TextQuoteSelector
		position?: TextPositionSelector
		region?: RegionSelector
		structure?: StructuralSelector
	}
	resolution: {
		state: DocumentResolutionState
		matchedPageIndex?: number
		matchedRange?: { start: number; end: number }
		matchedRectCount?: number
		candidateCount?: number
		reason?: string
	}
}
```

## Field rationale <!-- oc:id=sec_ae -->
### `version` <!-- oc:id=sec_af -->
Locks schema evolution. Downstream consumers can branch on format without guessing.

### `documentId` <!-- oc:id=sec_ag -->
Mandatory on every locator.
- enables cross-document chat
- prevents duplicate-quote confusion across project documents
- lets artifacts/tables/search results jump into correct source

### `anchorKind` <!-- oc:id=sec_ah -->
Declares primary intent:
- `text`: quote/range-based span
- `point`: single anchored note marker
- `region`: highlight or area spanning one or more rects
- `page`: coarse fallback when exact text/region unavailable

This helps renderers and degraded UX without bespoke per-feature booleans.

### `selectors` <!-- oc:id=sec_ai -->
Multi-selector stack. Any subset can exist, but downstream features all share same container.

#### `page` <!-- oc:id=sec_aj -->
Cheap stable hint and degraded fallback target.

#### `quote` <!-- oc:id=sec_ak -->
Human-auditable selector for grounding and fuzzy relocation.
- `quote` required when text grounding exists
- `prefix` / `suffix` disambiguate repeated quotes

#### `position` <!-- oc:id=sec_al -->
Text offsets inside extracted document corpus.
- for exact same-text-layer resolution
- should reference normalized extracted text, not assistant message offsets

#### `region` <!-- oc:id=sec_am -->
Stores durable document-space rects.
- for highlight rendering
- for point or area comments
- `unit: "pdf-points"` keeps shared schema explicit without leaking PDF.js viewport math

#### `structure` <!-- oc:id=sec_an -->
Optional stable ids from ingest/chunking pipeline.
- lets future extraction/versioned text layers resolve precisely
- chunk/block ids also help search hits and table provenance

### `resolution` <!-- oc:id=sec_ao -->
Shared degraded-state fields so all consumers speak same truth.
- `state`: current resolution truth
- `matchedPageIndex`: where resolver landed, if any
- `matchedRange`: resolved corpus offsets, if any
- `matchedRectCount`: useful for region rendering checks
- `candidateCount`: required for ambiguous repeated-quote cases
- `reason`: compact machine/human readable fallback explanation

## Consumer coverage <!-- oc:id=sec_ap -->
| Consumer | Uses |
| --- | --- |
| citation chip | `documentId`, `page`, `quote`, `resolution.state` |
| annotation/highlight | `documentId`, `region`, optional `quote`, `page` |
| note linked to annotation | same locator as annotation |
| search hit | `documentId`, `quote`, `position`, `page`, `resolution` |
| project chat answer | one locator per cited source span |
| artifact source reference | locator attached to claim/section/reference |
| table cell provenance | one or more locators per cell |
| audio summary provenance | optional coarse page/text locators for segments |

## Why one schema fits all listed consumers <!-- oc:id=sec_aq -->
- Citations need exact-or-degraded jump truth.
- Annotations need renderable region data.
- Search hits need quote + position + page.
- Project chat needs mandatory `documentId`.
- Artifacts and table cells need provenance references without inventing new span types.

All of these fit by combining the same selector bag plus explicit resolution state.

## Non-goals for v1 schema <!-- oc:id=sec_ar -->
Do not include:
- viewport pixels
- DOM node ids
- PDF.js text span ids
- Electron file paths
- renderer widget placement
- session ids

Those belong to adapters or owning entities, not shared locator contract.

## Ownership guidance <!-- oc:id=sec_as -->
- locator is embedded inside owning durable records
- examples: `annotation.locator`, `citation.locator`, `searchHit.locator`, `artifactReference.locator`, `tableCell.locators[]`
- locator is not standalone persisted top-level state

## Example shapes <!-- oc:id=sec_at -->
### Exact text citation <!-- oc:id=sec_au -->
```ts
const locator: DocumentLocator = {
	version: "v1",
	documentId: "doc_abc123",
	anchorKind: "text",
	selectors: {
		page: { pageIndex: 5, pageLabel: "6" },
		quote: {
			quote: "We evaluate retrieval under repeated-quote conditions.",
			prefix: "In this section,",
			suffix: "to avoid false precision.",
		},
		position: { start: 18244, end: 18293 },
		structure: { chunkId: "chunk_0051", textLayerVersion: "text-v1" },
	},
	resolution: {
		state: "resolved",
		matchedPageIndex: 5,
		matchedRange: { start: 18244, end: 18293 },
	},
}
```

### Highlight annotation with region rects <!-- oc:id=sec_av -->
```ts
const locator: DocumentLocator = {
	version: "v1",
	documentId: "doc_abc123",
	anchorKind: "region",
	selectors: {
		page: { pageIndex: 2 },
		quote: { quote: "Key finding: browser-mode parity is partial." },
		region: {
			pageIndex: 2,
			rects: [
				{ x1: 72, y1: 510, x2: 302, y2: 528, unit: "pdf-points" },
			],
		},
	},
	resolution: {
		state: "resolved",
		matchedPageIndex: 2,
		matchedRectCount: 1,
	},
}
```

### Degraded page-only search result <!-- oc:id=sec_aw -->
```ts
const locator: DocumentLocator = {
	version: "v1",
	documentId: "doc_scan001",
	anchorKind: "page",
	selectors: {
		page: { pageIndex: 10, pageLabel: "11" },
	},
	resolution: {
		state: "missing-text-layer",
		matchedPageIndex: 10,
		reason: "Document has no extractable text layer",
	},
}
```

## Acceptance check against plan <!-- oc:id=sec_ax -->
- Single versioned locator contract defined: yes
- Covers single-doc and multi-doc: yes, via mandatory `documentId`
- Covers resolved and unresolved/degraded states: yes, via `resolution.state`
- Named consumers listed: yes

## Recommendation <!-- oc:id=sec_ay -->
Add this contract to shared renderer types now, then build entity models and resolver spec against it. Do not let later features fork shape or rename core selector fields.