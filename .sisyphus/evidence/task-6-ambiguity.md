# Task 6 — Repeated-quote ambiguity guard <!-- oc:id=sec_aa -->

## Problem <!-- oc:id=sec_ab -->
Repeated quotes are common in papers:
- repeated headings
- duplicated summary lines
- table caption reuse
- boilerplate evaluation language

A naive string match would pick one and create false precision.

## Rule <!-- oc:id=sec_ac -->
If quote search yields multiple materially plausible matches and context signals do not produce one clear winner, resolver must return `ambiguous`.

## Example <!-- oc:id=sec_ad -->
Stored locator:
```ts
{
	version: "v1",
	documentId: "doc_eval_1",
	anchorKind: "text",
	selectors: {
		quote: {
			quote: "Results were statistically significant.",
		},
	},
	resolution: { state: "unresolved" },
}
```

Current extracted corpus contains same sentence on:
- page 3 discussion paragraph
- page 9 appendix summary

No `prefix`, `suffix`, `position`, or `page` hint survives.

## Expected resolver behavior <!-- oc:id=sec_ae -->
```ts
{
	state: "ambiguous",
	candidateCount: 2,
	reason: "Repeated quote matched multiple locations",
}
```

## Acceptable tie-breakers <!-- oc:id=sec_af -->
Only resolve automatically if one candidate clearly wins via:
- page match
- prefix match
- suffix match
- chunk/block match
- near-position continuity
- region/page agreement

If not, ambiguity stays visible.

## Forbidden behavior <!-- oc:id=sec_ag -->
Do not:
- pick first match in document order
- pick smallest page index by default
- silently fall through to one region/offset without verification
- claim `resolved` when multiple candidates remain tied

## UX implication <!-- oc:id=sec_ah -->
Ambiguous citation/highlight/search hit should:
- avoid exact auto-jump
- surface ambiguity warning
- optionally offer page-level fallback or candidate chooser later

## Verdict <!-- oc:id=sec_ai -->
False precision prevented. Ambiguous state is mandatory for repeated-quote ties.