
## 1. TASK 4 DECISIONS (2026-06-14)
- Reconciled onto the in-file split shell implementation instead of replacing it with a new adapter stack; current `SplitDockWorkspaceShell` and `useAgentSplitDockAdapters` remain the source of truth.
- Kept three independent Dockview instances (`main`, `right`, `bottom`) under nested `SplitPane` composition, matching the prototype seam without reintroducing a monolithic Dockview tree.
- Used reverse-portal stable hosts only for chat and side-panel surfaces; bottom widgets stay direct-rendered because task 4 requires stable protection on the chat host, not later persistence/transfer work.

## 2. TASK 5 DECISIONS (2026-06-14)
- Kept the transfer bridge thin: it validates drag payloads and translates Dockview external-drop events into placement requests, but descriptor metadata and visible zone state remain owned by adapter state.
- Stable hosts may move across zones unless a descriptor protection rule narrows them; the protected chat panel remains pinned to `main` through `requiredZone`, while surface hosts can reattach cross-zone without remounting.
- Remount-ok widgets stay direct-rendered so transfer state can close/reopen lightweight wrappers without teaching the bridge heavy-content lifecycle rules.
