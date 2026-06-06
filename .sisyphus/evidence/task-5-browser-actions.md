# Task 5 - Browser action completion

Implemented real runtime dispatch for browser actions using existing CDP websocket path.

## Landed

- Added CDP helpers in `apps/desktop/src/main/browser-lane-cdp.ts` for:
  - click via `Input.dispatchMouseEvent`
  - type via `Input.insertText` and optional enter key dispatch
  - scroll via mouse wheel dispatch
- Added browser-lane manager wrappers in `apps/desktop/src/main/browser-lane-manager.ts`.
- Wired `palot_browser_click`, `palot_browser_type`, and `palot_browser_scroll` in `apps/desktop/src/main/palot-browser-dispatcher.ts`.
- Preserved request/result action bus publishing behavior.

## Verification

- `bun test apps/desktop/.opencode/plugins/palot-bridge.test.js apps/desktop/src/main/palot-browser-dispatcher.test.ts apps/desktop/src/main/palot-session-binding.test.ts apps/desktop/src/main/palot-browser-ipc.test.ts apps/desktop/src/main/palot-resolver.test.ts apps/desktop/src/main/browser-lane-manager.test.ts`
- `bun run lint && bun run check-types`
