# Task 19 Meta Tools <!-- oc:id=sec_aa -->

Runtime tool surface now exposes compact MCP tools in `apps/desktop/.opencode/plugins/palot-bridge.js`:

- `mcp_search`
- `mcp_describe`
- `mcp_call`
- `mcp_status`

These sit alongside existing Palot tools and avoid per-tool explosion at boot.