# Task 1: Host Nav-Sidebar Architecture Seam Map <!-- oc:id=sec_aa -->

## Overview <!-- oc:id=sec_ab -->
This document maps the exact host-owned authority boundaries and seams for the `nav-sidebar` (note: semantic naming, not positional "left-sidebar") in Palot. The `nav-sidebar` is host chrome, and plugins project surfaces *into* it; the chrome itself remains host-owned to prevent authority inversion.

## Host-Owned Files & Authority Boundaries <!-- oc:id=sec_ac -->

### 1. Shell & Layout Authority <!-- oc:id=sec_ad -->
- **File**: `apps/desktop/src/renderer/components/sidebar-layout.tsx`
- **Authority**: Host-only. Owns the outer grid layout, `<AppBar />` placement, and the `<SplitPane>` container.
- **Seam**: Passes `{sidebarContent}` and `{slotFooter}` into the `<SidebarProvider>` wrapper.
- **State Dependency**: `leftPanelOpenAtom` (controls collapse/expand of the entire pane).

### 2. Default Built-in Body Authority <!-- oc:id=sec_ae -->
- **File**: `apps/desktop/src/renderer/components/sidebar.tsx` (`AppSidebarContent` component)
- **Authority**: Host-only default implementation. Owns the presentation of "Active Now", "Recent", and "Projects" groups, plus the Settings footer.
- **Seam**: Exposes a prop-driven interface (`AppSidebarContentProps`) for actions: `onRenameSession`, `onDeleteSession`, `onTogglePinnedSession`, `onForkSession`, `onOpenCommandPalette`, `onAddProject`. This allows the host layout to wire up server/backend calls while the UI remains self-contained.
- **State Dependency**: `sidebarSectionOpenAtom` (controls expansion of internal groups), `pinnedSessionsAtom`, `projectSessionIdsFamily`.

### 3. Route-Owned Override Seam (Current State) <!-- oc:id=sec_af -->
- **File**: `apps/desktop/src/renderer/components/sidebar-slot-context.tsx`
- **Authority**: Route-owned (not yet plugin-catalog-owned).
- **Seam**: `SidebarSlotProvider` exposes `setContent` and `setFooter`. Child routes can call `useSetSidebarSlot()` to completely replace the `AppSidebarContent` body or hide the footer.
- **Limitation**: This is currently a blunt override. Future plugin contributions should register as discrete tabs *within* a host-owned header, rather than replacing the entire body via route context.

### 4. First-Party Migration Doctrine <!-- oc:id=sec_ag -->
- **File**: `apps/desktop/src/shared/firefly-plugin/first-party-migration.ts` (lines 476-492)
- **Rationale**: Explicitly states `left-nav-sidebar` is `host-only` because "the left navigation sidebar is the host's own chrome; plugins project surfaces and widgets into it, so the chrome itself cannot be a plugin without inverting authority."
- **Rollout Phase**: `defer` for full plugin ownership, but plugins *can* contribute children via the `sidebar-slot-context` seam today.

## Future Stable Seams (Target Architecture) <!-- oc:id=sec_ah -->
1. **Host Shell**: Remains `sidebar-layout.tsx`. Owns `SplitPane`, collapse state, and responsive behavior. <!-- oc:id=item_aa -->
1. **Built-in Content Provider**: A refactored, reusable version of `AppSidebarContent` that can be rendered as the "default" tab in a new `nav-sidebar` header. <!-- oc:id=item_ab -->
1. **Plugin Contribution Outlet**: A new host-owned component that renders a `DiscreteTabs` header and dynamically switches between the built-in body and plugin-provided bodies, replacing the blunt `sidebar-slot-context` override with a structured tab model. <!-- oc:id=item_ac -->
1. **Persistence Layer**: A new, distinct atom family (e.g., `navSidebarActiveTabAtom`) separate from `sidePanelActiveTabAtom`, persisting the user's preferred nav-sidebar tab independently. <!-- oc:id=item_ad -->

## Verification Status <!-- oc:id=sec_ai -->
- [x] Seam mapped with exact file/type references.
- [x] Host-only authority boundary aligns with `first-party-migration.ts` doctrine.
- [x] Semantic naming (`nav-sidebar`) explicitly justified over positional naming.