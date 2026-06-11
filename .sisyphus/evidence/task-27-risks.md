# Task 27 — Risk Register and Mitigations <!-- oc:id=sec_aa -->

> Wave 5, Task 27 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## 1. Risk register <!-- oc:id=sec_ab -->

| ID | Risk | Severity | Detection | Mitigation | Fallback |
|---|---|---|---|---|---|
| R-01 | React singleton drift: 2 React instances render concurrently, hooks fail | Critical | runtime warning: "Invalid hook call" in dev tools; renderer.test.ts mounts plugin + host and asserts single React copy | `react` / `react-dom` marked external in all plugin esbuild configs; reconciler surface default; iframe escape hatch enforces single-instance `sandbox` | if detected, force a single React via `externals` and reload affected plugin |
| R-02 | Bridge version skew: plugin manifest expects newer host version | High | `manifest.fireflyClientVersion > host.supported` -> activation rejected with `errorCode: host_version_too_new` | host carries a `fireflyClientVersion` matrix; unknown version rejects activation; known-but-newer is downgrade, not crash | operator UI surfaces the version gap and links to migration doc |
| R-03 | Crash loop: bad plugin re-spawns 3 times in 5 min | High | lifecycle supervisor counts crashes in 5-min window | supervisor triggers `quarantined` posture automatically; activation disabled until operator clear; audit log entry | operator manual clear via `plugin.<id>.lifecycle.quarantine.clear`; auto-decay after 24h |
| R-04 | Capability violation: plugin asks for cap not in manifest | Critical | broker refuses with `errorCode: capability_violation` | first violation: warning + capability request prompt; second: `quarantined`; audit entry | uninstall + reinstall at corrected manifest; rollback within 14-day window |
| R-05 | Permission fatigue: users get spammed with prompts | Medium | prompt count per session exceeds 5/min | debounce: one summary prompt per session; one-time per `(pluginId, capability, scope)` grant cache; revoke to reset | per-plugin "Always deny this" toggle |
| R-06 | Theme precedence bug: user pick loses to plugin update | High | regression test: user picks theme X, plugin update applies theme Y -> user-pick must win | 5-row precedence matrix in Task 16 evidence; picked-theme uninstall sticky; preview never mutates | reset via `plugin.theme.reset` or fall back to bundled default |
| R-07 | Attached-server ambiguity: user attaches to pre-existing OpenCode without V2 bridge | High | server-mode matrix evaluator returns `bridge_unsupported_server`; operator UI shows badge | `bridge_unsupported_server` shown inline; `plugin install` denied; v2.1 install pathway scheduled | user can spawn a new managed server, or keep using the attached server without plugin V2 features |
| R-08 | Plugin code in main process: someone bypasses host | Critical | lint rule: any `import('child_process')` from `apps/desktop/src/main/` is rejected unless explicitly allow-listed | Wave 5 gates include a CI check that runs the lint and fails on any non-allow-listed usage | host exits with explicit error if main process ever spawns plugin code |
| R-09 | Theme contributions exceed CSS budget | Medium | renderer measures `getComputedStyle` time during preview | per-plugin theme contribution capped at 16 KB compressed; rejected on overflow | plugin author can split theme into multiple contributions |
| R-10 | Tool call cancellation race: agent cancels during running, plugin keeps writing | Low | 9-state machine; `cancelled` terminal with `cancellationSource`; subsequent writes are dropped | plugin worker respects cancellation token; broker returns `cancelled` envelope | any side effects already committed are reverted where possible |
| R-11 | Plugin storage quota exhaustion | Low | per-plugin quota per scope | quota exceeded -> request rejected with quota error | user can purge or expand quota |
| R-12 | Marketplace discover UX scope creep into V2 | High | "no marketplace product" guardrail | Wave 5 plan has explicit non-goal; F4 audit verifies | nothing falls back; v2.2+ workstream is separate |
| R-13 | AI cost attribution is hard to compute | Medium | per-plugin `firefly-client.broker.<pluginId>.bytes.accessed` counter | counters roll up per session, per day, per plugin; surfaced in operator UI | manual capping per plugin at install time |
| R-14 | Plugin worker memory leak | High | worker exceeds 256 MB heap | supervisor forces quarantine; activation requires raised cap to retry | operator override with audit entry; rollback within 14 days |
| R-15 | Audit log fills disk | Low | monthly rotation at 100 MB | NDJSON append + rotate; operator UI shows total + oldest entry | operator-triggered archive |

## 2. High-severity risk details <!-- oc:id=sec_ac -->

- R-01 (React singleton): Wave 1 evidence (Task 1) and Wave 3 evidence (Task 13) both pin this. The reconciler surface default is the safe path; the iframe escape hatch must be audited.
- R-02 (Bridge version skew): Wave 2 evidence (Task 12) explicitly handles this with `stable | proposed | internal` tiers and `fireflyClientVersion` semver pin. Wave 1 evidence (Task 2) shows the current bridge already does version checks at load.
- R-03 (Crash loop): Wave 1 evidence (Task 6) defines the quarantine posture. Wave 2 evidence (Task 11) defines the supervisor.
- R-04 (Capability violation): Wave 2 evidence (Task 10) defines the broker denial path. Wave 2 evidence (Task 11) wires capability violation into quarantine.
- R-06 (Theme precedence): Wave 3 evidence (Task 16) defines the 5-row matrix.
- R-07 (Attached server): Wave 3 evidence (Task 14) defines the server-mode matrix.
- R-08 (Plugin in main): Plan guardrail `No plugin code in main process`. Wave 5 Task 26 names the package boundary.
- R-12 (Scope creep): Plan guardrail `No generic marketplace/discovery product scope`. F4 audit verifies.
- R-14 (Memory leak): Wave 2 evidence (Task 11) defines worker resource limits.

All high-severity risks have mitigations in earlier waves. No risk is unaddressed.