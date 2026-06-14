# Workspace Identity & Placement Contract — Code Surface Map

Generated: 2026-06-13 (task 1 exploration)

## 1. IDENTITY LAYERS THAT EXIST TODAY (and where they live)

### Layer A: Descriptor id (static, declared by plugin manifest or registry row)
- `FireflySurfaceId` — 18 canonical string ids in `src/shared/firefly-surface-ids.ts`
  (e.g. `"review"`, `"browser"`, `"notes"`, `"pulse"`, …)
- `FireflySurfaceDef.id` — same value, on each row of `FIREFLY_SURFACE_REGISTRY`
  in `src/renderer/firefly-surface-registry.tsx`
- `PanelContribution.id` — plugin manifest panel id (e.g. `"notes"`)
- `ProjectedSidePanel.contributionId` / `projectedId` — derived from manifest

### Layer B: Side-panel tab id (what the active-tab routing atoms key on)
- `SidePanelTabId` = `LastSidePanelTabId` — union of the 18 surface id strings
  defined in `src/renderer/atoms/preferences.ts:25-43`
- `sidePanelTabSchema` (Zod) — same 18 values, in `src/shared/palot-bridge-schemas.ts:7-9`
- `SidePanelTabId` in preload — `src/preload/api.d.ts:241` (mirror of the 18)
- **KEY ASSUMPTION**: `SidePanelTabId` === `FireflySurfaceId`. They are the same
  string set today. This is the singleton side-panel coupling the plan must break.

### Layer C: Focus routing state (which tab is currently visible)
- `sidePanelOpenAtom` — boolean, persisted `elf:side-panel-open`
  (`src/renderer/atoms/ui.ts:42`)
- `sidePanelActiveTabAtom` — derived from `fireflySurfacePreferencesAtom.lastSidePanelTab`
  (`src/renderer/atoms/ui.ts:44`)
- `sidePanelFocusTokenAtom` — monotonic bump counter (`atoms/ui.ts:77`)
- `paneRoutingStateAtom` — `{ sidePanel: SidePanelRoute | null }` where
  `SidePanelRoute = { tab: SidePanelTabId; focusToken: number }` (`atoms/ui.ts:33-40,79-86`)
- `fireflySurfacePreferencesAtom` — persisted `{ lastSidePanelTab, lastNavSidebarTab }`
  (`atoms/preferences.ts:160-163`)
- **KEY ASSUMPTION**: exactly ONE side panel can be open at a time. The entire
  routing model is `sidePanel: SidePanelRoute | null` — a single optional slot.

### Layer D: Dock panel placement (dockview layout)
- `SessionDockviewShell` in `src/renderer/components/agent-detail.tsx:424-492`
- Three hardcoded dockview panel ids:
  - `SESSION_CHAT_PANEL = "session-chat"` (line 84)
  - `SESSION_WIDGETS_PANEL = "session-widgets"` (line 85)
  - `SESSION_SURFACE_PANEL = "session-surface"` (line 86)
- Layout: chat center, widgets below, surface right-of-chat
- **KEY ASSUMPTION**: one `SESSION_SURFACE_PANEL` dock panel holds ALL side-panel
  tabs as a single `SessionSidePanel` component. No per-surface dock panels.

### Layer E: Widget placement (session-scoped, zone-based)
- `SessionWidgetId` — `"session-task-list" | "genui-artifacts"`
  (`atoms/session-widgets.ts:4`)
- `SessionWidgetZoneId` — `"above-chat" | "chat-inline-right"` (`atoms/session-widgets.ts:6`)
- `SessionWidgetLayout` — `{ placement: Record<SessionWidgetZoneId, SessionWidgetId[]> }`
- `SESSION_WIDGET_REGISTRY` — `src/renderer/session-widget-registry.tsx`
- **KEY ASSUMPTION**: widgets live in per-session zone layouts, orthogonal to
  side-panel tabs. This is the most evolved placement model.

