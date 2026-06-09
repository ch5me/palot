# Sidebars As First-Class Plugins

> **Directive (Chris, 2026-06-09, verbatim):** "everything we've already built into the
> Firefly client, we're just going to turn into a plugin. Every single one of the
> sidebars, I want to try to reframe as a first-class plugin."
> **Quality bar (from the original Elf articulation):** "no plugin can crash anything",
> per-plugin schema + build system, mirroring VS Code's plugin posture.

**Status:** Atlas-ready execution plan.
**Repo:** `palot` (origin = ch5me/palot, push to origin `main`, pathspec-commit only).
**Supersedes nothing — extends:** `.sisyphus/plans/firefly-plugin-system-v2.md` (CLOSED
2026-06-08: 33/33 contract tasks, 498 firefly-plugin tests green) and the post-closure
runtime slices 1–6 (`7c08e1cb`…`5fd3344f`). This plan is the **migration + runtime
completion** phase that V2 explicitly deferred.

---

## 1. Ground truth (verified in source 2026-06-09)

### 1.1 What already exists — do NOT rebuild it

| Layer | State | Evidence |
|---|---|---|
| **Plugin manifest schema** (Zod, panels/widgets/commands/themes/tools, activation, capabilities, trust tiers, lifecycle hints) | DONE, locked, tested | `apps/desktop/src/shared/firefly-plugin/manifest.ts` (`firefly.plugin/v2`) |
| **Descriptor derivation + projections** (renderer, command, tool, bridge, theme) | DONE (pure contracts + tests) | `shared/firefly-plugin/{descriptor,renderer-projection,command-projection,tool-projection,bridge-projection,theme-pipeline}.ts` |
| **Capability broker** (deny-by-default, token grammar `host:<ns>:<verb>`) | DONE contract + main-process broker | `shared/firefly-plugin/capabilities.ts`, `main/firefly-plugin/capability-broker.ts` |
| **Runtime supervision contract** (locked lifecycle state machine, crash/hang/quarantine reducers, pure + clock-injected) | DONE as contract; **no live worker host implements it yet** | `shared/firefly-plugin/runtime-supervision.ts` |
| **Hot reload + storage scopes + perf quotas contracts** | DONE as contracts | `shared/firefly-plugin/{hot-reload,storage-scopes,perf-quotas}.ts` |
| **Catalog authority in main + IPC + renderer consumer + invoke path + boot probe** | DONE, but catalog only loads **2 in-source manifests** (palot-bridge + acme-notebook exemplar) | `main/firefly-plugin/{catalog,ipc,dispatch,authority}.ts`, `renderer/hooks/use-firefly-plugins.ts`, `window.elf.plugins.*` |
| **First-party migration matrix** (per-surface plugin id, capabilities, phases, teardown rules) | DONE as append-only source | `shared/firefly-plugin/first-party-migration.ts` |
| **Sidebars themselves** | All **hardcoded** in `renderer/firefly-surface-registry.tsx` (`FIREFLY_SURFACE_REGISTRY`), gated by Jotai feature-flag atoms; widgets hardcoded in `session-widget-registry.tsx` | consumed by `agent-detail.tsx`, `command-palette.tsx` |

**The gap this plan closes:** no sidebar is actually served from the plugin catalog. The
projection contracts exist; the cutover (registry → catalog-derived projection), the
plugin worker host, the per-plugin build pipeline, and disk-loaded manifests do not.

### 1.2 Full sidebar/surface inventory (enumerated from source)

**Side-panel tabs — 18** (the `SidePanelTabId` union in `renderer/atoms/ui.ts` +
`FIREFLY_SURFACE_REGISTRY` rows; one component each under
`renderer/components/side-panel/` unless noted):

