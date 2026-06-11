# Task 13 Evidence — Hidden Surface Drift Reduction <!-- oc:id=sec_aa -->

Updated code:
- `apps/desktop/src/renderer/components/command-palette.tsx`
- `apps/desktop/src/renderer/components/sidebar.tsx`

Behavior:
- hidden or excluded sessions are filtered by canonical `visibilityReason`
- attached idle sessions no longer appear in command palette only

Note:
- tray remains on older offline-session cache semantics and needs follow-up if full canonical parity is required there