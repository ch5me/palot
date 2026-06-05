# PDF Review Side Panel — Continuation Notes <!-- oc:id=sec_aa -->

## Completed discovery gates <!-- oc:id=sec_ab -->
- T1 viewer decision: choose `react-pdf`; current `StudioPanel` iframe preview not enough for text selection or grounded overlays.
- T2 scope contract: durable review content belongs to document/project scopes; session atoms only for ephemeral UI.
- T3 seam audit: shell/panel/backend/file-search patterns exist; text extraction, locator resolution, corpus search are net-new.
- T4 shell fit: `pdf-review` cleanly fits existing Firefly side-panel registry/flag/command-palette path.
- T5 locator contract: one shared versioned locator with `documentId`, selector bag, and explicit degraded states.

## Active next task <!-- oc:id=sec_ac -->
- Final verification wave in order: F3 QA execution, F4 scope fidelity.

## Resolver direction <!-- oc:id=sec_ad -->
- Order: structure -> page+position -> quote+context fuzzy -> page fallback.
- Source of truth: extracted document corpus, not assistant-message offsets.
- Repeated quotes must resolve to `ambiguous`, not false exact jumps.
- Region rects stay document-space (`pdf-points`), renderer computes viewport overlays later.

## Domain model notes <!-- oc:id=sec_af -->
- Durable roots now defined as document, chunk, ingest status, annotation, annotation note, project, project-document join, artifact, artifact source ref, extraction table/row/cell, audio summary, brief, starter question.
- Span-bearing entities must use shared `DocumentLocator`; no raw `{ page, quote }` side objects.
- Keep UI state out of durable model: active selection, menu visibility, panel open state, widget placement, playback controls stay session-only.

## Viewer integration notes <!-- oc:id=sec_ag -->
- Default side-panel width too narrow for permanent three-column reader; v1 should use two-zone layout with collapsible/contextual secondary rail.
- `react-pdf` viewer should split into panel shell, document viewport, per-page view, and locator overlay adapter.
- Jump-to-span flow: resolver result -> page scroll -> overlay pulse; `page-fallback` scrolls without fake exact highlight.
- Zoom/rerender safety comes from document-space rects and corpus-based resolver, not DOM span ids.

## Citation protocol notes <!-- oc:id=sec_ah -->
- Streaming citation marker can use compact inline token like `[[cite:{...}]]`.
- Token must carry `locatorId`, `documentId`, and explicit degraded `state`.
- Parser should mirror GenUI pending behavior: partial markers become pending, not hard errors.
- Chip render can happen before message completion; full locator resolution stays lazy on click/hover-prefetch.
- Degraded chips must never fake exact jumps.

## Selection menu notes <!-- oc:id=sec_ai -->
- Selection payload should include `documentId`, start/end page indexes, `quote`, `rects`, and full shared locator.
- Menu anchor belongs to viewer shell, but action registry belongs to controller/panel layer.
- Required actions: Highlight, Add note, Ask AI, Explain.
- Ask AI / Explain should inject grounded text into composer via `paneWriters`, not auto-send.
- On scroll/rerender, menu should reposition if safe or close cleanly; never orphan.

## Annotation integration notes <!-- oc:id=sec_aj -->
- Durable review notes should attach to `PdfAnnotation`, not reuse session draft `NotesPanel` storage.
- `NotesPanel` remains scratchpad/send-to-chat helper; annotation notes live in durable `PdfAnnotationNote` rows.
- Reopen path loads annotations by `documentId`, renders overlays, and reuses same locator jump flow as citations.
- Overlapping highlights should remain separate records by default; no silent merge.
- AI context should include annotation/note data only when explicitly selected or intentionally referenced.

## Ingest notes <!-- oc:id=sec_ak -->
- Upload pipeline should persist `PdfReviewDocument` and queued `PdfDocumentIngestStatus` before extraction starts.
- Durable outputs split cleanly: chunks, brief, starter questions, ingest status.
- Reopen must read persisted brief/questions instantly; no automatic rerun on every open.
- Partial status is important: brief and starter questions may fail independently after successful extraction.
- Starter questions should seed chat through `paneWriters`, not auto-send.

## Corpus search notes <!-- oc:id=sec_al -->
- Searchable corpus should include durable chunk text plus annotation note bodies; session drafts stay out.
- Primary indexing unit is `PdfDocumentChunk`; annotation notes are secondary searchable units.
- Every search result must carry shared locator for clickback.
- Ranking should degrade honestly: exact lexical first, hybrid only when infrastructure exists.
- Semantic-unavailable mode should be explicit, not silently claimed as hybrid.

