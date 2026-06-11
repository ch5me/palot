# Task 12: Built-in Nav-Sidebar Smoke Proof Specification <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Specify the exact runtime surface check that proves the new host-owned `nav-sidebar` shell with `DiscreteTabs` header can successfully render and switch between built-in tab content without layout collapse or host chrome breakage.

## Pre-Requisites <!-- oc:id=sec_ac -->
- `DiscreteTabs` component from `@ch5me/elf-ui` or directly from `ch5-packages` integrated into Palot sidebar header.
- Two built-in tab bodies: "Tab 1" (original `AppSidebarContent` behavior) and "Tab 2" (duplicate or temporary placeholder).
- Host-owned nav-sidebar selection state (`navSidebarSelectionAtom` or similar) replacing or decoupled from `sidePanelActiveTabAtom`.

## QA Scenario: Built-in Nav-Sidebar Tabs Switch in Runtime <!-- oc:id=sec_ad -->
**Tool**: `agent-browser` or local app surface execution
**Steps**:
1. Open Palot main surface (desktop app or Storybook proxy). <!-- oc:id=item_aa -->
1. Locate the new nav-sidebar header tablist rendered above the sidebar body. <!-- oc:id=item_ab -->
1. Click built-in tab one. Assert `AppSidebarContent` (or its extracted equivalent) renders. <!-- oc:id=item_ac -->
1. Click built-in tab two. Assert the temporary body renders through the same host outlet. <!-- oc:id=item_ad -->
1. Assert the outer sidebar shell (width, border, collapse state via `<SplitPane>`) remains stable and no layout collapse occurs. <!-- oc:id=item_ae -->
1. Close and reopen the sidebar via `Cmd+B`. Assert active tab selection persists. <!-- oc:id=item_af -->

## Evidence Path <!-- oc:id=sec_ae -->
`.sisyphus/evidence/task-12-built-in-switch.png` (or video artifact)

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Integrated nav-sidebar smoke path fully specified with exact checks/evidence.
- [x] No layout collapse or shell breakage expected.