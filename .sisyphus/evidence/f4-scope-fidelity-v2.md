# F4 — Scope Fidelity / Anti-Creep Audit <!-- oc:id=sec_aa -->

## Scope cleanliness checklist <!-- oc:id=sec_ab -->

| Scope guardrail | Evidence | Status |
|---|---|---|
| No marketplace product buildout | Task 24 lifecycle UI, Task 25 roadmap (v2.2+ defer), Task 27 risks | PASS |
| No runtime `vscode` API shim / hidden VS Code sidecar | Task 23 VS Code import classifier + transpile architecture | PASS |
| No full theme-studio rewrite | Task 16 theme pipeline, Task 25 roadmap | PASS |
| No generic app platform sprawl | plan §`Must NOT Have`, Task 26 implementation matrix (bounded package split) | PASS |
| No hidden first-party privileged path | Task 19 first-party migration, Task 21 first-party exemplar | PASS |
| Theme support stays contribution + mapping/runtime application only | Task 16 theme pipeline, Task 4 theme runtime | PASS |
| VS Code import remains classifier/transpile-only | Task 23 VS Code import | PASS |

## Violations or near-misses <!-- oc:id=sec_ac -->

No actual scope violations.

Near-misses that the evidence explicitly prevents:

- **VS Code import** could have drifted into runtime shim; Task 23 keeps it transpile-only and names RED-tier reject reasons.
- **Theme work** could have drifted into a token studio; Task 16 keeps themes data-only and app-scoped.
- **Plugins panel** could have drifted into marketplace discover/rank UX; Task 24 keeps it lifecycle/inventory only.
- **Attached-server support** could have ballooned into v2.0; Task 14 explicitly defers the generalized install path to v2.1.
- **First-party migration** could have left legacy side panels on a bypass path; Task 19 requires all 18 side panels to migrate.

## Verdict <!-- oc:id=sec_ad -->

Scope [CLEAN] | Guardrails [PASS] | VERDICT: APPROVE