## Cross-document chat notes <!-- oc:id=sec_am -->
- Project grouping should stay explicit through `PdfReviewProject` + `PdfProjectDocument` joins.
- Every citation in cross-doc answers must carry `documentId`; doc identity cannot be implied from context.
- Clicking a citation may need to switch active document before running locator jump.
- Duplicate quote across different docs is not ambiguous at cross-doc layer if `documentId` is present; only intra-doc ambiguity remains for resolver.
- Chip labels in multi-doc answers should distinguish source docs, not just page numbers.

## Artifact integration notes <!-- oc:id=sec_an -->
- Grounded artifacts should be durable project-scoped records, not only session-scoped GenUI captures.
- Existing `ArtifactsPanel` and session widget should remain presentation surfaces; no second artifact subsystem.
- Generated artifacts must keep locator-backed `sourceRefs`, even when mirrored into session artifact cards.
- Editing/pinning stays session/UI scoped; source grounding stays durable.
- If artifact cannot retain source refs, it should not be presented as grounded.

## Audio summary notes <!-- oc:id=sec_ao -->
- V1 should generate audio on demand, not during required ingest path.
- Cache key should combine scope, project/document id, summary text hash, and future voice/provider dimensions.
- Reopen should replay cached ready state immediately; never regenerate automatically on open.
- Failed audio must degrade independently; underlying text summary/reader flow stays usable.

## Grounded table notes <!-- oc:id=sec_ap -->
- `PdfExtractionTable` defines schema; rows/cells carry actual extracted data.
- Every `PdfExtractionCell` must hold `value` plus `locators[]`; bare values forbidden.
- Cell clickback should use locator list and switch documents when needed.
- CSV export may expose friendly values, but provenance must remain available via sidecar or explicit source columns.
- Extraction must batch/guard on large project × schema combinations.

## Degraded-state notes <!-- oc:id=sec_aq -->
- Shared state vocabulary should distinguish `resolved`, `page-fallback`, `ambiguous`, `unresolved`, `stale-document`, `no-text`, `failed`, and `guarded`.
- Exact highlight/jump allowed only for trusted resolved states.
- Repeated quote in one doc must stay `ambiguous`; same quote across docs is safe if `documentId` stays attached.
- Ingest failures should be phase-specific: extraction, brief, starter questions, indexing.
- Stale document refs must preserve metadata and show recovery action, never jump into current wrong doc.
- Large extraction/perf overload should surface explicit guard/lazy states rather than blocking whole panel.

## Performance notes <!-- oc:id=sec_ar -->
- Large PDFs need page virtualization, visible-page-only text/overlay work, and cached page metrics by doc+page+zoom.
- Zoom/rerender should reuse resolved document-space anchors; only viewport projection recomputes.
- Citation chips should render from cheap metadata first; exact resolution only on interaction or tiny bounded idle prefetch.
- Search/table lists should virtualize and defer expensive snippet/provenance expansion until interaction.
- Side panel must yield to chat/session interactions; background prefetch should pause under direct user action.

## Native boundary notes <!-- oc:id=sec_as -->
- Shared layer owns logical truth: locators, projects, annotations, artifacts, extraction cells, ingest/degraded states.
- Desktop adapters own rendering/input/runtime specifics: `react-pdf`, DOM selection, viewport math, Electron/browser transport, UI caches.
- Shared schema must reject viewport pixels, DOM ids, IPC handles, tab ids, command ids, and transient UI state.
- If platform-specific data ever leaks upward, keep it optional, versioned, and explicitly scoped.

## F2 notes <!-- oc:id=sec_at -->
- `FireflySurfacePreferences.lastSidePanelTab` needed widening for `artifacts` and `pdf-review` to match `SidePanelTabId`.
- `GenUiArtifactCard` pin toggle needed explicit non-`inline` fallback to satisfy placement contract.
- `ipc-handlers.ts` carried stale unused oracle/pty types; safe cleanup unblocked typecheck.

## Future implementation notes <!-- oc:id=sec_ae -->
- Durable document/project store should likely mirror automation DB style (libsql + drizzle), not localStorage atoms.
- Browser mode needs explicit degraded/unavailable behavior until PDF bytes/URL serving seam exists.
- No second notes or artifact system. Reuse shell and artifact surfaces, but keep PDF review durable model separate from session-scoped artifact atoms.
