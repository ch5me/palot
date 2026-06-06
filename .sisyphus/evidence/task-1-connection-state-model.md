# Task 1 Connection State Model <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Required state coverage <!-- oc:id=sec_ab -->

- Connection source: `registry | curated | imported | manual`
- Transport: `remote-http | remote-sse | local-stdio`
- Ownership mode: `local-only | cloud-only | handoff-derived`
- Canonical store: `local | gateway`
- Install state: `not_installed | installing | installed`
- Auth state: `unknown | not_required | needs_auth | authenticated | expired | failed`
- Runtime state: `not_projected | projected | active | degraded | offline`
- Test state: `untested | passing | failing`
- User-facing status: `connected | needs_auth | missing_env | degraded | offline | testing | installing | configured`

## Projection rule proof <!-- oc:id=sec_ac -->

`McpProjectionTarget` keeps projection separate from canonical record:

- `openCode` holds projected OpenCode MCP config only.
- `mcporter` holds control-plane projection metadata only.
- `McpConnectionRecord` remains canonical source for UI and ownership semantics.

## Status precedence proof <!-- oc:id=sec_ad -->

`deriveMcpConnectionStatus()` applies explicit precedence:

1. `installing` <!-- oc:id=item_aa -->
1. `testing` when probe failed <!-- oc:id=item_ab -->
1. `offline` <!-- oc:id=item_ac -->
1. `missing_env` <!-- oc:id=item_ad -->
1. `needs_auth` <!-- oc:id=item_ae -->
1. `degraded` <!-- oc:id=item_af -->
1. `connected` <!-- oc:id=item_ag -->
1. fallback `configured` <!-- oc:id=item_ah -->

This covers plan-required visible states: connected, needs_auth, missing_env, degraded, offline, testing, installing.