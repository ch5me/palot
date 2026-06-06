# Task 7 Backend Location <!-- oc:id=sec_aa -->

## Chosen location <!-- oc:id=sec_ab -->

Catalog ingestion/cache should live behind main-process owned backend surfaces.

## Pattern references <!-- oc:id=sec_ac -->

- `apps/desktop/src/renderer/hooks/use-opencode-data.ts` uses TanStack Query hooks that call typed backend/client helpers.
- `apps/desktop/src/renderer/services/backend.ts` is the renderer-facing abstraction for Electron IPC or browser HTTP fallback.
- `apps/desktop/src/main/ipc-handlers.ts` is the Electron mutation/read registration seam.

## Contract <!-- oc:id=sec_ad -->

`McpCatalogBackendServiceContract` in `apps/desktop/src/renderer/lib/mcp-connections.ts` sets:

- service owner: main process
- renderer access: typed backend helper
- transport: Electron IPC or HTTP proxy
- query key prefix: `mcp-catalog`
- fetch location: never renderer direct

This matches task 7 guardrail: no direct registry fetch from renderer dialog opens.