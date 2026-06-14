## Palette Bundled Portable OpenCode Contract And Implementation Plan

This document defines the consumer-side contract and the implementation-planning authority for shipping Palette packaged builds with a bundled `portable-opencode` runtime.

Use it in two parts:

- Contract authority: release policy, artifact metadata, platform scope, and packaged-runtime invariants.
- Implementation plan: main-process, onboarding, recovery, migration, and proof work required to satisfy that contract.

Unless a section explicitly says current repo state, planning statements below are requirements to implement, not claims that code already exists.

### Scope

- Palette consumes published `portable-opencode` native artifacts.
- Palette does not consume sibling source trees, local checkouts, or ad hoc copied bundles in release builds.
- Palette packaged mode uses the bundled runtime only. There is no host `opencode` fallback in packaged mode.

### Release authority

- CI and release jobs are the only authority for fetching the bundled runtime used in packaged builds.
- Local absolute paths such as `/Users/hassoncs/src/ch5/portable-opencode/` are developer breadcrumbs only.
- Release jobs must resolve artifacts from the approved `portable-opencode` publish surface using pinned metadata committed in this repo.
- Release jobs must fail closed when artifact metadata is missing, checksum validation fails, provenance is incomplete, or the requested channel/profile is not approved.

### Upstream references

- Portable runtime repo: `/Users/hassoncs/src/ch5/portable-opencode/`
- Portable release policy: `/Users/hassoncs/src/ch5/portable-opencode/README.md`
- Portable channel manifest: `/Users/hassoncs/src/ch5/portable-opencode/portable-opencode.manifest`
- Portable provenance examples: `/Users/hassoncs/src/ch5/portable-opencode/portable-opencode.lock`

### V1 platform and profile policy

- Supported packaged platforms in v1:
  - macOS arm64
  - macOS x64
- Release-gated only, not enabled by default in v1:
  - Linux x64
- Explicitly excluded from v1:
  - Windows all architectures

### Approved release channels

- `golden`: default packaged-consumer channel for customer-facing releases.
- `candidate`: internal preview channel only. Palette may consume it for preview or QA builds, never for default production packaging.
- `dev-snapshot`: never allowed in packaged release jobs.

### Approved target profiles

- `mac-mini`: the required native lineage artifact for macOS packaging in v1.
- `dell-lxc`: upstream Linux lineage reference. Palette cannot enable Linux packaging until Linux proof is added locally.
- `container`: not a desktop bundled-runtime input.
- `partner-laptop`: not an approved Palette packaged-runtime input.
- Repo-local metadata schema stays macOS-v1 only. Linux enablement comes later with schema and release-gate expansion after packaged Linux proof exists.

### Required packaged resource layout

Packaged builds stage the approved portable runtime under `process.resourcesPath`.

Required layout:

```text
process.resourcesPath/
  portable-opencode/
    bundle/
      bin/
      lib/
      share/
    artifact-metadata.json
    THIRD-PARTY-NOTICES.txt
```

Rules:

- `bundle/` is immutable packaged seed content.
- `artifact-metadata.json` is the Palette-owned consumer manifest for the bundled artifact instance.
- `THIRD-PARTY-NOTICES.txt` is required for shipped license attribution.
- Packaged builds must never mutate files inside `process.resourcesPath/portable-opencode/` at runtime.
- Current repo gap to close during implementation: `apps/desktop/electron-builder.yml` has `extraResources`, but it does not yet carry a dedicated `portable-opencode/` entry.

### Required metadata fields

Palette must carry repo-local metadata for every bundled artifact. Required fields are defined by `apps/desktop/resources/portable-opencode/artifact-metadata.schema.json` and must include:

- artifact version
- consumer app version constraint, expressed as an explicit semver operator string such as `>=0.8.0`
- release channel
- target profile
- operating system
- architecture
- checksum algorithm and value
- provenance URL
- source artifact identity
- upstream source repository identity
- upstream release identifier
- bundle relative path inside packaged resources
- bundled notices path
- published timestamp
- Windows support policy

### Consumer behavior rules

- Packaged mode resolves the runtime from `process.resourcesPath/portable-opencode/bundle`.
- Packaged mode must not probe `~/.opencode/bin`, run install scripts, attach to shared `:4096`, or shell out to fetch OpenCode from the network.
- Dev mode may keep an explicit override path for local iteration, but that path must stay visibly separate from packaged mode.
- Remote or manual server connection remains an advanced user path only and must never become automatic fallback when bundled runtime startup fails.

### Verification requirements for release jobs

