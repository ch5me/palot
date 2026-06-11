# Task 17 Evidence — Buffered Parts / Event Loss <!-- oc:id=sec_aa -->

Current automated proof remains partial.

What exists now:
- idle convergence code flushes on both `session.status idle` and `session.idle`
- reconnect path performs explicit reconciliation on stream open and HMR recovery
- `apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx` includes reconnect drift fixture

Still missing:
- dedicated streaming-buffer fixture that injects deltas across reconnect boundaries in `connection-manager.ts`

Status:
- implementation improved; automated buffered streaming proof still partial and remains a real verification gap