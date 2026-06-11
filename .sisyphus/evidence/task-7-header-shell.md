# Task 7: Host Nav-Sidebar Header Shell with DiscreteTabs <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Design a host-owned top header component that renders `DiscreteTabs` above the nav-sidebar outlet, combining one built-in tab with dynamic plugin-contributed tabs while preserving host authority over shell chrome.

## Proposed Host Component Split <!-- oc:id=sec_ac -->
1. **`NavSidebarShell`** <!-- oc:id=item_aa -->
   - Lives in `apps/desktop/src/renderer/components/sidebar-layout.tsx` or a new adjacent component file.
   - Owns the vertical flex container, header strip, body outlet, and optional footer slot.
1. **`NavSidebarHeaderTabs`** <!-- oc:id=item_ab -->
   - Receives normalized tab descriptors.
   - Renders `DiscreteTabs size="sm"`.
   - Calls host `onValueChange` when tab selection changes.
1. **`NavSidebarBodyOutlet`** <!-- oc:id=item_ac -->
   - Chooses between built-in body content and the selected plugin contribution.

## Visual Spec <!-- oc:id=sec_ad -->
Using the existing sidebar pane from `sidebar-layout.tsx`:
- Container remains `flex h-full min-h-0 flex-col overflow-hidden`.
- Header area sits at the top, above body content.
- Header styles:
  - width: `100%`
  - border-bottom: subtle divider
  - padding: `pt-3 pb-2 px-3`
  - background: inherit sidebar background
- Body outlet styles:
  - `flex-1 min-h-0 overflow-hidden`
  - plugin or built-in content scrolls inside the body area, not in the header

## Width and Spacing <!-- oc:id=sec_ae -->
- Target width range is inherited from `SplitPane` (`200-480px`, default 320px).
- Tabs should align left, not stretch full width.
- Keep one row only for MVP.
- Header should reserve enough room that active-tab expansion does not overlap body content or footer.

## Focus and Keyboard Behavior <!-- oc:id=sec_af -->
- `DiscreteTabs` already provides tab semantics.
- Host should ensure focus ring remains visible against sidebar background.
- `Cmd/Ctrl+B` continues to toggle the entire sidebar through `leftPanelOpenAtom`; it must not be repurposed for tab switching.
- Future arrow-key cycling can follow native tab semantics if added centrally.

## Collapsed-State Behavior <!-- oc:id=sec_ag -->
Current collapse behavior fully closes the pane at narrow widths; therefore:
- When open, render full header with `DiscreteTabs`.
- When closed, render nothing because the entire nav-sidebar is hidden.
- Do not move tabs into `AppBar`; the plan explicitly forbids app-bar placement.

## Dynamic Contribution Rules <!-- oc:id=sec_ah -->
- Built-in tab is always first and host-owned.
- Plugin tabs append after built-in using host-resolved ordering.
- Plugins supply only metadata/body render target; they never control header layout.
- Unavailable plugin tabs may show disabled state or be filtered before render based on the host contract, but the header component itself stays generic.

## Acceptance Check <!-- oc:id=sec_ai -->
- [x] Header shell is host-owned and placed inside the sidebar pane, not the app bar.
- [x] Width, borders, padding, focus, and collapsed-state behavior are explicit.
- [x] Built-in plus dynamic tabs are supported without handing shell authority to plugins.