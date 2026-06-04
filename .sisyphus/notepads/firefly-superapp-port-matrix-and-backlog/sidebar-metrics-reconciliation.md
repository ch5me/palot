# Sidebar / Metrics Reconciliation <!-- oc:id=sec_aa -->

## Current Elf equivalents <!-- oc:id=sec_ab -->

- Sidebar already splits work into Active Now, Recent, and Projects.
- `session-metrics-bar.tsx` already carries compact time/cost/token/tool-call visibility for the active session.
- Prompt toolbar and status bar already hold model/agent/context usage controls near the active work.

## Decision <!-- oc:id=sec_ac -->

Do not port old sidebar-usage/dashboard metrics concepts directly.

## Why <!-- oc:id=sec_ad -->

- The highest-value metrics are already closer to the active work than a legacy sidebar summary would be.
- Sidebar space is better used for session/project navigation than duplicative token/cost widgets.
- Existing app-bar and chat-adjacent surfaces are a better fit for real-time session metrics.

## Reconciliation stance <!-- oc:id=sec_ae -->

- Keep navigation in the sidebar.
- Keep session metrics near the active session.
- Revisit only if Elf later needs a cross-project portfolio metrics surface.