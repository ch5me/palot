
## 1. TASK 5 WATCHOUTS (2026-06-14)
- `useAgentSplitDockAdapters` currently resets placement state when `agent.sessionId` changes only. If later tasks add persistence or descriptor-set churn, that reset rule must widen without clobbering restored placements.

## 2. TASK 6 WATCHOUTS (2026-06-14)
- `focus-existing` now fails loud when no logical panel instance exists. Callers that truly want create-or-reveal semantics must opt into `reveal-preferred-zone` or `create-if-allowed` explicitly; do not silently downgrade focus requests back into singleton side-panel opens.
