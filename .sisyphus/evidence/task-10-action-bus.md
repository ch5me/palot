# Task 10 — Action bus publisher <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Extended `apps/desktop/src/main/palot-browser-ipc.ts` into a lightweight typed action bus.
- Added tests in `apps/desktop/src/main/palot-browser-action-bus.test.ts`.

## Bus behavior <!-- oc:id=sec_ac -->

- Assigns monotonic per-session sequence numbers with `nextSequence(sessionId)`.
- Drops sequence collisions by returning the already-buffered event.
- Keeps a capped in-memory buffer.
- Pushes published events through the existing `palot:browser-actions` channel.
- Tracks human takeover state.
- Rejects `toolRequest` events during takeover with:
  - `status = failed`
  - `errorCode = human_in_control`
  - `errorMessage = Human takeover is active`

## Notes <!-- oc:id=sec_ad -->

- This is still the same `palot-browser-ipc.ts` module rather than a separate class, but it now behaves as the typed event bus needed for downstream renderer work.
- No SSE subscription was added here; publishers still call into the bus directly.