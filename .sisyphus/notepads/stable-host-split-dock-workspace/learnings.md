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

## 7. TASK 2 IMPLEMENTATION NOTES (2026-06-13)
- Added `apps/desktop/src/renderer/components/workspace-dock/stable-panel-host-runtime.ts` with explicit stable-host states (`detached`, `attaching`, `attached`, `suspended`, `unavailable`), attach/detach/resize lifecycle hooks, hidden-zone suspension policy, and remount instrumentation.
- Added `apps/desktop/src/renderer/components/workspace-dock/reverse-portal-transport.tsx` as the first `SurfaceTransport` implementation, backed by `react-reverse-portal` and isolated behind a host-runtime seam so future `moveBefore()` transport can swap in without surface churn.
- Added `apps/desktop/src/renderer/components/workspace-dock/stable-panel-host-runtime.test.ts` to prove remount preservation, lifecycle callback order, and remount detection memory for protected hosts.

## 8. TASK 3 IMPLEMENTATION NOTES (2026-06-13)
- Firefly surface rows now keep canonical metadata in `descriptor` objects inside `apps/desktop/src/renderer/firefly-surface-registry.tsx`; raw render closures are derived later from `runtime` entrypoints instead of being the primary registry contract.
- Catalog surfaces now normalize through the same descriptor path in `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts` and `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`; existing `renderMode` now drives host-policy/runtime metadata rather than a separate parallel model.
- Session widgets now expose descriptor-backed host policy and runtime entrypoints in `apps/desktop/src/renderer/session-widget-registry.tsx`, and both widget shells resolve/render from normalized descriptors instead of direct `render()` registry fields.

## 9. TASK 4 EXPLORATION — THREE-ZONE SPLIT DOCK SHELL (2026-06-13)

### Prototype zone structure (ch5-packages)
| File | Lines | Role |
|---|---|---|
| `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` | 524-627 | `SplitDockInstancesWorkspace` — canonical three-zone prototype (main/right/bottom) |
| `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` | 718-743 | `SplitDockviewSurface` — reusable per-zone Dockview wrapper |
| `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` | 629-685 | `registerSplitDockBridge` — cross-zone drag/drop handler factory |
| `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` | 749-792 | `addPanelIfMissing`, `splitDockviewComponents`, `splitDockPanelDescriptors` |
| `ch5-packages/packages/workspace/contract/src/panes/SplitPane.tsx` | 1-339 | `SplitPane` primitive — animated collapsible splitter (left/right/top/bottom) |
| `ch5-packages/packages/workspace/contract/src/panes/index.ts` | 1-21 | Barrel: `SplitPane`, `Pane`, `PaneSeam`, `ResizablePanes`, `usePaneVisibility`, `useSnapBehavior` |
| `ch5-packages/packages/workspace/contract/src/shell/WorkspaceShell.tsx` | 1-340 | `WorkspaceShell` — 5-slot grid shell (top/toolbar/left/main/right/bottom) |

### Prototype zone geometry
```
SplitPane(side="right", panel=<SplitDockviewSurface zone="right" />)
  └─ SplitPane(side="bottom", panel=<SplitDockviewSurface zone="bottom" />)
       └─ <SplitDockviewSurface zone="main" />
```
Each zone gets its own independent `DockviewReact` instance. Zone toggle via `SplitPane` `open` prop — dock instances persist across toggle.

### Current Dockview creation path (palot)
| File | Lines | Role |
|---|---|---|
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 428-496 | `SessionDockviewShell` — current single-Dockview shell |
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 441-458 | `components` useMemo — 3 hardcoded panel components |
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 460-489 | `handleReady` — imperative `addPanel` calls |
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 498-500 | `DockPanel` wrapper — trivial `<div>` with bg/overflow classes |
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 86-90 | Panel ID constants |
| `apps/desktop/src/renderer/components/agent-detail.tsx` | 416-425 | **REmount BUG**: `key` includes `sidePanelOpen` — dock destroyed on toggle |

### Current shell vs prototype — key differences
| Aspect | Current `SessionDockviewShell` | Prototype `SplitDockInstancesWorkspace` |
|---|---|---|
| Dockview instances | 1 monolithic `DockviewReact` | 3 independent `DockviewReact` (one per zone) |
| Panel count | 3 panels in 1 dock | 1-2 panels per zone dock |
| Side panel toggle | Destroys/recreates entire dock via `key` | `SplitPane` open/close — dock instances persist |
| Resize mechanism | Dockview internal splitters | `SplitPane` animated splitters between zones |
| Cross-zone drag | Not supported | Custom drag bridge via `SPLIT_DOCK_DRAG_MIME` |

