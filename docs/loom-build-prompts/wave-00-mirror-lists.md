# Wave 0 — Collapse the 7 mirror lists (prerequisite) <!-- oc:id=sec_aa -->

> **Status:** ready to dispatch.
> **Plan section:** `docs/loom-implementation-plan.md` §3 Phase 0.
> **Assessment anchor:** `docs/loom-alignment-assessment.md` §4 + Appendix A.
> **Goal:** one source of truth for the 18 side-panel surface ids. Zero
> behavior change. No Loom-shaped API yet.

## Context (for the worker) <!-- oc:id=sec_ab -->

palot's renderer GenUI is already partially Loom-shaped (typed registry, allowlisted components, Zod schemas for the bridge). But the side-panel surface layer has **7 mirror lists** of the same 18 surface ids; every new surface requires editing all 7. This wave collapses them to one. **It is not Loom code** — it is the prerequisite that lets every later Loom wave (1–6) be reviewable in isolation.

## Why this is the first dispatch <!-- oc:id=sec_ac -->

- The worst offender is `apps/desktop/src/main/palot-plugin/plugin.js:124–143` (`VALID_SIDE_PANEL_TABS`). It is the validation boundary for the `open_side_panel` tool. A new surface added to the V1 registry but not to that list surfaces to the agent as `Invalid side panel tab. Expected one of: …`.
- The V2 plugin manifest already has the right shape (`contributes.panels`). The renderer registry is a V1 prototype. Unifying them is consolidation, not invention.
- Zero behavior change. The change is provable by `git grep` alone.

## Touched files <!-- oc:id=sec_ad -->

- `apps/desktop/src/renderer/firefly-surface-registry.tsx` — add a `manifestId` field; the 18-entry array becomes the canonical list.
- `apps/desktop/src/renderer/atoms/feature-flags.ts:26–180` — collapse 17 per-surface storage atoms into one `surfaceFlagsFamily(panelId)`. Keep the same `atomWithStorage` key so user prefs survive.
- `apps/desktop/src/renderer/atoms/ui.ts:25–43` — derive `SidePanelTabId` from the registry at module load (compile-time `as const`).
- `apps/desktop/src/renderer/components/agent-detail.tsx:27–44, 220–285` — replace 17 `useAtomValue` calls with a single `useFireflySurfaceContext(agent)` hook (new file `apps/desktop/src/renderer/hooks/use-firefly-surface-context.ts`).
- `apps/desktop/src/renderer/components/command-palette.tsx:460–648` — iterate the registry for the Features group. The Surfaces group at `:649–671` is already registry-driven.
- `apps/desktop/src/renderer/components/side-panel/side-panel-tabs.tsx` — consume the new hook.
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts:21–40` — replace `palotSidePanelTabSchema` with a derived `z.enum`.
- `apps/desktop/src/main/palot-plugin/plugin.js:124–143` — replace `VALID_SIDE_PANEL_TABS` with a JS array imported from a shared file the renderer registry exports. JS reads JSON, so the export path is `apps/desktop/src/renderer/firefly-surface-registry-ids.json` (build-emitted) or a small `apps/desktop/src/shared/firefly-plugin/surface-ids.ts` that both runtimes import.
- `docs/firefly-surface-playbook.md:25–31` — rewrite the "add a surface" checklist to "add a row to the table".

## Required tools <!-- oc:id=sec_ae -->

- `edit`, `write`, `read`
- `bun run check-types`, `bun run lint`
- `bun test` (Bun test, per `AGENTS.md:242–248`)
- `git grep` to assert mirror lists collapsed

## Must do <!-- oc:id=sec_af -->

1. Add a new test: `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` that iterates the registry, then asserts: <!-- oc:id=item_aa -->
   - `SidePanelTabId` (the derived type) has the same set of values as the registry.
   - The keys of `surfaceFlagsFamily` cover the same set.
   - `palotSidePanelTabSchema`'s `z.enum` covers the same set.
   - `plugin.js`'s `VALID_SIDE_PANEL_TABS` covers the same set.
   - The `fireflySurfaceLabels` table (in `feature-flags.ts`) covers the same set.
   - The `fireflySurfaceFlagAtoms` table (in `feature-flags.ts`) covers the same set.
   - The command-palette's Features group iterates the registry, not a hardcoded list.
   - Test fails CI if any list drifts.
1. The hook `useFireflySurfaceContext(agent)` returns a stable `flags` object derived from the registry + a `toggle(panelId)` mutator. <!-- oc:id=item_ab -->
1. All 18 surfaces' `defaultOn`, persistence keys, command ids, telemetry namespaces, and feature-flag keys come from the registry, not from a separate parallel table. <!-- oc:id=item_ac -->
1. Public type stability: `SidePanelTabId` keeps the same string-literal type. `window.elf` API unchanged. <!-- oc:id=item_ad -->
1. `firefly-surface-registry.tsx` stays the source of truth for `id` + `title` + `icon` + `spawn`. The 18 `FireflySurfaceDef` entries do not lose data. <!-- oc:id=item_ae -->

## Must NOT do <!-- oc:id=sec_ag -->

- No new transport, no new bridge tools, no WS, no TOON.
- No new components. The 18 surfaces stay the same 18.
- No changes to `apps/desktop/src/renderer/genui/registry.ts` or any GenUI fence logic.
- No new persistence path. `atomWithStorage` stays.
- No deprecation of any public path. `window.elf.*` unchanged.
- Do not bundle V2 manifest work into this wave. V2 `panels` family is already in place; consolidating V1 + V2 surfaces is a future wave.

## Proof criteria <!-- oc:id=sec_ah -->

1. `git grep "review.*browser.*notes.*pulse" -- 'apps/desktop/**' 2>/dev/null` returns at most 3 hits (canonical registry, docs, test). <!-- oc:id=item_af -->
1. `bun run check-types` clean. <!-- oc:id=item_ag -->
1. `bun run lint` clean. <!-- oc:id=item_ah -->
1. The new mirror-list test passes. <!-- oc:id=item_ai -->
1. Manual smoke: open a chat, open the side panel, toggle every tab. Visuals unchanged. Feature-flag defaults unchanged. Persistence survives a reload. <!-- oc:id=item_aj -->

## Risk <!-- oc:id=sec_ai -->

- Low. Pure refactor, no behavior change. Reversible in one PR.
- Failure mode: forgetting a derivation point and leaving a hardcoded id somewhere. The new test catches this.

## Out of scope (for later waves) <!-- oc:id=sec_aj -->

- Wave 1 (typed registry + `list` / `describe`).
- V2 `contributes.components` family.
- `dag-sparkline` legacy fence shortcut.
- Artifact store persistence.
- TOON encoding.

## Definition of done <!-- oc:id=sec_ak -->

- All proof criteria pass.
- `docs/loom-progress.md` is updated with `Wave 0: complete (date)`.
- A changeset (`bun changeset`) is added if the change is user-facing (it should not be — this is a refactor).
- A PR is opened; description cites this prompt + the plan section.