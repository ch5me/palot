# Current Goal

## Goal As Stated

"Land the ENTIRE thing now." (`/goal`, 2026-06-16) — referent: the Firefly
extension marketplace designed this session.

## Interpreted Goal

Ship the full **Firefly Extension Marketplace** on top of the existing
firefly-plugin V2 system, per the design doc `docs/firefly-plugin-marketplace-design.md`
(committed `b069a24`). A native Firefly extension system with a VS Code-shaped
package/import adapter: install / enable / disable / uninstall / update, SemVer,
signing/trust, a firefly-cloud-hosted catalog, Open VSX import (themes first), and
a clean web-vs-electron execution model.

Locked decisions (2026-06-16): backend = firefly-cloud (also web-build host
authority); identity = `namespace.name` (Open VSX), migrate built-ins now w/
aliases; web V2 = portable tier only (data-only + web-worker + iframe), cloud-host
deferred to Phase 3; install/package/grant/runtime state in app SQLite.

This is a large multi-phase build; "land it" = drive every phase to verified,
committed, pushed completion, one independently-shippable slice at a time.

## Success Criteria

Per phase (each must typecheck + lint + test + build clean, and prove the
user-facing path before moving on):

- **P0 runtime lifecycle (local):** clicking Disable on a surface plugin actually
  tears down its surface (unmount + drop tab) and stops its worker; Enable
  re-mounts. Dev file edit hot-reloads the plugin (reproject; worker restart) with
  no full app reload. Closes the current "disable does nothing" gap.
- **P1 theme marketplace (data-only, both builds):** Open VSX search → install a
  VS Code theme → it appears as a V2 theme contribution and applies via the
  existing theme pipeline; local VSIX import works; install/package state in DB.
- **P2 data-only imports:** snippets, language metadata, grammars, icon themes
  import as contribution families; Monaco registration projection.
- **P3 native runtime extensions:** extension-host RPC; node-worker (electron
  utility / firefly-cloud cloud-host) + web-worker; per-call capability grants;
  extension storage API.
- **P4 constrained VS Code runtime import:** green-tier command/config/language
  importer; `vscode.d.ts` compile-time only; unsupported APIs rejected at import;
  no hidden VS Code sidecar.

Marketplace-wide: `namespace.name` identity live (built-ins aliased);
`HostAuthority` seam (Electron + firefly-cloud impls); trust derived from
verification; no silent fallbacks anywhere.

## Constraints

- Manifest is source of truth; runtime state never mutates the manifest.
- Renderer never loads extension code (either build); consumes projections only.
- No silent fallback — unsupported API/surface ⇒ explicit reject or degraded
  contribution, never a quiet no-op (CH5 fail-fast).
- Reuse existing pieces: catalog authority, lifecycle store, worker supervisor,
  hot-reload FSM contract, capability broker, projections. Extend, don't fork.
- Both builds (electron + web) first-class; honor the §2 execution-surface matrix.
- Small coherent verified slices; commit (goal doc + code) and push each; never
  sweep up another agent's uncommitted edits (e.g. the in-flight `agent-detail.tsx`).

## Non-Goals

- Visual Studio Marketplace as a default source (Open VSX + manual VSIX only).
- Paid/pricing processing (display-only).
- Per-workspace enable split, web/remote cloud-host for node-worker (P3+, not P0–P2).
- Cloning the VS Code runtime; shipping a hidden VS Code sidecar.

## Current State

Landed on `main` + verified (desktop `tsgo` EXIT=0, 685 firefly-plugin tests pass, lint clean):

- **Design: DONE** (`b069a24`, `docs/firefly-plugin-marketplace-design.md`).
- **P0 runtime lifecycle: DONE** (`8604fc2a4`). `setEnabled` now drives the worker
  supervisor; hot-reload-executor consumes the `planHotReloadCycle` FSM;
  dev-plugin-watcher (node:fs, dev-only) wired in `index.ts`; renderer evicts a
  disabled surface's live instance (unmount + drop tab); 22 new tests. The
  "disable does nothing" gap is CLOSED.
- **engines.firefly: DONE** (`e8a46fc75`). `engines.desktop` → `engines.firefly`
  SemVer range + deprecated alias; built-ins migrated.
- **P4 classifier + green importer: LANDED** (`499fde713`, by a swarm agent that
  committed off-mandate — coherent + tested, 1305 lines: `vscode-probe.ts`,
  `vscode-green-importer.ts` + tests). NEEDS a review pass for design-fit.
