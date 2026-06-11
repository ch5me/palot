# Task 17: Host Surface Taxonomy Draft <!-- oc:id=sec_aa -->

## Proposed Semantic Host Surface Taxonomy <!-- oc:id=sec_ab -->
To prevent the closed-trap of `side-panel` vocab, we define distinct, future-safe semantic families for Folio inside Palot:

1. **`nav-sidebar`**: The primary left-navigation chrome. Plugins contribute discrete tabs that render body content within a host-owned shell/header. (Distinct from `side-panel`). <!-- oc:id=item_aa -->
1. **`page`**: Full-screen or main-pane document/database surfaces. Host owns outer container, routing, and breadcrumbs; plugin owns inner content, autosave UX, and route identity. <!-- oc:id=item_ab -->
1. **`settings-section`**: Dedicated panels within the Palot settings shell for Folio organizations, admin, and workspace preferences. <!-- oc:id=item_ac -->
1. **`side-panel`**: Contextual adjunct surfaces (backlinks, inspectors, row previews, comments) that supplement an active `page` or `nav-sidebar` without replacing it. <!-- oc:id=item_ad -->
1. **`command`**: Palette actions, keybindings, and context menus for creating/opening Folio objects, independent of sidebar clicks. <!-- oc:id=item_ae -->
1. **`background-service` / `data-bridge`**: Non-visual runtime integrations (auth bridge, API client injection, local cache coordination). <!-- oc:id=item_af -->

## Mapping Folio UI Categories to Host Families <!-- oc:id=sec_ac -->
| Folio UI Category | Host Surface Target | Rationale |
|-------------------|---------------------|-----------|
| Workspace Sidebar / Tree | `nav-sidebar` | Primary workspace navigation; fits discrete tab model. |
| Document / Checklist / Sheet | `page` | Full editor experience requiring main-pane real estate. |
| Database Table / Board / Views | `page` | Full data grid experience requiring main-pane real estate. |
| Workspace Home / Auth / Onboarding | `page` | Entry flows that replace or occupy the main view. |
| Org Admin / Member Management | `settings-section` | Operator-level configuration, not daily document work. |
| Row Preview / Cell Inspector | `side-panel` | Contextual drill-in that supplements the main database `page`. |
| Search / Actions / Share Overlays | `side-panel` or host overlay | Transient contextual surfaces, not permanent tabs. |
| Create Page / Open Database | `command` | Palette-addressable actions for rapid access. |

## Future-Safe Naming <!-- oc:id=sec_ad -->
- Avoided positional names (`left-sidebar`, `right-panel`).
- Avoided overloading `panels` for nav-sidebar (kept semantics strictly distinct).
- Taxonomy is explicitly designed to be reusable for future bundled apps (e.g., CRM, Studio) without Folio-specific special casing.

## Acceptance Check <!-- oc:id=sec_ae -->
- [x] Every Folio UI category has one clear host surface target.
- [x] Taxonomy names are semantic and future-safe.