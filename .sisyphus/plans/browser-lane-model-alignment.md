# Browser Lane Model Alignment

## TL;DR
> **Summary**: Realign Palot browser lanes around one primary concept — rendered surface kind — and push runtime ownership, deployment location, and CDP into separate explicit concepts. Remove the current overlap between `mode`, `runtime`, and `surfaceKind`, migrate persisted data safely, and rebuild the browser panel UX so operators configure the right thing first.
> **Deliverables**:
> - Canonical browser surface domain model and migrated registry contract
> - Main-process and server lifecycle logic branched by runtime ownership instead of faux top-level mode
> - Browser panel UX rebuilt around `direct-iframe` vs `selkies-stream`
> - Surface-aware health/status model and copy
> - Compatibility migration, tests, and operator docs
> **Effort**: Large
> **Parallel**: YES - 4 waves
> **Critical Path**: contract rename + migration -> manager/server lifecycle rewrite -> browser panel UX rebuild -> verification matrix

## Context
### Original Request
Write a plan for where the browser lane system is now and where it needs to be so it matches the desired design: first choose whether the surface is a direct iframe or a Selkies stream; then configure whether the runtime is locally managed or externally attached; then optionally describe whether the runtime happens to live locally or remotely. CDP should be orthogonal.

### Interview Summary
- Current code exposes three overlapping axes: `mode`, `runtime`, and `surfaceKind`.
- Desired product model is simpler: surface kind is primary; runtime ownership is secondary; deployment location is tertiary metadata; CDP is optional capability.
- `direct-iframe` means “render this target URL”, with no Selkies assumptions and no fake degraded CDP state.
- `selkies-stream` means “render a stream surface”, optionally with CDP, regardless of whether Palot manages the backing runtime locally or attaches to an existing remote/local runtime.
- Existing user-facing status/copy such as `Profile exists but runtime has not started yet` is valid only for managed-local lanes and should not leak into attached/external flows.

### Metis Review (gaps addressed)
- Preserve backward compatibility while changing shared types, registry rows, preload contract, and server route seams simultaneously.
- Separate health semantics for `direct-iframe` vs `selkies-stream`; do not reuse one stream/CDP model blindly.
- Keep the Electron main-process manager and browser-mode dev server route behavior in lockstep; drift here would create false confidence.
- Explicitly decide invalid combinations rather than silently allowing them.
- Include session binding and protocol/proxy seams in scope because they currently depend on the old model.

## Work Objectives
### Core Objective
Ship a decision-complete browser lane model where:
- surface kind answers “what the panel renders?”
- runtime ownership answers “who starts/stops the backing runtime?”
- deployment location answers “where does that runtime happen to live?”
- CDP answers “can automation control this surface?”

### Deliverables
- Canonical domain model replacing the ambiguous `mode` / `runtime` split.
- Durable registry format with versioned migration from existing lane records.
- Main-process lane manager that branches on runtime ownership (`managed-local` vs `attached`) and surface kind (`direct-iframe` vs `selkies-stream`).
- Server/browser-mode mirror route with the same semantics.
- Rebuilt browser panel create/edit/status UX.
- Surface-specific status copy, summaries, and action gating.
- Updated protocol/proxy behavior so Selkies-only features do not touch direct-iframe surfaces.
- Tests covering model migration, lifecycle branching, and panel behavior.
- Updated docs/runbook for operators.

### Definition of Done
- [ ] No persisted or runtime model uses `mode` as the primary user-facing concept.
- [ ] Shared types expose explicit `surfaceKind`, runtime ownership, and deployment location.
- [ ] Existing saved lane rows migrate without data loss.
- [ ] `direct-iframe` lanes never surface fake Selkies/CDP failure states.
- [ ] `managed-local` logic is the only path that creates runtime files, profile dirs, or runs Docker Compose.
- [ ] `attached` logic never attempts runtime generation or startup.
- [ ] Browser panel create flow starts with surface kind, then runtime ownership, then only relevant config fields.
- [ ] Actions are conditionally visible and valid only for compatible lane types.
- [ ] Electron protocol/proxy and browser-mode server route both preserve direct-iframe semantics and Selkies-specific behavior correctly.
- [ ] Typecheck, targeted tests, and lane verification scenarios pass.

### Must Have
- Explicit invalid-combination handling: `direct-iframe + managed-local` is unsupported and blocked.
- Backward-compatible migration for `~/.config/elf/browser-lanes/lanes.json`.
- Surface-aware health model with `not-applicable` automation/readiness state where needed.
- Session binding resolution preserved: session-bound lane first, global fallback second.
- One canonical glossary used across types, UI copy, tests, and docs.

