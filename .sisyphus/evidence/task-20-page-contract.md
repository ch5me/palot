# Task 20: Page Surface Contract <!-- oc:id=sec_aa -->

## Contract Definition <!-- oc:id=sec_ab -->
A plugin registers a first-class `page` surface by declaring a `surface` contribution with `kind: "page"`.

### Manifest Shape <!-- oc:id=sec_ac -->
```typescript
{
  kind: "page",
  id: "folio.database.table-view",
  title: "Database",
  icon: "grid", // lucide icon token
  routeIdentityPattern: "workspace:([^/]+)/database:([^/]+)", // Host evaluates this
  breadcrumbs: ["Workspace", "Database"],
  persistence: {
    key: "folio-db-view-state",
    scope: "workspace"
  }
}
```

### Host-Owned vs Plugin-Owned <!-- oc:id=sec_ad -->
- **Host-Owned**: Outer routing shell, app bar, global error boundaries, breadcrumb rendering, and deep-link parsing.
- **Plugin-Owned**: Inner content rendering, editor mounting, autosave status banner, and local cache coordination.

### Rules <!-- oc:id=sec_ae -->
- Plugins **cannot** own outer host routing. They only provide the `routeIdentityPattern` for the host to match against the current logical route.
- The host intercepts `?route=` and delegates rendering to the matching plugin surface.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Page surface registration contract is explicit and host-owned.