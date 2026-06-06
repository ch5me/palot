# Task 2 — Browser action event schema <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added shared event types to `apps/desktop/src/preload/api.d.ts`:
  - `BrowserActionSource`
  - `BrowserActionStatus`
  - `BrowserActionCaretConfidence`
  - `BrowserActionErrorCode`
  - `BrowserActionViewportCoords`
  - `BrowserActionTargetDescription`
  - `StreamGeometrySnapshot`
  - `BrowserActionEventBase`
  - full discriminated `BrowserActionEvent` union
- Added normalization helpers and contract metadata in `apps/desktop/src/shared/browser-action-events.ts`.
- Added unit tests in `apps/desktop/src/shared/browser-action-events.test.ts`.

## Event model <!-- oc:id=sec_ac -->

Kinds covered:
- `move`
- `click`
- `type`
- `scroll`
- `focus`
- `hover`
- `waitFor`
- `navigate`
- `attachSession`
- `detachSession`
- `toolRequest`
- `toolResult`
- `systemReconcile`
- `humanTakeoverPaused`
- `humanTakeoverResumed`

Shared base fields:
- `id`
- `sessionId`
- `laneId`
- `source`
- `sequence`
- `requestId`
- `causationId`
- `toolCallId`
- `targetDescription`
- `viewportCoords`
- `streamGeometrySnapshot`
- `timestamp`
- `durationMs`
- `status`
- optional `errorCode` / `errorMessage`

## Taxonomy <!-- oc:id=sec_ad -->

Sources:
- `tool_request`
- `automation_runtime`
- `human_takeover`
- `system_reconcile`

Statuses:
- `queued`
- `dispatched`
- `runtime_ack`
- `completed`
- `failed`
- `cancelled`

Errors:
- `unbound_session`
- `lane_unavailable`
- `human_in_control`
- `magic_browser_unavailable`
- `geometry_low_confidence`
- `binding_in_flight`
- `permission_denied`

Type fidelity:
- `caretConfidence = none | low | high`

## Notes <!-- oc:id=sec_ae -->

- Normalizer creates a stable synthetic id from `sessionId`, `sequence`, and `kind`.
- Contract metadata is versioned with `BROWSER_ACTION_EVENT_VERSION = 1` and checksum `browser-action-event-v1-tool-request-runtime-ack`.
- Sequence enforcement at publish time still belongs to the future action bus task (T10).