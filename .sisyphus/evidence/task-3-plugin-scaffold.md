# Task 3 — OpenCode plugin scaffold <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added dev plugin scaffold at `apps/desktop/.opencode/plugins/palot-bridge.js`.
- Added main-side loader proof helper at `apps/desktop/src/main/palot-opencode-plugin-shim.ts`.
- Added tests for module-shape validation at `apps/desktop/src/main/palot-opencode-plugin-shim.test.ts`.

## Module shape <!-- oc:id=sec_ac -->

Current scaffold exports the OpenCode-compatible module shape:

- `default = { id, server }`
- named `server`
- named `createPalotPlugin()` factory

This matches the plan requirement for a typed `{ id, server }` scaffold while keeping implementation tiny.

## Current behavior <!-- oc:id=sec_ad -->

- Plugin is desktop-oriented and placeholder-only.
- `experimental.chat.system.transform` exists and is safe no-op unless a session id and endpoint are present.
- Tool registration remains empty until T8/T9 wire the resolver and real tools.

## Loader compatibility proof <!-- oc:id=sec_ae -->

- `loadPalotPluginModule(filePath)` validates that a plugin module exports a usable `{ id, server }` shape.
- Test coverage proves both accept and reject paths.

## Remaining gap <!-- oc:id=sec_af -->

- OpenCode runtime injection from `opencode-manager.ts` is not wired yet.
- This scaffold is enough to unblock T8/T9 implementation work and later loader hookup.