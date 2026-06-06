# Task 16b — Tool dispatcher wiring <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added dispatcher at `apps/desktop/src/main/palot-browser-dispatcher.ts`.
- Added tests in `apps/desktop/src/main/palot-browser-dispatcher.test.ts`.

## Dispatcher behavior <!-- oc:id=sec_ac -->

- Resolves binding per call through `resolvePalotSessionBinding(sessionId)`.
- Publishes `toolRequest` event before execution.
- Publishes `toolResult` event after execution.
- Rejects unbound sessions.
- Wires real navigation/tab actions to `browser-lane-manager` for:
  - `palot_browser_open`
  - `palot_browser_navigate`
  - `palot_browser_tabs`

## Notes <!-- oc:id=sec_ad -->

- Click/type/scroll still need deeper runtime wiring; for now the real dispatcher closes the highest-value loop for navigation and tabs.
- This is enough to stop calling the current tools pure placeholders for those actions.