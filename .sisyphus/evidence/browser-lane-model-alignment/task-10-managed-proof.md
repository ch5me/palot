# Managed local Selkies proof

- Proof source: targeted lifecycle and health tests plus canonical docs update on 2026-06-13.
- Verified behavior: managed-local lanes are the only lanes that prepare runtime config, start/stop/restart/reset profile, and report managed lifecycle states.
- Test proof:
  - `apps/desktop/src/main/browser-lane-manager.test.ts`
  - `apps/desktop/src/main/browser-lane-runtime.test.ts`
  - `apps/desktop/src/main/browser-lane-process.test.ts`
  - `apps/server/src/routes/browser-lanes.test.ts`
- Expected operator-visible outcome: a managed Selkies lane moves through runtime preparation and startup states while attached lanes never do.

Residual blocker:

- No live devmux/browser capture recorded in this session yet. Functional proof is currently test-based.
