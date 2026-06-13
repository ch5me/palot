# Attached Selkies proof

- Proof source: targeted health, proxy, and transport tests on 2026-06-13.
- Verified behavior: attached Selkies lanes keep stream/CDP semantics, stay out of managed lifecycle paths, and still use the expected same-origin route/proxy transport.
- Test proof:
  - `apps/desktop/src/main/browser-lane-manager.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
  - `apps/desktop/src/main/browser-lane-protocol.test.ts`
- Runtime probe:
  - `scripts/browser-lane/healthcheck --mode remote --lane attached-proof --stream-backend-url https://example.com --cdp-endpoint https://example.com/json/version`
  - Result: stream probe succeeded (`200`), CDP probe returned `404`, which matches the attached-stream-with-optional-CDP semantics documented by the model.
- Expected operator-visible outcome: the panel can render an attached stream, optional CDP stays separate, and managed runtime controls remain unavailable.

Residual blocker:

- Runtime proof uses `https://example.com` as a semantic attached-stream probe, not a real Selkies deployment rendered in the panel. This proves the route/health model, not a live user-facing stream capture.
