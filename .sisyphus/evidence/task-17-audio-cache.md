# Task 17 — Audio summary pipeline <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Decide how audio summaries are generated, cached, scoped, and retried without blocking core PDF review flows.

## Trigger policy <!-- oc:id=sec_ac -->
### V1 decision: on-demand, not ingest-blocking <!-- oc:id=sec_ad -->
Generate audio summaries only when user explicitly requests them.

Why:
- avoids adding latency/cost to core upload/ingest flow
- avoids generating expensive audio for documents user never listens to
- keeps reader/citation path independent from TTS success
- matches plan guardrail: audio must not block core reader/citation delivery

### Future option <!-- oc:id=sec_ae -->
If usage proves high and cache economics are acceptable, project/document summary text could precompute during ingest later, but audio rendering itself should still stay decoupled from mandatory ingest completion.

## Scope model <!-- oc:id=sec_af -->
### Document scope <!-- oc:id=sec_ag -->
Use when user wants summary of one document.
- `scope = "document"`
- `documentId` set
- `projectId` also present for grouping

### Project scope <!-- oc:id=sec_ah -->
Use when user wants cross-document synthesis summary.
- `scope = "project"`
- `documentId` null/omitted
- summary source comes from project retrieval contract

## Source of truth <!-- oc:id=sec_ai -->
Use durable `PdfAudioSummary` record from T8:
- `id`
- `projectId`
- optional `documentId`
- `scope`
- `textSummary`
- `audioCacheKey?`
- `status`
- `errorMessage?`
- timestamps

## Generation flow <!-- oc:id=sec_aj -->
### 1. Request summary <!-- oc:id=sec_ak -->
User clicks `Generate audio summary` from document/project context.

### 2. Build summary text <!-- oc:id=sec_al -->
- document scope: derive from document corpus / brief / grounded summary flow
- project scope: derive from project retrieval synthesis
- summary text persisted before or alongside audio generation attempt

### 3. Generate audio asset <!-- oc:id=sec_am -->
- TTS engine produces audio binary or file reference
- store/cache under `audioCacheKey`
- set `status = "ready"` on success

### 4. Replay on reopen <!-- oc:id=sec_an -->
On reopen:
- load `PdfAudioSummary`
- if `status = "ready"` and cache key still valid, show playable ready state immediately
- do not regenerate automatically

## Cache key definition <!-- oc:id=sec_ao -->
Recommended cache key basis:
```text
scope + projectId + documentId? + summaryTextHash + voiceProfile? + providerVersion?
```

Why:
- new summary text invalidates audio correctly
- document/project scopes separate cleanly
- future voice/provider changes can bust cache intentionally

## Regeneration policy <!-- oc:id=sec_ap -->
### Automatic regeneration <!-- oc:id=sec_aq -->
Do not regenerate on reopen.

### Manual regeneration <!-- oc:id=sec_ar -->
Allow explicit regenerate when:
- summary text changed materially
- cached audio missing/corrupt
- user changes voice/profile later

### Cache hit rule <!-- oc:id=sec_as -->
If `audioCacheKey` matches and asset exists:
- return ready state immediately
- skip TTS work entirely

## Failure behavior <!-- oc:id=sec_at -->
### Timeout / provider failure <!-- oc:id=sec_au -->
- set `status = "failed"`
- store `errorMessage`
- keep previously generated `textSummary` if available
- show retry button

### Missing cached asset on reopen <!-- oc:id=sec_av -->
- if record says ready but asset missing, downgrade to failed/degraded and ask for regeneration
- do not silently regenerate in background without user action

### Summary text available but audio failed <!-- oc:id=sec_aw -->
- keep text summary visible/usable
- audio failure must not poison document/project summary experience

## UI states <!-- oc:id=sec_ax -->
- idle (no request yet)
- generating
- ready
- failed

### Ready state <!-- oc:id=sec_ay -->
- play button enabled
- cache hit indicator optional for debugging only

### Failed state <!-- oc:id=sec_az -->
- retry affordance
- clear error message
- underlying reader/search/citation flows remain unaffected

## Existing seam reuse <!-- oc:id=sec_ba -->
### Voice lane <!-- oc:id=sec_bb -->
Current voice lane is input-first dictation, not outbound TTS.
Useful precedent only for audio-related UI affordances, not for summary backend itself.

### Domain model <!-- oc:id=sec_bc -->
`PdfAudioSummary` already gives right durable record shape; no need for second ad hoc cache model.

## Independence from grounding path <!-- oc:id=sec_bd -->
Audio summary should depend on grounded source summary text, but once summary text exists:
- playback and cache are independent from live citation/viewer behavior
- failed audio does not block notes, search, annotations, or jump-to-source

## Acceptance check <!-- oc:id=sec_be -->
- scope and trigger policy decided: yes
- cache key/source defined: yes
- failure and regeneration behavior defined: yes

## QA mapping <!-- oc:id=sec_bf -->
### Audio summary generates and replays from cache <!-- oc:id=sec_bg -->
Expected proof:
1. request summary <!-- oc:id=item_aa -->
1. wait for ready <!-- oc:id=item_ab -->
1. reopen same doc/project <!-- oc:id=item_ac -->
1. ready state returns without regeneration <!-- oc:id=item_ad -->

### Failure path — audio generation timeout <!-- oc:id=sec_bh -->
Expected proof:
1. simulate failure/timeout <!-- oc:id=item_ae -->
1. failed state visible with retry <!-- oc:id=item_af -->
1. rest of reader experience unaffected <!-- oc:id=item_ag -->