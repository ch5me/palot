# Palette Bundled Portable OpenCode

## TL;DR
> **Summary**: Ship Palette packaged builds with a pinned bundled `portable-opencode` artifact, use it as the only managed local runtime in packaged mode, and isolate staging vs production runtime/auth state under app-owned user data roots.
> **Deliverables**:
> - bundled-artifact ingestion path for Palette releases
> - packaged-runtime resolver + spawn contract for bundled `portable-opencode`
> - first-run environment selection + sign-in flow bound to per-env runtime roots
> - onboarding rewrite from host-install checks to bundled-runtime checks
> - packaged-mode proof matrix for fresh install, relaunch, update, env switch, and failure recovery
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 4 -> Task 6 -> Task 9 -> Final Verification

## Context
### Original Request
Build Palette as an all-in-one Firefly desktop client so a fresh installer includes OpenCode, user only signs into staging or production Firefly Cloud, Palette boots OpenCode in background, and normal use works without host OpenCode/Bun/curl/shell setup.

### Interview Summary
- User wants a concrete implementation plan, not strategy only.
- Packaged builds must feel one-click.
- Firefly environment choice must support staging and production.
- Palette should own background boot after sign-in.

### Metis Review (gaps addressed)
- Packaged/runtime contract must be explicit; resolver swap alone is insufficient.
- Onboarding rewrite must be treated as full UX/state-machine work, not copy tweak.
- Environment isolation must define what is env-scoped vs shared.
- Artifact ingestion must declare channel/profile/provenance rules.
- Failure/recovery flows need explicit acceptance criteria.
- Host-tool/Nix ambiguity resolved by constraining v1 consumer contract below.
- Auth callback ownership is fixed below: Firefly Cloud owns sign-in callback completion; local portable runtime starts only after env-scoped token exchange succeeds.

## Work Objectives
### Core Objective
Change Palette packaged desktop builds so they launch a bundled `portable-opencode` runtime instead of host `opencode`, with explicit staging/production environment selection, per-environment runtime state isolation, and packaged-build onboarding that validates the bundled runtime rather than installing OpenCode from the network.

### Deliverables
- `portable-opencode` artifact ingestion pipeline for Palette releases.
- Main-process bundled-runtime resolver and spawn contract.
- Per-environment runtime root contract under Palette `userData`.
- Environment selection + sign-in + runtime boot orchestration.
- Onboarding rewrite for packaged builds.
- Packaged-mode health/recovery/update UX and proof suite.

### Definition of Done (verifiable conditions with commands)
- Fresh packaged install on supported target OS launches without host `opencode` present.
- Packaged app never runs network install scripts or probes `~/.opencode/bin` in packaged mode.
- Choosing `staging` vs `production` changes auth host, API host, runtime root, and token storage scope.
- Bundled runtime starts from `process.resourcesPath` and serves the local API Palette expects.
- Palette relaunch reuses the correct env-scoped runtime state.
- Palette update to a newer bundled artifact migrates or reseeds runtime state without breaking sign-in.
- Bundled native executables survive macOS signing/quarantine/notarization checks on clean machines.
- Failure states produce explicit actionable UX for missing artifact, startup timeout, bad auth, corrupted runtime root, and env mismatch.

### Must Have
- Packaged mode uses bundled runtime only. No silent host fallback.
- Dev mode may keep explicit override/fallback behavior, but must be visibly separate.
- Runtime assets are immutable bundled seeds; runtime roots are derived disposable state.
- Remote/manual server path remains advanced/manual only and must not be accidental packaged fallback.
- v1 consumer scope supports macOS arm64 + macOS x64 packaged releases first. Linux x64 may remain behind explicit release gating. Windows is excluded from v1 until a portable native artifact + verification lane exists.
- Firefly Cloud finishes auth callback/token exchange before local runtime boot. No local-runtime dependency for sign-in completion.

### Must NOT Have
- No source-merging `portable-opencode` into Palette repo.
- No bundled secrets, tenant values, or shared staging/prod auth files.
- No packaged-build execution of curl/PowerShell install scripts.
- No packaged-build attachment to shared `:4096` host runtime.
- No mutation of bundled config/plugins/skills in `process.resourcesPath`.
- No “best effort” fallback to host OpenCode when bundled runtime is broken.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after. Reuse existing Bun/unit coverage where available; add targeted desktop main-process and renderer tests around packaged runtime mode.
- QA policy: Every task includes agent-executed scenarios; packaged UX proofs use browser/Electron-adjacent automation or deterministic script assertions where browser tooling cannot attach directly.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Tasks 1-4 — release contract, bundled-runtime contract, env matrix, settings/auth contract

