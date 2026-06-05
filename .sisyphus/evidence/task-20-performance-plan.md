# Task 20 — Performance, virtualization, and caching hardening <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Keep PDF review usable for large documents, long grounded chats, and large result sets without blocking the Firefly shell.

## Performance principle <!-- oc:id=sec_ac -->
Prioritize first useful paint and user-directed interaction over eager completeness.

## Surface-specific controls <!-- oc:id=sec_ad -->
### Large PDFs <!-- oc:id=sec_ae -->
- Virtualize page mounting; keep only visible page band plus small overscan alive.
- Defer text-layer and overlay work for offscreen pages.
- Cache rendered page metrics keyed by document + page + zoom.
- Recompute viewport overlays from document-space rects only for visible pages.
- Collapse non-visible annotation overlays into count/state metadata instead of active DOM.

### Viewer rerenders and zoom <!-- oc:id=sec_af -->
- Separate durable locator resolution from transient viewport math.
- On zoom change, reuse resolved document-space anchors; rerun viewport projection only.
- Debounce expensive reflow/reprojection during continuous zoom/resize.
- Preserve page scroll anchor across rerender using page index + approximate y ratio.

### Long chats with many citations <!-- oc:id=sec_ag -->
- Parse streaming citation syntax incrementally.
- Render chips from cheap metadata first.
- Lazily resolve exact targets on click/hover/focus and bounded idle prefetch only for visible chips.
- Collapse extremely citation-dense messages behind expanders if needed, but never hide citations entirely.

### Large search result sets <!-- oc:id=sec_ah -->
- Virtualize result list.
- Return preview snippets only for visible page of results.
- Defer expensive context reconstruction until row expansion or hover.
- Group by source type or document when result count is high.

### Grounded tables <!-- oc:id=sec_ai -->
- Virtualize rows and optionally columns for wide schemas.
- Open cell provenance/details in side drawer/popover on demand.
- Avoid pre-resolving every cell locator in table viewport.

## Caching policy <!-- oc:id=sec_aj -->
### Resolver cache <!-- oc:id=sec_ak -->
Cache locator resolution by:
- locator hash
- document extraction version
- resolver version

### Text/excerpt cache <!-- oc:id=sec_al -->
Cache normalized page/chunk text used for fuzzy matching and snippets so repeat jumps/searches avoid repeated normalization.

### UI cache <!-- oc:id=sec_am -->
Retain:
- last-open page/zoom per document
- recent resolved citations
- recent visible search pages

Do not treat UI cache as source of truth for durable grounding.

## Gating thresholds <!-- oc:id=sec_an -->
### Large document gate <!-- oc:id=sec_ao -->
Trigger heavy-mode controls when any of:
- page count above moderate threshold
- annotation count above moderate threshold
- document chunk count above moderate threshold

### Citation density gate <!-- oc:id=sec_ap -->
Trigger lazy-only mode when:
- message citation count exceeds small visible budget
- multiple grounded messages mount together

### Result-set gate <!-- oc:id=sec_aq -->
Trigger virtualization/grouping when:
- search results exceed one screenful by a clear margin
- extraction table row count exceeds simple non-virtual list bounds

Exact numeric thresholds can stay implementation-tuned; requirement is explicit gating, not unlimited eager rendering.

## Shell responsiveness requirements <!-- oc:id=sec_ar -->
- Side panel open must not break chat width, scroll, or input responsiveness.
- Scroll in viewer must not block session widget or chat interactions.
- Background prefetch must yield to direct user actions.
- Expensive work should move off critical paint path whenever possible.

## Honest degraded behavior <!-- oc:id=sec_as -->
When gates activate, UI should communicate:
- `Loading visible pages`
- `Resolving source on demand`
- `Showing first results`
- `Large table: rows virtualized`

Never present deferred work as already done.

## Reuse precedents <!-- oc:id=sec_at -->
- `apps/desktop/src/renderer/components/review/review-panel.tsx`: virtualization and gated rendering model
- `apps/desktop/src/renderer/components/chat/chat-view.tsx`: preserve shell width/scroll behavior
- `apps/desktop/src/renderer/components/session-widgets/session-widget-shell.tsx`: avoid side-panel-open layout regressions

## QA mapping <!-- oc:id=sec_au -->
### Large document remains usable <!-- oc:id=sec_av -->
Expected proof:
1. load large text PDF <!-- oc:id=item_aa -->
1. open PDF review side panel <!-- oc:id=item_ab -->
1. scroll, search, and click citations repeatedly <!-- oc:id=item_ac -->
1. visible lazy/deferred behavior appears while shell remains responsive <!-- oc:id=item_ad -->

### Eager citation resolution overload prevented <!-- oc:id=sec_aw -->
See `.sisyphus/evidence/task-20-lazy-citations.md`.

## Acceptance check <!-- oc:id=sec_ax -->
- performance gates specified for large docs/result sets: yes
- lazy resolution/caching policy specified: yes
- shell responsiveness preserved as explicit requirement: yes