# Attached Selkies proof

- Proof source: targeted health, proxy, and transport tests on 2026-06-13.
- Verified behavior: attached Selkies lanes keep stream/CDP semantics, stay out of managed lifecycle paths, and still use the expected same-origin route/proxy transport.
- Test proof:
  - `apps/desktop/src/main/browser-lane-manager.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
  - `apps/desktop/src/main/browser-lane-protocol.test.ts`
- Expected operator-visible outcome: the panel can render an attached stream, optional CDP stays separate, and managed runtime controls remain unavailable.
