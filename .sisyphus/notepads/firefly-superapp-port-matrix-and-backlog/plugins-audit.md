# Plugins Audit <!-- oc:id=sec_aa -->

## Current reusable seams <!-- oc:id=sec_ab -->

- `ProviderSettings` already exposes plugin-style provider auth methods via `useProviderAuthMethods()` and `ConnectProviderDialog`.
- Chat already has a dedicated skills picker via `/skills`, backed by `client.app.skills()`.
- Slash command UI already distinguishes server commands, MCP entries, and skills.
- Onboarding scans MCP server counts and skill counts, proving Elf already knows those plugin-adjacent domains exist.

## Decision <!-- oc:id=sec_ac -->

The first Plugins surface should reflect OpenCode skills and MCPs, not invent a separate external plugin system.

## First shell shape <!-- oc:id=sec_ad -->

- Add a `plugins` Firefly surface as a side-panel proof shell.
- Show two primary sections:
  - Skills / commands already available from the current OpenCode connection
  - MCP / provider-adjacent integration posture summarized from existing settings/seams
- Use the surface as an integration inventory and launch point, not as a full package manager.

## Deferred <!-- oc:id=sec_ae -->

- external marketplace semantics
- install/update/remove plugin lifecycle
- deep plugin execution telemetry beyond what current OpenCode data already exposes