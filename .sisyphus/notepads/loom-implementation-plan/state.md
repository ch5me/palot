# Loom Implementation — Atlas Execution Notepad <!-- oc:id=sec_aa -->

## Status <!-- oc:id=sec_ab -->
- **Wave 0 (Mirror Lists Collapse)**: merged (2026-06-08)
- **Wave 1 (Typed Zod Registry)**: in progress (Slice 1 committed+pushed; Slices 2-5 delegated to deep junior)
- **Wave 2 (Loom Wire)**: blocked (D1/D3/D4 + ensurePalotBridgeServer pre-flight)
- **Wave 3 (Dual Bindings)**: blocked (wave 2)
- **Wave 4 (Per-node rev + dirty)**: blocked (wave 3)
- **Wave 5 (Durable Identity + append)**: blocked (wave 4)
- **Wave 6 (V2 components)**: blocked (wave 5)
- **Wave 7 (Tool-renderer consolidation)**: not started, deferred

## Worktree <!-- oc:id=sec_ac -->
- Path: `~/worktrees/ch5/palot/loom-atlas`
- Branch: `atlas/loom` (off palot `main` HEAD `9b23eb34`)
- Baseline dirty: `bun.lock` only (PM install artifact) — must include in first commit

## Wave 0 slice status <!-- oc:id=sec_ah -->
- [x] **Slice 1**: registry enriched with `manifestId`; `FireflySurfaceId` + `FIREFLY_SURFACE_IDS` + `FIREFLY_SURFACE_DEFAULT_ON` + `FIREFLY_SURFACE_LABELS` + `FIREFLY_SURFACE_REGISTRY_BY_ID` exported; runtime assertion checks registry drift. File `apps/desktop/src/renderer/firefly-surface-registry.tsx`. **NO new type errors** introduced.
- [x] **Slice 2**: `feature-flags.ts` rewritten — 17 individual `*SurfaceEnabledAtom` exports kept as derived aliases (byte-identical storage keys for persistence), `fireflySurfaceDefaults` derived from registry, `fireflySurfaceFlagAtoms` + `fireflySurfaceLabels` derived, 17 `toggle*SurfaceAtom` derived from a single factory.
- [x] **Slice 3a**: `atoms/ui.ts` — `SidePanelTabId` is now `type SidePanelTabId = FireflySurfaceId` (re-export of registry's union). `preferences.ts` — `lastSidePanelTab` typed as `SidePanelTabId`.
- [x] **Slice 3b**: `palot-bridge-manifest.ts` — `palotSidePanelTabSchema = z.enum(FIREFLY_SURFACE_IDS)`. `palot-bridge-schemas.ts` — `sidePanelTabValues = FIREFLY_SURFACE_IDS`.
- [x] **Slice 3c**: `plugin.js` — `VALID_SIDE_PANEL_TABS` now derived from `firefly-surface-registry-ids.json` sidecar via `readFileSync`. JSON sidecar emitted at `apps/desktop/src/renderer/firefly-surface-registry-ids.json`.
- [x] **Slice 3d**: `useFireflySurfaceContext()` hook created at `apps/desktop/src/renderer/hooks/use-firefly-surface-context.ts` (scaffolding in place; integration into agent-detail.tsx and command-palette.tsx is Slice 4).
- [committed] `eb1d70f8 wave-0: collapse the 7 mirror lists to a single registry source` — pushed to `origin/atlas/loom`.
- [x] **Slice 4**: replace 17 `useAtomValue` calls in `agent-detail.tsx:220-285` with `useFireflySurfaceContext()`; iterate registry for Features group in `command-palette.tsx:460-648` (Surfaces group at `:649-671` already registry-driven). Commits `d11176b0`.
- [x] **Slice 5**: delete `genui-artifact-context.ts` (24 LOC dead code); update `docs/firefly-surface-playbook.md:25-31`. Commit `030fcd68`.
- [x] **Slice 6**: add `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` CI guard; run `bun run check-types` + `bun run lint`; update `.sisyphus/plans/loom-progress.md` with `Wave 0: complete (date)`. Commits `b0e5ebab`, `8bef7e2f`, `178ce220`, `23ae3060`. Plus progress doc update.

## Type error status <!-- oc:id=sec_ai -->
- **Baseline (pre-Wave-0)**: 11 errors (8 in sidebar.tsx/command-palette.tsx/sidebar.tsx for `Agent` type drift, 2 in `palot-browser-ipc.ts` for `ensurePalotBridgeServer`/`registerPalotBrowserWindows` missing, 1 in `opencode-manager.ts` for `ensurePalotBridgeServer` import).
- **After Slice 1+2+3**: 11 errors. **Zero new errors** introduced by Wave 0.
- All Wave 0 errors are pre-existing on `main` (Appendix C.1 pre-flight + unrelated `Agent` type drift). Not in scope for Wave 0.

## Key files <!-- oc:id=sec_aj -->
- Plan: `.sisyphus/plans/loom-implementation-plan.md`
- Progress: `.sisyphus/plans/loom-progress.md`
- Registry: `apps/desktop/src/renderer/firefly-surface-registry.tsx` (522 lines, was 484)
- Flags: `apps/desktop/src/renderer/atoms/feature-flags.ts` (104 lines, was 180)
- UI atoms: `apps/desktop/src/renderer/atoms/ui.ts` (unchanged length)
- Manifest: `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts`
- Bridge schemas: `apps/desktop/src/shared/palot-bridge-schemas.ts`
- Plugin: `apps/desktop/src/main/palot-plugin/plugin.js`
- JSON sidecar: `apps/desktop/src/renderer/firefly-surface-registry-ids.json`
- Hook: `apps/desktop/src/renderer/hooks/use-firefly-surface-context.ts` (new, scaffolding only)
- Bridge IPC: `apps/desktop/src/main/palot-browser-ipc.ts` (200 lines, NO `ensurePalotBridgeServer` export — Wave 2 pre-flight)

## Critical findings from research <!-- oc:id=sec_ak -->
- 18 surface IDs appear in 7 places (per alignment assessment Appendix A)
- `genui-artifact-context.ts` (24 LOC) is dead code, 0 callers
- `palot-browser-ipc.ts` does NOT export `ensurePalotBridgeServer` — confirmed via grep
- `sidePanelTabValues` and `sidePanelTabSchema` exist in `palot-bridge-schemas.ts:3-24` as duplicate of manifest
- `FireflySurfacePreferences.lastSidePanelTab` in `preferences.ts:25-45` has same union typed inline

## Quality gate <!-- oc:id=sec_al -->
- `bun run lint` (Biome) — passes clean baseline; verify after Slice 6
- `bun run check-types` — same 11 pre-existing errors before/after Wave 0 Slices 1-3
- `bun test` (only `packages/configconv` has tests; desktop has none) — N/A for Wave 0

## Risk log <!-- oc:id=sec_am -->
- (none yet)