# Task 5 Surface Split <!-- oc:id=sec_aa -->

Source seams reviewed:
- `apps/desktop/src/renderer/components/settings/settings-page.tsx`
- `apps/desktop/src/renderer/router.tsx`
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx`
- `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Responsibility split <!-- oc:id=sec_ab -->

- Settings Connections: discovery, install, auth, ownership, recovery
- Plugins panel: read-only posture summary for currently configured/runtime-visible MCP servers
- Session/runtime surfaces: hydrated subset and active-use posture later

## Guardrail <!-- oc:id=sec_ac -->

`McpNavigationPlacement.pluginsPanelRole = read_only_posture` keeps Plugins from becoming the primary setup flow.