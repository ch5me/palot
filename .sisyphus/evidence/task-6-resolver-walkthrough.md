# Task 6 — Locator resolution engine walkthrough <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define deterministic resolver behavior for shared `DocumentLocator` records.

## Resolver inputs <!-- oc:id=sec_ac -->
- locator
- extracted document corpus for `documentId`
- optional chunk/block index
- optional page text map
- optional page region geometry map

## Output shape <!-- oc:id=sec_ad -->
Resolver returns updated locator-style resolution data:
```ts
interface LocatorResolutionResult {
	state: "resolved" | "page-fallback" | "ambiguous" | "unresolved" | "deleted-document" | "missing-text-layer"
	matchedPageIndex?: number
	matchedRange?: { start: number; end: number }
	matchedRects?: RegionRect[]
	candidateCount?: number
	reason?: string
}
```

## Algorithm order <!-- oc:id=sec_ae -->
### Step 0 — Preflight <!-- oc:id=sec_af -->
1. Fetch document by `documentId`. <!-- oc:id=item_aa -->
1. If document missing, return `deleted-document`. <!-- oc:id=item_ab -->
1. If no extracted text corpus exists: <!-- oc:id=item_ac -->
   - if locator has `page`, return `missing-text-layer` with `matchedPageIndex`
   - else return `missing-text-layer` without exact target

### Step 1 — Structural exact path <!-- oc:id=sec_ag -->
Use `selectors.structure` when available.
- If `blockId` or `chunkId` resolves to current extracted text unit:
  - recover canonical page/range from chunk metadata
  - if quote exists, verify normalized quote still matches recovered text slice
  - if verified, return `resolved`
- If structure id exists but quote verification fails, continue to step 2 rather than silently trusting stale structure

### Step 2 — Page + position exact path <!-- oc:id=sec_ah -->
Use `selectors.position` with current text corpus.
- Verify `start/end` in bounds.
- Extract normalized substring from current corpus.
- If locator quote exists and normalized substring matches normalized quote, return `resolved`.
- If no quote exists but position is still valid and anchor kind is page/point/region, accept current range as `resolved` when surrounding metadata still agrees.
- If position mismatch found, continue.

### Step 3 — Quote + context fuzzy path <!-- oc:id=sec_ai -->
Run normalized text search using `selectors.quote.quote`.
- Find all exact normalized quote matches in corpus.
- If one match only:
  - if page selector exists and match maps to same page, return `resolved`
  - if page differs slightly but prefix/suffix align, still return `resolved`
- If multiple matches:
  - score each candidate using:
    1. page match bonus <!-- oc:id=item_ad -->
    1. prefix similarity bonus <!-- oc:id=item_ae -->
    1. suffix similarity bonus <!-- oc:id=item_af -->
    1. chunk/block continuity bonus <!-- oc:id=item_ag -->
    1. region overlap/page-region agreement bonus when region exists <!-- oc:id=item_ah -->
  - if top candidate clearly wins over next candidate by threshold, return `resolved`
  - otherwise return `ambiguous` with `candidateCount`
- If zero exact matches:
  - run near-match search on normalized quote with conservative edit-distance/token-drop tolerance
  - if one confident near-match found on expected page/context, return `resolved`
  - if multiple plausible near-matches, return `ambiguous`
  - else continue

### Step 4 — Region-assisted recovery <!-- oc:id=sec_aj -->
If locator has `region` but text match failed:
- use `region.pageIndex` as strongest fallback page hint
- if page text exists, constrain fuzzy quote search to that page first
- if no text match but region page exists, return `page-fallback`

### Step 5 — Page fallback <!-- oc:id=sec_ak -->
If `selectors.page` exists, return `page-fallback` with that page.
If only `region.pageIndex` exists, return `page-fallback` with region page.
Else return `unresolved`.

## Normalization rules <!-- oc:id=sec_al -->
All quote/substring comparisons must normalize both stored selector text and extracted corpus text using same pipeline:
1. Unicode normalize to NFKC <!-- oc:id=item_ai -->
1. lowercase for match pipeline <!-- oc:id=item_aj -->
1. collapse repeated whitespace to single spaces <!-- oc:id=item_ak -->
1. trim leading/trailing whitespace <!-- oc:id=item_al -->
1. normalize smart quotes/dashes to plain equivalents where possible <!-- oc:id=item_am -->
1. optionally strip soft hyphenation / line-wrap hyphen artifacts from extracted text <!-- oc:id=item_an -->

Keep original quote text for display. Normalize only for matching.

