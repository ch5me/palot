# Task 4 — IPC / preload bridge contract <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added main-owned IPC helpers in `apps/desktop/src/main/palot-browser-ipc.ts`.
- Added typed preload surface in `apps/desktop/src/preload/index.ts` under `window.elf.palot`.
- Extended `ElfAPI` and shared types in `apps/desktop/src/preload/api.d.ts`.
- Registered IPC handlers in `apps/desktop/src/main/ipc-handlers.ts`:
  - `palot:browser-state-snapshot`
  - `palot:browser-action`
  - `palot:binding-get`
  - `palot:binding-set`
  - `palot:binding-release`
- Added channel smoke test in `apps/desktop/src/main/palot-browser-ipc.test.ts`.

## Channel contract <!-- oc:id=sec_ac -->

Request/response style:
- `palot:browser-state-snapshot(sessionId)` -> `BrowserStateSnapshot`
- `palot:browser-action({ event })` -> echoed `BrowserActionEvent`
- `palot:binding-get(sessionId)` -> `SessionBinding | null`
- `palot:binding-set(binding)` -> `SessionBinding`
- `palot:binding-release(sessionId)` -> `SessionBinding | null`

Push channel:
- `palot:browser-actions` event stream via `window.elf.palot.onBrowserActions(callback)`

## Notes <!-- oc:id=sec_ad -->

- Event buffering is intentionally small and local for now; formal bus semantics still belong to T10.
- Snapshot currently returns binding + recent actions only; richer non-secret snapshot fields will come with T7.
- No JSON stringification tunnel added; all channels use structured typed payloads.