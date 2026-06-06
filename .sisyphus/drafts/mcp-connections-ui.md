# Draft: MCP Connections UI <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Need full plan for a simple MCP setup UX in Palot/Elf.
- UX target: Settings area with connections box, plus button, dialog/catalog, one-click install, OAuth walkthrough, animated success, no refresh needed.
- Need public/discoverable MCP catalog source if possible.
- Need recommended top MCPs surfaced prominently.
- Want OpenCode server to talk to MCPorter through a tool-wrapper layer instead of injecting every MCP tool directly.
- Goal includes token/context efficiency and selective tool hydration.
- Want repo/local skill guidance for current MCPorter setup included in plan.
- Need architecture to consider both cloud-hosted OpenCode and laptop-local OpenCode.
- Local/laptop mode must remain viable even without gateway running.
- Cloud mode may still store credentials with container/runtime in encrypted form if needed.

## Technical Decisions <!-- oc:id=sec_ac -->
- MCPorter policy skill says MCPorter is discovery/auth/health/discovery/execution control plane.
- MCP tool exposure policy: small meta-surface (`mcp.search`, `mcp.describe`, `mcp.call`, optional `mcp.status`) rather than full schema dump.
- Connection UI should be catalog-first with setup states, tool browser, and safe test control.
- Existing provider connection UI is best reuse pattern for MCP connection UX.

## Research Findings <!-- oc:id=sec_ad -->
- Existing provider settings UI already supports searchable catalog, connect dialog, API key forms, OAuth browser launch, polling/callback, and hot refresh via `client.global.dispose()`.
- Existing MCP UI in repo is read-only posture/visibility only; no add/edit/install wizard found.
- Official MCP Registry exists at `https://registry.modelcontextprotocol.io/` and is intended as upstream source for downstream marketplaces.
- OpenCode docs support MCP config under `mcp`, local and remote servers, OAuth for remote MCPs, and manual auth commands.
- MCPorter skill references catalog building from `mcporter list <server> --schema --json` and CLI fallback via `mcporter call`.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: UX planning, architecture options, data flows, cloud/local credential strategies, MCP catalog strategy, runtime wrapper/tool-injection strategy, phased implementation tasks.
- EXCLUDE: actual implementation, production secret-store selection lock-in, exhaustive provider-specific OAuth app setup.

## Open Questions <!-- oc:id=sec_af -->
- Exact MCPorter credential file/schema and supported import/export/login flows still being researched.
- Exact OpenCode SDK/API seam for mutating `mcp` config from UI still being validated.
- Need final decision on cloud secret model: proxy-first, local-disk-first, or hybrid.