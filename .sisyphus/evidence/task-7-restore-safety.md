# Task 7 — Restore safety for disabled `pdf-review` surface <!-- oc:id=sec_aa -->

## Existing fallback rule <!-- oc:id=sec_ab -->
PALOT already has safe restore behavior in `apps/desktop/src/renderer/atoms/ui.ts:73`.

`setAvailableSidePanelTabsAtom` does:
1. close side panel if zero tabs available <!-- oc:id=item_aa -->
1. keep current tab if still valid <!-- oc:id=item_ab -->
1. otherwise switch active tab to first valid available tab <!-- oc:id=item_ac -->
1. bump focus token <!-- oc:id=item_ad -->

## Why this covers `pdf-review` <!-- oc:id=sec_ac -->
- last active side-panel tab persists through `fireflySurfacePreferencesAtom.lastSidePanelTab`
- if stored tab is `pdf-review` but feature flag later disables it:
  - `firefly-surface-registry.tsx` marks it unavailable
  - `agent-detail.tsx` filters `availableSidePanelTabs`
  - `setAvailableSidePanelTabsAtom` sees active tab is invalid
  - active tab falls back to first valid available tab
- if no tabs remain at all, side panel closes instead of breaking startup

## Expected behavior matrix <!-- oc:id=sec_ad -->
| Stored tab | Flag state on startup | Expected result |
| --- | --- | --- |
| `pdf-review` | enabled | restore to `pdf-review` |
| `pdf-review` | disabled, other tabs available | fallback to first available tab |
| `pdf-review` | disabled, no tabs available | side panel closes |

## No extra bespoke restore code needed <!-- oc:id=sec_ae -->
Do not add PDF-review-specific startup guards in:
- registry
- router
- panel component

Existing global fallback path is already correct and keeps restore logic DRY.

## Safety verdict <!-- oc:id=sec_af -->
Restore path is safe. Disabled persisted `pdf-review` cannot wedge startup or leave side panel pointing at nonexistent content.