- Verify bundled artifact metadata exists before packaging starts.
- Verify artifact checksum before files are staged into app resources.
- Verify provenance URL and source artifact identity are present and match the fetched artifact.
- Verify packaged notices are staged with the runtime bundle.
- Verify macOS bundled executables preserve executable mode after staging.
- Verify signing, quarantine, and notarization proof for bundled native executables on enabled macOS targets.

### Current-state proof expectation

- Evidence must call out current repo gaps, especially the missing dedicated `portable-opencode/` `extraResources` entry in `apps/desktop/electron-builder.yml`.
- Evidence must not claim packaging lane already exists when the current repo still lacks that resource mapping.

### Unsupported-platform handling

- Windows packaging stays disabled until a portable Windows artifact and Palette proof lane both exist.
- Linux packaging jobs must fail closed until Palette adds Linux packaged proof and explicitly enables Linux release scope.
- Unsupported-platform exclusions must be explicit in release config and proof docs, never inferred from missing files.

## Implementation Plan

The sections below are implementation-planning authority. They intentionally describe work still required in app code, onboarding, runtime ownership, and proof lanes.

## Runtime Owner Contract

### Lifecycle modes

- `external`: dev-only mode. Palette points at an already-running shared OpenCode host and never spawns it.
- `managed`: packaged default. Palette owns the full lifecycle of the bundled runtime.

### Source-of-truth surfaces

- Browser-mode server contract already lives in `apps/server/src/services/server-manager.ts`.
- Desktop packaged lifecycle must be aligned to the same contract in `apps/desktop/src/main/opencode-manager.ts`.
- `OPENCODE_MODE` and `OPENCODE_BIN` are the only approved runtime ownership switches. Do not invent a second packaged-only flag family.

### Required refactor seams

- `apps/desktop/src/main/opencode-manager.ts`
  - replace implicit always-managed behavior in `ensureServer()` with `external` vs `managed`
  - resolve runtime binary before lockfile/probe/spawn flow
  - branch detection and spawn policy on `OPENCODE_MODE`
  - use packaged resolver output for spawn, process matching, and health reporting
  - replace current `/session` readiness probe with parity to browser-mode `/global/health`
  - replace current 15s cold-start assumption with the existing 120s contract unless fresh proof justifies a lower bound
- `apps/server/src/services/server-manager.ts`
  - remains contract authority for `external` vs `managed`
  - desktop must mirror its semantics, timeout policy, and no-fallback rule
- `AGENTS.md`
  - remains the human/operator authority describing packaged expectations

### Managed packaged rules

- Packaged builds set `OPENCODE_MODE=managed`.
- Packaged builds set `OPENCODE_BIN` to the bundled portable runtime executable inside `process.resourcesPath/portable-opencode/bundle`.
- Packaged builds must never spawn bare `opencode` from PATH.
- Packaged builds must never attach to shared `127.0.0.1:4096`.
- Packaged builds must never probe `~/.opencode/bin` for readiness, installability, or version checks.

### External dev rules

- Devmux keeps `apps/server` on `OPENCODE_MODE=external` and `OPENCODE_PORT=4096`.
- One-off desktop dev may explicitly point to `:4096` for shared-host attachment.
- Dev-only override paths must be explicit operator actions, never implicit packaged fallback.

### Ownership and shutdown semantics

- In managed packaged mode, Palette owns start, stop, restart, crash detection, and lockfile cleanup.
- In external mode, Palette owns health checks only and must fail loud if the server is absent.
- Sign-out does not imply binary deletion. It only affects env-scoped auth/runtime state as defined below.

## Environment Scope Matrix

### Environment ids

- `staging`
- `production`

### Root layout

Packaged runtime state lives under Palette-owned roots, not inside bundled resources.

```text
<palette-config-root>/portable-opencode/<env>/
  auth/
  settings/

<palette-data-root>/portable-opencode/<env>/
  runtime/
  logs/
  cache/
  server.lock
```

Suggested concrete roots:

- config root: XDG/Electron config root already used by Palette settings surfaces
- data root: XDG/Electron data root already used by runtime-managed machine state

### Env-scoped state

- Firefly auth tokens and refresh tokens
- OpenCode runtime `auth.json`
- runtime config overrides derived from selected environment
- provider and model credentials resolved for runtime use
- MCP OAuth or session caches and per-connection auth artifacts
- account or provider caches used by runtime auth or model routing
- plugin lifecycle state and plugin-owned mutable caches
- shell or env projection cache derived for the packaged runtime process
- runtime data dir
- port allocation record
- server lockfile
- health/failure state
- logs and crash diagnostics
- cache and temp runtime artifacts
- first-run completion for bundled-runtime boot in that environment
- analytics attribution or auth-bound telemetry identity
- app-level settings whose meaning depends on selected Firefly environment

