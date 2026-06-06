# Task 6 - Doc alignment

Updated `docs/palot-opencode-plugin-bridge.md` to match current runtime truth.

## Fixed drift

- attached/pre-existing server path now called intentionally unsupported, not merely ambiguous
- browser action section now documents live click/type/scroll dispatch
- schema section now documents shared Zod module and live validation coverage
- gap section now records callback hydration as proven absent rather than unresolved hidden wiring
- next steps section now reflects post-implementation state

## Verification

- read-through against `apps/desktop/src/main/opencode-manager.ts`
- read-through against `apps/desktop/src/main/palot-browser-dispatcher.ts`
- read-through against `apps/desktop/src/shared/palot-bridge-schemas.ts`
