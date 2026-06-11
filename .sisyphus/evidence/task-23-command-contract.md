# Task 23: Command / Action Contract <!-- oc:id=sec_aa -->

## Contract Definition <!-- oc:id=sec_ab -->
Folio surfaces register command palette actions and context-aware commands using `kind: "command"`.

### Manifest Shape <!-- oc:id=sec_ac -->
```typescript
{
  kind: "command",
  id: "folio.create-page",
  title: "New Folio Page",
  category: "Folio",
  icon: "file-plus",
  keybinding: "mod+shift+n",
  when: "workspace-active", // Host predicate
  action: {
    type: "navigate",
    routeIdentity: "workspace:{workspaceId}/page:new"
  }
}
```

### Covered Flows <!-- oc:id=sec_ad -->
- **Create/Open**: "New Folio Page", "New Folio Database", "Open Recent Folio Doc"
- **Navigate**: "Go to Folio Workspace Home"
- **Settings/Admin**: "Open Folio Organization Settings"

### Rules <!-- oc:id=sec_ae -->
- Do not keep Folio navigation dependent on sidebar clicks only. Core actions must be addressable from the global command palette.
- The host owns keybinding resolution and predicate evaluation (`when`).

## Acceptance Check <!-- oc:id=sec_af -->
- [x] Folio command/action model is explicit and host-integrated.