### Shared state

- packaged immutable runtime bundle in `process.resourcesPath`
- bundled metadata and notices
- UI preferences unrelated to auth/runtime identity
- advanced remote/manual server definitions, but not selected active env auth
- non-auth visual preferences and local-only layout state

### Explicit non-shared rule

- No staging token may be readable from the production runtime root.
- No production lockfile or port record may be reused by staging.
- Switching env must never point at another env's runtime root, `auth.json`, or logs.

### Port and lockfile policy

- Allocate one managed local port per environment and persist it in env-scoped state.
- Lockfiles are env-scoped, not global.
- Active-session inference must include env identity when evaluating local managed processes.

### Sign-out and env-switch policy

- Sign out from one environment clears that environment's auth state and runtime session state only.
- A full "sign out everywhere" action may clear both environments, but it must be explicit UI, not hidden side effect.
- Env switch persists previous env state, then boots or reconnects only within the newly selected env root.
- Env switch also rotates environment-owned provider credentials, token-store file, analytics identity, and plugin caches before runtime bind.

## Auth And Runtime Orchestration

### First-run packaged sequence

1. Detect packaged mode.
2. Validate bundled artifact metadata and executable presence.
3. Show environment choice (`staging` or `production`).
4. Persist selected environment as pending active env.
5. Start Firefly sign-in in the selected environment.
6. Firefly Cloud completes callback and token exchange without requiring local OpenCode runtime.
7. Write env-scoped auth state.
8. Resolve env-scoped runtime roots, port, and lockfile path.
9. Start bundled runtime via `OPENCODE_BIN`.
10. Wait for health/readiness.
11. Bind renderer to the managed local runtime for the selected environment.
12. Mark onboarding complete for packaged flow.

### Runtime host resolution

- Runtime host is derived from persisted active environment config plus env-scoped port data.
- Build-time environment variables may seed defaults, but cannot be the only source of active runtime identity after first run.

### Concrete UI and main-process owners

- `apps/desktop/src/renderer/components/onboarding/onboarding-overlay.tsx`
  - replace packaged core flow with `welcome -> packaged-env-select -> packaged-auth -> packaged-runtime-boot -> providers -> complete`
  - keep migration screens as post-`complete` detours only
  - define resume behavior after deep-link callback or restart using persisted packaged onboarding progress
- `apps/desktop/src/renderer/components/root-layout.tsx`
  - persist packaged onboarding completion with environment-aware fields
  - gate transition from onboarding to startup/runtime states
- `apps/desktop/src/renderer/atoms/onboarding.ts`
  - add exact packaged renderer fields: `activeEnvironment`, `packagedResumeStep`, `authStatus`, `runtimeBootstrapStatus`, `advancedModeSelected`
  - treat these as UX state only, never auth source of truth
- `apps/desktop/src/main/onboarding.ts`
  - expose packaged-only bundled-runtime validation and auth boot IPC instead of install-script entrypoints
- `apps/desktop/src/main/settings-store.ts`
  - persist one durable `activeEnvironment` pointer for main-process auth and runtime ownership
- `apps/desktop/src/main/services/auth/sign-in-to-editor-handler.ts`
  - route callback exchange using `settings.activeEnvironment`, not one global auth host
- `apps/desktop/src/main/services/auth/token-store.ts`
  - split auth state storage by environment instead of one global `userData` file; main-process pointer selects active store
- `apps/desktop/src/main/ipc-handlers.ts`
  - add packaged-runtime diagnostics and environment-select/auth IPC handlers

### Session behaviors

- Silent refresh updates only the selected environment's auth state.
- Sign-in retry keeps the selected env and shows auth failure state without booting another runtime path.
- Env switch tears down or detaches from the old env runtime and attaches only after the new env auth/root contract is ready.
- Sign-out from current env stops or detaches the current env runtime, clears env auth, and returns to env selection or sign-in for that env.

### Active-environment pointer contract

- Main-process settings own the durable `activeEnvironment` pointer.
- Renderer onboarding state mirrors that pointer for resume/progress UX only.
- Deep-link callback exchange reads `activeEnvironment` from main-process settings, writes only to that env-scoped auth store, then advances packaged onboarding/runtime boot state.
- Runtime host resolution, token refresh, and sign-out all read the same main-process pointer; no packaged path may infer current environment from loose process env alone.

