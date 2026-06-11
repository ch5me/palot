# F1 — Plan Compliance Audit <!-- oc:id=sec_aa -->

## Must Have checklist <!-- oc:id=sec_ab -->

| Must Have | Evidence | Status |
|---|---|---|
| One manifest/runtime path for first-party and third-party plugins | Task 7 manifest schema, Task 19 first-party migration, Task 22 third-party exemplar | PASS |
| One unified contribution model for panels, widgets, commands, themes, and tools | Task 8 family contracts, Task 13 renderer projection, Task 17 commands projection, Task 16 theme pipeline | PASS |
| All existing first-party side panels migrate onto the plugin system | Task 19 first-party migration (all 18 side-panel ids + 1 defer row) | PASS |
| Host-owned DOM/rendering by default | Task 8 family contracts, Task 13 renderer projection, plan guardrail `No direct plugin DOM mutation in host renderer` | PASS |
| Zod-backed agent tool schemas and bridge payloads | Task 7 manifest, Task 9 tool projection, Task 14 bridge projection | PASS |
| Session-scoped plugin control semantics for OpenCode | Task 9 tool projection, Task 14 bridge projection | PASS |
| Clear capability broker and deny-by-default authority model | Task 10 capability broker | PASS |
| Firefly-specific capabilities for bridge/session/UI/browser/theme control explicitly modeled | Task 10 capability broker capability taxonomy | PASS |
| Migration path from current registries and Palot bridge | Task 19 first-party migration, Task 20 bridge migration | PASS |

## Must NOT Have checklist <!-- oc:id=sec_ac -->

| Must NOT Have | Evidence | Status |
|---|---|---|
| No plugin code in main process | plan §`Must NOT Have`, Task 11 isolation, Task 26 package split | PASS |
| No direct plugin DOM mutation in host renderer | plan guardrail, Task 8 family contracts, Task 13 renderer projection | PASS |
| No separate hidden first-party runtime bypassing plugin manifest path | plan guardrail, Task 19 migration, Task 21 first-party exemplar | PASS |
| No runtime `vscode` API shim or hidden VS Code sidecar | plan guardrail, Task 23 VS Code import | PASS |
| No generic marketplace/discovery product scope | plan guardrail, Task 24 lifecycle UI, Task 25 roadmap (defer to v2.2+) | PASS |
| No full theme-studio/platform rewrite | plan guardrail, Task 16 theme pipeline, Task 25 roadmap | PASS |
| No arbitrary native dependency support for AI-authored plugins in V2 | plan guardrail, Task 22 third-party exemplar | PASS |
| No agent tool path bypassing plugin capabilities, session scope, or Zod validation | Task 9 tool projection, Task 10 capability broker, Task 14 bridge projection | PASS |

## Verdict <!-- oc:id=sec_ad -->

Must Have [9/9] | Must NOT Have [8/8] | VERDICT: APPROVE