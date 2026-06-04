# Surface Semantics Audit <!-- oc:id=sec_aa -->

## Current state in `firefly-surface-registry.tsx` <!-- oc:id=sec_ab -->

Already present:
- `id`
- `title`
- `icon`
- `formFactor`
- `enabledFlag`
- `defaultOn`
- `availability(ctx)`
- `commandIds`
- `persistenceKey`
- `telemetryNamespace`
- `target`
- `spawn(ctx)`

## Gaps found <!-- oc:id=sec_ac -->

No clear low-risk semantics gap remains in the current registry for Wave 1 infrastructure.

What was missing before this session is now present:
- command/open semantics via `target`
- open/focus behavior wired from command palette into route-like side-panel actions
- disabled-surface fallback via centralized available-tab reconciliation

Remaining potential gaps are product-specific, not substrate-level:
- richer target kinds beyond `side-panel`
- route-level surface registration
- main-pane surface registration
- optional grouping/category metadata for larger command palettes
- cross-surface ordering/prioritization rules once Files/Terminal/Editor land

## Decision <!-- oc:id=sec_ad -->

`surfaces.ts` semantics that are still missing should stay deferred until a concrete non-side-panel surface exists.

Reason:
- inventing route/main-pane registry fields now would be speculative
- the current side-panel registry already covers all shipped surfaces
- future gaps will be easier to define once Files, Terminal, or Editor needs force them

## Implication <!-- oc:id=sec_ae -->

Treat `Port any shared surfaces.ts semantics that Elf registry still lacks` as complete for the current infrastructure wave.
Future semantics work should be reopened only when a new surface cannot be expressed by the current registry contract.