### Must NOT Have
- No silent inference that changes saved user intent across launches.
- No “remote means attached stream” shortcut in user-facing copy.
- No Selkies page-shim injection for direct-iframe surfaces.
- No Docker/profile/runtime operations for attached lanes.
- No direct-iframe lane blocked on CDP configuration.
- No broad browser-fleet orchestration, multi-panel scheduling, or cloud-control-plane redesign in this plan.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using Bun tests + typecheck + targeted route/UI verification
- QA policy: Every task includes agent-executed scenarios and captured evidence
- Evidence: `.sisyphus/evidence/browser-lane-model-alignment/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. Shared seams come first.

Wave 1: domain contract, glossary, migration spec, health semantics
Wave 2: main-process + server lifecycle/model rewrites
Wave 3: renderer/browser panel UX, session binding, protocol/proxy updates
Wave 4: docs, migration proof, regression verification

### Dependency Matrix
- 1 -> 2, 3, 4, 5, 6, 7, 8
- 2 -> 4, 5, 6, 9
- 3 -> 4, 5, 6, 9
- 4 -> 7, 8, 9
- 5 -> 7, 8, 9
- 6 -> 7, 8, 9
- 7 -> 10
- 8 -> 10
- 9 -> 10

### Agent Dispatch Summary
- Wave 1 -> 3 tasks -> `deep`, `api-design`, `writing`
- Wave 2 -> 3 tasks -> `deep`, `unspecified-high`, `deep`
- Wave 3 -> 3 tasks -> `visual-engineering`, `deep`, `quick`
- Wave 4 -> 1 task -> `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.
> Defaults applied in this plan: `direct-iframe + managed-local` invalid; session-bound preferred lane stays in scope; deployment location remains explicit metadata.

