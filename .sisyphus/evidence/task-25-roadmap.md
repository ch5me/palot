# Task 25 — Unified Phased Roadmap and Milestones <!-- oc:id=sec_aa -->

> Wave 5, Task 25 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Reads: all Wave 1-4 evidence.

## 1. Phase structure <!-- oc:id=sec_ab -->

Five phases, each a release candidate. Two earlier phases are the load-bearing risk reducers: source-of-truth canonicalization, then first vertical slice.

| Phase | Codename | Theme | Release gate |
|---|---|---|---|
| P0 | `v2.0-alpha-1` | manifest + broker + projection | internal testing |
| P1 | `v2.0-alpha-2` | first vertical slice (`palot.review-panel`) | internal testing |
| P2 | `v2.0-beta-1` | remaining first-party migration | opt-in beta |
| P3 | `v2.0-rc-1` | attached-server generalized install pathway (v2.1 deferred) | release candidate |
| P4 | `v2.0-ga` | marketplace discover UX in v2.2+ (deferred) | general availability |

Each phase has a hard exit criterion and a set of acceptance gates from Task 28.

## 2. Milestones with exit criteria <!-- oc:id=sec_ac -->

| # | Milestone | Phase | Exit criterion |
|---|---|---|---|
| M0 | Source-of-truth canonicalization | P0 | `firefly-surface-registry.tsx`, `session-widget-registry.tsx`, `command-palette.tsx` (commands), and theme definitions all reduced to consumers over host projection. Manifest schema accepted into `packages/firefly-client-sdk`. Plugin runtime `utilityProcess` + `worker_thread` skeleton passes a hello-world built-in. |
| M1 | First vertical slice | P1 | `palot.review-panel` plugin installed, enabled, surfaces panel, command, and `list_changed_files` tool end-to-end. Dev reload works. Quarantine triggers on a seeded fault. Operator UI shows the plugin with all required fields populated. |
| M2 | Remaining first-party migration | P2 | Every one of the 18 current first-party side panels is owned by a built-in plugin and rendered via the same renderer projection. No regression in any of the 18 panels' V1 behaviors. |
| M3 | Bridge generalization | P3 | Attached-server install pathway implemented. v2.1 explicitly deferred workstream spec is in tree. Server-mode matrix passes all 5 rows end-to-end (managed, attached-without, attached-with, offline, reconnect). |
| M4 | General availability | P4 | All F1-F4 review quartet pass. All release gates pass. No high-severity risk without mitigation in register. |

## 3. Dependency gates <!-- oc:id=sec_ad -->

- P0 blocks Wave 2 (manifest + contracts) finishing. Without manifest Zod shape, no projection can be locked.
- M1 blocks P2. Without a working vertical slice, we cannot prove the runtime holds under real first-party use.
- M2 blocks P3. The migration must complete before we expose the bridge pathway broadly.
- M3 blocks P4. The attached-server path is the last large architectural surface; it must work in RC before GA.
- P0 depends on `Capability` enum in plan being concrete enough. Task 10 evidence already pins that.

## 4. Defer decisions <!-- oc:id=sec_ae -->

- Attached-server generalized install: P3 only. v2.1 workstream documented in Task 14 evidence.
- Marketplace browse / discover / rank: explicitly out of scope. v2.2+, separate workstream.
- VS Code import importer: P3 (after v2.0 ships). Wave 4 evidence already specifies classifier + transpile.
- AI plugin authoring auto-loop: deferred beyond v2.0. v2.1+ consideration. Plan is read-only; this is for future architecture work.

## 5. Risk callouts (from Task 27) <!-- oc:id=sec_af -->

- Attached-server limitation discovered late in plan: Wave 4 evidence (Task 14) names `bridge_unsupported_server` error code; that error must surface in operator UI from day one.
- React singleton drift: 1 React instance required for all plugin UI. Reconciler surface default keeps this natural; iframe escape hatch requires explicit `sandbox` and `src` host verification.
- Crash loop / capability violation: quarantine posture must survive restart, must have operator manual override, must show in operator UI. Wave 4 evidence (Task 6, Task 11) already pins this.
- Permission fatigue: capability grant UI must show real consequences, not just capability names. Wave 4 evidence (Task 10, Task 24) already pins this.
- Theme precedence bugs: preview must not mutate applied theme; picked-theme uninstall must keep host graceful. Wave 3 evidence (Task 16) already pins this.