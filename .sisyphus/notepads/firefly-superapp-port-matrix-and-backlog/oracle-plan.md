# Oracle Roster Plan <!-- oc:id=sec_aa -->

## Current repo seams <!-- oc:id=sec_ab -->

- The sidebar already presents active and recent agents derived from live session state.
- Session metrics, status, waiting state, and sub-agent hierarchy already exist in `agentsAtom`, `sessionMetricsBar`, and session-tree helpers.
- Agent selectors already expose OpenCode agent names, but there is no dedicated roster surface yet.

## Decision <!-- oc:id=sec_ac -->

Oracle roster should start as a side-panel proof shell.

## Why <!-- oc:id=sec_ad -->

- The existing roster-like data is session-scoped and already available in renderer atoms.
- A side-panel shell can validate whether an explicit roster view adds value beyond the sidebar before introducing route-level complexity.
- If later the roster becomes a broader orchestration dashboard, it can graduate to route-level then.

## First shell shape <!-- oc:id=sec_ae -->

- Add an `oracle` Firefly side-panel surface.
- Show active agents, waiting/blocked status, and recent sessions in a denser roster view than the sidebar.
- Reuse existing `useAgents()` data and status derivations instead of inventing new backend logic.

## Deferred <!-- oc:id=sec_af -->

- route-level orchestration dashboard
- new backend logic for agent supervision
- separate oracle-specific runtime semantics