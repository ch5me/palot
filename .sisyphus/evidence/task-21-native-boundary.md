# Task 21 — Native/shared contract boundary <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Freeze the PDF review design so future mobile/native clients can replace viewer, input, and storage plumbing without rewriting grounding semantics.

## Boundary rule <!-- oc:id=sec_ac -->
Shared contracts define document identity, locators, provenance, projects, artifacts, extraction rows/cells, ingest states, and degraded states.
Desktop-only seams define how Electron/web renderer loads bytes, paints pages, captures selections, projects overlays, and persists local UI state.

## Shared contract package <!-- oc:id=sec_ad -->
### Safe to share across desktop and native <!-- oc:id=sec_ae -->
- `DocumentLocator` and locator-resolution result states
- `PdfReviewDocument` / project and join entities
- annotation, note, artifact source-ref, extraction table/row/cell, audio summary, brief, starter question domain records
- ingest phase/status vocabulary
- degraded-state vocabulary: `resolved`, `page-fallback`, `ambiguous`, `unresolved`, `stale-document`, `no-text`, `failed`, `guarded`
- citation token payload shape at logical level (`documentId`, locator ref, state, labels)

### Why these are portable <!-- oc:id=sec_af -->
They describe meaning and truth, not rendering or transport.
A native client can consume the same records and decide its own viewer/input adapters.

## Desktop-only seams <!-- oc:id=sec_ag -->
### Viewer/runtime seam <!-- oc:id=sec_ah -->
Desktop-specific pieces:
- `react-pdf` or pdf.js-flavored viewer substrate choice
- page virtualization/mount strategy
- viewport coordinate projection from document-space rects
- scroll container behavior and highlight pulse animation
- browser-mode vs Electron byte-loading details

### Input seam <!-- oc:id=sec_ai -->
Desktop-specific pieces:
- DOM/browser text selection capture
- floating menu anchoring to viewport rects
- hover/focus prefetch triggers tied to browser events

### Storage/runtime seam <!-- oc:id=sec_aj -->
Desktop-specific pieces:
- Electron preload/API bridge specifics
- local UI cache for page, zoom, open tab, visible ranges
- dev/browser-mode fallback transport for bytes or preview fetches

## Portability split <!-- oc:id=sec_ak -->
### Shared layer responsibilities <!-- oc:id=sec_al -->
- define logical citation/annotation/search/artifact/table/audio contracts
- resolve locators against extracted corpus
- preserve provenance and degraded truthfulness
- represent cross-document/project relationships

### Platform adapter responsibilities <!-- oc:id=sec_am -->
- fetch/open document bytes
- render document pages/text layer
- collect user selections
- execute scroll/highlight UX
- host local caches optimized for platform

## Future native path <!-- oc:id=sec_an -->
A native/mobile implementation should be able to:
1. reuse the same durable records and resolver semantics <!-- oc:id=item_aa -->
1. supply its own document renderer and selection adapter <!-- oc:id=item_ab -->
1. map document-space rects into native viewport geometry <!-- oc:id=item_ac -->
1. keep degraded-state UX language consistent even if visual affordances differ <!-- oc:id=item_ad -->

This is credible because shared contracts avoid DOM ids, CSS geometry, Electron IPC types, and renderer atoms.

## Versioning guidance <!-- oc:id=sec_ao -->
If a platform-specific concern must leak upward:
- add it behind explicit versioned optional extension fields
- keep core locator/domain semantics unchanged
- document the leak as temporary and platform-scoped

## Intentional non-shared items <!-- oc:id=sec_ap -->
Do not place these in shared schema:
- viewport pixel rectangles
- scroll offsets
- zoom percentages as durable source truth
- command-palette registration ids
- side-panel tab ids as domain state
- chat/session widget open/closed UI state
- preload function names or IPC channel names

## Relationship to prior tasks <!-- oc:id=sec_aq -->
- T5 provides shared locator contract
- T8 provides durable domain entities
- T15 keeps cross-document grounding doc-aware
- T16 keeps artifact grounding portable
- T18 keeps tables portable via locator-backed cells

## Acceptance check <!-- oc:id=sec_ar -->
- shared-vs-desktop seams documented: yes
- native/mobile future path credible without overbuilding: yes
- desktop-only fields excluded from shared contract by default: yes