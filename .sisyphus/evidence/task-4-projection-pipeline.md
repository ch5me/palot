# Task 4: Nav-Sidebar Projection / Runtime Contract <!-- oc:id=sec_aa -->

## End-to-End Pipeline <!-- oc:id=sec_ab -->
The nav-sidebar path should mirror the existing manifest -> descriptor -> catalog -> renderer flow, but with nav-sidebar-specific types instead of reusing side-panel structures.

## Stage 1: Manifest Parse <!-- oc:id=sec_ac -->
**File to extend**: `apps/desktop/src/shared/firefly-plugin/manifest.ts`
- Add `contributes.navSidebars: NavSidebarContribution[]` to the canonical schema.
- Enforce duplicate-id validation alongside panels/widgets/commands/themes/tools/components.
- Add nav-sidebar activation-event variants only if genuinely needed; otherwise reuse generic command/startup/restore triggers stored inside the contribution row.

## Stage 2: Family Contracts <!-- oc:id=sec_ad -->
**File to extend**: `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`
- Add `"navSidebars"` to `CONTRIBUTION_FAMILIES`.
- Define a dedicated `NAV_SIDEBAR_CONTRACT` with host vocabulary such as `nav-sidebar`, `nav-sidebar-tab`, `nav-sidebar-restore`.
- Persistence strategy should be distinct from `panel-layout-preference`; use something like `nav-sidebar-active-tab` and optionally `nav-sidebar-open-state`.
- Mutation guard must state that plugins cannot directly mutate shell chrome and may only render tab body content.

## Stage 3: Descriptor Derivation <!-- oc:id=sec_ae -->
**File to extend**: `apps/desktop/src/shared/firefly-plugin/descriptor.ts`
- Add `readonly navSidebars: readonly NavSidebarContribution[]` to `PluginDescriptor`.
- Add host-known nav-sidebar slot vocabulary if needed, but start with a single host surface rather than multiple slots.
- Do **not** reuse `HOST_PANEL_SLOTS`; nav-sidebar is not a panel slot.

## Stage 4: Renderer Projection <!-- oc:id=sec_af -->
**File to extend**: `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`
- Add `navSidebars` to `RENDERER_PROJECTION_FAMILIES`.
- Introduce `ProjectedNavSidebarTab` with fields like:
  - `pluginId`
  - `contributionId`
  - `projectedId`
  - `title`
  - `icon`
  - `orderHint`
  - `defaultOn`
  - `persistenceKey`
  - `telemetryNamespace`
  - `renderMode`
  - `capabilityGates`
  - `availability`
  - `contract`
- Projected host target should be `hostTarget: { kind: "nav-sidebar" }`.
- Collision handling must be based on `projectedId` and separately detect conflicting `orderHint` ties without assuming a closed canonical order.

## Stage 5: Catalog Authority <!-- oc:id=sec_ag -->
**File to extend**: `apps/desktop/src/main/firefly-plugin/catalog.ts`
- Include projected nav-sidebar items in `catalog.projections` alongside panels/widgets/commands/themes/components.
- Add nav-sidebar counts to projection summaries so the renderer and diagnostics can inspect them.
- Preload / IPC inspection APIs should expose nav-sidebar items explicitly, not as panels.

## Stage 6: Renderer Consumption <!-- oc:id=sec_ah -->
**Files to extend**:
- `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`
- new nav-sidebar merge / registry seam module
- `apps/desktop/src/renderer/components/sidebar-layout.tsx`

The renderer should:
1. Fetch projected nav-sidebar items from preload. <!-- oc:id=item_aa -->
1. Build host-renderable tab descriptors. <!-- oc:id=item_ab -->
1. Merge the built-in default tab with plugin-contributed tabs. <!-- oc:id=item_ac -->
1. Render them through a host-owned `DiscreteTabs` header. <!-- oc:id=item_ad -->
1. Select the active tab based on nav-sidebar-specific atoms/persistence. <!-- oc:id=item_ae -->

## Collision Policy <!-- oc:id=sec_ai -->
Host policy should be explicit and deterministic:
- **Duplicate projected ids**: quarantine the later plugin contribution and log a catalog collision.
- **Equal order hints**: stable sort by `(orderHint, pluginId, contributionId)`.
- **Built-in tab precedence**: the built-in host tab always exists and occupies the first slot unless the host later decides otherwise.
- **Unavailable plugin tabs**: remain listed only if product wants discoverability; otherwise filtered before render. The decision must live in the host contract, not inside plugin code.

## Preload / Inspection Shape <!-- oc:id=sec_aj -->
The preload bridge should expose a dedicated getter such as `window.elf.plugins.navSidebars()` returning `{ items, collisions }` with nav-sidebar-specific rows. This keeps inspection, debugging, and test fixtures honest about which host family is being consumed.

## Acceptance Check <!-- oc:id=sec_ak -->
- [x] Manifest -> descriptor -> catalog -> renderer path is fully named with exact files/types.
- [x] Collision policy is explicit and does not rely on static side-panel enums.