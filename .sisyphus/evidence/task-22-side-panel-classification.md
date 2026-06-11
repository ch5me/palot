# Task 22: Side-Panel / Contextual Surface Contract <!-- oc:id=sec_aa -->

## Contract Definition <!-- oc:id=sec_ab -->
Contextual Folio surfaces that supplement an active page are registered as `kind: "side-panel"`.

### Manifest Shape <!-- oc:id=sec_ac -->
```typescript
{
  kind: "side-panel",
  id: "folio.db.row-inspector",
  title: "Row Details",
  activationContext: "database.row-selected", // Host evaluates this
  defaultWidth: 320
}
```

### Contextual Classification <!-- oc:id=sec_ad -->
- **Row Preview / Cell Inspector**: `side-panel` (supplements database page)
- **Document Backlinks / Comments**: `side-panel` (supplements document page)
- **Share / Actions Overlays**: Host-native dialog (not persistent side-panel)

### Rules <!-- oc:id=sec_ae -->
- Do not turn every drill-in into a full page by default. Side-panels are for transient, context-specific adjuncts.
- The host owns the open/close state and z-index management. The plugin only provides the content when the `activationContext` is met.

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Contextual Folio surfaces are classified and mapped.