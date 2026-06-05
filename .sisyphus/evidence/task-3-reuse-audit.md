# Task 3 — Retrieval / masking / ingest seam audit <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Classify what PALOT already has for ingest, search, retrieval, masking, and background processing before downstream grounded PDF review work assumes too much.

## Classification legend <!-- oc:id=sec_ac -->
- **Confirmed**: repo code or docs prove seam exists now
- **Probable**: strong precedent exists, but not the exact PDF-review implementation needed
- **Unknown / net-new**: no direct seam found; plan should treat as new work

## Audit matrix <!-- oc:id=sec_ad -->
| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Side-panel shell registration | Confirmed | `docs/firefly-surface-playbook.md:18`, `apps/desktop/src/renderer/firefly-surface-registry.tsx:92`, `apps/desktop/src/renderer/components/agent-detail.tsx:230` | New PDF review surface can reuse existing registry/flag/persistence path |
| Session-side tab persistence and disabled-tab fallback | Confirmed | `apps/desktop/src/renderer/atoms/ui.ts:23`, `apps/desktop/src/renderer/atoms/ui.ts:55` | Existing `setAvailableSidePanelTabsAtom` already handles invalid active-tab fallback |
| Generic file search for document picker | Confirmed | `apps/desktop/src/renderer/hooks/use-file-search.ts:12`, `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx:50` | Good picker substrate for locating candidate PDFs/docs |
| PDF/office preview classification | Confirmed | `apps/desktop/src/main/files.ts:418`, `apps/desktop/src/main/files.ts:428` | App can detect pdf/office kinds, but no text extraction |
| Office -> PDF conversion | Confirmed | `apps/desktop/src/main/files.ts:514`, `apps/desktop/src/renderer/services/backend.ts:471`, `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx:65` | Useful normalization seam for non-PDF docs |
| Renderer-facing backend abstraction | Confirmed | `docs/firefly-surface-playbook.md:45`, `apps/desktop/src/renderer/services/backend.ts:434` | New PDF seams must flow through this facade |
| Session draft persistence | Confirmed | `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx:18` | Only suited for transient drafts, not durable annotations |
| Session-scoped artifact capture and prompt injection | Confirmed | `docs/genui-artifact-architecture.md:124`, `apps/desktop/src/renderer/genui/genui-renderer.tsx:235`, `apps/desktop/src/renderer/atoms/chat.ts:95` | Strong precedent for chat-linked derived outputs |
| Review-panel cross-pane navigation | Confirmed | `apps/desktop/src/renderer/atoms/ui.ts:74`, `apps/desktop/src/renderer/components/review/review-panel.tsx:177` | Good pattern for citation/result clickback opening another surface target |
| Async durable-ish panel service pattern | Confirmed | `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx:56`, `apps/desktop/src/renderer/services/memory-service.ts:15` | Local/hybrid/remote seam worth copying conceptually |
| Local durable SQLite/Drizzle substrate in desktop app | Confirmed | `apps/desktop/src/main/automation/database.ts:4`, `apps/desktop/src/main/automation/schema.ts:9` | Existing durable DB pattern exists, but only for automations today |
| Browser-mode file read/write parity path | Confirmed | `apps/desktop/src/renderer/services/backend.ts:441`, `apps/desktop/src/renderer/services/backend.ts:449` | Text files have browser-mode fallback routes; PDF preview/conversion do not |
| Browser-mode PDF preview parity | Unknown / net-new | `apps/desktop/src/renderer/services/backend.ts:434` throws outside Electron | Must add new backend seam if browser-mode proof required |
| Browser-mode office conversion parity | Unknown / net-new | `apps/desktop/src/renderer/services/backend.ts:471` throws outside Electron | Desktop-first okay, but browser-mode degraded path must be explicit |
| PDF text extraction | Unknown / net-new | no repo seam found; `studio-panel.tsx` only iframe-previews PDFs | Required for locators, search, grounded citations |
| PDF locator resolution engine | Unknown / net-new | no repo seam found | Must be new domain/service layer |
| Annotation persistence model | Unknown / net-new | no repo durable document annotation store found | Existing notes/artifacts stores are wrong scope |
| Corpus search over uploaded docs | Unknown / net-new | no document corpus index/search seam found | `useFileSearch` is filename search only |
| Background ingest jobs for documents | Probable | automation DB/job infra exists in main process, but no doc ingest pipeline | Could reuse patterns, not implementation |
| Structured extraction / tables | Unknown / net-new | no document extraction schema found | New work |
| Audio summary pipeline | Unknown / net-new | no document-audio summary seam found | New work |
| Masking proxy in renderer/app code | Unknown / net-new | no local app seam found in repo search | Must not assume quotes/offsets are already preserved through masking |
| Hosted retrieval / memory backend | Probable | memory service already calls hosted Cloudflare endpoints | Good architectural precedent, not same data model |

