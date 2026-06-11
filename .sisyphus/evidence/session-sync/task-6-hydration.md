# Task 6 Evidence — Active Session Hydration Bootstrap <!-- oc:id=sec_aa -->

Code paths updated:
- `apps/desktop/src/renderer/atoms/discovery.ts`
- `apps/desktop/src/renderer/services/connection-manager.ts`
- `apps/desktop/src/renderer/hooks/use-discovery.ts`
- `apps/desktop/src/renderer/hooks/use-servers.ts`
- `apps/desktop/src/renderer/lib/mock-data.ts`

Bootstrap contract now includes:
- focused projects
- directories discovered from active-session presence snapshots
- directories explicitly loaded via `loadProjectSessions()`

Behavior change:
- active-session presence snapshot appends directories into `discovery.bootstrapDirectories`
- discovery preload unions focused projects with bootstrap directories before hydrating sessions
- manual/direct project loads also register bootstrap directories so later reconnects keep them in scope

Verification:
- desktop typecheck passed after `DiscoveryState` and bootstrap path changes
- root lint still blocked by pre-existing `scripts/verify-mcp-connections.ts` formatting violation outside session-sync scope