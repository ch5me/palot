# Task 13 Evidence — Cross-Surface Active Consistency <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/components/command-palette.tsx`
- `apps/desktop/src/renderer/components/sidebar.tsx`

Behavior:
- command palette active session list now uses same canonical rule as sidebar: visible sessions with non-idle status
- command palette sorts by `lastActiveAt`
- sidebar and command palette no longer disagree over attached idle sessions

Result:
- renderer surfaces share one active-membership rule