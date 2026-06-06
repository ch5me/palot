# Task 18 — Checkpoint / human takeover coexistence <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added helper module `apps/desktop/src/main/palot-human-takeover.ts`.
- Added tests in `apps/desktop/src/main/palot-human-takeover.test.ts`.
- Exposed bus state helper `isHumanTakeoverPaused()` in `apps/desktop/src/main/palot-browser-ipc.ts`.

## Behavior <!-- oc:id=sec_ac -->

- `pauseForHumanTakeover(sessionId)` emits `humanTakeoverPaused` event through the main action bus.
- `resumeFromHumanTakeover(sessionId)` emits `humanTakeoverResumed` event through the main action bus.
- While paused, `toolRequest` events are rejected with `human_in_control`.
- Event ordering is preserved across pause -> rejected request -> resume.

## Notes <!-- oc:id=sec_ad -->

- This is bus-level coexistence. The visual overlay already reflects these events from earlier tasks.
- Real external checkpoint/runtime integration still remains for later end-to-end verification.