- [x] 1. Define the canonical browser surface glossary and target type model

  **What to do**: Replace the conceptual center of gravity in shared contracts. Introduce explicit fields for `surfaceKind`, runtime ownership (`managed-local` vs `attached`), and deployment location metadata. Split `targetUrl` from `streamBackendUrl`, define CDP as orthogonal automation config, and document invalid combinations directly in the type layer and helper docs.
  **Must NOT do**: Do not leave `mode` as a first-class primary concept in public contracts. Do not reuse one URL field for both direct-iframe targets and Selkies stream upstreams.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: canonical cross-process type redesign
  - Skills: [`api-design`] — crisp contract and compatibility design
  - Omitted: [`agent-browser`] — no browser execution needed for type work

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2,3,4,5,6,7,8 | Blocked By: none

  **References**:
  - `apps/desktop/src/shared/browser-lanes.ts:4`
  - `apps/desktop/src/preload/api.d.ts:14`
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:127`
  - `.sisyphus/drafts/browser-panel-mode-split.md:42`

  **Acceptance Criteria**:
  - [ ] Shared/browser/preload lane types expose `surfaceKind`, runtime ownership, and location metadata explicitly.
  - [ ] Direct-iframe config is represented by target URL, not stream URL.
  - [ ] Selkies config distinguishes stream surface URL from optional CDP endpoint.
  - [ ] Invalid combinations are typed or validated explicitly.

  **QA Scenarios**:
  ```text
  Scenario: type model expresses valid combinations only
    Tool: Bash
    Steps: Run `bun run check-types` after updating shared/preload/renderer type consumers.
    Expected: Typecheck passes with no remaining references that require old primary `mode` semantics.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-1-contract-typecheck.txt

  Scenario: helper summaries do not mislabel direct iframe lanes as streams
    Tool: Bun test
    Steps: Add/update tests around shared helper summarization for direct-iframe vs Selkies lane inputs.
    Expected: Direct iframe summary says iframe/target semantics; Selkies summary says stream/CDP semantics.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-1-contract-tests.txt
  ```

  **Commit**: YES | Message: `refactor(browser-lanes): define surface-first lane model` | Files: `apps/desktop/src/shared/browser-lanes.ts`, `apps/desktop/src/preload/api.d.ts`, related type consumers

- [x] 2. Design and implement registry migration with backward compatibility

  **What to do**: Version the browser-lane record shape and add migration logic for existing rows in `~/.config/elf/browser-lanes/lanes.json`. Map current records into the new model deterministically, preserve user intent, and keep the migration idempotent. Include migration coverage for default lane creation and empty/partial legacy rows.
  **Must NOT do**: Do not rewrite user-configured external lanes into different semantic combinations based on guesswork. Do not require manual registry edits.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: persistence migration risk surface
  - Skills: [] — project-local seam is enough
  - Omitted: [`api-design`] — already applied in task 1

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4,5,6,9 | Blocked By: 1

  **References**:
  - `apps/desktop/src/main/browser-lane-manager.ts:48`
  - `apps/server/src/routes/browser-lanes.ts:30`
  - `apps/desktop/src/shared/browser-lanes.ts:51`
  - `.sisyphus/drafts/browser-panel-mode-split.md:55`

  **Acceptance Criteria**:
  - [ ] Legacy rows load into the new in-memory model without data loss.
  - [ ] Re-running migration on already-migrated rows is a no-op.
  - [ ] Default lane generation produces the new canonical record shape.

  **QA Scenarios**:
  ```text
  Scenario: migrate legacy lane rows
    Tool: Bun test
    Steps: Feed fixtures covering legacy local Selkies, legacy remote attached Selkies, and legacy direct iframe-ish rows.
    Expected: Output rows match expected canonical fields exactly.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-2-migration-fixtures.txt

  Scenario: startup with empty or malformed registry
    Tool: Bun test
    Steps: Exercise registry bootstrap with missing file, empty lanes array, and partial records.
    Expected: Manager/server recover to a valid default canonical registry without crash.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-2-bootstrap.txt
  ```

  **Commit**: YES | Message: `feat(browser-lanes): migrate registry to canonical surface model` | Files: manager/server registry seams, tests

- [x] 3. Redefine browser-lane health and status semantics around surface kind and runtime ownership

  **What to do**: Replace the current mixed status wording with surface-aware and ownership-aware health. Keep stream/CDP endpoint states, but make direct-iframe use target reachability semantics and `not-applicable` CDP state. Restrict runtime-preparation states such as `profile-locked` to managed-local lanes only. Standardize summarization helpers and user-facing copy.
  **Must NOT do**: Do not report fake CDP failures for direct-iframe surfaces. Do not show managed-runtime states for attached lanes.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: shared status semantics fan out across all layers
  - Skills: []
  - Omitted: [`agent-browser`] — status logic first

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4,5,6,9 | Blocked By: 1

  **References**:
  - `apps/desktop/src/main/browser-lane-process.ts:138`
  - `apps/desktop/src/main/browser-lane-manager.ts:125`
  - `apps/server/src/routes/browser-lanes.ts:595`
  - `apps/desktop/src/shared/browser-lanes.ts:138`

  **Acceptance Criteria**:
  - [ ] Managed-local lanes alone can emit profile/runtime-prepared states.
  - [ ] Direct-iframe lanes report target reachability, not stream/CDP degradation.
  - [ ] Attached Selkies lanes distinguish stream reachability from optional CDP availability.

  **QA Scenarios**:
  ```text
  Scenario: direct iframe health summary
    Tool: Bun test
    Steps: Evaluate health builder/summarizer with reachable and unreachable direct-iframe fixtures.
    Expected: Status/messages mention iframe/target only; CDP is `not-applicable` unless explicitly supported by design.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-3-direct-iframe-health.txt

  Scenario: managed-local profile state isolation
    Tool: Bun test
    Steps: Feed attached-lane and managed-local fixtures with missing probes/profile path combinations.
    Expected: `profile-locked` appears only for managed-local rows.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-3-runtime-health.txt
  ```

  **Commit**: YES | Message: `refactor(browser-lanes): separate surface and runtime health semantics` | Files: process, manager, server route, shared summarizers, tests

- [x] 4. Rewrite main-process lane lifecycle around runtime ownership

  **What to do**: Refactor manager lifecycle so `managed-local` is the only path that prepares runtime files, allocates ports, manages profiles, and runs Docker Compose. `attached` lanes should only validate/probe configured endpoints and expose CDP operations when present. Move any residual `mode` branches to explicit strategy/location logic.
  **Must NOT do**: Do not start, stop, restart, or reset profiles for attached lanes. Do not require Docker capabilities for attached lanes.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: complex lifecycle orchestration
  - Skills: [`api-design`] — helpful for lifecycle API behavior
  - Omitted: [`agent-browser`] — orchestration first

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,8,9 | Blocked By: 1,2,3

  **References**:
  - `apps/desktop/src/main/browser-lane-manager.ts:282`
  - `apps/desktop/src/main/browser-lane-runtime.ts:105`
  - `apps/desktop/src/main/browser-lane-capabilities.ts:16`
  - `apps/desktop/src/main/browser-lane-process.ts:24`

  **Acceptance Criteria**:
  - [ ] `managed-local` lanes prepare runtime config and can start/stop/restart/reset profile.
  - [ ] `attached` lanes skip runtime generation and Docker checks entirely.
  - [ ] Invalid lifecycle actions on attached/direct-iframe lanes fail with typed errors and clear messages.

  **QA Scenarios**:
  ```text
  Scenario: attached lane skips Docker path
    Tool: Bun test
    Steps: Exercise manager ensure/start/stop flows for attached lanes.
    Expected: No runtime file generation or Docker command execution occurs; manager returns probe-driven state only.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-4-attached-lifecycle.txt

  Scenario: managed-local lane prepares runtime config
    Tool: Bun test
    Steps: Run manager ensure flow for managed-local Selkies lane with mocked capability success.
    Expected: Runtime config, ports, and profile path are generated and persisted correctly.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-4-managed-runtime.txt
  ```

  **Commit**: YES | Message: `refactor(browser-lanes): branch lifecycle on runtime ownership` | Files: manager/runtime/capabilities/process tests

- [x] 5. Mirror the canonical model in browser-mode server routes and proxy seams

  **What to do**: Update the Bun/Hono browser-lane routes to use the same canonical fields and semantics as the Electron manager. Keep route creation, health, proxy, and CDP tab control behavior aligned. Make Selkies-only body rewriting and auth-header injection conditional on surface kind/ownership rules.
  **Must NOT do**: Do not let the browser-mode route drift into a second competing model. Do not inject the Selkies page shim into direct-iframe content.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: server mirror must match manager exactly
  - Skills: [`api-design`] — route semantics and compatibility
  - Omitted: [`agent-browser`] — route contract first

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,8,9 | Blocked By: 1,2,3

  **References**:
  - `apps/server/src/routes/browser-lanes.ts:14`
  - `apps/server/src/services/browser-lane-cdp.ts:41`
  - `apps/desktop/src/main/browser-lane-protocol.ts:98`
  - `.sisyphus/drafts/browser-panel-mode-split.md:55`

  **Acceptance Criteria**:
  - [ ] Route registry responses serialize the new canonical record shape.
  - [ ] Health responses match manager semantics for direct-iframe, attached Selkies, and managed-local Selkies.
  - [ ] Direct-iframe proxied pages are returned without Selkies body rewriting.

  **QA Scenarios**:
  ```text
  Scenario: direct iframe proxy bypasses Selkies rewrite
    Tool: Bun test
    Steps: Feed a direct-iframe HTML response through route rewrite helpers.
    Expected: Response body is unchanged aside from safe proxy transport requirements.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-5-direct-proxy.txt

  Scenario: route health matches manager semantics
    Tool: Bun test
    Steps: Exercise `/browser/:laneId/health` with canonical fixtures for each lane type.
    Expected: Returned status/message/endpoint states match manager health expectations exactly.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-5-route-health.txt
  ```

  **Commit**: YES | Message: `refactor(browser-routes): align server lanes with canonical model` | Files: server routes/services/tests, protocol helpers if needed

- [x] 6. Update preload and renderer backend bridges to the new model without contract ambiguity

  **What to do**: Propagate the canonical lane model through preload and renderer backend wrappers. Ensure all browser lane operations, payloads, and UI consumers use the new concepts and do not reconstruct old `mode` assumptions. Keep IPC and browser-mode HTTP APIs behaviorally aligned.
  **Must NOT do**: Do not leave parallel shadow fields whose values can diverge silently.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: seam update across typed bridges
  - Skills: []
  - Omitted: [`api-design`] — contracts already decided

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,8,9 | Blocked By: 1,2,3

  **References**:
  - `apps/desktop/src/preload/index.ts:48`
  - `apps/desktop/src/renderer/services/backend.ts:235`
  - `apps/desktop/src/renderer/services/elf-server.ts`
  - `apps/desktop/src/preload/api.d.ts:45`

  **Acceptance Criteria**:
  - [ ] Renderer bridge types and payloads compile with the new canonical fields.
  - [ ] No browser-lane IPC path requires old primary `mode` semantics in renderer consumers.

  **QA Scenarios**:
  ```text
  Scenario: preload/backend compile against new lane shape
    Tool: Bash
    Steps: Run `bun run check-types` after preload and backend bridge updates.
    Expected: No bridge/type consumer fails on the canonical lane model.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-6-bridge-typecheck.txt

  Scenario: browser-mode HTTP wrapper mirrors preload semantics
    Tool: Bun test
    Steps: Add/update wrapper tests for create/list/health lane flows if coverage exists.
    Expected: Electron and browser-mode wrappers expose the same field shape and action semantics.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-6-wrapper-tests.txt
  ```

  **Commit**: YES | Message: `refactor(browser-bridge): propagate canonical lane contract` | Files: preload, backend wrappers, tests

- [x] 7. Rebuild the browser panel UX around surface kind first

  **What to do**: Redesign the browser panel create/edit/display flow so operators choose surface kind first, runtime ownership second, and then see only relevant fields. Direct-iframe should ask for target URL. Attached Selkies should ask for stream URL and optional CDP. Managed-local Selkies should default most runtime details and hide irrelevant attached fields. Update lane metadata displays and action labels accordingly.
  **Must NOT do**: Do not keep the current implementation-first “new remote lane” form. Do not expose managed-runtime controls for attached lanes.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: information architecture and conditional UI rebuild
  - Skills: [`ui-content-design`] — concise, clear operator copy
  - Omitted: [`agent-browser`] — UI build first, browser proof later

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10 | Blocked By: 1,4,5,6

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:89`
  - `apps/desktop/src/renderer/atoms/browser.ts:50`
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx:104`
  - `.sisyphus/drafts/browser-panel-mode-split.md:62`

  **Acceptance Criteria**:
  - [ ] Browser panel create flow begins with surface kind.
  - [ ] Direct-iframe flows ask for target URL and skip Selkies-runtime fields.
  - [ ] Managed-local Selkies flows expose lifecycle controls; attached flows do not.
  - [ ] Panel titles/details use the new vocabulary consistently.

  **QA Scenarios**:
  ```text
  Scenario: create form field matrix
    Tool: Bun test / React component test
    Steps: Render browser panel create flow for each supported lane combination.
    Expected: Only relevant fields and actions are visible for each combination.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-7-form-matrix.txt

  Scenario: direct iframe panel render path
    Tool: agent-browser or browser automation in localhost web mode
    Steps: Select/register a direct-iframe lane and open the browser side panel.
    Expected: Panel renders iframe surface without waiting on Selkies-style startup states.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-7-direct-iframe-browser.md
  ```

  **Commit**: YES | Message: `feat(browser-panel): make surface kind the primary UX axis` | Files: browser panel, local state helpers, component tests

- [x] 8. Preserve and clarify lane binding, display URL, and action routing behavior

  **What to do**: Update lane resolution and display URL helpers so session-bound lane selection remains first-class and global lane remains fallback only. Rename helpers to reflect surface semantics, and ensure navigation/action routing respects direct-iframe vs Selkies differences. Keep browser panel persistence stable through migration.
  **Must NOT do**: Do not drop session binding semantics accidentally. Do not route direct-iframe navigation through CDP actions.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: subtle user-state and binding behavior
  - Skills: []
  - Omitted: [`ui-content-design`] — logic more important than copy here

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10 | Blocked By: 1,4,5,6

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.binding.test.tsx:1`
  - `apps/desktop/src/renderer/atoms/browser.ts:38`
  - `apps/desktop/src/renderer/components/agent-detail.tsx:298`
  - `apps/desktop/src/preload/api.d.ts:192`

  **Acceptance Criteria**:
  - [ ] Session-bound lane overrides still win over global fallback.
  - [ ] Display URL helper name and behavior match the new surface-first model.
  - [ ] Direct-iframe navigation updates target URL without CDP dependency.

  **QA Scenarios**:
  ```text
  Scenario: binding precedence
    Tool: Bun test
    Steps: Exercise panel lane resolution with bound lane, unbound lane, and global fallback state.
    Expected: Bound lane wins; global lane is used only when no binding exists.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-8-binding.txt

  Scenario: direct-iframe navigation bypasses CDP
    Tool: Bun test / component test
    Steps: Trigger panel navigation for a direct-iframe lane.
    Expected: Target URL updates without invoking CDP-only lane actions.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-8-navigation.txt
  ```

  **Commit**: YES | Message: `refactor(browser-panel): preserve binding and surface-aware navigation` | Files: browser atoms/helpers, panel binding tests, related consumers

