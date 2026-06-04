# Dashboard Reconciliation <!-- oc:id=sec_aa -->

## Current Elf replacements <!-- oc:id=sec_ab -->

- `new-chat.tsx` already acts as the modern landing surface for starting work.
- Sidebar empty state, Active Now, Recent, and Projects sections already cover most of the old dashboard/navigation role.
- `session-metrics-bar.tsx` plus prompt-toolbar/status-bar already absorb the most useful runtime metrics concepts.

## Decision <!-- oc:id=sec_ac -->

Do not port `IdleDashboard.tsx` or `dashboard.ts` directly.

## Why <!-- oc:id=sec_ad -->

- Their core value has already been absorbed into existing Elf surfaces with a better fit:
  - launch / prompt entry → `new-chat.tsx`
  - recent + active work visibility → sidebar groups
  - session runtime stats → metrics bar and status bar
- A separate dashboard layer would duplicate the current navigation and startup experience.

## Reconciliation stance <!-- oc:id=sec_ae -->

- Keep `new-chat` as the canonical landing/idle experience.
- Keep sidebar sections as the canonical active/recent/project overview.
- Keep metrics in app-bar/chat surfaces instead of inventing a separate dashboard widget layer.

## Future reopen condition <!-- oc:id=sec_af -->

Only reopen dashboard-specific work if Elf needs a cross-project executive overview that cannot be expressed by:
- current sidebar grouping
- current `new-chat` landing surface
- current session/app-bar metrics surfaces