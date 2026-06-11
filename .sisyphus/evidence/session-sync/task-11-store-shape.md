# Task 11 Evidence — Canonical Store Shape <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/lib/types.ts`
- `apps/desktop/src/renderer/atoms/sessions.ts`
- `apps/desktop/src/renderer/atoms/derived/agents.ts`
- `apps/desktop/src/renderer/lib/mock-data.ts`

Canonical fields added:
- session entry: `presenceSource`, `visibilityReason`, `driftFlags`, `lastContentActivityAt`, `lastActivityAt`
- agent view: `presenceSource`, `visibilityReason`, `driftFlags`, `lastContentActivityAt`
- agent status simplified to canonical surface states: `running | waiting | degraded | idle`

Behavior:
- session upserts and bulk hydration now seed canonical timestamps and visibility defaults
- status updates bump `lastActivityAt`
- presence replacement updates canonical presence source
- child/session drift can surface through canonical `driftFlags`

Verification:
- desktop typecheck passed after store-shape refactor