## Confirmed reusable seams <!-- oc:id=sec_ae -->
### 1. Shell and discoverability <!-- oc:id=sec_af -->
PDF review can plug into existing Firefly side-panel path without inventing new routing:
- tab id in `atoms/ui.ts`
- flag atom in `atoms/feature-flags.ts`
- registry entry in `firefly-surface-registry.tsx`
- active-session availability/fallback in `agent-detail.tsx`
- Cmd+K feature toggle and surface launcher in `command-palette.tsx`

### 2. Desktop file/document access <!-- oc:id=sec_ag -->
PALOT already has:
- file search by project
- file preview kind classification
- office-to-pdf conversion
- preload + IPC + backend service abstraction pattern

This is enough to boot a first document picker and preview-adjacent surface.

### 3. Session-linked derived-output precedent <!-- oc:id=sec_ah -->
GenUI artifacts prove PALOT already knows how to:
- capture model-derived UI blocks
- assign stable ids
- expose them in session widget and side-panel surfaces
- append lightweight context back into prompts

This is highly relevant for grounded citation chips and source-linked artifacts.

### 4. Durable local data precedent <!-- oc:id=sec_ai -->
Automation subsystem proves the app already has a local durable database pattern:
- libsql client
- Drizzle schema
- migrations

PDF review should likely reuse this style for durable document/project entities instead of stuffing them into localStorage atoms.

## Probable reusable seams <!-- oc:id=sec_aj -->
### Hosted/local durability split <!-- oc:id=sec_ak -->
`memory-service.ts` shows PALOT already uses a local / hybrid / remote mode concept. That is useful for thinking about document corpora later, but it is not a drop-in annotation/search implementation.

### Background processing shape <!-- oc:id=sec_al -->
Automation subsystem suggests main-process async job orchestration is acceptable in this codebase. Could inform ingest queue design, but no PDF/job implementation exists yet.

## Net-new work required <!-- oc:id=sec_am -->
- PDF text extraction
- shared locator contract
- locator resolution engine
- document/project durable schema
- annotation persistence model
- grounded citation streaming protocol
- corpus indexing and result ranking
- browser-mode parity for PDF bytes / served preview path
- explicit degraded states for no-text PDFs and unresolved locators

## Masking / quote-offset risk <!-- oc:id=sec_an -->
No repo evidence proves existing masking infrastructure preserves:
- original extracted text offsets
n- quote spans used for locator resolution
- stable raw text for fuzzy quote matching

Because of that:
- locator resolution must treat extracted document text as its own authoritative corpus
- grounded citations must not depend on already-masked chat text offsets
- if chat output or remote retrieval passes masked snippets, resolution should use stored document chunks and locators, not assistant-response character offsets

## Recommended safe defaults <!-- oc:id=sec_ao -->
1. Source-of-truth for grounding = extracted document corpus stored by document id. <!-- oc:id=item_aa -->
1. Chat citations carry locator references, not raw-message string offsets. <!-- oc:id=item_ab -->
1. Browser mode may degrade to read-only/unavailable until a PDF byte-serving seam exists. <!-- oc:id=item_ac -->
1. If extraction fails or PDF is image-only, surface explicit no-text degraded state; do not fake quote-level grounding. <!-- oc:id=item_ad -->

## Verdict <!-- oc:id=sec_ap -->
PALOT has strong shell, panel, prompt-context, and durable-app-storage precedents.
PALOT does **not** yet have document-grounding infrastructure. PDF review grounding, extraction, locator resolution, and corpus search should be scoped as net-new work, not assumed reuse.