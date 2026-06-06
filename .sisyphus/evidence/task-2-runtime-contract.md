# Task 2 Runtime Contract Evidence <!-- oc:id=sec_aa -->

## Compact runtime meta-tool surface <!-- oc:id=sec_ab -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

Required runtime meta-tools present:
- `mcp.search`
- `mcp.describe`
- `mcp.call`
- optional `mcp.status`

## Control-plane responsibilities <!-- oc:id=sec_ac -->

`MCP_CONTROL_PLANE_CONTRACT` defines explicit responsibilities for:
- `register`
- `list`
- `get`
- `login`
- `logout`
- `test`
- `call`
- `status`

## Runtime path split <!-- oc:id=sec_ad -->

Preferred runtime paths are modeled separately from CLI fallback:
- `in_process` for lazy runtime search/describe/call and compact test probing
- `daemon` for long-lived MCPorter control-plane registration/auth/status
- `cli` only as fallback path descriptor, not default runtime contract

## Separation proof <!-- oc:id=sec_ae -->

Provider types stay untouched. New contract stays scoped to MCP connection and runtime control-plane types in this file.