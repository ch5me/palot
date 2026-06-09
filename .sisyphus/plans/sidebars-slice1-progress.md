# Sidebars-as-plugins — Slice 1 progress (Notes)

Plan: `.sisyphus/plans/sidebars-as-first-class-plugins.md` (998c6f28).
Ticket: CH5COMPAC4C-284. Session 1 landed 2026-06-09.

## Landed (palot main)

| Commit | Plan task | What |
|---|---|---|
| ab253e81 | T2 | JSON manifest profile (`shared/firefly-plugin/json-manifest.ts`) + disk catalog discovery (`main/firefly-plugin/disk-manifests.ts`); bad manifest ⇒ quarantined entry; disk manifests claiming built-in trust quarantined |
| c80841cb | T1 | `worker-supervisor.ts` + `worker-thread-spawner.ts`: per-plugin worker_thread runtime fully driven by the locked `applySupervisionEvent` reducer; heartbeat/hang scan, activation timeout, restart backoff, durable QuarantineRecord store. **Quarantine drill proven with real worker_threads fixtures** (crash / hang / never-ready ⇒ quarantined; healthy sibling + host unaffected) |
| 736e2b12 | T4+T5 core | Renderer merged view (catalog ∪ registry, catalog wins, canonical order; identity test with zero migrated plugins), `PluginPanelBoundary` (typed fallback + crash report IPC), lifecycle-state store (durable enable/disable + UI-crash quarantine counter at `<userData>/firefly-plugins.json`), catalog `stateOverrides`, IPC set-enabled / panel-crash / release-quarantine |
| df616e40 | T6 | **Notes served from the catalog**: `apps/desktop/plugins/notes/` (manifest + panel as lazy chunk), registry row + `notesSurfaceEnabledAtom` deleted, V2 tool dispatch (`invokePluginTool` + `firefly-plugin:invoke-tool`), notes.open/notes.state handlers wired to live side-panel broadcast/snapshot, one-time flag migration, 14 slice-proof tests incl. UI-crash quarantine drill |

Gates: 600 firefly-plugin/notes tests pass (5 consecutive runs); electron-vite
build green (notes panel = own lazy renderer chunk; manifest in main bundle).
NOTE: repo `check-types`/`lint` have PRE-EXISTING failures on main in
unrelated files (sidebar.tsx, use-discovery.ts, firefly-runtime-client.test.ts,
apps/server format) — not from this work; verified by checking HEAD before
changes.

## Next session picks up

1. **T3 — per-plugin build pipeline**: `scripts/build-plugins.ts` (bun-driven
   Vite lib-mode per `apps/desktop/plugins/*`), `scripts/validate-plugin-manifests.ts`
   wired into lint gate, electron-builder `extraResources`, packaged mac smoke
   (`CSC_IDENTITY_AUTO_DISCOVERY=false`). Built-ins currently ride electron-vite
   lazy chunks (acceptable for first-party; disk loader is ready and tested).
2. **Live OpenCode tool proof (T6 criterion 3)**: the palot OpenCode plugin
   (`main/palot-plugin/plugin.js`) registers tools statically; it must project
   catalog tools (`plugin.<id>.*`) dynamically and route execution to
   `invokePluginTool` (host side is done + tested). Then prove from a live
   session: call `plugin.firefly.built-in.surface.notes.open` + `.state`.
3. **Boot the worker supervisor in main** (`main/index.ts`): instantiate
   `createPluginWorkerSupervisor` + `createWorkerThreadSpawner` for catalog
   plugins that ship worker entries; optionally move it under a utilityProcess
   host per plan §2.1 (supervisor is transport-injected, so this is wiring).
4. **Live app drill**: run the app, throw inside NotesPanel (dev hook),
   observe fallback + chat unaffected + quarantine after 3; confirm panel
   state survives restart (persistence key identity already proven in tests).
5. **Operator surface**: enable/disable/release buttons in `v2-plugins-panel`
   (IPC already exists; palette toggle landed).
6. **T8 matrix hygiene** (anytime): dedupe doubled `browser` row, fix
   `findFirstPartyMigrationRow` first-match, correct `currentFile` drift, add
   main-pane + host-only rows.
7. Then T7: write `docs/plugin-migration-recipe.md` from the Notes diff and
   fan out phase-1 slices (pdf-review → files → artifacts → …).

## Gotchas discovered

- Locked reducer resets `hangStreak` on re-activation ⇒ hang→restart→hang
  loops never quarantine via streak; host policy counts hang-class crashes in
  the crash window and emits `quarantineRequested` (see worker-supervisor.ts).
- Crashed-worker exit events can race the hang scanner under load — drills
  asserting a specific quarantine reason need a long hang timeout.
- Concurrent agents share this checkout: commit the registry-row deletion and
  the legacy panel deletion in the SAME commit or someone restores the file
  (happened: 85236a6e).
