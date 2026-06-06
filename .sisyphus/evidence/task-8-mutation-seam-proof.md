# Task 8 Mutation Seam Proof <!-- oc:id=sec_aa -->

## SDK evidence <!-- oc:id=sec_ab -->

Context7 docs for `/anomalyco/opencode-sdk-js` show `client.config.get()` for reading config, including `config.mcp` inspection.
No config update/write/remove API was surfaced in the SDK docs used for this task.

## Chosen seam <!-- oc:id=sec_ac -->

`McpConfigMutationSeamProof` in `apps/desktop/src/renderer/lib/mcp-connections.ts` records:

- `sdkSupportsMutation: false`
- `readSurface: client.config.get`
- `writeSurface: main_process_managed_config_writer`
- `runtimeRefresh: client.global.dispose`

## Decision <!-- oc:id=sec_ad -->

Use a main-process managed config writer seam for MCP entry mutations, then trigger runtime refresh via `client.global.dispose` / existing `reloadConfig` patterns.
This satisfies the guardrail against renderer file writes and manual JSON editing.