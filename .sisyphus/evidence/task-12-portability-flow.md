# Task 12 Portability Flow <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## One-shot handoff policy <!-- oc:id=sec_ab -->

`McpCredentialArchitecture.allowedHandoffDirections` defines only explicit one-shot directions.
There is no ongoing sync surface.

- local desktop: `local_to_cloud`
- cloud disposable: `cloud_to_local`
- hybrid handoff: both directions, but with `reauth-required` recovery and no shared refresh ownership

## Safe portability <!-- oc:id=sec_ac -->

- local-only mode keeps `gatewayPersistence = not_required`
- cloud/handoff modes require gateway persistence for durable restore
- `forbiddenSyncPatterns` explicitly reject shared refresh chains and live bidirectional token sync