### Drag constraints
**Prototype drag system** (stories.tsx:629-685):
- `registerSplitDockBridge` wires three events per zone:
  1. `api.onWillDragPanel` — attaches `SPLIT_DOCK_DRAG_MIME` (`"application/x-ch5-panel"`) data
  2. `api.onUnhandledDragOverEvent` — accepts drop if drag data has MIME type
  3. `api.onDidDrop` — parses descriptor, adds panel to target zone, removes from source
- **Protected panel**: `agent-chat` in main zone cannot be dragged out when sole panel in group (stories.tsx:613-620)

**Current palot drag constraints**: **None exist.** No `onWillDragPanel`, `onUnhandledDragOverEvent`, or `onDidDrop` handlers anywhere in palot renderer. Dockview default intra-dock drag only.

### Safest integration seams

#### 1. `SplitDockWorkspaceShell` replacement seam
**Target**: Replace `SessionDockviewShell` (agent-detail.tsx:428-496) entirely.

**Approach**:
- Accept `main`, `right`, `bottom` zone content as props
- Use nested `SplitPane` from `@ch5me/workspace` (already a dependency: `"@ch5me/workspace": "workspace:*"`)
- Create 3 independent `DockviewReact` instances via reusable `SplitDockviewSurface`
- **Remove remount-prone `key`** at line 418 — zone visibility must NOT destroy dock instances

**Suggested new file**: `apps/desktop/src/renderer/components/workspace-dock/split-dock-workspace-shell.tsx`

#### 2. Dock adapter seam
**Target**: Adapt current `SessionSidePanel` content and `SessionDockWidgets` into zone-hosted panels.

**Current panel → zone mapping**:
- `SESSION_CHAT_PANEL` → `main` zone (sole panel, protected from drag)
- `SESSION_WIDGETS_PANEL` → `bottom` zone (alongside or replaced by timeline/runs)
- `SESSION_SURFACE_PANEL` → `right` zone (split into per-surface dock panels)

**Suggested new file**: `apps/desktop/src/renderer/components/workspace-dock/agent-dock-adapters.tsx`

#### 3. `DockPanel` wrapper seam
**Target**: `DockPanel` (agent-detail.tsx:498-500) is the trivial wrapper inside every dockview panel. Provides `h-full min-h-0 overflow-hidden bg-background`. This is the exact seam that `StablePanelHostAttachmentOutlet` or portal-based transports need to wrap.

## 10. TASK 4 IMPLEMENTATION — SPLIT DOCK SHELL + HOST-AWARE ADAPTERS (2026-06-14)

- `SplitDockWorkspaceShell` now mirrors the prototype shape: right `SplitPane` outside bottom `SplitPane`, with independent Dockview instances for `main`, `right`, and `bottom` zones.
- `agent-detail.tsx` no longer keys the session dock shell on side-panel visibility. Right/bottom visibility flows through `SplitPane` `open` props, so toggles resize/collapse zones without recreating the dock shell.
- `useAgentSplitDockAdapters` owns the adapter seam from logical session content to dock panels. Chat, session widgets, and side-panel surface content are registered as stable hosts using the task-2 reverse-portal runtime, then exposed to Dockview through remount-safe attachment outlets.
- Stable hosts use `hiddenMode: "keep-attached"`, so closing right or bottom zones changes attachment visibility metadata instead of unmounting protected content.
- Protected main chat drag policy lives below the shell in `split-dock-protection.ts`: the only protected `session-chat` panel in main is blocked from drag, while regular panels keep normal Dockview movement.
- Manual proof artifacts for this slice live at `.sisyphus/evidence/task-4-shell-toggle.txt` and `.sisyphus/evidence/task-4-protected-drag.txt`; targeted tests cover runtime remount behavior and protected drag policy.

#### 4. `SplitPane` import path
Already available: `import { SplitPane } from "@ch5me/workspace"` (or `@ch5me/workspace/panes` for tree-shaking). Package in `apps/desktop/package.json` as `"workspace:*"`, resolved via symlink to `../ch5-packages/packages/workspace/contract`.

