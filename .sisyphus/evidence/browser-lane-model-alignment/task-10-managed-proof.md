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
  - After the runtime relay patch, `bun scripts/browser-lane/install-runtime --lane default` regenerated the helper runtime files with the new contract and `bun scripts/browser-lane/healthcheck --lane default` reported `stream.ok = true` and `cdp.ok = true` against the managed-local helper endpoints.
  - Helper caveat: `bun scripts/browser-lane/start-lane --lane default` can still print stale endpoint values if it races an already-removing container. In one rerun it printed a compose-recreate error while `healthcheck` against the registry-backed endpoints still passed (`stream.ok = true`, `cdp.ok = true`). The runtime code path itself is now much stronger than the helper output suggests.
  - The route-health semantics bug is fixed: browser-mode `/health` no longer falls back to `profile-locked` when the managed stream is reachable but CDP is down, and the helper/runtime path can now reach CDP on the regenerated contract.
- Expected operator-visible outcome: a managed Selkies lane moves through runtime preparation and startup states while attached lanes never do.

Residual blocker:

- No live running Selkies stream capture recorded in this session yet. Current proof now shows the managed stream route can come up and CDP can answer after the runtime patch, but the helper/registry endpoint contract is still inconsistent.
- Container logs previously showed repeated Selkies panics: `called Result::unwrap() on an Err value: Io(Os { code: 95, kind: Unsupported, message: "Operation not supported" })`. The new runtime patch weakens the case that CDP failure is purely a relay bug, but we still need one clean end-to-end pass with matching regenerated endpoints before calling the managed-local proof complete.
- Tried two runtime mitigation experiments earlier in this session and both failed to stabilize the lane: (1) moving the CDP relay to a distinct exposed port with helper-driven runtime file regeneration, and (2) forcing `PIXELFLUX_WAYLAND=false` plus `seccomp=unconfined`. The latest runtime patch improves CDP reachability, but it also exposed a remaining helper/registry race that still needs follow-up.
