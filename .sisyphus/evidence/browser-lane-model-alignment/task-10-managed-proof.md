# Managed local Selkies proof

- Proof source: targeted lifecycle and health tests plus live route/health probes on 2026-06-13.
- Verified behavior: managed-local lanes are the only lanes that prepare runtime config, start/stop/restart/reset profile, and report managed lifecycle states.
- Test proof:
  - `apps/desktop/src/main/browser-lane-manager.test.ts`
  - `apps/desktop/src/main/browser-lane-runtime.test.ts`
  - `apps/desktop/src/main/browser-lane-process.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
- Runtime probe:
  - `rtk curl -sf -X POST http://127.0.0.1:30206/browser/default -H "Content-Type: application/json" -d '{"action":"start"}'` returned lane health with `status = starting`.
  - Running the repo helper directly now shows stable partial runtime success after settle time: `scripts/browser-lane/start-lane --lane default` starts the container, `scripts/browser-lane/healthcheck --lane default` reports `stream.ok = true` and `cdp.ok = false`, `rtk curl -sf http://127.0.0.1:30206/browser/default/health` returns `status = degraded` with message `Stream route ready, CDP probe pending`, and `rtk curl -i http://127.0.0.1:30206/browser/default/` returns `200 OK` with the Selkies HTML plus the injected Palot shim.
  - The route-health semantics bug is fixed: browser-mode `/health` no longer falls back to `profile-locked` when the managed stream is reachable but CDP is down.
- Expected operator-visible outcome: a managed Selkies lane moves through runtime preparation and startup states while attached lanes never do.

Residual blocker:

- No live running Selkies stream capture recorded in this session yet. Current proof now shows the managed stream route can come up and render through Palot, but CDP is still unreachable.
- Container logs still show repeated Selkies panics: `called Result::unwrap() on an Err value: Io(Os { code: 95, kind: Unsupported, message: "Operation not supported" })`. Until that runtime failure is resolved, the full managed-local proof remains incomplete.
- Tried two runtime mitigation experiments in this session and both failed to stabilize the lane: (1) moving the CDP relay to a distinct exposed port with helper-driven runtime file regeneration, and (2) forcing `PIXELFLUX_WAYLAND=false` plus `seccomp=unconfined`. The stream briefly reached a degraded-but-rendering state after regeneration, but both mitigations still fell back to unhealthy / `500` after a clean restart, so neither changed the final blocker.