| # | Tab id | Component | Notes |
|---|---|---|---|
| 1 | `review` | `review/review-panel.tsx` | git-diff IPC coupling |
| 2 | `browser` | `browser-panel.tsx` | browser-lane runtime (utilityProcess) coupling |
| 3 | `notes` | `notes-panel.tsx` | lightweight, agent-scoped |
| 4 | `pulse` | `pulse-panel.tsx` | observability, default-off |
| 5 | `artifacts` | `artifacts-panel.tsx` | pairs with genui widget zone (Loom flux) |
| 6 | `memory` | `memory-panel.tsx` | flagged, default-off |
| 7 | `files` | `files-panel.tsx` | thin wrapper over main `files.ts` IPC |
| 8 | `terminal` | `terminal-panel.tsx` | live PTY sessions (`main/pty.ts`) |
| 9 | `editor` | `editor-panel.tsx` | bridge scrollback coupling |
| 10 | `plugins` | `v2-plugins-panel.tsx` | **host-only exception** (operator UI for the catalog itself; self-reference loop) |
| 11 | `bridges` | `bridges-panel.tsx` | reads bridge registry |
| 12 | `crm` | `crm-panel.tsx` | main `crm.ts` IPC |
| 13 | `studio` | `studio-panel.tsx` | already uses an `<iframe>` for office preview |
| 14 | `voice` | `voice-panel.tsx` | audio-capture capability not yet modeled |
| 15 | `oracle` | `oracle-panel.tsx` | agent roster dependency |
| 16 | `claude` | `claude-panel.tsx` | Claude Code parity surface |
| 17 | `ch5pm` | `ch5pm-dashboard/panel.tsx` | PM dashboard, default-off |
| 18 | `pdf-review` | `pdf-review-panel.tsx` | has in-flight tool calls (locator dispatch) |

**Main-pane surfaces — 4** (from `renderer/router.tsx`):

