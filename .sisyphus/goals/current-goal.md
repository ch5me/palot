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
- Swarm produced **file-level implementation specs** for the rest (P1, P2, P3,
  identity, HostAuthority) — ready to drive follow-on waves.

**Hard boundary discovered:** the remote gallery (Open VSX/firefly-cloud fetch,
publish, hosted catalog) lives in the **firefly-cloud repo**, NOT palot. The
remote half of P1 cannot land from this repo. In-repo landable now: P1 *local*
(VSIX import + theme convert + DB/package store), P2 data families, identity
migration, HostAuthority seam.

Swarm lesson (codify): workflow spec agents must get an explicit
NO git add/commit/push rule — one rogue agent pushed P4 to main.

## Remaining

- Cross-cutting: identity `namespace.name` migration (aliases); `HostAuthority` seam.
- P1 local: DB schema/stores, VSIX download+verify+unpack, Open VSX client +
  registry adapters, theme converter, marketplace UI + IPC. (Remote half →
  firefly-cloud repo.)
- P2 data families + Monaco projection. P3 runtime hosts. P4 review.
- Trust derived from verification (signing).

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
