# Task 2 Mutability Metadata Evidence <!-- oc:id=sec_aa -->

## Explicit metadata surfaces <!-- oc:id=sec_ab -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

Mutability and approval metadata exist in two layers:
- `McpToolDescriptor`: per-tool `mutability` + `approval`
- `McpControlPlaneOperationDescriptor`: per-operation `mutability` + `approval`
- `McpRuntimeMetaToolDescriptor`: runtime wrapper `mutability` + `approval`

## Mutating operations called out <!-- oc:id=sec_ac -->

`MCP_CONTROL_PLANE_CONTRACT` marks:
- `register` as `write` + `required`
- `login` as `write` + `required`
- `logout` as `destructive` + `required`
- `call` as `write` + `required_if_mutating`

## Runtime wrapper guardrails <!-- oc:id=sec_ad -->

`MCP_RUNTIME_META_TOOL_CONTRACT` marks:
- `mcp.search` as `read` + `none`
- `mcp.describe` as `read` + `none`
- `mcp.call` as `write` + `required`
- `mcp.status` as `read` + `none`

## Acceptance mapping <!-- oc:id=sec_ae -->

This satisfies task-2 requirement that mutability and approval metadata be explicit, not implied.