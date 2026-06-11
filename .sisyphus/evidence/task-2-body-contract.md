# Task 2: Built-in Sidebar Inner/Body Contract <!-- oc:id=sec_aa -->

## Overview <!-- oc:id=sec_ab -->
This document defines the extraction boundary for the reusable built-in inner body unit of the `nav-sidebar`. The goal is to decompose `AppSidebarContent` from `apps/desktop/src/renderer/components/sidebar.tsx` into a pure, reusable component that can be rendered as the "default" or "built-in" tab within the future host-owned `nav-sidebar` header, preserving 100% of existing user interactions.

## Current Feature Inventory (from `sidebar.tsx`) <!-- oc:id=sec_ac -->
The existing `AppSidebarContent` provides the following capabilities that **must** be preserved in the extracted contract:

1. **Section Expansion/Collapse**: Toggling visibility of "Active Now", "Recent", and "Projects" groups. <!-- oc:id=item_aa -->
1. **Session Actions (per agent)**: <!-- oc:id=item_ab -->
   - Rename session (inline editing with Enter/Escape handling)
   - Delete session (with destructive context menu)
   - Toggle pinned status (pin/unpin)
   - Fork session (creates new session from current state)
1. **Project Management**: <!-- oc:id=item_ac -->
   - "Add Project" button (triggers directory picker for local, or dialog for remote)
   - Project list rendering with session counts
1. **Global Actions**: <!-- oc:id=item_ad -->
   - Open Command Palette (`Cmd+K` / `Ctrl+K`)
1. **Visual Indicators**: <!-- oc:id=item_ae -->
   - Server connection status (`serverConnected` prop)
   - Agent status indicators (running, waiting, degraded, idle) with live presence pulses
   - Project Manager session tags
   - Automations enabled indicator
   - Compact mode support (`size="sm"` vs `"default"`)

## Extracted Body Contract Interface <!-- oc:id=sec_ad -->

The reusable built-in body component (e.g., `NavSidebarBuiltInBody`) should accept the following props, cleanly separating UI rendering from host-level side effects:

```typescript
interface NavSidebarBuiltInBodyProps {
  // Data
  agents: Agent[];
  projects: SidebarProject[];
  serverConnected: boolean;
  
  // Actions (provided by host layout to wire up backend/server calls)
  onOpenCommandPalette: () => void;
  onAddProject: () => void | Promise<void>;
  onRenameSession: (agent: Agent, title: string) => Promise<void>;
  onDeleteSession: (agent: Agent) => Promise<void>;
  onTogglePinnedSession: (agent: Agent, pinned: boolean) => Promise<void>;
  onForkSession: (agent: Agent) => Promise<void>;
  
  // Optional UI overrides
  compact?: boolean;
}
```

## State Dependencies (To Be Preserved) <!-- oc:id=sec_ae -->
The extracted component will continue to read from the following atoms, which remain host-owned:
- `sidebarSectionOpenAtom`: Controls group expansion state.
- `pinnedSessionsAtom`: Determines pin status for context menu and visual indicator.
- `projectManagerSessionTagsAtom`: For PM session visual tagging.
- `automationsEnabledAtom`: For automation feature flag UI.
- `activeServerConfigAtom`: To adapt "Add Project" behavior (local vs remote).

## Extraction Boundary <!-- oc:id=sec_af -->
- **Host Layout (`sidebar-layout.tsx`)**: Owns the `SidebarProvider`, `SplitPane`, and fetches/wires the action callbacks (`onRenameSession`, etc.) by calling server hooks (`useAgentActions`).
- **Extracted Body (`sidebar.tsx` -> `NavSidebarBuiltInBody`)**: Owns the UI rendering, local state (e.g., inline edit mode, search query), and context menus. It calls the provided action callbacks when the user interacts.
- **Future Plugin Outlet**: Will sit alongside the `NavSidebarBuiltInBody` inside a new `nav-sidebar` shell that provides a `DiscreteTabs` header for switching between them.

## Verification Checklist <!-- oc:id=sec_ag -->
- [x] Enumerated all current sidebar actions from `sidebar.tsx`.
- [x] Mapped each action to extracted body props or host-owned atom dependencies.
- [x] Asserted no feature is lost in decomposition: all 6 action callbacks, 5 visual indicators, and 3 section states are explicitly accounted for in the contract.