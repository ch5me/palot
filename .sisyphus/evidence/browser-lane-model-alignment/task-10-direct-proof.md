# Direct iframe proof

- Proof source: targeted browser-lane tests plus live route and health probes on 2026-06-13.
- Verified behavior: direct-iframe lanes use target-first copy, direct URL navigation strategy, auth-free proxy transport, no Selkies HTML shim injection, and reachability-only health with `cdp.state = not-applicable`.
- Test proof:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel-view-model.test.ts`
  - `apps/desktop/src/renderer/atoms/browser.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
  - `apps/desktop/src/main/browser-lane-protocol.test.ts`
- Runtime proof:
  - `curl -sf http://127.0.0.1:30206/browser/iframe-host-test/health` returned `{"status":"running","stream":{"state":"ready"},"cdp":{"state":"not-applicable"}}`.
  - `.sisyphus/evidence/browser-lanes/iframe-host-test-direct-proof.txt` captured a successful `200` response from `http://127.0.0.1:30206/browser/iframe-host-test/` with the proxied target body preview.
- Expected operator-visible outcome: the panel can render the target without Selkies gating, CDP requirements, or injected managed-local auth semantics.

Residual blocker:

- No live browser screenshot captured in this session yet. Current proof is route + health evidence rather than a visual panel capture.
