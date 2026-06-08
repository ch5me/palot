## 2026-06-07T23:00:00Z Task: foundation
Committed V2 foundation in 4 scoped commits:
- manifest + descriptor
- capability taxonomy
- tool projection + 9-state machine
- palot bridge first-party manifest exemplar

Key learnings:
- current apps/desktop biome setup only checks a small config file set via script; use `bun run lint` as repo-grounded lint signal, not direct per-file biome targeting.
- firefly-plugin namespace now exists under apps/desktop/src/shared/firefly-plugin/ and is safe place for shared V2 contracts.
- reserved command ids in manifest use short ids, not dotted host-style ids; plugin business tools use full namespaced ids.
- contribution family contracts should stay host-vocabulary-first: panels/widgets own placement contracts and escape-hatch eligibility; commands/themes stay chrome-safe, with theme preview/apply remaining host-owned.

## 2026-06-08T00:30:00Z Task: api-versioning
Added `apps/desktop/src/shared/firefly-plugin/api-versioning.ts` (+ test) and exported from `index.ts`.

Encoded:
- tier vocabulary `["stable", "proposed", "internal"]` (API_TIERS), with `internal` never available to non-built-in trust and `proposed` always marked unstable.
- manifest revision rule table (MANIFEST_REVISION_RULES) keyed by integer revision, each entry carrying `minHostVersion`, tier, and optional deprecation. negotiation helpers reject revisions below MIN_MANIFEST_REVISION, above MAX_MANIFEST_REVISION, beyond hostKnownMaxRevision, below the per-revision `minHostVersion` floor, or unknown in the table.
- `negotiateApiVersion` folds in the manifest's optional `engines.desktop` floor so the catalog loader gets a single decision.
- separate sub-manifest surface revision tables for `tool-result-envelope`, `bridge`, and `inspection-tool` so bridge/tool/inspection schema evolution is auditable in one place, with their own `negotiateBridgeSchema` / `negotiateToolResultEnvelope` / `negotiateInspectionToolSet` wrappers.
- `deprecationPolicySchema` with concrete fields `replacement` (required), `removalTarget` (semver), `removalRevision` (int <= MAX_MANIFEST_REVISION), `codemod` (codemodExpectationSchema), `migrationNote`. At least one of removalTarget/removalRevision is required.
- `codemodExpectationSchema` with availability `["none", "available", "required", "manual-only"]`, superRefine enforces the field-set rules: `required` and `available` need `codemodId`; `manual-only` needs at least one `manualStep`; `none` carries neither.
- `evaluateCodemodExpectation` and `computeDeprecationStatus` give migration tooling a structured decision.
- `annotateApiSurface` + `isApiSurfaceAvailableToTrust` + `isApiSurfaceUnstable` + `evaluateApiSurfaceAvailability` cover the per-surface tier gating.
- `summarizeApiSurface` produces a JSON-serializable summary for the operator UI.

Verification:
- `cd apps/desktop && bunx tsgo --noEmit` clean
- `cd apps/desktop && bun test src/shared/firefly-plugin/` — 139 pass, 0 fail (was 78, added 61 new tests in api-versioning.test.ts).

Key learnings:
- descriptor.ts already enforces `engines.desktop` floor; api-versioning layers on top with the manifest-revision-side floor. Two floors, one decision surface.
- comparison helper for manifest revisions stays purely numeric — semver compare is wrong for integer revisions, so kept them separate.
- deprecation policy requires *both* a replacement AND at least one of removalTarget/removalRevision. Silent deprecation (replacement-less) is a footgun; explicit removal window is non-negotiable.
- codemod superRefine had to reject `none` carrying a codemodId *and* reject `available`/`required` lacking one. Test cases lock both directions so the schema can't drift later.

## 2026-06-08T01:30:00Z Task: runtime-supervision
Added `apps/desktop/src/shared/firefly-plugin/runtime-supervision.ts` (+ test) and exported from `index.ts`.

