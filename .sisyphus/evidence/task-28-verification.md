# Task 28 — Verification Matrix and Release Gates <!-- oc:id=sec_aa -->

> Wave 5, Task 28 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## 1. Gate levels <!-- oc:id=sec_ab -->

Three confidence bands. Each band has explicit obligations, executable in the current repo.

| Level | Trigger | Time budget | Owner |
|---|---|---|---|
| **local** | any dev change touching plugin runtime, bridge, renderer, or themes | 5-10 min | implementer |
| **pre-merge** | PR opened, before merge to main | 15-30 min | reviewer + CI |
| **release** | cut a release candidate | 2-4 h | release captain + agent QA |

Per plan §`QA Policy`, agent QA is mandatory for every implementation task in the future. Wave 5 evidence is the contract.

## 2. Per-workstream gate obligations <!-- oc:id=sec_ac -->

### Runtime (host + plugins) <!-- oc:id=sec_ad -->

- local: `bun run lint` + `bun run check-types` + targeted bun test in `packages/firefly-client-host`
- pre-merge: above + host runtime fixture that boots `palot.review-panel` (the Wave 4 Task 21 exemplar) and asserts panel mounts, command appears in palette, `list_changed_files` tool returns expected shape
- release: above + crash recovery test (kill worker, expect quarantine) + capability denial test + cleanup

### Bridge (OpenCode bridge) <!-- oc:id=sec_ae -->

- local: bridge schema validation tests + Zod parse against every current tool args shape
- pre-merge: above + server-mode matrix fixture covering all 5 rows (managed, attached-without, attached-with, offline, reconnect) with canonical error codes
- release: above + managed OpenCode live test that exercises `browser_navigate`, `open_side_panel`, `list_changed_files`, plus failure path `bridge_unsupported_server`

### Renderer (renderer projection) <!-- oc:id=sec_af -->

- local: per-family derivation shim test (panels, widgets, commands, themes) + availability state matrix tests
- pre-merge: above + 18 first-party side panels render via projection shim, no regression
- release: above + hot-reload fixture (edit plugin, verify renderer projection stream updates, no flicker)

### Themes (theme contribution) <!-- oc:id=sec_ag -->

- local: 5-row precedence matrix fixture + picked-theme uninstall sticky + preview-doesn't-mutate
- pre-merge: above + JSONC parse + host fallback chain
- release: above + three imported themes from Open VSX applied cleanly + revert path

### Operator UI <!-- oc:id=sec_ah -->

- local: capability-grant UI consequence rendering per capability
- pre-merge: 11 operator actions all map to V2 commands
- release: end-to-end operator run (install, enable, quarantine, clear, uninstall)

## 3. Reality check <!-- oc:id=sec_ai -->

The repo already has:
- `bun run lint` (Biome) — works
- `bun run check-types` (TypeScript) — works
- `bun test` in `packages/configconv` — works
- `bun run dev` and `bun run svc:status` (devmux) — works
- `apps/desktop` Electron-vite + Vite 6 + React 19 setup — works

The repo does NOT have:
- comprehensive E2E test infrastructure
- Playwright integration with plugin workers
- Load testing harness for plugin count

The release gate must not depend on infrastructure we don't have. Where E2E is required, agent-executed runtime scenarios (per plan §`QA Policy`) substitute. Load tests are deferred beyond v2.0 GA.

## 4. Manual + automated lanes <!-- oc:id=sec_aj -->

- automated: lint, typecheck, unit tests, JSONC validation, Zod parse, projection derivation tests
- manual: capability grant prompt UX, operator UI consequence readability, theme preview visual check, hot-reload UX feel
- agent-executed: full plugin install + activate + tool call + crash + recovery, server-mode matrix end-to-end, first-party migration smoke

The `agents.qa` skill (already in repo as `agent-eval-team`) is the official manual + agent-execution lane.

## 5. Release gate per phase (from Task 25) <!-- oc:id=sec_ak -->

| Phase | Release gate | Required passes |
|---|---|---|
| P0 alpha-1 | all local + pre-merge + Wave 2 review quartet | gate levels: local + pre-merge for host + bridge + renderer + themes + operator UI |
| P1 alpha-2 | all + vertical slice demo + Wave 3 review quartet | adds M1 demonstration |
| P2 beta-1 | all + first-party migration smoke + Wave 4 review quartet | adds 18-panel migration smoke |
| P3 rc-1 | all + attached-server install smoke + Wave 5 review quartet | adds M3 demonstration |
| P4 GA | all + F1-F4 audit pass | final sign-off |

A release is blocked if any high-severity risk lacks an executed mitigation, regardless of which gate passed.