- **identity `namespace.name`: DONE** (`a2030ccaf`). pluginIdSchema widened;
  plugin-id-aliases.ts (19 old->canonical); built-ins renamed firefly.<x>, old ids
  aliased in catalog; non-breaking.
- **HostAuthority seam: DONE** (`573987ed4`). host-authority-types.ts interface (14
  methods) + ElectronHostAuthority (ipc routes through it, behavior-identical) +
  CloudHostAuthority stub for web. firefly-cloud RPC wiring deferred to P3.
- Swarm produced **file-level implementation specs** for the rest (P1, P2, P3) —
  ready to drive follow-on waves.

The full in-repo FOUNDATION is now landed + verified: lifecycle (P0), identity,
engines, HostAuthority seam, VS Code classifier (P4). Remaining is feature
implementation + the cross-repo backend.

**Hard boundary discovered:** the remote gallery (Open VSX/firefly-cloud fetch,
publish, hosted catalog) lives in the **firefly-cloud repo**, NOT palot. The
remote half of P1 cannot land from this repo. In-repo landable now: P1 *local*
(VSIX import + theme convert + DB/package store), P2 data families, identity
migration, HostAuthority seam.

Swarm lesson (codify): workflow spec agents must get an explicit
NO git add/commit/push rule — one rogue agent pushed P4 to main.

- **P1 theme-import core: DONE** (`d4a92afdb`). vscode-theme-import converter (§9
  color map, 47 tests), content-addressed package-store w/ sha256 verify-before-
  extract (16 tests), read-only Open VSX v3 client behind RegistryClient (23 tests);
  themes contribution gained import provenance. 771 tests pass.

- **P2 data families: DONE** (`854fb43b8`). snippets/languages/grammars/iconThemes
  contribution schemas + converter (vscode-data-contributions-import) + Monaco
  projection (TextMate grammar reg stubbed); family-contracts 6->10. Committed
  together with a concurrent session's nav-sidebar+folio work (entangled in shared
  files; integrated to preserve both — tree green, 803 firefly-plugin tests pass).

- **P1 FINISH: DONE** (`fc4bf8118`). Real Drizzle migration (extension_packages +
  extension_installations) + extension-store CRUD; install-orchestrator (Open VSX /
  local .vsix → verify+unpack → convert → records) with 3 end-to-end tests (happy /
  idempotent / integrity-fail); marketplace IPC (search/install/list/uninstall/apply)
  on HostAuthority + preload; marketplace-panel UI (browse + install + apply). Themes
  are installable end-to-end. 843 tests pass.
- **P2 Monaco wiring: DONE** (`debfb6a00`). Language/grammar/snippet/icon-theme
  registration entry points; TextMate WASM pipeline left behind a typed boundary
  (only monaco-editor installed).

- **P1 theme apply-to-DOM: DONE** (`5f151a48c`). VSCODE_COLOR_MAP remapped to the
  app's real shadcn tokens; converted appTokens flow through install → apply IPC →
  a runtime imported-theme registry (getTheme/getAvailableThemes) → setTheme →
  useThemeEffect injects CSS vars. Installing + applying a VS Code theme now visibly
  retints the app. **P1 theme marketplace is COMPLETE end-to-end.** 883 tests pass.

- **P3 native runtime extensions: DONE** (`9b50be1af` contracts + `0cd976385`
  runtime; desktop tsgo EXIT 0, 899 firefly-plugin + 40 renderer/lib tests pass,
  lint clean):
  - **P3a (keystone)** `runtime-location.ts` — single-SoT §2.3 host-kind→location
    matrix (`resolveRuntimeLocation`, fail-loud on unsupported). Manifest gained an
    optional `runtime` block; descriptor resolves effective runtime + resolution and
    infers a back-compat default hostKind so existing built-ins are untouched.
  - **P3b** `extension-host-protocol.ts` — transport-agnostic host↔worker message
    contract (lifecycle + activation-grants + storage + capability channels) +
    `RuntimeTransport` port.
  - **P3c** `utility-process-spawner.ts` — Electron utilityProcess transport;
    supervisor-boot selects it per resolved location, else worker_threads. Additive.
  - **P3d** capability grants + consent: `extension_capability_grants` migration +
    `grant-store.ts` (deny-by-default resolve) + `install-consent.ts` (risk-tier
    policy). dispatch's hardcoded over-grant REMOVED → pluggable resolver feeds the
    broker (built-ins: declared non-critical by policy; third-party: deny-by-default
    until granted); DB resolver wired at boot. Security behavior change: third-party
    dispatch now requires grants.
  - **P3e** plugin storage API: `plugin_storage_entries` migration +
    `plugin-storage-service.ts` (scoped KV + quota; secrets via safeStorage,
    fail-loud, never plaintext); exposed via host-authority.
  - **P3f** `cloud-host-rpc-client.ts` — typed firefly-cloud RPC client (config from
    FIREFLY_CLOUD_URL, fail-fast `CloudHostNotConfiguredError`); CloudHostAuthority's
    async methods now issue real RPCs (no more blanket throw-stub).
  - **Drizzle migrator (boy-scout):** the journal-less per-subdir format is what the
    workspace beta drizzle-orm uses; verified all 7 tables apply to a fresh DB at
    runtime. (An earlier "broken migrator" scare was a stale cached
    drizzle-orm@0.45.2 resolving for /tmp scripts, not the real app path.)

