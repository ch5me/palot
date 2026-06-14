
## 1. TASK 5 WATCHOUTS (2026-06-14)
- `useAgentSplitDockAdapters` currently resets placement state when `agent.sessionId` changes only. If later tasks add persistence or descriptor-set churn, that reset rule must widen without clobbering restored placements.
