
## 1. TASK 4 DECISIONS (2026-06-14)
- Reconciled onto the in-file split shell implementation instead of replacing it with a new adapter stack; current `SplitDockWorkspaceShell` and `useAgentSplitDockAdapters` remain the source of truth.
- Kept three independent Dockview instances (`main`, `right`, `bottom`) under nested `SplitPane` composition, matching the prototype seam without reintroducing a monolithic Dockview tree.
- Used reverse-portal stable hosts only for chat and side-panel surfaces; bottom widgets stay direct-rendered because task 4 requires stable protection on the chat host, not later persistence/transfer work.