Wave 2: Tasks 5-8 — artifact ingestion, runtime resolver/spawn, onboarding rewrite, runtime status/recovery UX

Wave 3: Tasks 9-11 — update/migration flow, remote/manual path hardening, packaged proof matrix + release gating

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 5, 9, 11
- Task 2 blocks Tasks 6, 7, 8, 9
- Task 3 blocks Tasks 4, 6, 7, 9, 11
- Task 4 blocks Tasks 7, 9, 11
- Task 5 blocks Task 6 and Task 11
- Task 6 blocks Tasks 7, 8, 9, 10, 11
- Task 7 blocks Tasks 8, 11
- Task 8 blocks Task 11
- Task 9 blocks Task 11
- Task 10 blocks Task 11

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 -> 4 tasks -> `deep`, `writing`, `unspecified-high`
- Wave 2 -> 4 tasks -> `deep`, `quick`, `visual-engineering`, `unspecified-high`
- Wave 3 -> 3 tasks -> `deep`, `writing`, `unspecified-high`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Add consumer artifact contract + repo-local metadata schema

  **What to do**: Add repo-local artifact metadata and docs for Palette's bundled-runtime consumption contract: supported OS/arch set for v1, required bundle layout inside app resources, required metadata fields (version, channel, profile, checksum, provenance URL, source artifact identity, license/notice manifest path), and the rule that Palette consumes published native artifacts rather than sibling source trees. Replace absolute local-path authority with CI/release authority: Palette release jobs fetch approved portable artifacts from the portable release surface named in metadata, while local absolute paths remain reference-only breadcrumbs for developers. Add explicit cross-repo references to `/Users/hassoncs/src/ch5/portable-opencode/...` so implementers know these inputs live outside palot. Name the approved portable release channels (`golden` default, `candidate` only for internal preview builds) and target profiles (`mac-mini` lineage artifact consumed for macOS packaging; Linux held behind explicit gating; Windows excluded v1).
  **Must NOT do**: Do not redesign portable-opencode’s release system. Do not allow implicit local-checkout consumption in release builds. Do not leave platform support “to be decided.”

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: release-boundary and artifact-consumption contract is architecture-shaping.
  - Skills: [`portable-opencode`] — needed for native artifact contract and channel/profile doctrine.
  - Omitted: [`brainstorming`] — idea generation not needed; contract must be explicit.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 9, 11 | Blocked By: none

  **References**:
  - Pattern: `apps/desktop/electron-builder.yml:18` — current packaged resources entrypoint.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:63` — current release model and consumer boundary.
  - API/Type: `/Users/hassoncs/src/ch5/portable-opencode/portable-opencode.manifest:18` — release channels and policy.
  - API/Type: `/Users/hassoncs/src/ch5/portable-opencode/portable-opencode.manifest:77` — input provenance expectations.
  - External: `/Users/hassoncs/src/ch5/portable-opencode/portable-opencode.lock:3` — pinned input/provenance example.

  **Acceptance Criteria**:
  - [ ] Palette repo contains a durable artifact-consumption contract naming supported v1 platforms, approved channels, approved target profiles, and required metadata fields.
  - [ ] Release builds have a documented rule that packaged mode consumes verified published artifacts only.
  - [ ] CI/release authority for fetching artifacts is explicit and does not rely on local `/Users/...` paths.
  - [ ] Windows is explicitly excluded from v1 unless artifact + proof lane exists.

  **QA Scenarios**:
  ```text
  Scenario: Contract completeness
    Tool: Bash
    Steps: Read contract doc/config and verify it names channel, profile, platform scope, checksum/provenance, and packaged resource layout.
    Expected: Every field is present with no TBD placeholders.
    Evidence: .sisyphus/evidence/task-1-artifact-contract.txt

  Scenario: Fail-closed on unsupported platform ambiguity
    Tool: Bash
    Steps: Search contract for Windows handling and packaged fallback wording.
    Expected: Windows explicitly excluded for v1 and no host fallback language appears.
    Evidence: .sisyphus/evidence/task-1-artifact-contract-error.txt
  ```

  **Commit**: YES | Message: `docs(desktop): freeze bundled portable artifact contract` | Files: `.sisyphus/**`, docs/config surfaces in repo scope

- [x] 2. Implement packaged runtime-owner contract in main-process surfaces

  **What to do**: Implement the packaged runtime-owner contract in planning terms by naming exact code changes: use `OPENCODE_BIN` as the packaged binary contract, port `opencode-manager.ts` to honor the same `OPENCODE_MODE=managed|external` seam already documented for server mode, define executable resolution order, packaged-vs-dev behavior, spawn args, readiness timeout policy, runtime log locations, lockfile behavior, plugin injection expectations, and the authoritative managed-server process identity. Replace the current 15s readiness assumption with the documented managed-mode cold-start contract and add explicit stale-lockfile/port-reuse handling. Decide process identity detection now: portable-managed processes are recognized by resolved executable path under bundled resources and/or env marker `PORTABLE_OPENCODE_NPM_HOME`, not just process name.
  **Must NOT do**: Do not keep packaged behavior dependent on shared `:4096` or host `PATH`. Do not leave readiness timeout undefined. Do not leave process identity matching implicit.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: main-process lifecycle contract affects boot, recovery, and verification.
  - Skills: [] — repo evidence is sufficient.
  - Omitted: [`portable-opencode`] — useful context already captured; task is Palette runtime-owner policy.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 8, 9 | Blocked By: none

  **References**:
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:722` — current PATH-based binary resolution.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:761` — current raw `opencode` spawn.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:812` — current 15s readiness timeout.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:439` — current process-name assumption for active-session inference.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/npm/bin/portable-opencode.mjs:1` — bundled launcher entrypoint.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/npm/bin/portable-opencode.mjs:75` — runtime env overrides.
  - Pattern: `AGENTS.md:220` — packaged/server mode contract and managed-mode boot notes.
  - Pattern: `AGENTS.md:225` — `OPENCODE_BIN` packaged-build requirement.
  - Pattern: `AGENTS.md:227` — explicit note that `opencode-manager.ts` must be ported to `OPENCODE_MODE`.
  - Pattern: `apps/desktop/src/main/server-lockfile.ts` — lockfile authority used by desktop lifecycle.
  - Pattern: `apps/desktop/src/main/process-owner.ts` — ownership/process identity helpers.

  **Acceptance Criteria**:
  - [ ] Runtime-owner contract names executable path resolution, spawn args, env vars, readiness timeout, logs, lockfiles, and packaged-vs-dev branch behavior.
  - [ ] Contract explicitly uses `OPENCODE_BIN` in packaged mode and forbids packaged host fallback.
  - [ ] Contract defines how active-session/process detection recognizes portable launcher processes and how env switching reuses or kills them.
  - [ ] Contract defines readiness timeout using documented managed-mode cold-start expectations, not the current 15s default.
  - [ ] Contract defines whether staging and production share one local port with stop/start exclusivity or use separate ports, plus matching lockfile behavior.

  **QA Scenarios**:
  ```text
  Scenario: Runtime contract traceability
    Tool: Bash
    Steps: Read runtime contract and confirm each item maps to a current code insertion point in `opencode-manager.ts`.
    Expected: Resolution, spawn, readiness, logging, lockfile, and detection are all covered.
    Evidence: .sisyphus/evidence/task-2-runtime-contract.txt

  Scenario: No packaged host fallback
    Tool: Bash
    Steps: Search runtime contract for fallback behavior and shared :4096 references.
    Expected: Packaged mode forbids both host fallback and shared-host attachment.
    Evidence: .sisyphus/evidence/task-2-runtime-contract-error.txt
  ```

  **Commit**: YES | Message: `docs(desktop): define packaged runtime owner contract` | Files: `.sisyphus/**`, docs/config surfaces in repo scope

- [x] 3. Add full environment-scoping matrix for staging and production

  **What to do**: Add a full staging-vs-production scoping matrix that classifies every runtime surface: Firefly auth token storage, Firefly API base URL, auth host, portable runtime root, OpenCode auth data, session DB/state/cache/log dirs, config/plugin/skill seed copies, provider/model credentials, MCP OAuth caches, plugin state, shell/env projection cache, account/provider cache surfaces, analytics attribution if any, and app-level settings. Use one policy: all runtime/auth/provider/plugin execution state is env-scoped; only non-sensitive UI preferences may be shared. Fix runtime-root strategy now: env roots are stable by environment with explicit bundled-artifact version metadata and migration state layered under them, not opaque local `/Users/...` version roots alone. Document env-switch semantics as atomic: persist env choice, derive all endpoints/roots from that choice, stop current runtime, start target runtime, then rebind renderer.
  **Must NOT do**: Do not share auth/runtime files across envs. Do not leave switch behavior partial. Do not rely on only endpoint changes while reusing one runtime root.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: staging/prod isolation is load-bearing security/runtime behavior.
  - Skills: [] — repo evidence is sufficient.
  - Omitted: [`portable-opencode`] — already grounded.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 6, 7, 9, 11 | Blocked By: none

  **References**:
  - Pattern: `apps/desktop/src/main/services/auth/sign-in-to-editor-handler.ts:33` — auth-host env split.
  - Pattern: `apps/desktop/src/main/services/cloud/firefly-runtime-client.ts:27` — API URL env split.
  - Pattern: `apps/desktop/src/main/services/auth/token-store.ts:30` — current single auth-state path.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:45` — portable auth/data path authority.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:50` — auth-path contradiction warning.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/npm/bin/portable-opencode.mjs:25` — runtime root derivation.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/npm/bin/portable-opencode.mjs:26` — config/data/state/cache directories.

  **Acceptance Criteria**:
  - [ ] A durable matrix names every env-scoped and shared surface, including provider creds, MCP OAuth caches, plugin state, shell projection, and account caches.
  - [ ] Env-switch sequence is explicitly atomic and ordered.
  - [ ] Separate runtime roots and auth stores are mandatory for staging and production.

  **QA Scenarios**:
  ```text
  Scenario: Matrix completeness
    Tool: Bash
    Steps: Read env matrix and verify auth, API, runtime root, session state, logs, config seeds, and shared UI prefs are all classified.
    Expected: No unclassified state remains.
    Evidence: .sisyphus/evidence/task-3-env-matrix.txt

  Scenario: No shared sensitive state
    Tool: Bash
    Steps: Search env matrix for shared auth/runtime paths.
    Expected: No auth token, runtime root, or OpenCode state path is marked shared.
    Evidence: .sisyphus/evidence/task-3-env-matrix-error.txt
  ```

  **Commit**: YES | Message: `docs(desktop): freeze staging production isolation matrix` | Files: `.sisyphus/**`, docs/config surfaces in repo scope

- [x] 4. Add executable settings + auth orchestration sequence

  **What to do**: Add the exact first-run and steady-state control flow for environment selection, sign-in, token persistence, token refresh, sign-out, runtime boot, and callback ownership. Decision is fixed here: Firefly auth callback is Cloud-owned, token exchange completes in app main process, then local portable runtime boot begins; no local runtime is required to complete sign-in. Document offline/no-network behavior for env selection, sign-in launch, callback exchange, token refresh, and post-auth runtime boot. Use env-scoped auth state files keyed by selected Firefly environment, one active-env pointer in settings, sign-in callback writing only to selected env store, and runtime client resolving hosts from selected env definition rather than loose process env in packaged mode.
  **Must NOT do**: Do not keep one global auth blob for both envs. Do not let packaged runtime client resolve production/staging purely from build-time env vars. Do not leave sign-out behavior unspecified.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: sign-in/runtime orchestration spans settings, auth storage, and boot lifecycle.
  - Skills: [] — direct code/docs references sufficient.
  - Omitted: [`summarize-meeting`] — not relevant.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 9, 11 | Blocked By: 3

  **References**:
  - Pattern: `apps/desktop/src/main/settings-store.ts:16` — `AppSettings` extension point for env selection persistence.
  - Pattern: `apps/desktop/src/main/services/auth/sign-in-to-editor-handler.ts:50` — callback exchange flow.
  - Pattern: `apps/desktop/src/main/services/auth/token-store.ts:83` — current token store lifecycle.
  - Pattern: `apps/desktop/src/main/services/cloud/firefly-runtime-client.ts:55` — current cloud runtime status call path.
  - Pattern: `apps/desktop/src/main/services/cloud/firefly-runtime-client.ts:106` — current runtime claim call path.

  **Acceptance Criteria**:
  - [ ] Contract defines first-run sequence from env choice through runtime-ready state.
  - [ ] Contract defines sign-in, silent refresh, sign-out, and env-switch behavior.
  - [ ] Packaged runtime host resolution is derived from persisted env config, not loose build-time env alone.

  **QA Scenarios**:
  ```text
  Scenario: First-run sequence review
    Tool: Bash
    Steps: Read orchestration contract and verify sequence includes env choice, sign-in, auth write, runtime boot, health check, renderer bind.
    Expected: Steps are ordered and complete with no hidden transitions.
    Evidence: .sisyphus/evidence/task-4-auth-orchestration.txt

  Scenario: Env-specific sign-out correctness
    Tool: Bash
    Steps: Inspect contract for sign-out and env switch behavior.
    Expected: Sign-out clears only targeted env auth/runtime state or explicitly defines full sign-out behavior; no ambiguity remains.
    Evidence: .sisyphus/evidence/task-4-auth-orchestration-error.txt
  ```

  **Commit**: YES | Message: `docs(desktop): define env aware auth orchestration` | Files: `.sisyphus/**`, docs/config surfaces in repo scope

- [x] 5. Add artifact ingestion + packaging implementation tasks

  **What to do**: Add concrete work items for Palette build/release flow: where artifact metadata lives in repo, how CI fetches the approved portable artifact, how checksums/provenance are verified, how files are staged into `apps/desktop/resources`, how `electron-builder` `extraResources` is extended to carry the bundle, how bundled dependency license data and third-party notices are incorporated into release gates, and how macOS executable mode, quarantine handling, and app-signing/notarization proof are verified for bundled native executables. Include v1 rule that macOS release jobs fail if artifact metadata is absent or checksum mismatch occurs.
  **Must NOT do**: Do not allow ad hoc manual copying into release jobs. Do not leave checksum verification optional. Do not package raw source checkouts.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: build/release implementation details are operational but bounded.
  - Skills: [`portable-opencode`] — artifact family knowledge needed.
  - Omitted: []

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6, 11 | Blocked By: 1

  **References**:
  - Pattern: `apps/desktop/electron-builder.yml:18` — current extraResources contract.
  - Pattern: `apps/desktop/package.json:22` — current build/package scripts.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:65` — candidate/golden release model.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/docs/artifact-families.md:7` — native artifact family/source metadata contract.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/docs/artifact-families.md:43` — runtime-root and install-script contract.

  **Acceptance Criteria**:
  - [ ] Plan names exact staging directory under app resources for bundled portable artifact and the `extraResources` entry that carries it.
  - [ ] Plan names CI verification steps for checksum and provenance before packaging.
  - [ ] Plan names bundled dependency license / third-party notice update gate for the shipped artifact.
  - [ ] Plan names macOS signing/quarantine/notarization proof for bundled native executables.
  - [ ] Plan names package-fail behavior on missing or invalid artifact metadata.

  **QA Scenarios**:
  ```text
  Scenario: Packaging flow completeness
    Tool: Bash
    Steps: Read plan tasks for artifact ingestion and verify metadata fetch, checksum validation, staging path, and electron-builder inclusion all exist.
    Expected: End-to-end packaging path is explicit.
    Evidence: .sisyphus/evidence/task-5-packaging-flow.txt

  Scenario: Invalid artifact handling
    Tool: Bash
    Steps: Search plan for checksum mismatch and missing-artifact behavior.
    Expected: Release job fail-closed behavior is documented explicitly.
    Evidence: .sisyphus/evidence/task-5-packaging-flow-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): add bundled runtime packaging lane` | Files: `.sisyphus/**`

- [x] 6. Add main-process bundled-runtime resolver and server-manager refactor tasks

  **What to do**: Add exact implementation tasks for new resolver module, `opencode-manager.ts` refactor, `OPENCODE_MODE` adoption, `OPENCODE_BIN` packaged-path wiring, portable-process matching, readiness timeout update, per-env port/lockfile policy, env injection, and packaged-vs-dev branching. Include rule that bundled runtime path resolves from `process.resourcesPath` in packaged mode and may use an explicit dev override env only in dev mode.
  **Must NOT do**: Do not keep literal `spawn("opencode")` in packaged path. Do not leave current process matching untouched. Do not keep 15s timeout without explicit proof.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the core implementation seam.
  - Skills: [] — code references are local.
  - Omitted: [`portable-opencode`] — artifact contract already frozen upstream in Tasks 1 and 5.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8, 9, 10, 11 | Blocked By: 2, 3, 5

  **References**:
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:111` — current local server config path.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:132` — `ensureServer()` contract.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:406` — process enumeration for active sessions.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:761` — spawn call site.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:858` — readiness helper.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/npm/bin/portable-opencode.mjs:101` — command dispatch semantics.
  - Pattern: `AGENTS.md:225` — packaged-build `OPENCODE_BIN` contract.
  - Pattern: `AGENTS.md:227` — required `OPENCODE_MODE` port for `opencode-manager.ts`.
  - Pattern: `apps/desktop/src/main/server-lockfile.ts` — desktop lockfile helpers.
  - Pattern: `apps/desktop/src/main/process-owner.ts` — process ownership helpers.
  - Pattern: `apps/desktop/src/main/automation/paths.ts` — data-dir/path construction helpers used by lockfile/runtime state.

  **Acceptance Criteria**:
  - [ ] Plan includes a dedicated resolver module and explicit insertion points in `opencode-manager.ts`.
  - [ ] Plan defines portable process detection changes for active-session inference.
  - [ ] Plan defines packaged runtime env injection, runtime-root wiring, updated readiness timeout policy, and per-env port/lockfile behavior.
  - [ ] Plan explicitly ports desktop manager to the existing `OPENCODE_MODE` + `OPENCODE_BIN` contract instead of inventing a parallel seam.

  **QA Scenarios**:
  ```text
  Scenario: Refactor coverage
    Tool: Bash
    Steps: Read task details and verify resolver, spawn, detection, env injection, and readiness items are all present.
    Expected: No core `opencode-manager` seam is omitted.
    Evidence: .sisyphus/evidence/task-6-runtime-refactor.txt

  Scenario: Legacy assumptions removed
    Tool: Bash
    Steps: Search plan for literal host-path assumptions and unchanged process-name matching.
    Expected: Plan explicitly replaces both host spawn and `opencode`-only detection.
    Evidence: .sisyphus/evidence/task-6-runtime-refactor-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): define bundled runtime manager refactor` | Files: `.sisyphus/**`

- [x] 7. Plan packaged onboarding rewrite

  **What to do**: Add exact tasks for replacing packaged-build host-OpenCode checks with bundled-runtime checks, inserting environment selection before sign-in, preserving remote/manual path as advanced/manual mode, and removing network-install CTAs in packaged mode. Keep source/dev onboarding path distinct and explicitly gated by `app.isPackaged`. Include exact state integration points for onboarding state persistence and the new environment-selection step.
  **Must NOT do**: Do not keep contradictory packaged UI that says “Install OpenCode.” Do not remove remote/manual mode without replacement policy. Do not mix packaged and dev onboarding states.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: onboarding is a stateful user-facing flow.
  - Skills: [] — current UI code is enough.
  - Omitted: [`brainstorm-ideas-existing`] — flow must be concrete, not exploratory.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8, 11 | Blocked By: 2, 3, 4, 6

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx:53` — current environment-check state.
  - Pattern: `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx:168` — install handler.
  - Pattern: `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx:253` — remote/discovered server bypass.
  - Pattern: `apps/desktop/src/main/onboarding.ts:123` — current install command path.
  - Pattern: `apps/desktop/src/main/compatibility.ts:47` — current host-binary detection logic.
  - Pattern: `apps/desktop/src/renderer/atoms/onboarding.ts` — onboarding state atom that must incorporate env-selection progress.

  **Acceptance Criteria**:
  - [ ] Plan defines packaged onboarding states for bundled runtime present/invalid/starting/ready.
  - [ ] Plan inserts environment choice before sign-in and runtime boot.
  - [ ] Plan explicitly gates network-install and host-CLI checks to dev/source mode only.

  **QA Scenarios**:
  ```text
  Scenario: Packaged onboarding flow review
    Tool: Bash
    Steps: Read onboarding task details and verify env choice, sign-in, bundled runtime validation, remote advanced path, and packaged/dev split are all defined.
    Expected: Full onboarding state machine is covered.
    Evidence: .sisyphus/evidence/task-7-onboarding.txt

  Scenario: Contradiction check
    Tool: Bash
    Steps: Search plan for packaged install-script or host-OpenCode CTA language.
    Expected: None remains for packaged flow.
    Evidence: .sisyphus/evidence/task-7-onboarding-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): define packaged onboarding rewrite` | Files: `.sisyphus/**`

- [x] 8. Add runtime status, failure UX, and repair-flow tasks

  **What to do**: Define the runtime-status state machine and UI contract for missing artifact, checksum mismatch, boot timeout, auth required, corrupted runtime root, port conflict, and env mismatch. Add a repair/reseed flow that rebuilds derived runtime root from immutable bundled seeds without mutating packaged resources.
  **Must NOT do**: Do not leave failure UX as log-only. Do not route user to generic OpenCode install docs. Do not mutate bundled resources in place.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: recovery/state-machine work is non-trivial but bounded.
  - Skills: [] — local references sufficient.
  - Omitted: []

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 11 | Blocked By: 2, 6, 7

  **References**:
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:69` — current port-conflict error shape.
  - Pattern: `apps/desktop/src/main/opencode-manager.ts:230` — lockfile reconnect path.
  - Pattern: `apps/desktop/src/main/services/auth/token-store.ts:47` — current auth-state failure behavior.
  - Pattern: `portable-opencode/npm/bin/portable-opencode.mjs:47` — reseeding config/plugins/skills per launch.

  **Acceptance Criteria**:
  - [ ] Plan defines explicit runtime status states and corresponding user-visible actions.
  - [ ] Plan defines repair/reseed flow using runtime root deletion/recreation only.
  - [ ] Plan defines which failures are recoverable in-app vs hard-block release/package issues.

  **QA Scenarios**:
  ```text
  Scenario: Failure-state coverage
    Tool: Bash
    Steps: Read failure UX task and verify missing artifact, checksum mismatch, auth, timeout, corrupted root, port conflict, and env mismatch are all covered.
    Expected: Every named failure has user-facing handling.
    Evidence: .sisyphus/evidence/task-8-failure-ux.txt

  Scenario: Immutable-seed rule
    Tool: Bash
    Steps: Search repair-flow details for mutation target.
    Expected: Only derived runtime roots are reset; packaged resources remain immutable.
    Evidence: .sisyphus/evidence/task-8-failure-ux-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): define runtime failure and repair flows` | Files: `.sisyphus/**`

- [x] 9. Add runtime update and migration policy tasks

  **What to do**: Add v1 update ownership and migration behavior: Palette app update is sole transport for bundled runtime updates; runtime artifact version and runtime-root schema version are recorded in app metadata; app compares previous bundled version to current on launch; env-scoped runtime roots are migrated or reseeded deterministically; auth persistence policy is explicit; per-env migration journal, pre-migration backup/restore point, failed-launch cutoff, downgrade behavior, and rollback expectations when bundled runtime is bad after app update are all specified.
  **Must NOT do**: Do not introduce separate sidecar updater in v1. Do not leave upgrade behavior to ad hoc runtime scripts. Do not assume runtime roots survive incompatible artifact changes unchanged.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: update/migration is core trust and support boundary.
  - Skills: [`portable-opencode`] — useful for artifact-version expectations.
  - Omitted: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 11 | Blocked By: 1, 2, 3, 4, 6

  **References**:
  - Pattern: `apps/desktop/src/main/updater.ts` — current app-update surface.
  - Pattern: `apps/desktop/electron-builder.yml:93` — current publish path.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:71` — promote-golden / release model.
  - Pattern: `/Users/hassoncs/src/ch5/portable-opencode/README.md:72` — candidate/golden no longer use live host overlays.

  **Acceptance Criteria**:
  - [ ] Plan defines how Palette detects bundled runtime version change and chooses migrate vs reseed.
  - [ ] Plan defines runtime-root schema versioning, per-env migration journal, backup/restore point, failed-launch cutoff, and downgrade behavior.
  - [ ] Plan defines auth/token preservation policy across runtime upgrades.
  - [ ] Plan defines bad-update rollback/operator recovery behavior.

  **QA Scenarios**:
  ```text
  Scenario: Update policy completeness
    Tool: Bash
    Steps: Read update task details and verify transport, version detection, migrate/reseed, auth preservation, and rollback are all defined.
    Expected: No upgrade behavior is implicit.
    Evidence: .sisyphus/evidence/task-9-update-policy.txt

  Scenario: No sidecar updater scope creep
    Tool: Bash
    Steps: Search update policy for independent runtime updater behavior.
    Expected: V1 keeps runtime updates inside Palette app update boundary only.
    Evidence: .sisyphus/evidence/task-9-update-policy-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): define bundled runtime update policy` | Files: `.sisyphus/**`

- [x] 10. Preserve and harden remote/manual server path as advanced mode

  **What to do**: Define how current remote/manual/discovered-server connection options remain available without undermining one-click bundled local runtime. Advanced path must be explicitly user-selected after onboarding or in settings, never the default packaged recovery path. Document interaction with env-scoped Firefly sign-in so local bundled runtime and remote manual modes do not trample each other.
  **Must NOT do**: Do not let remote/discovered server path masquerade as packaged-runtime recovery. Do not remove it without explicit product decision.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: primarily product/interaction contract and guardrails.
  - Skills: [] — no special procedure needed.
  - Omitted: []

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 11 | Blocked By: 6

  **References**:
  - Pattern: `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx:211` — manual server connection flow.
  - Pattern: `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx:262` — discovered-server connection flow.
  - Pattern: `apps/desktop/src/shared/server-config.ts:13` — current built-in local server entry.

  **Acceptance Criteria**:
  - [ ] Plan defines remote/manual mode as advanced/manual path only.
  - [ ] Plan defines where users can choose it and how they return to bundled local runtime.
  - [ ] Plan prevents remote/manual mode from becoming implicit packaged fallback.

  **QA Scenarios**:
  ```text
  Scenario: Advanced-mode boundary
    Tool: Bash
    Steps: Read plan details for remote/manual path.
    Expected: Path is preserved but explicitly separate from bundled-runtime default path.
    Evidence: .sisyphus/evidence/task-10-advanced-mode.txt

  Scenario: No accidental fallback
    Tool: Bash
    Steps: Search plan for any packaged-runtime failure path that auto-switches to remote/manual connection.
    Expected: None exists.
    Evidence: .sisyphus/evidence/task-10-advanced-mode-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): preserve remote advanced mode boundary` | Files: `.sisyphus/**`

- [x] 11. Build full packaged proof matrix and release gate

  **What to do**: Define the final implementation/proof tasks that verify fresh install, no host OpenCode, sign-in, runtime boot, relaunch, env switch, update migration, corrupted runtime recovery, bad-runtime update recovery, downgrade/rollback behavior, bundled-binary signing/quarantine success, and explicit unsupported-platform gating. Require packaged proof on macOS arm64 and macOS x64; define which runners or hardware prove x64, and whether Rosetta is acceptable for any part of proof. Linux x64 proof is required before enabling Linux packaging, and Linux package jobs must fail-closed until that proof lane exists. Windows packaging stays disabled in v1. Add exact evidence artifact names and release gate rules.
  **Must NOT do**: Do not call work complete with source-mode proof only. Do not claim Linux/Windows support without packaged proof. Do not skip broken-artifact and env-switch tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: proof/release gating spans code, packaging, and UX outcomes.
  - Skills: [] — repo guidance enough.
  - Omitted: [`agent-browser`] — browser automation may help later, but this plan task is about proof contract.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: Final Verification | Blocked By: 1, 3, 4, 5, 6, 7, 8, 9, 10

  **References**:
  - Pattern: `apps/desktop/package.json:25` — package targets.
  - Pattern: `apps/desktop/electron-builder.yml:49` — mac targets.
  - Pattern: `apps/desktop/electron-builder.yml:69` — linux targets.
  - Pattern: `apps/desktop/electron-builder.yml:63` — win targets currently present.
  - Pattern: `AGENTS.md:82` — packaging commands.
  - Pattern: `AGENTS.md:220` — packaged/server mode notes relevant to runtime proof.

  **Acceptance Criteria**:
  - [ ] Proof matrix includes fresh install, relaunch, env switch, update, recovery, bad-update rollback/downgrade, signing/quarantine success, and unsupported-platform gating.
  - [ ] Release gate explicitly requires packaged proof for each enabled platform.
  - [ ] Linux release jobs fail closed until Linux proof is green.
  - [ ] Windows stays disabled in v1 release scope.

  **QA Scenarios**:
  ```text
  Scenario: Proof matrix completeness
    Tool: Bash
    Steps: Read proof matrix and confirm it covers fresh install, no host runtime, sign-in, boot, relaunch, env switch, update, recovery, and platform gating.
    Expected: All required proofs are listed with evidence outputs.
    Evidence: .sisyphus/evidence/task-11-proof-matrix.txt

  Scenario: Release-scope enforcement
    Tool: Bash
    Steps: Search proof matrix for Windows and Linux enablement conditions.
    Expected: Windows excluded v1; Linux gated on proof; mac required by default.
    Evidence: .sisyphus/evidence/task-11-proof-matrix-error.txt
  ```

  **Commit**: YES | Message: `plan(desktop): add packaged proof and release gate matrix` | Files: `.sisyphus/**`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: artifact + runtime/env contract docs/config
- Commit 2: packaging/runtime-manager/onboarding plan details
- Commit 3: update/advanced-mode/proof-matrix details
- Keep all planning artifacts inside `.sisyphus/**` unless a repo-level docs/config source-of-truth update is necessary.

## Success Criteria
- An implementer can build the feature without choosing artifact shape, env-scoping policy, packaged-vs-dev behavior, onboarding state machine, update ownership, or release gate rules.
- Packaged mode is decision-complete: bundled runtime only, env-isolated, no network install script, no host fallback.
- Platform scope is explicit: macOS first, Linux gated, Windows excluded in v1.
- Verification is release-real: packaged install proof, not local-source optimism.