Encoded:
- locked 11-state lifecycle state machine (`PLUGIN_LIFECYCLE_STATES` / `PLUGIN_LIFECYCLE_TRANSITIONS`) with terminal `removed`, transient `tearingDown` (the hot-reload boundary), and `quarantined -> discovered` re-entry after operator release. `isLifecycleTransitionAllowed`, `isLifecycleTerminalState`, `isLifecycleRunning`, `isLifecycleAcceptingCalls`, `isLifecycleQuarantined` are the predicates the runtime uses to decide what to do.
- failure class taxonomy `PLUGIN_FAILURE_CLASSES` covering every V2 plan §11.3 class: `init_crash`, `runtime_crash`, `hang`, `partial_activation`, `oom`, `load_failure`, `critical_security`, `manual_disable`, `manifest_mismatch`.
- `HeartbeatPolicy` (default 30s hang / 10s interval) + `isHangDetected(lastHeartbeatAt, nowMs, policy)`.
- `RestartBackoffPolicy` + `computeNextRestartDelayMs(attemptCount, policy, random01)` with capped exponential and injectable jitter.
- `CrashWindowPolicy` (default 5min window, 3-threshold for activation / runtime / hangs, 24h counter TTL, 50-deep history) + `crashCountWithin(history, windowMs, nowMs, failureClass?)` excluding future-stamped records.
- `PluginSupervisionState` (Zod-validated, JSON-serializable) + `createEmptyPluginSupervision`.
- `QuarantineRecord` (durable) + `quarantineRecordSchema` + `serializeQuarantineState` / `parseQuarantineRecord` (durable path = `~/.config/elf/firefly-client/quarantine.json`).
- `evaluateQuarantineTrigger({ state, failureClass, policy, nowMs })` — pure quarantine-trigger check that takes the post-append state and the failure class. Encodes the V2 plan §11.4 policy: 3 activation / 3 runtime / 3 hangs in window, immediate trips for critical_security / manifest_mismatch / load_failure / oom, persistent partial_activation only.
- `PluginSupervisionEvent` discriminated union (22 event kinds) + `applySupervisionEvent(prev, event, policy, nowMs)` — pure reducer. Returns `{ state, decision, transitions }`; `decision.action` is the host action: `none | spawn-worker | teardown-worker | restart-worker | stop-worker | purge-bundle | write-quarantine | clear-quarantine | notify-operator`.
- `buildOperatorOverrideEvent(pluginId, action, note)` translates the 6 operator actions (`enable` / `disable` / `quarantine` / `quarantine_release` / `hot_reload` / `purge`) into reducer events.
- `requestHotReloadDecision(state)` — pure policy check for the operator UI "what will happen if I click reload".
- `PluginSupervisionSummary` + `summarizePluginSupervision` for the operator panel and `plugins.lifecycle` inspection tool.
- `pluginLifecycle{Enable,Disable,Quarantine,Release,HotReload,History}ArgsShape` Zod arg shapes for the inspection tool.
- `DEFAULT_SUPERVISION_POLICIES` aggregate of the three defaults.

Verification:
- `cd apps/desktop && bunx tsgo --noEmit` clean
- `cd apps/desktop && bun test src/shared/firefly-plugin/` — 217 pass, 0 fail (was 139, added 78 new tests in `runtime-supervision.test.ts`).

