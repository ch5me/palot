# Task 21: Settings-Section Contract <!-- oc:id=sec_aa -->

## Contract Definition <!-- oc:id=sec_ab -->
Plugins register first-class settings sections inside the Palot settings shell using `kind: "settings-section"`.

### Manifest Shape <!-- oc:id=sec_ac -->
```typescript
{
  kind: "settings-section",
  id: "folio.org-admin",
  title: "Organization",
  category: "Workspace",
  visibility: "requires-role:admin", // Host evaluates this
  orderHint: 20
}
```

### Host-Owned vs Plugin-Owned <!-- oc:id=sec_ad -->
- **Host-Owned**: Settings shell layout, search filtering, category navigation, and role-based visibility gating.
- **Plugin-Owned**: The actual content of the settings section (e.g., member list, audit log).

### Rules <!-- oc:id=sec_ae -->
- Plugins cannot own the settings shell itself or register top-level categories without host approval.
- Visibility rules are evaluated by the host; if the user lacks the required role, the section is completely hidden from the settings nav.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Settings-section integration model is explicit and reusable.