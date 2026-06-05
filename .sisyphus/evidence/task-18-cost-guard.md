# Task 18 — Extraction cost guardrails <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Define batching and cost-control behavior for grounded data-table extraction so large projects or wide schemas do not trigger silent runaway work.

## Guardrail rules <!-- oc:id=sec_ac -->
### Batch by document and row budget <!-- oc:id=sec_ad -->
- process extraction in bounded document batches
- cap number of active documents per extraction pass
- cap number of schema columns evaluated per pass when schema wide

### Trigger explicit guard when thresholds exceeded <!-- oc:id=sec_ae -->
If project exceeds configured thresholds:
- pause before full extraction
- surface clear `too-large-for-single-pass` or similar state
- require chunked/batched execution path

## Suggested threshold dimensions <!-- oc:id=sec_af -->
- document count in project
- total extracted chunk count across project
- estimated token volume for selected schema columns
- expected cells = documents/rows × columns

## Behavior when guard engages <!-- oc:id=sec_ag -->
- do not start one monolithic extraction
- show planned batches or require narrower schema/project subset
- preserve already completed partial rows/cells
- keep provenance and state explicit

## Output state suggestion <!-- oc:id=sec_ah -->
Table/job status may move through:
- `draft`
- `running`
- `ready`
- `failed`
- `guarded` (optional extension) or `failed` with cost/size reason

## Why this matters <!-- oc:id=sec_ai -->
Grounded cell extraction scales with both corpus size and schema width. Without explicit batching, one project can explode cost and latency.

## Acceptance check <!-- oc:id=sec_aj -->
- batching/guardrail behavior explicit: yes
- no silent runaway extraction promised: yes