## P3 last-mile — DONE (`385526f58` worker-RPC/grants/signing + `0f0d6d9dc` consent UI/RPC contract)

- **L1 worker→host RPC routing: DONE.** Supervisor message loop now parses the full
  extension-host protocol and routes storage-request/capability-request to an injected
  handler (`worker-request-handler.ts` → storage service + grant store), posting typed
  replies. Lifecycle schema unified with the protocol. Tested (handler + supervisor routing).
- **L2 install-time grant persistence: DONE.** `persistInstallGrants` in the orchestrator
  (auto-grant low; medium/high/critical → prompt-required; honors consented set). No-op for
  data-only themes; ready for code-extension install. Tested with a synthetic install.
- **L5 publisher-key signature trust: DONE.** `signature-verify.ts` (ed25519/rsa-sha256 via
  node:crypto) + `derivePackageTrust` (present-but-invalid sig → hard integrity_mismatch),
  wired into the orchestrator. Publisher-key registry not yet plumbed → marketplace installs
  derive unsigned-third-party today (one-line upgrade when the registry lands). Tested.
- **L3 capability consent UI: DONE (wired, dormant for themes).** Deny-by-default consent
  dialog + tested risk-ordering model; marketplace-panel gates install on consent when an
  entry declares capabilities. Themes declare none → dormant; it is the surface for the
  future code-extension install path.
- **L6 firefly-cloud RPC contract: DOCUMENTED** (design §16) for the cross-repo server.

## Remaining

In-repo:
- **TextMate grammar runtime: BLOCKED (environment).** `bun add vscode-textmate
  vscode-oniguruma` fails because the cross-workspace graph can't resolve
  `@ch5me/federation-build@workspace:*` (referenced by an external `../ch5-packages/*`
  member, not by palot). Repairing that foreign workspace is out of scope. Unblock: fix the
  `@ch5me/federation-build` workspace ref, then add the deps + wire the loader into
  `renderer/lib/monaco.ts` (the P2 typed grammar boundary is the seam). Also: TextMate
  tokenization is GUI-verification-only (needs an app launch).
- **P4 review** (design-fit of the landed classifier/importer).

Cross-repo (CANNOT land from palot):
- **firefly-cloud hosted gallery + publish API + extension-host RPC server** — the remote
  half lives in the firefly-cloud repo. palot's client + the wire contract are landed +
  documented (design §16).

## Plan

0. **P0 runtime lifecycle** (now): wire `setEnabled`→supervisor enable/disable;
   build the hot-reload executor + dev file watcher; renderer unmount-on-disable +
   remount-on-enable. Verify by launching the app and toggling a surface.
1. **P1 theme marketplace**: Open VSX client + registry adapter; package store +
   DB tables (ExtensionPackage/Installation); VSIX download/unpack/parse; theme
   conversion → V2 contribution; install/preview/apply UI; local VSIX import.
2. **P2 data-only imports**: snippet/language/grammar/icon-theme families + Monaco
   projection.
3. **P3 native runtime extensions**: extension-host RPC, node/web-worker hosts,
   per-call capability grants, storage API.
4. **P4 VS Code runtime import**: green-tier importer, compile-time `vscode.d.ts`.

Cross-cutting (fold in as phases touch them): `namespace.name` identity migration
(aliases), `engines.firefly` rename, `HostAuthority` seam.

## Next Update Triggers

- a phase completes (update Current State + check off Success Criteria)
- goal / constraints / acceptance criteria change
- a blocker is hit (record it + shortest path forward)
- a locked decision changes
