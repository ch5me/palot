# Task 14 Evidence — Stale-State Indicator <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/components/sidebar.tsx`
- `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx`

Behavior:
- in dev mode, sidebar session items now show canonical debug labels composed from `visibilityReason` and `driftFlags`
- sub-agent cards now show same canonical debug labels for child sessions in dev mode

Result:
- drifted or degraded sessions get explicit renderer-level indicators without affecting normal production UX