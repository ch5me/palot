# Task 12 Local-Only Proof <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

Local desktop credential architecture:

- `mode = local-desktop`
- `callbackOwnership = desktop-loopback`
- `recoveryPolicy = local-only`
- `hushTargets = [none]`
- `gatewayPersistence = not_required`

Result: no-gateway laptop-local flow stands alone and does not require uploading secrets to gateway by default.