### Layer F: Host slot/zone vocabulary (plugin system)
- `HostPanelSlot` — `"side-panel" | "main-pane"` (`shared/firefly-plugin/descriptor.ts:34`)
- `HostWidgetZone` — `"above-chat" | "chat-inline-right"` (`descriptor.ts:40`)
- `panelPlacementSlotSchema` — same two values (`family-contracts.ts:12`)
- `widgetPlacementZoneSchema` — same two values (`family-contracts.ts:38`)
- `FireflySurfaceTarget` — `{ kind: "side-panel"; tab: SidePanelTabId }`
  (`lib/types.ts:185-188`)
- **KEY ASSUMPTION**: `FireflySurfaceTarget` only has `kind: "side-panel"`.
  No `"main-pane"` target exists on the renderer side yet, even though the
  plugin descriptor system declares `HostPanelSlot = "side-panel" | "main-pane"`.

## 2. SINGLETON SIDE-PANEL ASSUMPTION — FULL CONSUMER LIST

### Atoms (write path)
- `openSidePanelTabAtom` — `atoms/ui.ts:88-92` — sets open=true, sets active tab, bumps focus token
- `closeSidePanelAtom` — `atoms/ui.ts:94-96` — sets open=false
- `setAvailableSidePanelTabsAtom` — `atoms/ui.ts:98-111` — closes panel if no tabs, else picks first
- `viewFileInDiffPanelAtom` — `atoms/ui.ts:117-120` — hardcodes `"review"` tab

### Components (read path)
- `agent-detail.tsx:164-166` — reads `sidePanelOpenAtom`, `sidePanelActiveTabAtom`
- `agent-detail.tsx:299-307` — `subscribeToPalotOpenSidePanel` handler: opens panel, sets tab
- `agent-detail.tsx:309-317` — UI state snapshot restore: reads `snapshot.sidePanel.open/activeTab`
- `agent-detail.tsx:412-421` — `SessionDockviewShell` key includes `sidePanelOpen` — **dock is recreated on open/close toggle**
- `session-side-panel.tsx:22-24` — reads `sidePanelActiveTabAtom`, `sidePanelOpenAtom`
- `command-palette.tsx:689` — calls `openSidePanelTab(surface.target.tab)`

### IPC / preload (cross-process)
- `preload/api.d.ts:1175` — `openSidePanel(tab: SidePanelTabId)`
- `preload/api.d.ts:1200` — `onOpenSidePanel(callback)`
- `preload/index.ts:85,113-114` — IPC channel wiring
- `main/ipc-handlers.ts:453-466` — handler: parses tab, calls `setUiStateSnapshot`, broadcasts
- `main/palot-browser-ipc.ts:139,413` — browser-mode side-panel open
- `services/backend.ts:274-279,344-351` — renderer-side wrappers

### Plugin bridge (OpenCode tool)
- `shared/palot-bridge-schemas.ts:261,358-360,453,473` — `open_side_panel` tool schema
- `main/palot-plugin/plugin.js:264-277,791-792` — `buildOpenSidePanelHandler`
- `main/firefly-plugin/dispatch.ts:342,368-394` — notes-specific `openSidePanel("notes")`

### Snapshot/state
- `palotSidePanelSnapshotSchema` — `{ open: boolean; activeTab; availableTabs }` (`palot-bridge-schemas.ts:196-200`)
- `palotUiStateSnapshotSchema` — `{ sidePanel: palotSidePanelSnapshotSchema }` (`:202-204`)

## 3. EXISTING COMPATIBILITY SEAMS (already built, reusable)

1. **`firefly-plugin-surface-merge.ts`** — `mergeSurfaceTabs()` merges catalog-served
   tabs with hardcoded registry tabs. Catalog wins on id collision. This is the
   pattern for backward-compatible adapter layers.

2. **`firefly-plugin-surfaces.tsx`** — `buildCatalogSurfaceTab()` converts a
   `CatalogSurfaceTabDescriptor` → `FireflySidePanelTab`. Shows how to adapt
   new descriptors into the existing tab shape.

3. **`side-panel-tabs.tsx`** — `SidePanelTabDef = FireflySidePanelTab` — a single
   3-line type alias. Easy to widen or replace.

4. **Session widget model** — `SessionWidgetId` / `SessionWidgetZoneId` /
   `SessionWidgetLayout` in `atoms/session-widgets.ts` is the most evolved
   placement model. Zone-based, per-session, with drag-move. This is the
   template for what a dock-slot attachment model should look like.

