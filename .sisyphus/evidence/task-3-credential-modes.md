# Task 3 Credential Modes <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Supported modes <!-- oc:id=sec_ab -->

`McpCredentialMode` defines three explicit modes:

- `local-desktop`
- `cloud-disposable`
- `hybrid-handoff`

## Ownership and callback policy <!-- oc:id=sec_ac -->

`McpCredentialArchitecture` captures:

- callback owner
- token storage surface
- recovery policy
- token sync policy
- forbidden sync patterns
- allowed handoff directions

## Mode mapping <!-- oc:id=sec_ad -->

`createMcpCredentialArchitecture()` maps each mode to a concrete policy:

- local desktop: desktop loopback + local-only recovery
- cloud disposable: gateway proxy + cloud restore
- hybrid handoff: device code + reauth-required fallback

This covers local-only mode, cloud-hosted mode, and handoff-derived portability as required by task 3.