# Task 1 - Runtime callback hydration proof

## Code-trace proof

- Managed spawn injects plugin file path through `OPENCODE_PLUGIN` in `apps/desktop/src/main/opencode-manager.ts`.
- Plugin module shape validation only checks `{ id, server }` in `apps/desktop/src/main/palot-opencode-plugin-shim.ts`.
- Plugin default export still instantiates `server` as `createPalotPlugin()` with no injected callbacks in `apps/desktop/.opencode/plugins/palot-bridge.js`.
- Official OpenCode plugin docs show plugins receive runtime context through plugin function input and tool execute context, not via arbitrary host-side callback hydration into a local factory.

## Conclusion

No host-side runtime callback hydration into `createPalotPlugin({ resolve, dispatch, getUiState, openSidePanel })` is visible in this repo.

Smallest correct completion path in current architecture:

1. Treat managed-server plugin loading as file injection only.
2. Make attached-server policy explicit as unsupported for Palot bridge features.
3. Harden seam contracts with shared schemas.
4. Either implement bridge features through standard OpenCode plugin context/hooks plus an explicit transport, or document current callback seam as test-only/scaffold-only until such transport exists.

## Result

Task 1 currently lands as decisive documentation/proof of missing hydration path, not as a completed runtime hydration implementation, because no viable host callback injection seam is exposed by OpenCode's documented plugin API in this repo.
