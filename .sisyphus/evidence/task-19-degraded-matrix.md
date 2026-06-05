# Task 19 — Degraded-state and error-handling matrix <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Unify failure handling across locator resolution, citations, ingest, search, cross-document retrieval, audio, and grounded tables so PDF review never falls into silent failure or false precision.

## Shared UX rules <!-- oc:id=sec_ac -->
- Every degraded state must be visible in product UI, not hidden in logs only.
- Every degraded state must name the broken thing: citation, document, ingest, search, audio, extraction cell, or annotation.
- Every degraded state must offer one of: retry, open source page, re-run ingest, open project/doc selector, or inspect provenance.
- Exact jump/highlight only when resolver returns exact or region-backed resolved state.
- Ambiguous or unresolved states must never render as if exact.

## Shared state vocabulary <!-- oc:id=sec_ad -->
### Resolution states <!-- oc:id=sec_ae -->
- `resolved`: exact enough to jump and pulse highlight
- `page-fallback`: document known, page known, exact span not trusted
- `ambiguous`: multiple plausible matches; require user choice or present source list
- `unresolved`: source data insufficient to locate exact or page fallback target
- `stale-document`: referenced document missing, deleted, or detached from project
- `no-text`: document present but no extractable text corpus exists
- `failed`: operation-specific execution failed
- `guarded`: intentionally blocked by cost/scale/perf control

## Matrix <!-- oc:id=sec_af -->
| Failure mode | Trigger | Visible UX | Allowed action | Forbidden behavior |
| --- | --- | --- | --- | --- |
| Repeated quote in one doc | Resolver finds several equal-confidence matches | citation/annotation chip shows `Ambiguous source` | open source list, narrow by page/context, fall back to page if one page dominates | auto-jump to arbitrary match |
| Quote drift after extraction change | structural/position anchors fail, quote fuzzy weak | `Source moved` state with page fallback when available | retry resolution, open page, refresh extraction | pulse fake highlight on weak text match |
| Unresolved citation | missing/invalid locator selectors | degraded chip `Source not found` | open page fallback if known, inspect source metadata | claim exact quoted support |
| Stale/deleted document | citation or artifact points to removed doc | stale-source banner with doc title/id and recovery CTA | locate replacement doc, restore doc, remove stale ref | navigate to wrong current doc |
| No-text PDF | ingest sees scanned/image-only or failed text layer | ingest card `No selectable text found` | keep raw viewer open, offer OCR/future upgrade note, allow manual notes | pretend search/citation/highlight works |
| Ingest extraction failed | backend extraction/model step errors | ingest status `Failed` with phase + retry | retry failed step, inspect details | leave brief/questions blank with no explanation |
| Brief generation failed after extraction success | model output step fails | extracted text available; brief card shows `Unavailable` | retry brief/question generation independently | mark whole document ingest failed |
| Search semantic path unavailable | embeddings/index infra absent | search header shows `Lexical mode` | run lexical search, explain ranking limit | imply hybrid ranking exists |
| Search no results | lexical/semantic search returns empty | empty-state with scope hint | broaden query, search annotations only, search current doc | blank panel with no explanation |
| Cross-doc duplicate quote | same text appears in different docs | chips label source doc explicitly | switch docs and jump per clicked citation | treat same quote as cross-doc ambiguous when `documentId` exists |
| Artifact source ref unresolved | artifact claim source no longer resolves | inline source badge `Unavailable` | inspect stored provenance, attempt page fallback | drop grounding badge silently |
| Audio generation failed | TTS request/network/provider fails | audio card `Failed to generate audio` | retry audio only | block reading/chat flow |
| Audio cache missing but text summary exists | cache evicted or never built | audio card `Generate audio` | generate on demand | auto-regenerate on open without request |
| Table cell has multiple sources | cell synthesized from many locators | cell opens source list | choose source, inspect all provenance | auto-jump to hidden arbitrary primary without disclosure |
| Table extraction over budget | doc×schema threshold exceeded | extraction state `Too large to run in one pass` | batch by docs/columns, narrow scope, confirm guarded rerun | silently continue runaway extraction |
| Large doc / heavy citation load | perf gate trips | lazy loading indicators / deferred resolution badges | resolve on demand, open page, continue reading | block whole panel while precomputing everything |

## Feature-specific guidance <!-- oc:id=sec_ag -->
### Citations <!-- oc:id=sec_ah -->
- Chip text should reflect confidence: exact source, page fallback, ambiguous, unresolved, stale.
- Clicking degraded citation opens the best honest target: source list, page, or stale banner.

### Annotations and notes <!-- oc:id=sec_ai -->
- Existing annotation with drifted locator should remain listed as durable record, but overlay may show `Needs re-anchor`.
- Note body stays visible even if source highlight becomes unresolved.

### Ingest <!-- oc:id=sec_aj -->
- Split ingest phases visibly: bytes saved, text extracted, brief generated, starter questions generated, indexed.
- Later phase failure must not erase earlier durable outputs.

### Search <!-- oc:id=sec_ak -->
- Search result cards must show source type: chunk, annotation note, table cell, artifact source ref.
- If source locator degraded, result still renders with explicit degraded badge.

### Cross-document chat <!-- oc:id=sec_al -->
- Citation badge always includes document label before page info.
- Missing doc becomes `stale-document`, not generic unresolved.

### Grounded tables <!-- oc:id=sec_am -->
- Cell provenance viewer should distinguish one-source exact clickback vs multi-source inspection mode.
- Export workflows must preserve stale-source metadata, not strip broken refs.

### Audio <!-- oc:id=sec_an -->
- Audio state is orthogonal to document grounding state.
- Audio retries must not touch ingest/search/citation caches.

## Retry and escape-hatch policy <!-- oc:id=sec_ao -->
- Retry only the failed slice, not the entire pipeline, when phase boundaries are clear.
- Prefer page fallback over unresolved when document and page remain trustworthy.
- Prefer source list over arbitrary auto-choice when ambiguity remains.
- Prefer persisted stale metadata over silently dropping references.

## Review against upstream task requirements <!-- oc:id=sec_ap -->
- T6 repeated quotes -> `ambiguous`, no false precision: covered
- T10 unresolved citation degraded UI: covered
- T13 no-text / extraction failure: covered
- T15 stale/multi-doc identity: covered
- T17 audio failure independent: covered
- T18 guarded extraction and multi-source cells: covered

## Acceptance check <!-- oc:id=sec_aq -->
- shared degraded-state matrix exists: yes
- visible UX and recovery path for each major failure mode: yes
- no false-exactness path remains in matrix: yes