## Repeated-quote disambiguation <!-- oc:id=sec_am -->
When same normalized quote appears multiple times:
- prefer candidate on expected page
- then prefer candidate with matching `prefix`
- then matching `suffix`
- then matching `chunkId`/`blockId`
- then nearest stored `position` if stale but close

If after scoring two or more candidates remain materially tied, result must be:
```ts
{
	state: "ambiguous",
	candidateCount: 2,
	reason: "Repeated quote matched multiple locations",
}
```
Never auto-jump to one arbitrary match.

## Degraded outcomes <!-- oc:id=sec_an -->
| Condition | Result |
| --- | --- |
| document deleted | `deleted-document` |
| no extracted text, page known | `missing-text-layer` |
| structure/position stale, page known | `page-fallback` |
| repeated quote unresolved between candidates | `ambiguous` |
| no selectors recover target, page known | `page-fallback` |
| no selectors recover target, no page hint | `unresolved` |

## Durability requirements <!-- oc:id=sec_ao -->
### Reopen <!-- oc:id=sec_ap -->
Resolver should produce same outcome after closing/reopening app because it depends on durable document corpus + locator selectors, not viewport state.

### Rerender <!-- oc:id=sec_aq -->
Viewer rerender must not affect result because resolver never depends on DOM nodes or text spans.

### Zoom changes <!-- oc:id=sec_ar -->
Zoom must not affect result because stored region rects remain in document-space (`pdf-points`), with viewport conversion deferred to viewer adapter.

### Minor extraction drift <!-- oc:id=sec_as -->
If chunk boundaries or offsets shift slightly:
- structure or position may fail
- quote/context fuzzy path should recover exact span when surrounding text still exists
- if not recoverable safely, degrade to `ambiguous` or `page-fallback`

## Walkthroughs <!-- oc:id=sec_at -->
### Case A — exact anchor survives intact <!-- oc:id=sec_au -->
Input locator:
- `documentId = doc_1`
- `chunkId = chunk_51`
- `position = { start: 18244, end: 18293 }`
- `quote = "We evaluate retrieval under repeated-quote conditions."`
- `page = 5`

Flow:
1. document exists <!-- oc:id=item_ao -->
1. extracted text exists <!-- oc:id=item_ap -->
1. `chunk_51` resolves <!-- oc:id=item_aq -->
1. stored quote matches normalized chunk substring <!-- oc:id=item_ar -->
1. result = `resolved` <!-- oc:id=item_as -->

Expected output:
```ts
{
	state: "resolved",
	matchedPageIndex: 5,
	matchedRange: { start: 18244, end: 18293 },
}
```

### Case B — structure/position stale, quote recovers after minor drift <!-- oc:id=sec_av -->
Input locator:
- `chunkId = chunk_51` no longer exists after re-extraction
- stored position now off by 12 chars
- quote + prefix/suffix still present on page 5

Flow:
1. structure fails <!-- oc:id=item_at -->
1. position verification fails <!-- oc:id=item_au -->
1. exact quote search finds one candidate on page 5 with matching prefix/suffix <!-- oc:id=item_av -->
1. result = `resolved` <!-- oc:id=item_aw -->

Expected output:
```ts
{
	state: "resolved",
	matchedPageIndex: 5,
	matchedRange: { start: 18256, end: 18305 },
	reason: "Recovered via quote/context after extraction drift",
}
```

### Case C — quote-only locator with repeated text <!-- oc:id=sec_aw -->
Input locator:
- `quote = "Results were statistically significant."`
- page hint missing
- two matches in corpus with weak context

Flow:
1. no structure <!-- oc:id=item_ax -->
1. no position <!-- oc:id=item_ay -->
1. quote search returns 2 candidates <!-- oc:id=item_az -->
1. prefix/suffix absent or non-discriminating <!-- oc:id=item_ba -->
1. no safe winner <!-- oc:id=item_bb -->
1. result = `ambiguous` <!-- oc:id=item_bc -->

Expected output:
```ts
{
	state: "ambiguous",
	candidateCount: 2,
	reason: "Repeated quote matched multiple locations",
}
```

### Case D — scanned PDF with page hint only <!-- oc:id=sec_ax -->
Input locator:
- `page = 10`
- no extracted text available

Flow:
1. document exists <!-- oc:id=item_bd -->
1. no text corpus <!-- oc:id=item_be -->
1. return `missing-text-layer` with page hint <!-- oc:id=item_bf -->

Expected output:
```ts
{
	state: "missing-text-layer",
	matchedPageIndex: 10,
	reason: "No extractable text available for quote grounding",
}
```

## Verdict <!-- oc:id=sec_ay -->
Resolver order is concrete:
- structure
- position
- quote/context fuzzy
- region-assisted fallback
- page fallback

All failure paths end in explicit states. No silent false precision.