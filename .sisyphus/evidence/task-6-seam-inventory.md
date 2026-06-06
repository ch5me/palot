# Task 6 Seam Inventory <!-- oc:id=sec_aa -->

## Renderer seams <!-- oc:id=sec_ab -->

- `apps/desktop/src/renderer/components/settings/settings-page.tsx` — settings sidebar tabs and route placement for Connections
- `apps/desktop/src/renderer/components/settings/provider-settings.tsx` — baseline catalog/setup UX patterns to adapt
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx` — runtime posture-only MCP summary surface
- `apps/desktop/src/renderer/services/backend.ts` — renderer-side gateway to Electron IPC or browser HTTP backend
- `apps/desktop/src/renderer/lib/mcp-connections.ts` — shared MCP domain/contracts layer for connections work

## Preload seams <!-- oc:id=sec_ac -->

- `apps/desktop/src/preload/index.ts` — contextBridge registration point for new Connections/onboarding IPC methods

## Main-process seams <!-- oc:id=sec_ad -->

- `apps/desktop/src/main/ipc-handlers.ts` — authoritative IPC registration surface for renderer-invoked mutations and probes
- `apps/desktop/src/main/credential-store.ts` — local encrypted credential storage pattern for desktop-only secrets
- `apps/desktop/src/main/onboarding.ts` — migration preview/execute flow where imported MCPs enter Elf-managed state

## Config conversion / migration seams <!-- oc:id=sec_ae -->

- `packages/configconv/src/converter/mcp.ts` — migration-side local/remote MCP conversion and source merge behavior

## Expected future backend seams <!-- oc:id=sec_af -->

- `apps/desktop/src/renderer/services/backend.ts` should gain typed helpers for Connections-specific catalog, auth, and mutation calls.
- `apps/desktop/src/main/ipc-handlers.ts` should fan into dedicated MCP connections services rather than inline heavy logic.