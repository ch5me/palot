# Task 10 Remediation Labels <!-- oc:id=sec_aa -->

Source: `apps/desktop/src/renderer/lib/mcp-connections.ts`

## Offline <!-- oc:id=sec_ab -->

- label: `Offline`
- action: `reconnect_runtime`
- meaning: runtime unreachable at all

## Degraded <!-- oc:id=sec_ac -->

- label: `Degraded`
- action: `reprobe`
- meaning: runtime exists but health/probe is failing non-fatally

## Missing env vs needs auth <!-- oc:id=sec_ad -->

- `Missing environment` -> `open_env_setup`
- `Needs auth` -> `retry_auth`

These labels ensure users get different remediation prompts instead of a flat enabled/disabled state.