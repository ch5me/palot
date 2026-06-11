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