- [x] 9. Constrain Selkies-only protocol and proxy behavior to streamed surfaces

  **What to do**: Audit and tighten protocol/proxy behavior so Selkies-specific auth-header injection, body rewriting, and same-origin desktop URL conventions apply only when a lane actually uses a streamed Selkies surface. Direct-iframe surfaces should keep the simplest possible transport path consistent with Electron/browser-mode needs.
  **Must NOT do**: Do not spray local lane auth headers onto arbitrary direct-iframe targets. Do not keep Selkies UI-hiding shims active for generic pages.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: transport/security seam with subtle regressions
  - Skills: []
  - Omitted: [`agent-browser`] — protocol correctness first

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 10 | Blocked By: 1,4,5,6

  **References**:
  - `apps/desktop/src/main/browser-lane-protocol.ts:65`
  - `apps/server/src/routes/browser-lanes.ts:162`
  - `.sisyphus/drafts/browser-panel-mode-split.md:69`

  **Acceptance Criteria**:
  - [ ] Direct-iframe surfaces bypass Selkies-only rewrite/auth logic.
  - [ ] Selkies surfaces still load through the expected same-origin desktop/browser routes.
  - [ ] No regression in stream proxy behavior for managed-local or attached Selkies lanes.

  **QA Scenarios**:
  ```text
  Scenario: direct iframe proxy transport
    Tool: Bun test / HTTP route test
    Steps: Request a direct-iframe proxied page through the desktop/server path.
    Expected: Page returns without Selkies-only rewriting or injected local lane auth semantics.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-9-direct-transport.txt

  Scenario: Selkies transport unchanged
    Tool: Bun test / route verification
    Steps: Request a Selkies surface path and inspect rewrite/auth behavior.
    Expected: Same-origin stream route still functions with expected Selkies handling.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-9-stream-transport.txt
  ```

  **Commit**: YES | Message: `fix(browser-proxy): scope Selkies transport behavior to streamed lanes` | Files: protocol, server route, tests

