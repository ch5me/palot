# Task 10 — Grounded citation streaming protocol <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define a streaming-safe citation protocol that renders inline source chips before message completion, without buffering full answers and without implying false precision.

## Protocol shape <!-- oc:id=sec_ac -->
Use lightweight inline citation markers embedded directly in assistant text stream.

### Recommended annotation syntax <!-- oc:id=sec_ad -->
```text
Regular answer prose here.[[cite:{"locatorId":"loc_123","documentId":"doc_1","label":"p.6","state":"resolved"}]]
```

### Why this shape <!-- oc:id=sec_ae -->
- compact enough to stream inline with text
- JSON payload mirrors existing `genui` parser style
- can be parsed incrementally without requiring entire answer buffer
- payload can carry degraded state explicitly

## Citation payload contract <!-- oc:id=sec_af -->
```ts
interface StreamingCitationToken {
	locatorId: string
	documentId: string
	label?: string
	state: "resolved" | "page-fallback" | "ambiguous" | "unresolved" | "missing-text-layer" | "deleted-document"
	pageIndex?: number
	reason?: string
}
```

Notes:
- `locatorId` points to durable citation/locator record or message-local locator map
- `documentId` stays explicit for cross-document behavior
- `state` must ship with token so UI can render degraded chips honestly
- `pageIndex` optional convenience hint for immediate fallback label

## Streaming parser behavior <!-- oc:id=sec_ag -->
### Parsing model <!-- oc:id=sec_ah -->
Reuse `genui-renderer.tsx` philosophy:
- text and structured markers interleave in one stream
- partial markers should not flash hard errors
- pending/incomplete marker stays invisible or placeholder until terminator arrives

### Segment model <!-- oc:id=sec_ai -->
Introduce citation-aware text splitter conceptually like:
```ts
type CitationSegment =
	| { kind: "text"; text: string }
	| { kind: "citation"; token: StreamingCitationToken; raw: string }
	| { kind: "citation-pending"; raw: string }
	| { kind: "citation-error"; raw: string; error: string }
```

### Pending behavior <!-- oc:id=sec_aj -->
If stream currently ends with partial `[[cite:` block:
- parse as `citation-pending`
- do not render broken JSON or visible error while stream still active
- once closed `]]` arrives, upgrade into `citation`

### Error behavior <!-- oc:id=sec_ak -->
If completed token is malformed after stream chunk settles:
- treat raw marker as plain text or degraded citation-error fallback
- do not block rest of message rendering

This mirrors `splitGenUiFences(..., { dropErrors: true })` behavior.

## Rendering behavior <!-- oc:id=sec_al -->
### Inline chip rendering <!-- oc:id=sec_am -->
Rendered message should interleave prose and chips:
- prose stays in normal `MessageResponse`
- citation chip appears inline-right after referenced clause/sentence
- chip label priority:
  1. explicit `label` <!-- oc:id=item_aa -->
  1. `pageIndex` -> `p.{pageIndex + 1}` <!-- oc:id=item_ab -->
  1. degraded generic label like `source` <!-- oc:id=item_ac -->

### Visual states <!-- oc:id=sec_an -->
| token state | chip presentation |
| --- | --- |
| `resolved` | normal clickable chip |
| `page-fallback` | clickable chip with fallback styling |
| `ambiguous` | warning/degraded chip |
| `unresolved` | degraded non-precise chip |
| `missing-text-layer` | degraded page-only chip |
| `deleted-document` | broken/stale chip |

### Click behavior <!-- oc:id=sec_ao -->
Click path:
1. chip click emits locator jump request <!-- oc:id=item_ad -->
1. panel opens `pdf-review` if needed <!-- oc:id=item_ae -->
1. resolver result drives viewer behavior <!-- oc:id=item_af -->
1. degraded states show safe fallback message instead of exact jump <!-- oc:id=item_ag -->

## Lazy resolution policy <!-- oc:id=sec_ap -->
Do not eagerly resolve every citation token on initial render if message contains many chips.

Recommended split:
- assistant stream includes enough state for first-pass UI label
- full resolver/viewer action runs on click or hover-prefetch
- optional small cache stores resolution results keyed by `locatorId`

Why:
- avoids blocking streaming completion
- avoids heavy synchronous work in long cited answers
- aligns with T20 lazy-resolution goals

## Source of truth <!-- oc:id=sec_aq -->
- citation token is transport/view hint
- durable locator record remains source of truth for jump behavior
- never derive final span from assistant message character offsets

## Unresolved citation behavior <!-- oc:id=sec_ar -->
When token state is degraded:
- chip still renders, but styling communicates uncertainty
- click opens one of:
  - page fallback
  - ambiguity notice
  - source missing message
- never scroll to arbitrary exact span

## Example flows <!-- oc:id=sec_as -->
### Resolved citation <!-- oc:id=sec_at -->
Streamed answer:
```text
This benchmark regresses under repeated-quote conditions.[[cite:{"locatorId":"loc_a1","documentId":"doc_eval","label":"p.6","state":"resolved"}]]
```
UI:
- answer text appears immediately
- chip `p.6` appears as soon as marker closes
- clicking chip opens `pdf-review` and jumps to resolved span

### Page fallback citation <!-- oc:id=sec_au -->
```text
The appendix discusses an alternate extraction path.[[cite:{"locatorId":"loc_b2","documentId":"doc_eval","label":"p.12","state":"page-fallback","pageIndex":11,"reason":"Exact quote no longer matched"}]]
```
UI:
- chip styled as degraded fallback
- click jumps to page 12 only
- viewer shows fallback indicator, not exact highlight

### Unresolved citation <!-- oc:id=sec_av -->
```text
Older notes mention a deprecated route.[[cite:{"locatorId":"loc_c3","documentId":"doc_old","state":"deleted-document","reason":"Source document removed"}]]
```
UI:
- chip styled broken/stale
- click shows source unavailable state
- no false navigation

## Integration seam recommendation <!-- oc:id=sec_aw -->
### Chat renderer <!-- oc:id=sec_ax -->
Add citation-aware text renderer adjacent to or inside `TextWithGenUi` pipeline.
Two safe options:
1. parse citations first, then pass text fragments through existing `TextWithGenUi` <!-- oc:id=item_ah -->
1. extend `TextWithGenUi` to support both genui fences and citation markers <!-- oc:id=item_ai -->

Preferred: option 1, to avoid tangling fence parsing with citation token parsing too early.

### Prompt/agent contract <!-- oc:id=sec_ay -->
No need to append citation data into user bubble stripping path.
`atoms/chat.ts` remains prompt augmentation seam; grounded answers can be instructed to emit `[[cite:...]]` tokens when document context is active.

## Acceptance check <!-- oc:id=sec_az -->
- citation annotation syntax specified: yes
- partial/incomplete parser behavior specified: yes
- click path to resolver defined: yes
- unresolved state UI specified: yes

## Key non-goals <!-- oc:id=sec_ba -->
- no full-answer buffering for citation post-processing
- no exactness claims when state degraded
- no bespoke viewer-only anchor payloads in message stream