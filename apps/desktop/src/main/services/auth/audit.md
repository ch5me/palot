# T01 — safeStorage + preload audit <!-- oc:id=sec_aa -->

## Existing safeStorage call sites <!-- oc:id=sec_ab -->

| File | Lines | Use |
|---|---|---|
| `apps/desktop/src/main/credential-store.ts` | 11, 54–59, 74–80 | `safeStorage.isEncryptionAvailable()`, `safeStorage.encryptString()`, `safeStorage.decryptString()` — sync API only, no `Async` variant |
| `apps/desktop/src/main/ipc-handlers.ts` | 924–940 | IPC handlers `credential:store`, `credential:get`, `credential:delete` — wrappers around the credential-store |

`safeStorage.getSelectedStorageBackend()` is **NOT currently used anywhere** in the codebase. This must be added for T21 (Linux basic_text policy).

## Existing IPC channels touching credentials <!-- oc:id=sec_ac -->

| Channel | Direction | Notes |
|---|---|---|
| `credential:store` | Renderer → Main | Stores password per serverId, encrypted via safeStorage |
| `credential:get` | Renderer → Main | Retrieves decrypted password for serverId |
| `credential:delete` | Renderer → Main | Removes stored credential |

## Preload auth namespace <!-- oc:id=sec_ad -->

**Currently: NO `auth:` namespace.** The preload bridge (`apps/desktop/src/preload/index.ts`) exposes `window.elf.credential` but no `window.elf.auth`.

This plan adds: `auth:getState`, `auth:signIn`, `auth:poll`, `auth:cancelSignIn`, `auth:signOut`, `auth:onChange`.

## Renderer token exposure rule <!-- oc:id=sec_ae -->

**NEVER** expose raw access token to renderer. The `ElfAuthStateDto` sent to renderer via `elf.auth.getState()` contains only: `hasToken`, `elfUserId`, `expiresAt`, `issuer`, `audience`. No `accessToken` field.

## What T02–T06 add <!-- oc:id=sec_af -->

1. **vault.ts** — async safeStorage wrapper with `basic_text` detection <!-- oc:id=item_aa -->
1. **token-store.ts** — ElfTokenStore shape, encrypted persist via vault, change notifications <!-- oc:id=item_ab -->
1. **device-auth-client.ts** — RFC 8628 device-auth client (request + poll + deny) <!-- oc:id=item_ac -->
1. **sign-in-to-editor-handler.ts** — deep-link handler + singleton auth store <!-- oc:id=item_ad -->
1. **auth-controller.ts** — orchestrates sign-in flow, wires IPC, pushes state to renderer <!-- oc:id=item_ae -->
1. **preload/api.d.ts** — `ElfAuthApi` interface (types only) <!-- oc:id=item_af -->
1. **preload/index.ts** — `elf.auth` surface (functions only, no raw token) <!-- oc:id=item_ag -->
1. **ipc-handlers.ts** — new `auth:*` IPC handlers <!-- oc:id=item_ah -->

## Known gaps flagged in plan <!-- oc:id=sec_ag -->

- `api.staging.elf.dance` is unresolved (CG6). `device-auth-client.ts` defaults to `'auth.elf.dance'` with a clearly labeled placeholder.
- `GET /api/device-auth/codes/:code` polling endpoint confirmed present in firefly-cloud.
- `POST /api/device-auth/tokens` for editor handoff confirmed present in firefly-cloud.