## Artifact Ingestion And Packaging

### Repo-owned metadata location

- Consumer metadata schema: `apps/desktop/resources/portable-opencode/artifact-metadata.schema.json`
- Consumer metadata instance: `apps/desktop/resources/portable-opencode/artifact-metadata.json` at packaging time
- Example scaffold: `apps/desktop/resources/portable-opencode/artifact-metadata.example.json`

### CI packaging lane

1. Read committed metadata.
2. Fetch approved published `portable-opencode` artifact for the declared channel/profile/platform.
3. Verify checksum.
4. Verify provenance URL and upstream release identity.
5. Extract artifact into a staging directory under `apps/desktop/resources/portable-opencode/bundle`.
6. Stage bundled notices into `apps/desktop/resources/portable-opencode/THIRD-PARTY-NOTICES.txt`.
7. Extend `apps/desktop/electron-builder.yml` `extraResources` to carry the full `portable-opencode/` directory.
8. Run macOS executable-mode and signing/quarantine checks on staged executables.
9. Package the desktop app.

### Fail-closed release rules

- Missing metadata: fail packaging.
- Unsupported channel/profile combination: fail packaging.
- Checksum mismatch: fail packaging.
- Missing provenance URL or source artifact identity: fail packaging.
- Missing notices file: fail packaging.
- Staged binary missing executable bit on macOS: fail packaging.

### Required `electron-builder` change

- Add an `extraResources` entry carrying `apps/desktop/resources/portable-opencode` to `process.resourcesPath/portable-opencode`.
- Keep this separate from `resources/bin` so the runtime bundle is a named packaged dependency, not mixed with wrapper scripts.

## Main-Process Refactor Plan

### New resolver module

Add a dedicated main-process resolver, for example:

- `apps/desktop/src/main/portable-opencode-resolver.ts`

Responsibilities:

- detect packaged vs dev mode
- resolve bundled executable path from `process.resourcesPath`
- validate artifact metadata and required files
- derive env-scoped runtime config/data roots
- derive env-scoped port and lockfile path
- produce spawn env for `opencode-manager.ts`

### `opencode-manager.ts` changes

- Read `OPENCODE_MODE` the same way the browser-mode server already does.
- Replace bare spawn assumptions with resolver output.
- Replace host-only process matching with portable-aware detection that recognizes bundled executable paths and env-scoped roots.
- Keep or extend the 120s readiness timeout; do not shrink to 15s without fresh proof.
- Record env identity in managed server state used for active-session inference.
- Record current mismatch explicitly: desktop today still prepends `~/.opencode/bin`, probes `/session`, and waits on a shorter cold-start budget; implementation must remove that divergence.

### Detection changes

- Process enumeration must match bundled executable paths, not only command strings containing `opencode`.
- Active-session inference must understand the managed bundled runtime origin and its env-scoped data roots.
- Lockfile ownership checks stay fail-loud across users.

## Packaged Onboarding Rewrite

### Packaged onboarding states

- `artifact-missing`
- `artifact-invalid`
- `environment-select`
- `auth-required`
- `auth-in-progress`
- `runtime-starting`
- `runtime-ready`
- `runtime-failed`
- `advanced-manual-mode`

### Source/dev-only states retained separately

- host OpenCode detection
- host version compatibility
- install or update CTA via install script

### Required code seams

- `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx`
  - keep host OpenCode detection and install/update CTA for source/dev flow only
  - remove this step from default packaged first-run path
  - remove inline discovered/manual controls from packaged first-run content
  - expose one explicit `Advanced connection options` affordance that leads to remote/manual mode intentionally
- `apps/desktop/src/main/onboarding.ts`
  - packaged mode must not offer `installOpenCode()`
  - add bundled artifact validation and env-aware boot hooks
- `apps/desktop/src/main/compatibility.ts`
  - gate host binary detection to source/dev flow only
- `apps/desktop/src/renderer/atoms/onboarding.ts`
  - persist active env choice and packaged-flow completion details alongside existing onboarding state
- `apps/desktop/src/renderer/components/startup-overlay.tsx`
  - own packaged pre-onboarding and post-auth startup messaging for `artifact-missing`, `auth-required`, `runtime-starting`, and `runtime-failed`

### Packaged first-run ownership

- Default packaged first-run path must never render current inline remote/discovered server controls.
- Choosing remote/manual mode is a branch away from bundled local onboarding, not part of the default path.
- Returning from advanced mode to bundled local flow resumes at `packaged-env-select` unless a valid env-scoped auth store already exists.

