# Task 8 — OpenCode plugin context injection <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Updated `apps/desktop/.opencode/plugins/palot-bridge.js` to implement:
  - `experimental.chat.system.transform`
  - `event` hook for `session.idle`
  - shared resolver wrapper with no plugin-side cache
- Added plugin tests in `apps/desktop/.opencode/plugins/palot-bridge.test.js`.

## Injection contract <!-- oc:id=sec_ac -->

On each `experimental.chat.system.transform` call:
- If `sessionID` missing: no-op
- Call shared resolver function immediately
- If no binding/snapshot: no-op
- If binding exists: append a compact block to `output.system`

Injected fields:
- OpenCode session id
- binding status
- lane id
- Magic Browser session id
- viewer URL hint
- current URL

## Guardrails held <!-- oc:id=sec_ad -->

- No auth tokens
- No secret cache handles
- No long-lived lane or Magic Browser cache in plugin state
- `session.idle` only refreshes via resolver re-call; it does not mutate stored plugin state