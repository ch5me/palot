# Task 11 — Selection action menu <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define anchored text-selection UX for `pdf-review` that can feed chat and annotation flows without hardwiring product logic into viewer internals.

## Core interaction model <!-- oc:id=sec_ac -->
### Trigger <!-- oc:id=sec_ad -->
- user drag-selects text on PDF text layer
- selection capture produces `PdfSelectionPayload`
- panel shows floating action menu anchored near selection bounds

### Payload shape <!-- oc:id=sec_ae -->
```ts
interface PdfSelectionPayload {
	documentId: string
	pageIndexStart: number
	pageIndexEnd: number
	quote: string
	rects: RegionRect[]
	locator: DocumentLocator
}
```

Notes:
- start/end page indexes support multi-page selections
- `rects` may span multiple lines and pages
- shared locator is already built before actions run

## Menu anchor behavior <!-- oc:id=sec_af -->
### Placement rules <!-- oc:id=sec_ag -->
- anchor to selection bounding box center/top by default
- clamp inside viewer viewport
- if selection near top edge, flip below selection
- if selection spans multiple lines/pages, anchor to first visible rect cluster or viewport-centered composite box

### Visibility rules <!-- oc:id=sec_ah -->
Menu opens only when:
- quote non-empty
- at least one rect exists
- viewer still owns active selection

Menu closes when:
- selection cleared
- user clicks elsewhere
- document scroll moves selection meaningfully out of view
- zoom/rerender invalidates current live selection
- action chosen successfully

### Scroll behavior <!-- oc:id=sec_ai -->
On scroll while menu open:
- if selected rects still visible, menu should reposition against updated bounding box
- if viewer rerender temporarily clears DOM selection, menu may close rather than risk orphaned UI
- do not leave menu floating in stale coordinates

## Action registry design <!-- oc:id=sec_aj -->
Keep actions declarative, not viewer-hardcoded.

```ts
interface PdfSelectionAction {
	id: "highlight" | "note" | "ask-ai" | "explain"
	label: string
	icon?: string
	run: (selection: PdfSelectionPayload) => void | Promise<void>
}
```

Registry owned by `pdf-review` surface/controller, not by low-level page renderer.

## Required actions <!-- oc:id=sec_ak -->
### 1. Highlight <!-- oc:id=sec_al -->
- creates durable annotation shell from selection locator + rects
- optional immediate color/default style
- no chat side effects required

### 2. Note <!-- oc:id=sec_am -->
- creates annotation draft plus opens note composer tied to that annotation
- may chain from `highlight`

### 3. Ask AI <!-- oc:id=sec_an -->
- writes grounded prompt text into active chat composer using `paneWriters`
- should include quote + compact source cue, not raw UI coordinates

Recommended inserted text shape:
```text
[Selected passage from document doc_1, page 6]
"...selected quote..."
Please answer about this passage.
```

Better later form can reference `documentId` / locator id more directly once chat retrieval flow exists.

### 4. Explain <!-- oc:id=sec_ao -->
- convenience variant of Ask AI
- seeds prompt with explain-focused framing like `Explain this passage in simpler terms.`

## Ask-AI integration seam <!-- oc:id=sec_ap -->
Use `paneWriters.get(agent.sessionId)` exactly like `NotesPanel`.

Flow:
1. selection action resolves current session writer <!-- oc:id=item_aa -->
1. compose grounded text snippet from selection payload <!-- oc:id=item_ab -->
1. inject into active chat composer <!-- oc:id=item_ac -->
1. keep user in flow; do not auto-send in v1 <!-- oc:id=item_ad -->

If no writer available:
- show same style of informative message as `NotesPanel`
- do not lose selection silently

## Viewer / controller boundary <!-- oc:id=sec_aq -->
### Viewer owns <!-- oc:id=sec_ar -->
- live DOM selection capture
- bounding rect measurement
- menu open/close/reposition signals

### Controller owns <!-- oc:id=sec_as -->
- action registry
- annotation creation intent
- chat injection intent
- note composer routing

This prevents viewer internals from becoming product-logic hub.

## Edge cases <!-- oc:id=sec_at -->
### Multi-line selection <!-- oc:id=sec_au -->
- supported
- `rects` includes one rect per line fragment
- menu anchor uses aggregate visible bounding box

### Multi-page selection <!-- oc:id=sec_av -->
- supported at payload level
- menu anchor should prefer currently visible leading rect cluster
- actions use combined locator/rects, not one-page truncation

### Overlapping with existing highlight <!-- oc:id=sec_aw -->
- selecting already highlighted text should still open menu
- downstream annotation layer decides merge/overlap policy later

### Empty / whitespace-only selection <!-- oc:id=sec_ax -->
- no menu

### Reversed selection drag <!-- oc:id=sec_ay -->
- normalize rect/order before payload build

### Keyboard selection / accessibility later <!-- oc:id=sec_az -->
- same payload contract can support non-pointer selection paths later

## UX copy guidance <!-- oc:id=sec_ba -->
Short action labels:
- Highlight
- Add note
- Ask AI
- Explain

Keep menu compact and horizontal when width allows; wrap only if needed in narrow panel.

## Failure behavior <!-- oc:id=sec_bb -->
### Missing chat composer <!-- oc:id=sec_bc -->
- Ask AI / Explain show non-destructive toast/message
- menu may stay open briefly or close after feedback

### Scroll while open <!-- oc:id=sec_bd -->
- reposition if possible
- otherwise close safely

### Rerender/zoom during live selection <!-- oc:id=sec_be -->
- close menu rather than preserve stale geometry
- user can reselect if needed

## Acceptance check <!-- oc:id=sec_bf -->
- menu anchor behavior specified: yes
- action registry shape specified: yes
- Ask-AI path feeds grounded context into chat: yes, via `paneWriters`
- edge cases for scroll/deselect/overlap covered: yes

## QA mapping <!-- oc:id=sec_bg -->
### Text selection opens anchored menu <!-- oc:id=sec_bh -->
Expected proof:
1. select visible sentence <!-- oc:id=item_ae -->
1. menu appears near selection <!-- oc:id=item_af -->
1. click Ask AI <!-- oc:id=item_ag -->
1. composer receives grounded selected text <!-- oc:id=item_ah -->

### Scroll while menu open <!-- oc:id=sec_bi -->
Expected proof:
1. open menu on live selection <!-- oc:id=item_ai -->
1. scroll document <!-- oc:id=item_aj -->
1. menu repositions or closes, never orphaned <!-- oc:id=item_ak -->