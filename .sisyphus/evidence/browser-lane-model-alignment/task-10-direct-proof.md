# Direct iframe proof

- Proof source: targeted browser-lane test suite and canonical docs update on 2026-06-13.
- Verified behavior: direct-iframe lanes use target-first copy, direct URL navigation strategy, auth-free proxy transport, and no Selkies HTML shim injection.
- Test proof:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel-view-model.test.ts`
  - `apps/desktop/src/renderer/atoms/browser.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
  - `apps/desktop/src/main/browser-lane-protocol.test.ts`
- Expected operator-visible outcome: the panel renders the target without Selkies gating, CDP requirements, or injected local lane auth semantics.

Residual blocker:

- No live browser screenshot captured in this session yet. Functional proof is currently test-based.