| # | Surface | Component | Disposition |
|---|---|---|---|
| 19 | Chat / sessions (`/`, `project/$slug`, `session/$id`) | `new-chat.tsx`, `session-route.tsx`, `session-view.tsx` | plugin-candidate **last** (it is the product's core loop; manifest `formFactor: "main-pane"` exists; migrate only after the side-panel tier is proven) |
| 20 | Project Manager (`/project-manager`) | `project-manager.tsx`, `pm-dockview.tsx` | main-pane plugin, phase 3 |
| 21 | Automations (`/automations`, detail, runs) | `automations/*` | main-pane plugin, phase 3 |
| 22 | Settings (`/settings` + 9 sub-pages: general, servers, notifications, setup, providers, connections, profiles, worktrees, about) | `settings/*` | **host-only for the settings SHELL** (it hosts plugin/permission UX — same self-reference class as the plugins panel); individual settings *sections* become plugin contributions later via a `contributes.settings` family (new, out of scope here; ticketed follow-up) |

**Session widgets — 2** (`renderer/session-widget-registry.tsx`): `session-task-list`,
`genui-artifacts` → both already have matrix rows (`firefly.built-in.widget.*`).

**Host chrome — never plugins** (rationale recorded, mirrors matrix `host-only` pattern):
left navigation sidebar (`sidebar.tsx`, `sidebar-layout.tsx`), app bar, command palette
shell, side-panel tab strip (`session-side-panel.tsx`), startup overlay, update banner.
These are the surfaces plugins project *into*; making them plugins inverts authority.

**Count for the directive:** 24 migratable surfaces enumerated (18 side-panel tabs + 4
main-pane + 2 widgets), of which 2 are justified host-only exceptions (plugins panel,
settings shell) → **22 become first-class plugins**.

### 1.3 Loom / AXI alignment (company direction, 2026-06-08)

Per `ch5-company/docs/contracts/loom-protocol-spec.md` §6: *"this registry is your
plugin surface. A plugin contributes components to the registry; the manifest's Zod
schema you already designed is exactly this contract. Loom components and Firefly
plugins can be the same artifact."* And `agent-ui-direction-axi-loom.md` rule 3: plugin
manifest and component contract are the **same Zod artifact**, discoverable
smallest-schema-first.

Concrete obligations for this plan:
- The V2 manifest stays the single Zod registry. Loom wave 6
  (`contributes.components`, see `.sisyphus/plans/loom-progress.md`) adds the component
  family to the SAME schema — sidebar migration must not fork a second registry.
- Each migrated plugin's paired tools follow AXI: smallest-schema-first
  (`plugins.list` → `plugins.describe` → `plugin.<id>.*`), typed results, structured
  errors. This already matches the V2 tool envelope; keep it.
- **Do not block on Loom waves 2–5** (they are `blocked` on open transport/decision
  items). The migration uses render modes that exist today; `declarative-props` panels
  become Loom-tree-rendered when wave 2+ lands, with no manifest change.

### 1.4 Federation tier — honest finding

There is **no browser-isolated sub-app / module-federation runtime tier in the desktop
client today.** "Federation" in repo canon (`.sisyphus/goals/current-goal.md`) means
*repo-level* federation: firefly-cloud, folio-db, open-pencil stay separate repos and
federate via shared `@ch5me/*` packages. The closest in-app isolation surfaces are:
- `studio-panel.tsx` office preview `<iframe>` (ad hoc, no sandbox policy),
- the browser-lane runtime (`main/browser-lane-*.ts`, separate processes for web content).

Consequence: the in-shell plugin tier cannot lean on an existing sub-app sandbox. The
manifest's `render.mode: "iframe"` escape hatch (with `iframeSandbox` attr string)
needs its **own** host-enforced sandbox policy (Task 9). The studio iframe should be
retrofitted onto that policy rather than staying bespoke.

---

## 2. Decisions

### 2.1 Containment model — tiered, justified against the no-crash bar

The bar is "**no plugin can crash anything**". Decompose what can crash:

1. **Main process** — already protected: V2 guardrail "no plugin code in main" is locked
   and enforced by the catalog design. Main only parses manifests (Zod `safeParse` at the
   catalog boundary quarantines bad manifests without blocking the catalog) and brokers
   capabilities. **No change needed; keep the guardrail absolute.**
2. **Plugin logic (tools, handlers, background work)** — **process grade**: one Electron
   `utilityProcess` plugin host, one `worker_thread` per active plugin under it, exactly
   as the locked `runtime-supervision.ts` contract specifies (heartbeats, hang detection,
   crash counters, quarantine with durable `QuarantineRecord`). A hung or crashed worker
   is killed and quarantined; the host and other plugins are unaffected. This is the
   VS Code extension-host posture (VS Code likewise runs ALL extensions in one
   extension-host process, with the renderer/workbench protected from them).
3. **Plugin UI** — **error-boundary grade inside the renderer, by render mode**:
   - `host-reconciler` (built-in/trusted panels, the migration default): the panel React
     subtree mounts inside a **per-plugin React error boundary** that (a) contains the
     throw, (b) reports a `partialActivation`/`workerCrashed`-equivalent supervision
     event to main, (c) renders a typed fallback with "restart surface / disable plugin"
     actions. Repeated UI crashes count toward the same quarantine counter as worker
     crashes (`quarantineOnCrashCount`, default 3).
   - `declarative-props` (AI-authored / Loom): plugin sends **data**, never code; the
     host renders registered components with Zod-validated props. A malformed tree is a
     validation failure, not a crash. This is the strongest containment and the Loom
     end-state.
   - `iframe` (explicit escape hatch): sandboxed iframe, host-defined sandbox allowlist,
     postMessage bridge only. Process-isolated by Chromium.

**Why error-boundary grade is sufficient for first-party panel UI (the call, justified):**
a built-in panel's React code is host code today — moving it into a process cannot
protect the renderer, because the UI must ultimately execute in the renderer to be UI.
VS Code makes the same trade: webview/extension *logic* is out-of-process, but
workbench-contributed UI is in-process and protected by disposal/error containment. The
no-crash bar is met because: renderer exceptions are contained per-panel by boundary;
the surviving failure class (infinite loop in a panel render hanging the renderer) is
mitigated by (a) moving all non-trivial plugin compute to the worker tier and keeping
panels thin views over IPC state, and (b) the supervision hang-detection path being able
to disable + unmount the offending panel on next paint. Third-party UI **never** gets
`host-reconciler` — `gate-matrix.ts` capability gates already encode trust-tier checks;
this plan locks: `render.mode: "host-reconciler"` requires `trust: "built-in"` or
`"local-dev"`. Third-party/AI UI is `declarative-props` or `iframe` only.

### 2.2 Manifest + schema — reuse V2, two additions

The V2 manifest (`firefly.plugin/v2`) is the per-plugin schema. No new schema system.
Additions (manifest-revision-gated, backward compatible):

1. **`render.mode` × trust enforcement** (above) — a descriptor-derivation rule plus
   gate-matrix entry, not a schema change.
2. **Serializable manifest profile for disk loading.** `manifest.ts` allows live Zod
   nodes in `contributes.tools[].args` (`z.custom<z.ZodTypeAny>`), which cannot ship as
   a JSON file. Resolution: built-in plugins keep **TypeScript manifests** compiled
   per-plugin (the manifest is code, imported by the per-plugin build); third-party /
   disk-loaded plugins use the **JSON profile** where `args` entries are JSON-Schema
   fragments converted at the catalog boundary (one new module
   `shared/firefly-plugin/json-manifest.ts` + tests). This keeps "first-party and
   third-party use the SAME runtime path" true at the descriptor level — both paths
   produce identical `PluginDescriptor`s.

### 2.3 Per-plugin build pipeline

Today both manifests are imported in-source by `main/firefly-plugin/catalog.ts`. Target:

```
apps/desktop/plugins/<plugin-id>/
  manifest.ts          # typed PluginManifest (the same Zod artifact)
  panel/               # panel React code (host-reconciler) or component pack (Loom)
  worker/              # worker_thread entry: tool handlers, background logic
  package.json         # name=@firefly-plugin/<id>, own deps allowed (no native deps for AI-authored)
```

- **Build:** one Vite **lib-mode build per plugin** driven by a single
  `scripts/build-plugins.ts` (bun) that globs `apps/desktop/plugins/*/manifest.ts` and
  emits `out/plugins/<id>/{manifest.json|manifest.mjs, worker.mjs, panel.mjs}`.
  electron-vite keeps owning main/preload/renderer; plugins are a sibling build step
  wired into `bun run build` and `electron-builder` `extraResources`. (Do NOT try to
  multiplex N plugin entries through the electron-vite renderer config — externalized
  React + worker targets differ per artifact.)
- **Panel chunks load lazily** in the renderer via dynamic `import()` keyed by the
  catalog's projected panel id — replacing today's eager static imports in
  `firefly-surface-registry.tsx`. A panel bundle that fails to load = `degraded` state +
  fallback UI, not a crash (fail loud: typed error names the missing artifact).
- **CI gate:** `scripts/validate-plugin-manifests.ts` runs `parsePluginManifest` (TS
  path) and the JSON-profile parser over every plugin dir; wired into `bun run lint`
  path used by `quality-gate`. A manifest that doesn't parse fails the build — the
  schema IS the contract (fail fast, no fallback).
- **Hot reload (dev):** implement the existing `hot-reload.ts` contract against the
  watcher: manifest/worker change → `hotReloadRequested` → `tearingDown` → re-derive
  descriptor → re-project. Renderer panels remount via projection change; no app restart.

### 2.4 Migration order (phases from the locked matrix, refined by risk)

Phases follow `FIRST_PARTY_MIGRATION_MATRIX` with this ordering inside phase 1, chosen
so each slice adds exactly one new platform seam:

| Order | Surface | New seam it proves |
|---|---|---|
| **1. notes** | first full panel cutover | registry-row deletion → catalog projection; flag→plugin-enable migration; commands; paired tools; storage scope; teardown |
| 2. pdf-review | in-flight tool **cancellation** on disable (matrix: `cancel-in-flight-tool`) | |
| 3. files | host-capability-bridged IPC (`main/files.ts`) through the capability broker | |
| 4. artifacts (+ both session widgets) | **widget family** projection + genui zone | |
| 5. review | high-traffic default-on surface; git IPC | |
| 6. terminal | live PTY teardown semantics | |
| 7. bridges | bridge-registry introspection pairing | |
| 8. browser | browser-lane capability (`host:browser.lane-control`); palot-bridge tool re-export | |
| Phase 2 | pulse, memory, editor, crm | mechanical repeats |
| Phase 3 | studio (iframe policy), voice (audio capability), oracle, claude, ch5pm; main-pane: project-manager, automations | |
| Phase 4 | chat/main-pane (only after the platform carried 20+ surfaces) | |
| Host-only (locked rationale) | plugins panel, settings shell, host chrome | |

Each migration slice is the same mechanical recipe (Task 7), so Atlas workers can run
them in parallel after slice 1 locks the recipe.

### 2.5 First slice: **Notes** — and why

Honest criterion: most platform seams exercised at least risk.
- Seams exercised: manifest→descriptor→catalog→**renderer projection replacing a
  hardcoded registry row** (the one seam nothing exercises today), per-plugin build +
  lazy panel chunk, command projection into the palette (`surface.notes.open/toggle`
  continuity), paired Zod tools (`plugin.firefly.built-in.surface.notes.open` + a
  `notes.state` read tool — AXI-compliant), storage scope (`side-panel.notes`
  persistence key → V2 storage scopes), feature-flag → plugin-enable/disable migration,
  teardown (`close-surface`, `dismiss-widget`), error-boundary containment, quarantine
  drill.
- Risk floor: no PTY, no browser lanes, no git IPC, no genui/Loom flux coupling, no
  in-flight tool calls (matrix note: "no in-flight tool calls to cancel"), default-on
  but low blast radius — a broken Notes panel never blocks the chat loop.
- What Notes does NOT prove (named honestly, covered by slices 2–4): in-flight tool
  cancellation (pdf-review), widget family (artifacts), broker-gated main IPC (files).

### 2.6 What "first-class" means (acceptance semantics)

A sidebar is a first-class plugin when: its `FIREFLY_SURFACE_REGISTRY` row is
**deleted**; its UI, commands, availability, persistence, and telemetry derive solely
from the catalog projection; it can be disabled/enabled/quarantined at runtime via the
operator surface with the matrix teardown behaviors; its paired tools are visible to
OpenCode via the bridge projection; killing/crashing it (UI throw + worker crash + hang)
provably leaves the rest of the app running.

---

## 3. Work breakdown (Atlas tasks)

Verification commands for every task: `bun run check-types && bun run lint` (repo
gates), `bun test apps/desktop/src/shared/firefly-plugin apps/desktop/src/main/firefly-plugin`
plus task-specific proofs. Commit each task by pathspec; pull --rebase first; push main.

**Task 1 — Plugin worker host (process tier).**
Implement the `utilityProcess` plugin host + per-plugin `worker_thread` runtime against
`runtime-supervision.ts` (route every state change through `applySupervisionEvent`;
persist `QuarantineRecord`s in the settings store). Heartbeat + hang detection per
contract. Proof: integration test spawns a deliberately-crashing and a hanging fixture
plugin; both reach `quarantined` without affecting a healthy sibling or the app.

**Task 2 — Disk/package catalog loading + JSON manifest profile.**
`shared/firefly-plugin/json-manifest.ts` (JSON-Schema→Zod arg conversion at the
boundary, typed errors); catalog discovers `out/plugins/*` (packaged) and
`apps/desktop/plugins/*` (dev). Bad manifest ⇒ quarantined entry visible in operator
surface, rest of catalog loads. Proof: unit tests + boot probe extension.

**Task 3 — Per-plugin build pipeline.**
`scripts/build-plugins.ts` + `scripts/validate-plugin-manifests.ts`; wire into
`bun run build`, electron-builder `extraResources`, and the lint gate. Proof: clean
`bun run package:mac` smoke (CSC_IDENTITY_AUTO_DISCOVERY=false) with plugins present in
the packaged app's resources; validator fails CI on a fixture-bad manifest.

**Task 4 — Renderer projection cutover seam.**
`agent-detail.tsx` + `command-palette.tsx` consume a merged view:
catalog-projected panels (via `projectSidePanelsFromCatalog`) ∪ remaining hardcoded
registry rows, so surfaces migrate one at a time with zero UX change. Per-plugin error
boundary component (`PluginPanelBoundary`) with supervision reporting + fallback UI.
Lazy `import()` of panel chunks. Proof: with zero migrated plugins the UI is unchanged
(snapshot tests on tab list); boundary test contains a thrown render.

**Task 5 — Enable/disable/quarantine UX + teardown engine.**
Implement matrix teardown behaviors (`close-surface`, `dismiss-widget`,
`deregister-command`, `cancel-in-flight-tool`, `preserve-state`) as a host walker keyed
off lifecycle transitions; surface enable/disable in the v2-plugins operator panel
(replacing feature-flag atoms for migrated surfaces, with a one-time preference
migration: flag value → plugin enabled state). Proof: disable active Notes → panel
closes, commands vanish from palette, tools vanish from bridge projection; re-enable
restores; preference migration unit test.

**Task 6 — FIRST SLICE: Notes panel as `firefly.built-in.surface.notes`.**
Create `apps/desktop/plugins/notes/` (manifest per matrix row: capabilities
`host:panel.register`, `host:command.register`; activation `onPanelOpen`/`onCommand`;
panel `render.mode: "host-reconciler"`; tools `…notes.open` + `…notes.state`). Move
`notes-panel.tsx` in; delete the registry row and `notesSurfaceEnabledAtom` usage.
Proof criteria (the template for every subsequent migration):
1. registry row deleted; tab renders only via catalog projection (grep-proof:
   `notes` absent from `firefly-surface-registry.tsx`);
2. `surface.notes.open`/`toggle` still work from the palette (projected, ids stable);
3. OpenCode session can call `plugin.firefly.built-in.surface.notes.open` and `.state`
   (live session proof via palot bridge);
4. disable/enable + quarantine drill passes (Task 5 behaviors);
5. thrown render in NotesPanel contains to fallback; app + chat keep working
   (boundary integration test);
6. persistence key honored (panel state survives restart);
7. `check-types`, `lint`, full firefly-plugin test suite, packaged smoke all green.

**Task 7 — Migration recipe doc + parallel rollout of phase-1 remainder.**
Write `docs/plugin-migration-recipe.md` from the Notes diff (mechanical checklist +
proof criteria above). Then slices in §2.4 order: pdf-review, files, artifacts(+widgets),
review, terminal, bridges, browser. Each = one commit, same proof template, plus the
slice's named "new seam" proof.

**Task 8 — Matrix hygiene + drift fixes (small, do early).**
`first-party-migration.ts`: deduplicate the doubled `browser` row (append-only ≠
duplicated key; add a superseding-row convention instead), fix
`findFirstPartyMigrationRow` first-match ambiguity, correct `currentFile` drift
(`palot-bridge` row points at `main/palot-plugin/plugin.js`; actual:
`main/palot-plugin-entry.ts` / `.opencode` bundle), add matrix rows for the 4 main-pane
surfaces + host-only rows for settings shell/host chrome so the inventory in §1.2 is
encoded in source. Proof: tests updated, matrix row count matches §1.2.

**Task 9 — Iframe sandbox policy + studio retrofit (phase-3 gate, design now).**
Host-enforced sandbox allowlist for `render.mode: "iframe"` (default-deny; explicit
`iframeSandbox` validated against host policy), postMessage bridge with Zod-validated
frames, CSP. Retrofit the studio office-preview iframe onto it. This is the containment
story for the missing federation tier (§1.4).

**Task 10 — Loom convergence checkpoint (no implementation).**
When Loom wave 6 lands `contributes.components`, panels using `declarative-props`
declare component packs in the SAME manifest. This task is only: keep
`render.declarativeSchemaRef` stable, add a one-page alignment note to
`docs/loom-alignment-assessment.md`, and verify no second registry appeared
(grep-proof). Blocked-on-Loom items must NOT block Tasks 1–9.

Dependencies: T1–T4 parallelizable; T5 needs T4; T6 needs T1–T5; T7 needs T6; T8
anytime; T9 design anytime, retrofit in phase 3; T10 event-driven.

---

## 4. Momus self-review (5 weakest claims, found and fixed)

1. **"Error boundaries satisfy 'no plugin can crash anything'" — was overclaimed.**
   A render infinite-loop or sync busy-loop in a host-reconciler panel can still wedge
   the renderer; boundaries only catch throws. Fixed in §2.1: thin-view rule (compute
   lives in the worker tier), trust-gating host-reconciler to built-in/local-dev only,
   hang-detection disable path, and `declarative-props`/`iframe` as the only third-party
   UI modes. The residual risk is named, not hidden.
2. **"Notes exercises the most seams" — was false as originally drafted.** Notes skips
   in-flight tool cancellation, widget projection, and broker-gated main IPC. Fixed in
   §2.5: those gaps are named and assigned to slices 2–4 so the recipe is complete
   before the high-risk surfaces (terminal/browser) migrate.
3. **"Manifests load from disk" contradicted the schema** — `tools[].args` holds live
   Zod nodes that cannot serialize. Fixed in §2.2/§Task 2 with the dual profile
   (TS manifests compiled per-plugin; JSON profile with JSON-Schema args converted at
   the boundary), keeping one descriptor path.
4. **"Per-plugin builds via electron-vite" was hand-waved.** electron-vite's
   main/preload/renderer triad doesn't naturally emit N worker+panel bundles with
   distinct externals. Fixed in §2.3: sibling bun-driven Vite lib-mode builds +
   `extraResources`, with packaged-app smoke as the proof, and an explicit "do not
   multiplex through the renderer config" warning.
5. **The migration matrix was treated as clean ground truth — it isn't.** It contains a
   duplicated `browser` row, a first-match lookup that hides the duplicate, and a stale
   `currentFile` for palot-bridge; and it lacks rows for main-pane surfaces, so "every
   single sidebar" wasn't actually encoded anywhere in source. Fixed by adding Task 8
   (matrix hygiene + completing rows to match the §1.2 inventory).

---

## 5. Success criteria (plan-level)

- [ ] All phase-1 surfaces (notes, pdf-review, files, artifacts+widgets, review,
      terminal, bridges, browser) serve from the catalog; their registry rows are gone.
- [ ] Crash drill green: UI throw, worker crash, worker hang, bad manifest — each
      contained + quarantined with app and chat loop unaffected (automated tests).
- [ ] Per-plugin build + manifest validation in CI; packaged mac smoke passes.
- [ ] Every migrated surface has paired AXI-compliant tools callable from a live
      OpenCode session.
- [ ] One registry: V2 manifest = Loom component contract seam intact (no parallel
      registry introduced).
- [ ] `firefly-surface-registry.tsx` shrinks monotonically; final state (post phase-3)
      is deletion.
