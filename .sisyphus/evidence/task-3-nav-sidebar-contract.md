# Task 3: Nav-Sidebar Manifest / Schema Contract <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->
Introduce a **new contribution family** named `navSidebars` rather than overloading existing `panels` semantics.

## Why `navSidebars` and not `panels` <!-- oc:id=sec_ac -->
Current `panels` vocabulary is explicitly shaped around `side-panel` and `main-pane` placement:
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts` defines `panelPlacementSlotSchema = z.enum(["side-panel", "main-pane"])`.
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts` hard-codes `HOST_PANEL_SLOTS = ["side-panel", "main-pane"]`.
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` projects `ProjectedSidePanel` objects with `formFactor: "side-panel-tab" | "main-pane"` and `hostTarget.kind: "side-panel" | "main-pane"`.
- `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts` still relies on the closed `SidePanelTabId` union and `SIDE_PANEL_TAB_ORDER` static ordering.

Reusing `panels` for the left navigation surface would incorrectly inherit side-panel-only placement terms, a closed tab-id world, and right-panel migration assumptions. That would violate the plan's explicit requirement not to overload `defaultZone: side-panel` or bind nav-sidebar ids to `SidePanelTabId`.

## Proposed `navSidebars` Contribution Shape <!-- oc:id=sec_ad -->
Each plugin manifest row should declare a nav-sidebar contribution with the following semantic fields:

```ts
interface NavSidebarContribution {
  id: string;                     // plugin-local short id, unique within (plugin, navSidebars)
  title: string;                  // tab label shown by host-owned DiscreteTabs shell
  icon?: string | null;           // host-resolved icon token; no arbitrary component injection
  orderHint?: number | null;      // relative ordering hint among dynamic tabs
  defaultState: "default-on" | "default-off" | "host-selects";
  persistenceKey?: string | null; // optional plugin suggestion; host may normalize / reject
  renderMode: "host-reconciler" | "declarative-props" | "iframe";
  activation: {
    trigger: "host-startup" | "nav-sidebar-open" | "command" | "host-restore";
    commandIds?: string[];
  };
  capabilityGates: string[];
  availabilityWhen?: string | null; // declarative host predicate only
  hostChrome: {
    hostOwnsShell: true;
    hostOwnsHeader: true;
    hostOwnsCollapseState: true;
    pluginMayReplaceContainer: false;
    pluginMayRenderFooter: false;
  };
  telemetryNamespace?: string | null;
}
```

## Required Host Constraints <!-- oc:id=sec_ae -->
The schema must encode these non-negotiable rules:
- Host owns the shell, header, tabs, width, collapse state, and persistence policy.
- Plugins contribute **body content only** for a selected tab.
- Plugins cannot inject arbitrary shell/header/footer layout.
- Nav-sidebar ids are **not** `SidePanelTabId`; they are their own namespace and remain dynamic.
- Render modes may mirror other families, but placement vocabulary must be nav-sidebar-specific.

## Validation Rules <!-- oc:id=sec_af -->
- `navSidebars[*].id` unique within plugin manifest.
- `orderHint` optional and non-authoritative; host resolves collisions.
- `persistenceKey` optional; if absent, host derives `nav-sidebar.<pluginId>.<contributionId>`.
- `renderMode: "iframe"` requires explicit escape-hatch policy, same as other interactive families.
- `hostChrome` object is fixed, largely declarative, and enforced by schema defaults to prevent inversion of authority.

## Rationale Against Overloading Existing Panels <!-- oc:id=sec_ag -->
A new family keeps the semantics auditable:
- `panels` remain about side-panel/main-pane host targets.
- `navSidebars` become the canonical left-nav contribution surface.
- Future host families (`page`, `settings-section`) can be introduced with equally explicit vocabulary instead of accreting side-panel terminology everywhere.

## Acceptance Check <!-- oc:id=sec_ah -->
- [x] Contract is semantically distinct from side-panel.
- [x] Host-owned chrome constraint is explicit and encoded in the shape.