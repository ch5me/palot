# Task 6: Host Nav-Sidebar State Model and Persistence <!-- oc:id=sec_aa -->

## Current State Problem <!-- oc:id=sec_ab -->
`apps/desktop/src/renderer/atoms/ui.ts` currently has a closed side-panel state model:
- `sidePanelOpenAtom`
- `sidePanelActiveTabAtom`
- `setSidePanelActiveTabAtom`
- `setAvailableSidePanelTabsAtom`
- `SidePanelTabId` derived from the static `FireflySurfaceId` union

This model is explicitly tied to right-side side-panel semantics and cannot be reused for `nav-sidebar` without importing closed tab ids, persistence keys, and side-panel routing assumptions.

## Proposed Distinct Nav-Sidebar State <!-- oc:id=sec_ac -->
Add a separate nav-sidebar family in `apps/desktop/src/renderer/atoms/ui.ts`:

```ts
export const navSidebarOpenAtom = leftPanelOpenAtom

export interface NavSidebarSelection {
  pluginId: string | null
  tabId: string
}

export const navSidebarAvailableTabsAtom = atom<readonly NavSidebarTabDescriptor[]>([])

export const navSidebarSelectionAtom = atomWithStorage<NavSidebarSelection>(
  "elf:nav-sidebar-selection",
  { pluginId: null, tabId: "built-in" },
)

export const setNavSidebarSelectionAtom = atom(null, (get, set, selection: NavSidebarSelection) => {
  set(navSidebarSelectionAtom, selection)
})

export const reconcileNavSidebarSelectionAtom = atom(null, (get, set, tabs: readonly NavSidebarTabDescriptor[]) => {
  set(navSidebarAvailableTabsAtom, tabs)
  const current = get(navSidebarSelectionAtom)
  const stillExists = tabs.some((tab) => tab.pluginId === current.pluginId && tab.tabId === current.tabId)
  if (!stillExists) {
    const fallback = tabs[0] ?? { pluginId: null, tabId: "built-in" }
    set(navSidebarSelectionAtom, fallback)
  }
})
```

## Key Separation Rules <!-- oc:id=sec_ad -->
- `navSidebarSelectionAtom` must use its own storage key, never `fireflySurfacePreferencesAtom.lastSidePanelTab`.
- `tabId` remains dynamic `string`, not `SidePanelTabId`.
- The built-in host tab uses a stable sentinel such as `{ pluginId: null, tabId: "built-in" }`.
- Nav-sidebar persistence does not reuse side-panel focus tokens or pane routing state.

## Dynamic Arrival / Disappearance Behavior <!-- oc:id=sec_ae -->
When plugin tabs appear/disappear:
1. If the current selected tab still exists, keep it. <!-- oc:id=item_aa -->
1. If it disappears, fall back deterministically to the first available tab, preferring the built-in host tab. <!-- oc:id=item_ab -->
1. If no plugin tabs remain, selection returns to `{ pluginId: null, tabId: "built-in" }`. <!-- oc:id=item_ac -->
1. Temporary duplicate proof tabs must use host-owned stable ids that can later be replaced without poisoning storage keys. <!-- oc:id=item_ad -->

## Persistence Ownership <!-- oc:id=sec_af -->
The host owns persistence. Plugins may suggest a persistence key in manifest data, but the renderer persists only normalized host-level selection state. This matches the host-owned chrome doctrine and prevents plugin tabs from hijacking top-level nav state.

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Nav-sidebar state is distinct from side-panel state.
- [x] Dynamic tab disappearance/arrival behavior is explicit.
- [x] No `SidePanelTabId` or side-panel storage key reuse is allowed.