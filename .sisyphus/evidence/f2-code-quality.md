# F2 - Code quality review

## Verification

- `bun run lint`
- `bun run check-types`
- `bun test apps/desktop/.opencode/plugins/palot-bridge.test.js apps/desktop/src/main/palot-browser-dispatcher.test.ts apps/desktop/src/main/palot-session-binding.test.ts apps/desktop/src/main/palot-browser-ipc.test.ts apps/desktop/src/main/palot-resolver.test.ts apps/desktop/src/main/browser-lane-manager.test.ts`

## Review outcome

- shared schema contract consolidated in `apps/desktop/src/shared/palot-bridge-schemas.ts`
- no fake schema placeholders remain on Palot browser/UI tools
- no secret-handling regression introduced; persisted binding store still excludes viewer auth token
- managed live proof still blocked by devmux startup failure documented separately