Key learnings:
- contract-first means no main-process touch: this task is types + Zod + pure reducer only. The runtime worker spawn / teardown / IPC plumbing is downstream work (task 18, 22, 24, 25, 27, 28, 29). The reducer's `decision.action` vocabulary IS the API for the runtime — implement against the enum, not the state field.
- the reducer must thread `crashHistory` through both the trigger path AND the `failed` fallthrough path. First reducer draft had `transition("failed")` spreading `prev` (without the just-appended crash) and dropped the record. Fixed by a single `buildFailedFromCrash` helper that returns both the hydrated state and the trigger, then both branches merge `hydrated.crashHistory` into the result.
- hangStreak and `lastError` had to be carried into the `quarantined` transition explicitly — spreading `prev` (the pre-quarantine state) preserved the old (lower) hangStreak. Quarantine trips on the 3rd hang now correctly stamp `hangStreak=3` on the resulting state.
- `crashCountWithin` initially only checked the lower bound (`timestamp >= nowMs - windowMs`). A test with a future-stamped record (`9_001` against `nowMs=6_000`) failed because the future record was counted. Added the `timestamp > nowMs` exclusion to harden against clock skew — this is a contract the runtime depends on even if no test today stamps future records.
- `computeNextRestartDelayMs` exponent was originally `attemptCount - 1` so attempt 0 returned `baseMs * factor^0 = baseMs` (right) and attempt 1 returned `baseMs * factor^0 = baseMs` (wrong, should be `2x`). Switched to `attemptCount` directly with explicit docstring. Tests locked: attempt 0 = base, attempt 1 = 2x base, attempt 2 = 4x base, capped at maxMs.
- The `tearingDown` transient state is the auditable answer to "where is the worker during a hot reload?". Plan §11.2 implied this with prose ("teardown + restart boundary"); the contract now names the state and locks the `active|degraded -> tearingDown -> activating` triple. The runtime can `decision.action === "teardown-worker"` then `decision.action === "spawn-worker"` after `teardownComplete`, no implicit gap.
- Heartbeats are gated to running states (`activating | active | degraded | tearingDown`). A heartbeat in `failed` or `validated` is a no-op with `decision.action: "none"`. Test that wanted to reset `hangStreak` via heartbeat had to first bring the worker back up via `activationRequested -> activationSucceeded` — that's the right shape; a heartbeat on a dead worker would mask real hang detection.
- Quarantine file path is `firefly-client/quarantine.json` (XDG-relative, same as the `palot-plugin` runtime's existing storage). Runtime will resolve via XDG base directory at write time; the contract just records the relative path so future agents know the layout.
- `QUARANTINE_FILE_PATH` is exported as a `const` (`firefly-client/quarantine.json`) so the runtime layer can compose the absolute path against the XDG base directory without hardcoding it again.
- `restartBackoffPolicySchema` had a `.refine` that only rejects `maxMs < baseMs`. The original test used `baseMs: 1, maxMs: 1` (which satisfies `1 >= 1` so the refine passed). Replaced with `baseMs: 100, maxMs: 50` so the schema actually rejects it. Test cases must probe the refine path, not the field validators alone.
- Suppression note: biome ignores `apps/desktop/src/shared/` paths by design (per task 7 learning). `bun run lint` returned one pre-existing formatting error in `apps/server/src/services/mcp-connections.ts` — unrelated to this task. `tsgo --noEmit` is the real signal for the contract files.
- Contract consumers: Task 18 (hot reload implementation) reads `hotReloadRequested` + `tearingDown` + `teardownComplete`; task 22 (lifecycle UI) reads `summarizePluginSupervision` + `pluginLifecycleXxxArgsShape`; task 24 (operator override) reads `buildOperatorOverrideEvent`; task 25 (lifecycle persistence) reads `serializeQuarantineState` / `parseQuarantineRecord`; task 27 (risks) verifies the failure-class coverage; task 28 (verification) re-runs the test surface; task 29 (metering) reads `crashHistory` + `attempt` + `lastTransitionAt`.


## 2026-06-08T02:15:00Z Task: renderer-projection
Added `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` (+ test) and exported from `index.ts`.

Key learnings:
- Renderer projection needs a host-owned capability state snapshot baked into every availability reason so later UI migration can render gating without recomputing broker semantics.
- Collision reporting belongs at catalog scope, not single-descriptor scope: per-plugin manifests already reject local duplicates, so cross-plugin collisions are the real renderer risk surface for panels/widgets/commands/themes.
- Theme projection should stay a strict data envelope clone; no renderer registry types or host apply logic should leak into the shared contract layer.


## 2026-06-08T03:15:00Z Task: bridge-projection
Added `apps/desktop/src/shared/firefly-plugin/bridge-projection.ts` (+ test) and exported from `index.ts`.

Key learnings:
- OpenCode bridge projection should stay descriptor-pure: tool defs, system-context aggregation, hook subscription list, dispatch-path decision, and server-mode matrix all derive from `PluginDescriptor` without touching runtime modules.
- V2 bridge tool args must preserve raw `ZodRawShape` and separately expose `z.object(args).passthrough()` wrapper. Shared contract needs both surfaces because OpenCode registration wants raw shape semantics while tests need deterministic parse behavior.
- Initial rollout stance is source-level policy, not runtime folklore: managed server works; attached-no-install and attached-with-install both stay explicit `bridge_unsupported_server` rows until attached install path exists; offline/reconnect each map to their own canonical tool error codes.
- Bridge dispatch projection should expose both coarse plugin-level binding flags and per-tool binding summaries. Downstream host code needs quick yes/no answers for session binding plus stable per-tool rows for inspection/UI without re-deriving policy.
