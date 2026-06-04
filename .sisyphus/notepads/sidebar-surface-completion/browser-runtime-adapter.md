# Browser Runtime Adapter Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 5 completed.
- Browser-mode server currently exposes only `/api/servers`, `/api/model-state`, `/api/files`, and `/health` from `apps/server/src/index.ts`.
- No existing same-origin browser-lane publisher route exists in `apps/server`.
- Browser-mode backend pattern is clear: server-owned Hono routes with shared renderer access through `services/backend.ts`.
- Earlier browser architecture decision already locked these constraints:
  - renderer embeds only Palot-owned same-origin `publishedUrl`
  - Electron main owns native lane adapter
  - browser mode owns server-published iframe adapter
  - fail-closed rule: same-origin publish or unavailable state, never direct provider embed
- Chosen adapter contract: `ensureLane`, `getLane`, `publishLane`, `reloadLane`, `openExternal`, returning lane metadata instead of raw provider embed instructions.
- Chosen route contract: same-origin embed route like `/firefly/browser-lanes/:laneId` plus optional metadata route like `/api/browser-lanes/:laneId`.

## Open questions <!-- oc:id=sec_ac -->
- Should browser-mode publisher be a thin route proxy, a hosted remote browser stream frame, or a local preview shell that wraps a lane session URL?
- What is the smallest metadata payload that still covers renderer state cards cleanly: `displayUrl`, `capabilities`, `lastError`, `updatedAt` all in v1, or some deferred?
