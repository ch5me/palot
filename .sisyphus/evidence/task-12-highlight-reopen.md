# Task 12 — Annotations + notes integration <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define how durable highlights and note attachments integrate with existing notes/chat/artifact patterns without creating a second disconnected note system.

## Core integration decision <!-- oc:id=sec_ac -->
### Durable review notes are annotation-attached, not session draft notes <!-- oc:id=sec_ad -->
- `NotesPanel` remains operator scratchpad scoped to `notes:${agent.sessionId}` via `useDraft`
- document review notes live under `PdfAnnotation` + `PdfAnnotationNote`
- session draft notes can still help compose content, but they are not source of truth for persisted paper annotations

This avoids abusing session draft storage for document durability.

## Annotation + note relationship <!-- oc:id=sec_ae -->
### Durable entities <!-- oc:id=sec_af -->
From T8:
- `PdfAnnotation { id, documentId, projectId, kind, locator, color, status, ... }`
- `PdfAnnotationNote { id, annotationId, body, authorRole, ... }`

### Creation flow <!-- oc:id=sec_ag -->
1. selection action `Highlight` creates `PdfAnnotation` <!-- oc:id=item_aa -->
1. selection action `Add note` creates `PdfAnnotation` if missing, then opens note composer bound to `annotationId` <!-- oc:id=item_ab -->
1. note save writes durable `PdfAnnotationNote` <!-- oc:id=item_ac -->
1. annotation list and viewer overlays subscribe to durable records, not session draft text <!-- oc:id=item_ad -->

## Reopen and jump behavior <!-- oc:id=sec_ah -->
### Reopen <!-- oc:id=sec_ai -->
On document reopen:
- load `PdfAnnotation[]` for `documentId`
- render overlay regions from each annotation locator
- show annotation list ordered by page / recency
- note bodies load through `annotationId`

### Jump-to-annotation <!-- oc:id=sec_aj -->
From annotation list or artifact/source clickback:
1. open `pdf-review` if needed <!-- oc:id=item_ae -->
1. send annotation locator through same jump path as citations <!-- oc:id=item_af -->
1. resolver returns exact/degraded state <!-- oc:id=item_ag -->
1. viewer scrolls to annotation target and pulses highlight region <!-- oc:id=item_ah -->

This means annotations and citations share one navigation contract.

## AI context inclusion policy <!-- oc:id=sec_ak -->
### Included <!-- oc:id=sec_al -->
Annotations can feed AI in controlled ways:
- Ask-AI on selected passage uses fresh selection payload
- future project/doc prompts may include recent or explicitly referenced annotation summaries
- note body plus quote may be included when user invokes annotation-based follow-up

### Not included by default <!-- oc:id=sec_am -->
Do not blindly append all annotations/notes to every prompt.

Recommended policy:
- include only explicitly selected annotation(s)
- or small recent subset relevant to current document/project question
- reference durable ids / locators where possible

Why:
- avoids context bloat
- preserves intentionality
- aligns with artifact-context pattern of bounded prompt injection

## Existing pattern reuse <!-- oc:id=sec_an -->
### From `NotesPanel` <!-- oc:id=sec_ao -->
Reuse:
- send-to-chat seam via `paneWriters`
- small note-composer affordance patterns

Do not reuse:
- session draft persistence as durable storage
- freeform unscoped notes blob as annotation record

### From `MemoryPanel` / `memory-service` <!-- oc:id=sec_ap -->
Reuse:
- async durable record loading/fallback mindset
- local/remote/hybrid thinking if sync arrives later

Do not reuse:
- memory item schema for annotations directly

### From artifact system <!-- oc:id=sec_aq -->
Reuse:
- stable ids
- source-link thinking
- side-panel + session-surface coexistence discipline

Do not reuse:
- session-scoped artifact storage as durable annotation backend

## Overlap semantics <!-- oc:id=sec_ar -->
### Allowed overlap <!-- oc:id=sec_as -->
Overlapping highlights should be allowed in v1 when they represent distinct user intent.

### Representation rule <!-- oc:id=sec_at -->
Each annotation remains separate durable record with its own locator and note thread.

### Rendering rule <!-- oc:id=sec_au -->
If overlap occurs:
- stack visually by translucency or slight outline difference
- selection of overlapping area should surface deterministic nearest/topmost list or grouped selection affordance later
- do not merge records silently

### Conflict rule <!-- oc:id=sec_av -->
Repeated creation of identical locator by same user/session may dedupe only if explicitly chosen by product later. Default v1: treat as separate unless exact duplicate suppression is added intentionally.

## Sync semantics <!-- oc:id=sec_aw -->
### V1 <!-- oc:id=sec_ax -->
Single-user durable local-first model.
- local durable store authoritative
- optional remote sync can be layered later
- timestamps on annotation and note records support future sync/reconcile

### Future-safe fields already useful <!-- oc:id=sec_ay -->
- `createdAt`
- `updatedAt`
- stable ids
- explicit `status`
- `authorRole`

## Suggested UI structure inside `pdf-review` <!-- oc:id=sec_az -->
- annotation overlays on pages
- annotation list grouped by page or recency
- note composer drawer/inline panel bound to selected annotation
- `Ask AI about this note` or `Send note to chat` uses annotation quote + note body + locator

## Durable vs transient split <!-- oc:id=sec_ba -->
### Durable <!-- oc:id=sec_bb -->
- annotation locator
- note body
- color/status
- created/updated timestamps

### Transient <!-- oc:id=sec_bc -->
- active selected annotation id
- note composer open state
- draft edits before save
- hover state / pulse state

## Failure behavior <!-- oc:id=sec_bd -->
### Missing document on reopen <!-- oc:id=sec_be -->
- annotation remains durable record
- locator resolves `deleted-document`
- UI shows stale-source state, not silent disappearance

### Overlap conflict <!-- oc:id=sec_bf -->
- keep both records visible or list them separately
- no data corruption / overwrite

### Note save interrupted <!-- oc:id=sec_bg -->
- draft can exist transiently in composer
- durable record writes only on explicit save

## Acceptance check <!-- oc:id=sec_bh -->
- annotation entity and note linkage specified: yes
- reopen and jump-to-annotation path specified: yes
- AI context inclusion policy specified: yes
- overlap/sync semantics specified: yes

## QA mapping <!-- oc:id=sec_bi -->
### Highlight persists and reopens <!-- oc:id=sec_bj -->
Expected proof:
1. create highlight + note <!-- oc:id=item_ai -->
1. close and reopen document/session <!-- oc:id=item_aj -->
1. annotation overlay and note still present <!-- oc:id=item_ak -->
1. click annotation and jump works <!-- oc:id=item_al -->

### Overlap conflict <!-- oc:id=sec_bk -->
Expected proof:
1. create one highlight <!-- oc:id=item_am -->
1. create overlapping highlight <!-- oc:id=item_an -->
1. both remain deterministic records, not corrupted merge <!-- oc:id=item_ao -->