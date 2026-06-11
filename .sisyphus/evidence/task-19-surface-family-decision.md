# Task 19: Surface-Family Architecture Decision <!-- oc:id=sec_aa -->

## Decision: Unified `surface` Family with Discriminated `kind` <!-- oc:id=sec_ab -->
Instead of creating a separate top-level contribution array for every host surface (`panels`, `navSidebars`, `pages`, `settingsSections`), the architecture chooses a unified `surface` family with a discriminated `kind` property.

### Rationale <!-- oc:id=sec_ac -->
1. **Reusability Beyond Folio**: A generic `surface` contract allows any future bundled app (CRM, Studio, etc.) to register its UI into Palot's designated zones without requiring new manifest arrays per app. <!-- oc:id=item_aa -->
1. **Avoids Schema Bloat**: Adding a new array to `contributes` for every new surface type bloats validation and projection logic. A discriminated union keeps the schema DRY and the projection pipeline uniform. <!-- oc:id=item_ab -->
1. **Host-Owned Zone Vocabulary**: The host defines the allowed `kind` values (e.g., `"nav-sidebar"`, `"page"`, `"settings-section"`, `"side-panel"`). This preserves host authority over routing and chrome while letting plugins declaratively target them. <!-- oc:id=item_ac -->

### Rejected Alternative <!-- oc:id=sec_ad -->
**New family per surface type** (`"navSidebars"`, `"pages"`, etc.): Rejected because it couples the manifest schema rigidly to host UI decisions. If Palot later renames or merges host surfaces, it would require manifest schema migrations for all plugins.

## Surface Kind Definitions <!-- oc:id=sec_ae -->
- `"nav-sidebar"`: Host-owned left navigation tab.
- `"page"`: Main-pane content surface.
- `"settings-section"`: Settings shell tab.
- `"side-panel"`: Contextual adjunct panel (existing `panels` family can be aliased here).
- `"command"`: Palette/action registry.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Chosen schema direction has explicit reasons and rejected alternative documented.