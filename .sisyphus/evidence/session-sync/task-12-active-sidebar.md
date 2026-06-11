# Task 12 Evidence — Active Sidebar Canonical Model <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/components/sidebar.tsx`

Behavior:
- sidebar active sessions now require canonical visibility (`visibilityReason === "visible"`) and non-idle canonical status
- active list ordering now uses `lastActiveAt` instead of `createdAt`
- project session sorting also uses same canonical active predicate plus `lastActiveAt`

Result:
- active sidebar membership and ordering now follow canonical session graph semantics rather than mixed heuristics