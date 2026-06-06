# Task 8 - Attached/pre-existing server policy proof

## Policy

Attached/pre-existing OpenCode servers are intentionally unsupported for Palot bridge features.

## Proof

- `apps/desktop/src/main/opencode-manager.ts` returns discovered existing server immediately in `ensureServer()` without mutating env or writing plugin config.
- `docs/palot-opencode-plugin-bridge.md` now documents attached/pre-existing servers as unsupported for bridge-dependent features.
- No repo path installs Palot bridge into an already-running external server.

## UX state

No separate attached-server fallback UX was implemented in this slice. Operator guidance now lives in canonical docs.