#### 5. Zone visibility state
Current `sidePanelOpenAtom` / `sidePanelActiveTabAtom` must decompose into per-zone visibility:
- `rightDockOpen` (replaces `sidePanelOpen` for right zone)
- `bottomDockOpen` (new — for widgets/timeline zone)
- These must NOT be part of any Dockview `key` prop

### Outer shell context
| File | Lines | Role |
|---|---|---|
| `apps/desktop/src/renderer/components/sidebar-layout.tsx` | 44-191 | `SidebarLayout` — uses `AppSidebarShellFrame` with left sidebar + `<Outlet/>` |
| `apps/desktop/src/renderer/components/sidebar-layout.tsx` | 150-183 | Content area: `<main>` with `data-slot="content-area"` wrapping `<Outlet/>` — agent-detail renders here |

### Existing workspace-dock infrastructure (task 2 outputs)
| File | Role |
|---|---|
| `apps/desktop/src/renderer/components/workspace-dock/stable-panel-host-runtime.ts` | `StablePanelHostRuntime` + `SurfaceTransport` interface |
| `apps/desktop/src/renderer/components/workspace-dock/reverse-portal-transport.tsx` | `createReversePortalTransport()` — first `SurfaceTransport` impl |

### Other Dockview usage (not affected by task 4)
| File | Role |
|---|---|
| `apps/desktop/src/renderer/components/pm-dockview.tsx` | `PmDockviewShell` — separate single-Dockview for PM console |

## 10. TASK 4 IMPLEMENTATION NOTES (2026-06-14)
- `apps/desktop/src/renderer/components/workspace-dock/split-dock-workspace-shell.tsx` now owns only three-zone geometry, Dockview zone instances, and cross-zone drag wiring; content ownership stays in adapter descriptors.
- `apps/desktop/src/renderer/components/workspace-dock/agent-dock-adapters.tsx` now maps chat/right/bottom logical placements onto stable-host attachment outlets, so `agent-detail.tsx` no longer remounts the dock tree on side-panel toggle.
- Protected drag policy moved into `apps/desktop/src/renderer/components/workspace-dock/split-dock-protection.ts`; the lone chat panel in the main zone is blocked when it would orphan the protected host.
- Toggle proof remains targeted: stable-host runtime mount count for `session-chat` stays at 1 while right/bottom visibility flips reuse the same attachment id.

## 11. TASK 5 IMPLEMENTATION — STATE-DRIVEN TRANSFER BRIDGE (2026-06-14)
- Cross-zone drag now serializes a thin `version: 1` payload in `split-dock-transfer-bridge.ts`, validates MIME/zone/policy/descriptor protection on drop, and emits a transfer request instead of calling Dockview `addPanel`/`close` as source of truth.
- `useAgentSplitDockAdapters` now owns zone placement state via `split-dock-placement-state.ts`; Dockview zones reconcile from that state, while stable hosts reattach to new attachment ids when moved and keep `mountCount === 1`.
- Protected hosts stay remount-safe because the bridge mutates placement state only; only remount-ok panels are direct-rendered. Future clone support has a reserved policy branch but current reducers intentionally accept `move` only.
- Proof artifacts for task 5 live at `.sisyphus/evidence/task-5-protected-transfer.txt` and `.sisyphus/evidence/task-5-transfer-guard.txt`.

## 12. TASK 6 IMPLEMENTATION — LOGICAL PANEL ROUTING (2026-06-14)
- Firefly surface targets now speak logical-panel semantics (`focus-existing`, `reveal-preferred-zone`, `create-if-allowed`) instead of a canonical `kind: "side-panel"` tab target, while legacy callers still map through `openSidePanel` with `legacySidePanelTabId` preserved for compatibility.
- Renderer routing moved into `routeLogicalPanelAtom`; command palette and Palot bridge now route by logical panel id + preferred zone, and the singleton side-panel tab API is treated as an adapter rather than the canonical write path.
- Bridge migration is explicit: new schema/tool `open_logical_panel` carries versioned logical routing input, while `open_side_panel` remains readable as a legacy adapter with migration metadata in responses and bridge-migration docs/tests updated to mention the non-atomic upgrade path.
- Proof artifacts for task 6 live at `.sisyphus/evidence/task-6-command-routing.txt` and `.sisyphus/evidence/task-6-legacy-adapter.txt`.