## Runtime Status, Failure UX, And Repair

### Required status surfaces

- selected environment
- bundled artifact version and channel
- managed runtime state (`stopped`, `starting`, `ready`, `failed`)
- active runtime root path
- last health-check timestamp
- last failure code and message
- available repair actions

### Failure states

- missing bundled artifact
- invalid metadata
- checksum mismatch
- local managed port conflict
- startup timeout
- auth rejected or expired
- corrupted runtime root
- env mismatch between persisted selection and runtime state
- incompatible artifact after app update

### Repair actions

- retry start
- revalidate bundled artifact
- clear current environment runtime cache
- clear current environment auth and re-sign-in
- reset current environment runtime root from bundled seed
- switch environment
- open advanced manual mode intentionally
- surface logs and diagnostics entrypoint for support use

### No-fallback rule

- None of these failures may auto-switch to host OpenCode, shared `:4096`, or remote/manual mode.

### Surface ownership

- `startup-overlay` owns failures that happen before onboarding can render or before packaged env/auth state is ready enough to enter onboarding UI.
- onboarding-owned packaged states own `environment-select`, `auth-required`, `auth-in-progress`, `runtime-starting`, and first-run `runtime-failed` states.
- post-onboarding runtime status/settings surfaces own degradation after initial onboarding completed.
- hard-block release/package faults still surface operator diagnostics and release-owner classification, even when first shown in `startup-overlay`.

## Update And Migration Policy

### Seed vs mutable state

- `process.resourcesPath/portable-opencode/**` is immutable bundled seed state.
- Env-scoped runtime roots are mutable disposable state.

### Update flow

1. App update lands a new bundled artifact and metadata.
2. On next launch, Palette compares bundled artifact identity against the env-scoped runtime state marker.
3. If compatible, reuse env-scoped mutable state.
4. If migration is required, run env-scoped migration before runtime boot.
5. If migration fails, offer repair actions before any fallback.

### Required migration guards

- record runtime-root schema version per environment
- record last bundled artifact version per environment
- keep migration journal per environment
- create pre-migration backup or restore point before destructive changes
- support clean reseed from bundled artifact without deleting other environment state
- preserve valid auth tokens across non-auth migration steps unless an auth schema change explicitly invalidates them
- stop automatic relaunch after a defined failed-launch cutoff and surface operator recovery UI instead
- define rollback and downgrade handling explicitly rather than assuming forward-only success

## Advanced Remote Or Manual Mode Boundary

### Preserve, but isolate

- Remote/manual server connection remains available as an advanced path.
- It must be explicitly selected by the user.
- It must not be chosen automatically because local bundled runtime is missing or failed.
- First-run packaged onboarding must hide existing discovered/manual server affordances behind an explicit advanced action instead of showing them inline by default.

### Return path

- Settings or onboarding must offer a clear "Return to bundled local runtime" action.
- Returning to local runtime re-enters env selection or resumes the persisted active environment.

## Packaged Proof Matrix And Release Gate

### Required packaged proofs

- fresh install on macOS arm64 with no host OpenCode installed
- fresh install on macOS x64 with no host OpenCode installed
- sign-in for `staging`
- sign-in for `production`
- bundled runtime boot from `process.resourcesPath`
- relaunch reusing the correct env-scoped runtime state
- env switch from `staging` to `production` and back without state bleed
- app update with bundled artifact migration
- corrupted runtime root recovery
- bad bundled artifact update recovery
- downgrade or rollback behavior
- macOS executable mode, quarantine, signing, and notarization success
- Linux gating proof before Linux packaging can be enabled
- Windows explicitly disabled in release scope

### Evidence artifact names

- `.sisyphus/evidence/task-11-proof-matrix.txt`
- `.sisyphus/evidence/task-11-proof-matrix-error.txt`
- future implementation/release verification must add platform-specific packaged proof outputs under `.sisyphus/evidence/packaged-runtime/`

### macOS x64 proof lane policy

- Default proof lane: native macOS x64 runner or dedicated Intel Mac hardware.
- Rosetta on arm64 is supplementary smoke only, not release proof by itself.
- Release checklist must record which x64 lane produced proof for the exact bundled artifact.

### Release gate rules

- macOS arm64 and x64 proof are mandatory for enabled macOS releases.
- Linux package jobs must stay disabled or fail closed until Linux packaged proof is green.
- Windows package jobs stay disabled in v1.
- Source-mode proof never substitutes for packaged proof.
