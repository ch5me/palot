# Task 17 — Magic Browser session bootstrap / attach contract <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added bootstrap helper in `apps/desktop/src/main/palot-magic-browser.ts`.
- Added tests in `apps/desktop/src/main/palot-magic-browser.test.ts`.

## Behavior <!-- oc:id=sec_ac -->

- `ensureMagicBrowserSessionForBinding(sessionId)`:
  - requires an existing binding + lane id
  - derives a stable `magicBrowserSessionId` from binding id if missing
  - stores viewer auth token only in the in-memory secret cache
  - stores derived viewer URL only in the in-memory viewer URL cache
  - persists only the stable `magicBrowserSessionId` to the binding record
- `getDerivedViewerUrlForBinding(sessionId)` reads derived URL from in-memory cache.
- `clearMagicBrowserViewerState(sessionId)` clears only derived viewer URL cache state.

## Guardrails held <!-- oc:id=sec_ad -->

- Binding JSON stores no `viewerUrl`
- Binding JSON stores no `authToken`
- Secret and viewer URL stay main-only

## Note <!-- oc:id=sec_ae -->

- This is a deterministic bootstrap/attach contract, not a real external Magic Browser process integration yet.