- [ ] 10. Document the canonical model and prove it end-to-end

  **What to do**: Update the durable docs/runbook and add evidence proving all supported lane combinations. Include a concise glossary, configuration matrix, invalid combinations, and operator-facing examples. Verify the canonical combinations: direct iframe attached, Selkies attached with CDP, and managed-local Selkies.
  **Must NOT do**: Do not leave old wording in README/plan/runbook surfaces once the code changes land.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: durable doctrine + evidence curation
  - Skills: [`ui-content-design`] — operator-facing wording
  - Omitted: [`agent-browser`] — use only for proof capture, not doc writing

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: final verification | Blocked By: 2,3,4,5,6,7,8,9

  **References**:
  - `docs/palot-opencode-plugin-bridge.md`
  - `README.md`
  - `.sisyphus/drafts/browser-panel-mode-split.md:42`
  - `.sisyphus/plans/palot-browser-lane-virtual-stream.md:50`

  **Acceptance Criteria**:
  - [ ] Docs explain surface kind, runtime ownership, deployment location, and CDP as separate concepts.
  - [ ] Docs include supported combinations and one invalid-combination table.
  - [ ] Evidence exists for canonical direct-iframe, attached Selkies, and managed-local Selkies flows.

  **QA Scenarios**:
  ```text
  Scenario: direct-iframe proof
    Tool: agent-browser or browser automation against localhost panel
    Steps: Register/use a direct-iframe lane and capture rendered panel evidence plus health state.
    Expected: Panel renders target without Selkies gating or CDP requirement.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-10-direct-proof.md

  Scenario: managed-local Selkies proof
    Tool: interactive_bash + browser verification
    Steps: Start a managed-local Selkies lane, verify stream path and CDP endpoint readiness, then render in the panel.
    Expected: Managed lane transitions through runtime-prepared -> starting -> running and the panel renders the stream.
    Evidence: .sisyphus/evidence/browser-lane-model-alignment/task-10-managed-proof.md
  ```

  **Commit**: YES | Message: `docs(browser-lanes): codify canonical surface model` | Files: docs, evidence references, any small runbook helpers

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ agent-browser if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Keep contract/migration, lifecycle, UI, and docs work in separate coherent commits.
- Prefer one commit per numbered task unless two adjacent tasks are inseparable in the same seam.
- Do not mix docs-only changes into lifecycle or migration commits.

## Success Criteria
- Browser lanes are explained and configured surface-first, not infra-first.
- The codebase contains one canonical lane model across Electron main, preload, renderer, and server route mirror.
- Direct-iframe and Selkies lanes have distinct, truthful health semantics.
- Managed-local and attached lanes have distinct, truthful lifecycle behavior.
- Operators can predict what fields and controls will appear from the combination they choose.
