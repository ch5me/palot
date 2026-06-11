# PM Side Agents Panel Seam Map (Wave 1) <!-- oc:id=sec_aa -->

Generated: 2026-06-10

## 1. Route Seam <!-- oc:id=sec_ab -->
- **File**: `apps/desktop/src/renderer/router.tsx`
- **Line**: 150
- **Detail**: `projectManagerRoute` maps path `"project-manager"` to `ProjectManager` component. Main entry point for PM page.

## 2. Wrapper Seam <!-- oc:id=sec_ac -->
- **File**: `apps/desktop/src/renderer/components/project-manager.tsx`
- **Line**: 3
- **Detail**: `ProjectManager` is a thin wrapper (9 lines) rendering `PmDockviewShell`.

## 3. Dock Panel Replacement Target <!-- oc:id=sec_ad -->
- **File**: `apps/desktop/src/renderer/components/pm-dockview.tsx`
- **Line**: 21
- **Detail**: `AgentsPanel` component is a placeholder. Registered in `DockviewReact` components map as `"pm-agents"` (line 7, 34). Exact insertion point for Side Agents UI.

## 4. Dense Dashboard Seam <!-- oc:id=sec_ae -->
- **File**: `apps/desktop/src/renderer/components/pm-live-dashboard.tsx`
- **Line**: 398
- **Detail**: `PmLiveDashboard` already contains distinct sections: `PmAttentionQueue` (imported line 19) and a `backgroundAgents` grid section (lines 398-406). Merged query data can be injected here.

## 5. Shared Fetch Seam <!-- oc:id=sec_af -->
- **File**: `apps/desktop/src/renderer/services/backend.ts`
- **Line**: 659
- **Detail**: `fetchCh5PmState()` is the unified client fetch seam. Uses `window.elf.fetch` for Electron IPC to `/api/ch5pm/state`, or falls back to HTTP `elf-server`. Returns typed `Ch5PmLiveState`.

## 6. Server Proxy Seam <!-- oc:id=sec_ag -->
- **File**: `apps/server/src/routes/ch5pm.ts`
- **Line**: 74-78
- **Detail**: Hono routes proxying frontend requests to CH5PM daemon. `GET /state` -> `/pm/state`. `POST /attention/resolve` and `/attention/cancel` -> daemon mutation endpoints. Single seam between client and PM control plane.

## 7. Side-Agent Contract Module
- **File**: `apps/desktop/src/renderer/pm-side-agents/types.ts`
- **Detail**: Added renderer-only babysitter feed contracts for classifications, session reports, actions, box digests, loop status, attention rows, and aggregated `/pm/babysitter` payload shape. Kept namespaced away from `Ch5PmLiveState`.
- **Verification**: file-level LSP diagnostics clean; repo `bun run check-types` still fails on pre-existing `apps/server/tsconfig.json` include issue for `apps/desktop/src/shared/mcp-connections-shared.ts`, unrelated to this task.

## 8. Server Proxy Expansion (Wave 2)
- **File**: `apps/server/src/routes/ch5pm.ts`
- **Detail**: Added `GET /babysitter` → `/pm/babysitter`, `GET /queue` → `/queue`, `GET /health` → `/health` to the Hono route chain. Side agents panel can now fetch babysitter classifications, queue depth, and daemon health through the same proxy seam.

## 9. Composition Policy (Wave 1)
- **File**: `apps/desktop/src/renderer/pm-side-agents/composition.ts`
- **Detail**: Added pure `composePmSideAgentsModel()` view-model seam. Keeps `/api/ch5pm/state` snapshot separate from daemon `feed`, `queue`, and `health` sources, then exposes source snapshots, shared freshness, loop status, attention buckets, and degraded banner reasons for both dock panel and dense dashboard.
- **Rules**:
  - Feed freshness uses daemon `dataAges.feed` first, then `generatedAt`; stale after 5 minutes.
  - Missing feed does not erase PM snapshot; it yields explicit `side-agent-feed-missing` and overall `offline` only when both feed and health are missing.
  - Queue stays render-safe when `jobs` or `claims` is absent by marking source `partial` and preserving whichever list exists.
  - Health degradation comes from `/health` payload reasons/status without overwriting feed or PM timestamps; loop status derives from health payload and surfaces `stalled` vs `failed` separately.
- **Verification**: `lsp_diagnostics` clean for `composition.ts` and `types.ts`; practical file-level `bun x tsc --noEmit apps/desktop/src/renderer/pm-side-agents/composition.ts apps/desktop/src/renderer/pm-side-agents/types.ts` completed clean.
