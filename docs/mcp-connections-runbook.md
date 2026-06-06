# MCP Connections Runbook <!-- oc:id=sec_aa -->

Use this when Connections catalog, auth, runtime posture, or portability behavior needs operator recovery.

## Architecture <!-- oc:id=sec_ab -->

Connections is a first-class Settings surface for MCP servers.

- canonical connection model: `apps/desktop/src/renderer/lib/mcp-connections.ts`
- renderer surface: `apps/desktop/src/renderer/components/settings/connections-settings.tsx`
- main-process config mutation seam: `apps/desktop/src/main/mcp-connections-config.ts`
- runtime posture panel: `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx`
- compact runtime tools: `apps/desktop/.opencode/plugins/palot-bridge.js`

## Control plane <!-- oc:id=sec_ac -->

MCPorter remains the control plane for registration, auth, status, and probing.
Preferred CLI lane on this machine:

```bash
npx -y mcporter config add <name> <target>
npx -y mcporter config login <name>
npx -y mcporter auth <name>
npx -y mcporter list <name> --status
npx -y mcporter config logout <name>
```

## Credential modes <!-- oc:id=sec_ad -->

Defined in `apps/desktop/src/renderer/lib/mcp-connections.ts`:

- `local-desktop`
- `cloud-disposable`
- `hybrid-handoff`

Key rules:

- local desktop keeps secrets on-device by default
- cloud disposable requires durable gateway persistence
- handoff is one-shot, never live bidirectional token sync
- Hush runtime targets stay split: `runtime-dev`, `runtime-staging`, `runtime-production`

## Registry outage recovery <!-- oc:id=sec_ae -->

If the MCP registry is unavailable:

1. use cached catalog entries first <!-- oc:id=item_aa -->
1. prefer stale/offline cache responses over empty UI <!-- oc:id=item_ab -->
1. record freshness metadata in evidence <!-- oc:id=item_ac -->
1. avoid pushing renderer-only fetch hacks <!-- oc:id=item_ad -->

## Auth recovery <!-- oc:id=sec_af -->

If a connection shows `needs_auth` or `expired`:

1. inspect ownership mode <!-- oc:id=item_ae -->
1. rerun MCPorter auth/login flow <!-- oc:id=item_af -->
1. if local desktop, keep tokens local <!-- oc:id=item_ag -->
1. if cloud disposable, restore via gateway-backed flow <!-- oc:id=item_ah -->
1. reprobe with safe read action only <!-- oc:id=item_ai -->

## Local/cloud handoff <!-- oc:id=sec_ag -->

One-shot handoff only.

- local to cloud: export/adopt into gateway-backed flow, then reauth if needed
- cloud to local: import into local managed layer, then keep future secrets local
- do not share one refresh chain between both sides

## Safe reprobe <!-- oc:id=sec_ah -->

Use read-only probe behavior only.

- preferred: status/list probe through MCPorter
- never use mutating tools for health checks
- keep failure classes distinct: env/config vs auth vs offline/runtime