5. **`ProjectedSidePanel`** in `renderer-projection.ts` already has
   `hostSlot: HostPanelSlot` and `hostTarget: { kind, slot }` — the plugin
   system already reasons about which host slot a panel targets. The renderer
   just hasn't caught up to using it for anything beyond `"side-panel"`.

## 4. FILES SAFEST FOR INTRODUCING NEW CONTRACT TYPES FIRST

### Tier 1 — No runtime consumers, pure type/schema additions
- `src/shared/firefly-plugin/descriptor.ts` — add new `HostPanelSlot` values here
- `src/shared/firefly-plugin/family-contracts.ts` — widen `panelPlacementSlotSchema`
- `src/shared/firefly-surface-ids.ts` — renderer-free, safe to add new ids
- `src/renderer/lib/types.ts` — `FireflySurfaceTarget` widening (add `"main-pane"` kind)

### Tier 2 — Type-only changes, adapter-friendly
- `src/renderer/atoms/ui.ts` — `PaneRoutingState` needs to go from single-slot to multi-slot
- `src/renderer/atoms/preferences.ts` — `LastSidePanelTabId` may need renaming/widening
- `src/renderer/firefly-surface-registry.tsx` — `FireflySurfaceDef.target` widening
- `src/renderer/firefly-plugin-surface-merge.ts` — add adapter functions

### Tier 3 — Component changes (require dockview layout changes)
- `src/renderer/components/agent-detail.tsx` — `SessionDockviewShell` must support
  multiple surface panels, not one monolithic `SESSION_SURFACE_PANEL`
- `src/renderer/components/side-panel/session-side-panel.tsx` — currently assumes
  it is the only side-panel host

### Tier 4 — Cross-process contract (must stay backward-compatible)
- `src/shared/palot-bridge-schemas.ts` — `palotSidePanelSnapshotSchema` must
  remain readable by older plugin versions
- `src/preload/api.d.ts` — preload types
- `src/main/ipc-handlers.ts` — IPC handler

## 5. RECOMMENDED ADAPTER SEAM FOR TASK 1

The plan calls for separating: descriptor → logical instance → stable host →
workspace instance → dock slot attachment.

**Proposed adapter location**: new file `src/renderer/workspace-identity.ts`
(renderer-free types) + `src/renderer/atoms/workspace-routing.ts` (atoms).

**Compatibility strategy**:
1. Define new canonical types in a renderer-free module under `src/shared/`
2. Write adapter functions that map old `SidePanelTabId` → new `WorkspaceSurfaceInstanceId`
3. Keep `PaneRoutingState` reading from both old atoms and new atoms during migration
4. `SessionDockviewShell` gets a new prop for per-surface dock panels, old
  `sidePanelOpen` path becomes a compatibility shim that maps to a single
  surface in the new model

**Key invariant to preserve**: `palotSidePanelSnapshotSchema` must remain
readable. New workspace model can extend the snapshot but not break the old shape.


## 6. TASK 1 IMPLEMENTATION NOTES (2026-06-13)
- Added renderer-free canonical contract at `apps/desktop/src/shared/workspace-contract.ts` with explicit descriptor/instance/host/workspace/attachment identity layers.
- Added compatibility workspace atom seam at `apps/desktop/src/renderer/atoms/workspace.ts`; legacy side-panel state now materializes a `WorkspaceInstance` with `StableHostInstance`, `DockSlotAttachment`, and explicit focus authority ownership.
- Preserved old caller surface in `apps/desktop/src/renderer/atoms/ui.ts`; `openSidePanelTabAtom`, `sidePanelActiveTabAtom`, `sidePanelOpenAtom`, and `paneRoutingStateAtom` still compile as adapters over workspace state.
- Widened `FireflySurfaceTarget` in `apps/desktop/src/renderer/lib/types.ts` so callers can target either legacy `side-panel` or future canonical `workspace-panel` routes without changing visible UI.
- Command palette now opens via target-aware adapter atom, preserving current side-panel behavior while keeping future workspace-panel targets type-safe.
