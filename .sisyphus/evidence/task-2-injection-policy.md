# Task 2 - Injection policy

## Policy

- Managed Palot-spawned OpenCode servers get Palot plugin injection through `OPENCODE_PLUGIN`.
- Attached/pre-existing OpenCode servers do not get retrofitted plugin injection.
- Bridge-dependent features must therefore be documented as managed-server-only unless/until OpenCode exposes a supported install path for external long-lived servers.

## Proof

- `apps/desktop/src/main/opencode-manager.ts` appends plugin path only in spawn env before `opencode serve` spawn.
- Existing server attach path returns discovered server immediately and does not mutate env or write plugin config.
- `docs/palot-opencode-plugin-bridge.md` updated to reflect explicit unsupported attached-path guarantee.
