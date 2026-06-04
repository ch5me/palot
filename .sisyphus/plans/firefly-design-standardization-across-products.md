# Firefly Design Standardization Across Products <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Standardize CH5 product UI on shared Firefly design packages across Firefly Cloud, Elf, FolioDB, and OpenPencil.

Canonical shared layers:
- `@ch5me/firefly-design` — tokens, CSS variables, semantic alias bridge, typography/radius/spacing contract
- `@ch5me/firefly-ui-web` — reusable web React primitives that consume canonical Firefly design tokens

## Non-goals <!-- oc:id=sec_ac -->
- Do not redesign every product to look identical.
- Do not force full component migration where token bridge is enough.
- Do not move OpenPencil onto shared React component source unless later evidence proves it is worth it.
- Do not encode product-local behavior inside shared packages unless at least two products truly need the same abstraction.
- Do not rely on fragile local cross-repo linking as the long-term package strategy.

## Current State <!-- oc:id=sec_ad -->
### Done <!-- oc:id=sec_ae -->
- `ch5-packages` now contains:
  - `packages/firefly/design`
  - `packages/firefly/ui-web`
- `firefly-cloud` has been migrated to consume the split shared packages for token/css/web surfaces.
- Shared package proof already exists in the shared package repo:
  - tests
  - boundary tests
  - build
- Firefly Cloud now acts as the migrated reference implementation.

### Key Evidence <!-- oc:id=sec_af -->
- Firefly Cloud token authority was local and is now extracted.
- Elf has its own theme registry plus shadcn-style root vars and is the first external adopter candidate.
- FolioDB already has a clear token bridge in `apps/web/src/styles/theme.css` and should prove the shared contract generalizes beyond Firefly Cloud + Elf
- OpenPencil has a compact token/theme lane in `src/app.css` + `src/app/shell/theme.ts`; this strongly suggests token bridge only, not shared React primitive adoption.

## Target Architecture <!-- oc:id=sec_ag -->
### Shared packages <!-- oc:id=sec_ah -->
1. `@ch5me/firefly-design` <!-- oc:id=item_aa -->
   - Owns semantic token contract
   - Owns CSS variable contract
   - Owns Tailwind semantic alias bridge
   - Owns typography, radius, spacing, and status tone canon
   - Must remain framework-light and broadly consumable

1. `@ch5me/firefly-ui-web` <!-- oc:id=item_ab -->
   - Owns proven reusable web primitives only
   - Must consume `@ch5me/firefly-design`
   - Must not encode Firefly Cloud-only app assumptions
   - Must stay safe for consumption in external React products

### Product repos <!-- oc:id=sec_ai -->
- Firefly Cloud remains proof/reference consumer
- Elf adopts token layer first, then selected web primitives where they map cleanly
- FolioDB adopts token bridge first, then selective primitives if Elf proves package fit
- OpenPencil adopts token bridge only

## Global Rules <!-- oc:id=sec_aj -->
- Token layer first, primitives second.
- Replace duplicate token definitions only after proof, not before.
- Product-specific shells, flows, charts, and domain-specific UI stay local.
- No broad visual churn for its own sake.
- Every repo change must end with verification proof and a clean push.
- If a shared package API only works because Firefly Cloud shaped it that way, fix the package before continuing to other products.
- If local linking creates React duplication or bundler instability, stop and adjust package consumption strategy before doing more migration.

## Execution Strategy <!-- oc:id=sec_ak -->
Run in this order:
1. Firefly Cloud guardrail hardening <!-- oc:id=item_ac -->
1. Elf adoption <!-- oc:id=item_ad -->
1. FolioDB adoption <!-- oc:id=item_ae -->
1. OpenPencil token bridge <!-- oc:id=item_af -->
1. Shared package cleanup and release hardening <!-- oc:id=item_ag -->
1. Cross-product regression pass <!-- oc:id=item_ah -->

## Phase 0 — Baseline Lock <!-- oc:id=sec_al -->
- [x] Record current package SHAs and pushed state:
- [x] Subtask: capture `ch5-packages` latest pushed commit containing `@ch5me/firefly-design` and `@ch5me/firefly-ui-web` from `git log --oneline` and `git status -sb`.
- [x] Subtask: capture `firefly-cloud` latest pushed commit consuming shared packages from `git log --oneline` and `git status -sb`.
- [x] Subtask: record whether Elf currently points at local-only theme lanes or shared package imports by reading `packages/ui/src/styles/globals.css`, `apps/desktop/src/renderer/lib/themes.ts`, and package manifests.
- [x] Subtask: record whether FolioDB currently points at `apps/web/src/styles/theme.css` and `components.json` only, or any shared CH5 package imports.
- [x] Subtask: record whether OpenPencil points only at local `src/app.css` and `src/app/shell/theme.ts`, with no shared CH5 package dependency.
- [x] Subtask: capture current dirty-state exceptions in each repo via `git status --short` and classify what must be preserved vs ignored.
- [x] Subtask: capture proof commands that currently succeed in `ch5-packages` and `firefly-cloud`, plus expected proof commands for Elf, FolioDB, and OpenPencil.
  - `ch5-packages` commit containing `@ch5me/firefly-design`
  - `ch5-packages` commit containing `@ch5me/firefly-ui-web`
  - `firefly-cloud` commit consuming shared packages
- [x] Record current dependency mode in each product:
  - published semver
  - workspace symlink
  - repo-local alias
- [x] Record current proof commands per repo so later regressions have a baseline.
- [x] Record current known dirty-state exceptions in each repo before more work starts.
- [x] Confirm there is one written source of truth for token semantics:
  - `@ch5me/firefly-design`
- [x] Confirm `@ch5me/firefly-ui-web` only contains primitives that are already proven reusable.

## Phase 1 — Shared Package Hardening <!-- oc:id=sec_am -->
### Package API review <!-- oc:id=sec_an -->
- [ ] Review `@ch5me/firefly-design` exports and confirm they cover:
  - token TS exports
  - CSS custom properties
  - Tailwind semantic alias bridge
  - status copy
  - typography/radius/spacing contract
- [ ] Review `@ch5me/firefly-ui-web` exports and confirm they cover only:
  - aurora/orb/glass/status/wordmark/frame/token-like primitives
- [ ] Audit package names and public import surfaces for stability.
- [ ] Confirm package docs explain intended consumption shape for:
  - plain CSS import
  - token object import
  - web primitive import

### Package verification <!-- oc:id=sec_ao -->
- [x] Run package proof again before any consumer migration:
- [x] Subtask: run `pnpm --filter @ch5me/firefly-design test` in `ch5-packages` and capture pass/fail.
- [x] Subtask: run `pnpm --filter @ch5me/firefly-design test:boundary` in `ch5-packages` and capture pass/fail.
- [x] Subtask: run `pnpm --filter @ch5me/firefly-design build` in `ch5-packages` and capture pass/fail.
- [x] Subtask: run `pnpm --filter @ch5me/firefly-ui-web test` in `ch5-packages` and capture pass/fail.
- [x] Subtask: run `pnpm --filter @ch5me/firefly-ui-web test:boundary` in `ch5-packages` and capture pass/fail.
- [x] Subtask: run `pnpm --filter @ch5me/firefly-ui-web build` in `ch5-packages` and capture pass/fail.
- [x] Subtask: read `packages/firefly/design/src/tokens.ts` and `packages/firefly/design/src/tailwind.css` line by line to confirm token/css drift has not reappeared.
- [x] Subtask: read `packages/firefly/ui-web/src/index.tsx` to confirm only generic web primitives are exported.
  - `pnpm --filter @ch5me/firefly-design test`
  - `pnpm --filter @ch5me/firefly-design test:boundary`
  - `pnpm --filter @ch5me/firefly-design build`
  - `pnpm --filter @ch5me/firefly-ui-web test`
  - `pnpm --filter @ch5me/firefly-ui-web test:boundary`
  - `pnpm --filter @ch5me/firefly-ui-web build`
- [ ] Add/keep snapshot or regression proof preventing token drift between TS and CSS if not already sufficient.
- [x] Confirm package docs/package map/AGENTS entries are current.
- [ ] Confirm package repo pushed clean after any fixes.

### Stop conditions <!-- oc:id=sec_ap -->
- [ ] Stop if `@ch5me/firefly-ui-web` requires product-specific props or assumptions.
- [ ] Stop if token names need per-product forks to work.
- [ ] Stop if consumers require unpublished local hacks rather than clean package consumption.

## Phase 2 — Firefly Cloud Guardrail <!-- oc:id=sec_aq -->
Firefly Cloud is already migrated. Use it as regression proof before external adopters.

### Dependency and import audit <!-- oc:id=sec_ar -->
- [x] Confirm all token imports now point to `@ch5me/firefly-design`.
- [x] Subtask: grep `firefly-cloud` for `@ch5me/firefly-design`, `@ch5me/firefly-ui-web`, `@ch5me/firefly-ui/tokens`, `@ch5me/firefly-ui/web`, and `@ch5me/firefly-ui/tailwind.css` to confirm old web/token imports are gone.
- [x] Subtask: inspect `firefly-cloud/packages/firefly-ui/src/native/index.tsx` and related native consumers to confirm native lane still compiles with shared token source.
- [x] Subtask: inspect `firefly-cloud/pnpm-workspace.yaml`, `packages/firefly-design`, and `packages/firefly-ui-web` to document symlink/workspace resolution strategy.
- [ ] Subtask: run targeted install/typecheck proof in `firefly-cloud` and record any push-gate blockers that are unrelated to this migration.
- [x] Confirm all web primitive imports now point to `@ch5me/firefly-ui-web`.
- [x] Confirm local native lane still works for `@ch5me/firefly-ui/native`.
- [ ] Confirm no deleted local web/token files are still referenced anywhere.
- [x] Confirm package/symlink strategy in Firefly Cloud is documented and deliberate.

### Verification <!-- oc:id=sec_as -->
- [ ] Run root package install or equivalent dependency resolution proof.
- [ ] Run affected lint/type gates in Firefly Cloud.
- [ ] Run direct type/build proofs for:
  - web
  - storybook
  - firefly runtime
  - mobile where impacted
- [ ] Run grep proof that local old token import paths are gone.
- [ ] Confirm push gate passes cleanly.

### Firefly-specific cleanup <!-- oc:id=sec_at -->
- [ ] Remove obsolete docs language that still says `@ch5me/firefly-ui` when it really means split packages.
- [ ] Keep native-only bridge local until there is a real shared native package strategy.
- [ ] Document how local dev should resolve shared package deps:
  - workspace link
  - published package
  - symlink strategy if still used

## Phase 3 — Elf Adoption (First External Adopter) <!-- oc:id=sec_au -->
### Discovery and mapping <!-- oc:id=sec_av -->
- [x] Inventory Elf theme sources:
  - `packages/ui/src/styles/globals.css`
  - `apps/desktop/src/renderer/lib/themes.ts`
  - `apps/desktop/src/renderer/hooks/use-theme.ts`
  - `apps/desktop/src/renderer/atoms/preferences.ts`
- [x] Classify Elf surfaces into:
  - semantic shadcn root vars
  - named theme registry overrides
  - glass/vibrancy-specific vars
  - motion/density/radius vars
  - sidebar/review/diff-specific locals
- [x] Identify all current hardcoded palette values that should map to Firefly semantics.
- [x] Identify all current local tokens that should remain Elf-only.

### Token bridge migration <!-- oc:id=sec_aw -->
- [x] Introduce `@ch5me/firefly-design/tailwind.css` into Elf CSS entry path.
- [x] Subtask: add shared Firefly design CSS import to `packages/ui/src/styles/globals.css` in Elf without breaking existing Tailwind/shadcn bridge.
- [x] Subtask: map Elf root semantic vars in `packages/ui/src/styles/globals.css` onto Firefly semantic lanes where safe.
- [x] Subtask: inspect and update `apps/desktop/src/renderer/lib/themes.ts` so theme registry overrides sit on top of canonical Firefly token lanes instead of a separate base palette where practical.
- [x] Subtask: inspect and update `apps/desktop/src/renderer/hooks/use-theme.ts` so dynamic CSS var injection still works with shared Firefly semantics.
- [x] Subtask: preserve local-only glass, vibrancy, density, and platform accent behavior in Elf after introducing shared tokens.
- [x] Subtask: grep Elf for raw palette hotspots and convert only the ones that should become semantic token usages.
- [x] Map Elf root semantic vars onto Firefly semantic lanes where the product can keep its identity while sharing the contract.
- [x] Preserve Elf-only controls for:
  - glass opacity tuning
  - platform-specific native accent behavior
  - density and text scale
  - diff colors if they do not fit Firefly canon
- [x] Convert local hex/hsl palette hotspots to semantic vars where possible.
- [x] Keep Elf theme registry, but make registry values override canonical Firefly tokens instead of maintaining a separate base palette where practical.

### Primitive adoption <!-- oc:id=sec_ax -->
- [x] Inventory Elf UI primitives overlapping `@ch5me/firefly-ui-web`.
- [ ] Adopt shared web primitives only where there is a direct fit:
  - wordmark/orb/aurora/glass/status/frame primitives
- [x] Do not replace mature Elf product-specific UI just for consistency if there is no net simplification.
- [x] Confirm no duplicate React or monorepo cross-link issue appears in Electron/browser bundling.

### Verification <!-- oc:id=sec_ay -->
- [x] Typecheck Elf touched packages.
- [x] Subtask: run Elf narrow proof commands for changed surfaces (typecheck/lint/build as supported by touched packages).
- [x] Subtask: manually read every changed Elf file after migration and verify theme logic matches intent.
- [ ] Subtask: verify desktop/browser-mode theme rendering and named theme switching still work.
- [x] Subtask: verify no duplicate React or unresolved shared-package import regression appears in Elf dev/build flows.
- [x] Run lint on touched surfaces.
- [ ] Run desktop/browser proof relevant to changed surfaces.
- [ ] Verify named themes still switch correctly.
- [ ] Verify macOS transparency/vibrancy/liquid-glass behavior is not regressed.
- [x] Verify no duplicate React instance or unresolved import issue.

### Elf completion criteria <!-- oc:id=sec_az -->
- [ ] Elf root tokens consume shared Firefly semantic lanes.
- [ ] Elf keeps its platform/theme behavior.
- [ ] No React duplication or Vite/Electron resolution regressions.
- [ ] Shared package usage is cleaner than local duplication.

## Phase 4 — FolioDB Adoption (Second External Adopter) <!-- oc:id=sec_ba -->
### Discovery and mapping <!-- oc:id=sec_bb -->
- [x] Review FolioDB theme lane:
  - `apps/web/src/styles/theme.css`
  - `apps/web/components.json`
  - package/build CSS entrypoint
- [x] Separate tokens into:
  - broadly semantic surface/text/border/radius/spacing values
  - editorial/Notion-like palette and product voice values
  - Folio-only glow/shadow/sidebar values
- [x] Identify where Folio already bridges local vars into shadcn semantic tokens.

### Token bridge migration <!-- oc:id=sec_bc -->
- [x] Introduce Firefly semantic token contract beneath or alongside Folio's existing bridge.
- [x] Subtask: inspect `folio-db/apps/web/src/styles/theme.css` and identify exact insertion point for shared Firefly design semantic layer.
- [x] Subtask: keep Folio editorial/Notion-like palette vars local while mapping compatible spacing/radius/semantic lanes.
- [x] Subtask: update any Folio component/theme metadata (`components.json`, CSS entrypoints, package manifests) needed to consume shared token contract.
- [ ] Subtask: adopt shared web primitives only if Elf proves they fit and Folio has a direct generic use.
- [x] Keep Folio editorial palette local if needed.
- [ ] Map only shared semantics:
  - typography rhythm where compatible
  - radius scale where compatible
  - spacing scale where compatible
  - core semantic lanes if product fit is acceptable
- [ ] Avoid forcing Firefly brand accent or Firefly visual identity where it conflicts with Folio's intended editorial feel.
- [ ] Replace duplicate implementation only when bridge remains understandable.

### Primitive adoption <!-- oc:id=sec_bd -->
- [x] Re-evaluate `@ch5me/firefly-ui-web` after Elf proof.
- [x] Adopt only primitives that are truly generic in FolioDB's context.
- [x] Leave local product-specific cards, tables, editorial chrome, and workspace shells untouched if shared primitives do not clearly help.

### Verification <!-- oc:id=sec_be -->
- [x] Typecheck touched FolioDB surfaces.
- [x] Subtask: run FolioDB narrow build/type/lint proof for touched theme and UI surfaces.
- [x] Subtask: manually read every changed FolioDB file and verify the bridge keeps editorial identity intact.
- [x] Subtask: verify `data-folio-theme` switching and any storybook/web preview still behave correctly.
- [x] Lint touched FolioDB surfaces.
- [x] Run app build or local proof.
- [x] Verify `data-folio-theme` switching still works.
- [x] Verify editorial surfaces still look intentional.

### Folio completion criteria <!-- oc:id=sec_bf -->
- [x] Shared token contract adopted without flattening Folio's product identity.
- [x] Shared primitives only used where they reduce duplication.
- [x] Theme switching and editorial surfaces remain correct.

## Phase 5 — OpenPencil Token Bridge Only <!-- oc:id=sec_bg -->
### Discovery and mapping <!-- oc:id=sec_bh -->
- [x] Review OpenPencil token/theme sources:
  - `src/app.css`
  - `src/app/shell/theme.ts`
  - UI component folder shape
  - ACP design context references if relevant
- [x] Separate tokens into:
  - general surface/text/border/accent vars
  - drawing-editor-specific canvas/ruler/checkerboard/code-highlight vars
  - app shell preference / storage behavior
- [x] Confirm OpenPencil is still Vue/Tailwind token driven and does not need shared React components.

### Token bridge migration <!-- oc:id=sec_bi -->
- [x] Introduce only the shared token bridge where it improves consistency.
- [x] Subtask: inspect `open-pencil/src/app.css` and `open-pencil/src/app/shell/theme.ts` and identify exact token bridge insertion points.
- [x] Subtask: map only compatible shared semantics from `@ch5me/firefly-design` while preserving canvas/ruler/checkerboard/code-highlight/editor vars.
- [x] Subtask: update any package/build config needed for CSS or token consumption without introducing React primitive dependency.
- [x] Keep local vars for:
  - canvas colors
  - ruler colors
  - checkerboard colors
  - code highlight colors
  - component purple and editor-specific accents if needed
- [x] Align typography/radius/spacing tokens only where that does not degrade editor ergonomics.
- [x] Avoid importing `@ch5me/firefly-ui-web` unless a specific case proves worthwhile.

### Verification <!-- oc:id=sec_bj -->
- [x] Run OpenPencil build/check pipeline relevant to touched theme files.
- [x] Subtask: manually read every changed OpenPencil file and verify token bridge does not pollute editor-specific semantics.
- [x] Subtask: verify `data-theme` switching, ruler theme propagation, and repaint behavior still work.
- [x] Verify theme toggling still updates `data-theme` correctly.
- [x] Verify ruler theme and canvas repaint behavior still works.
- [x] Verify light/dark editor surfaces remain readable and intentional.

### OpenPencil completion criteria <!-- oc:id=sec_bk -->
- [x] Shared token bridge adopted where useful.
- [x] No shared React primitive dependency introduced.
- [x] Editor-specific design semantics remain local.

## Phase 6 — Shared Package Cleanup and Standardization <!-- oc:id=sec_bl -->
- [x] Review cross-product findings and normalize token naming where at least two products needed the same concept.
- [x] Remove package APIs that only existed to satisfy Firefly Cloud local history.
- [x] Document which token lanes are canonical and which remain product-local.
- [x] Add regression docs for each repo showing:
  - what imports from shared packages
  - what stays local
- [x] Decide whether a shared native package is warranted later; explicitly defer if not.
- [x] Publish shared package versions if the flow is semver-based rather than workspace-local.

## Phase 7 — Cross-Product Verification Pass <!-- oc:id=sec_bm -->
- [x] Re-run proof in Firefly Cloud after external adopter changes.
- [x] Re-run proof in Elf
- [x] Re-run proof in FolioDB.
- [x] Re-run proof in OpenPencil.
- [x] Confirm no repo still depends on obsolete local Firefly token authority where it should use the shared package.
- [x] Confirm shared package docs still match real consumption.

## Repo-Specific TODO Matrix <!-- oc:id=sec_bn -->
### Firefly Cloud <!-- oc:id=sec_bo -->
- [x] Keep migrated state green.
- [x] Maintain local native bridge only as needed.
- [x] Keep docs accurate for split package reality.
- [x] Confirm push gate stays green after shared package changes.

### Elf <!-- oc:id=sec_bp -->
- [x] Add shared Firefly design CSS import path.
- [x] Bridge local root vars to shared semantics.
- [x] Preserve glass/native platform lanes.
- [x] Optionally adopt shared wordmark/orb/glass/status primitives.
- [x] Verify Electron build + browser-mode dev path.

### FolioDB <!-- oc:id=sec_bq -->
- [x] Map Folio bridge to shared semantic lanes where compatible.
- [x] Keep editorial palette local.
- [x] Optionally adopt shared primitives only if Elf proves them generic.
- [x] Verify `data-folio-theme` and app build.

### OpenPencil <!-- oc:id=sec_br -->
- [x] Bridge only shared semantics.
- [x] Keep editor-specific token lanes local.
- [x] Do not adopt shared React primitives.
- [x] Verify Vue app theme switching, ruler/canvas theme behavior, and build.

## Key Risks <!-- oc:id=sec_bs -->
- [x] Duplicate React or bad package resolution in Elf/Electron.
- [x] Shared package API too tightly coupled to Firefly Cloud.
- [x] Token bridge appears complete while local CSS still shadows canonical vars.
- [x] Scope expands into unnecessary component migration.
- [x] OpenPencil loses editor-specific clarity if over-standardized.
- [x] Local symlink/workspace tricks drift from publish-time reality.

## Stop Conditions <!-- oc:id=sec_bt -->
Stop the unattended run if any of these happen:
- [x] Shared package needs product-specific branching to proceed.
- [x] React duplication or bundler instability appears in Elf
- [x] FolioDB requires abandoning its editorial system to fit the contract.
- [x] OpenPencil would need shared React primitives rather than token bridge only.
- [x] Package consumption differs materially between local symlink mode and published mode.

## Deliverables <!-- oc:id=sec_bu -->
- [x] `ch5-packages` remains canonical for Firefly design packages.
- [x] Firefly Cloud remains migrated and green.
- [x] Elf adopts shared Firefly token lane.
- [x] FolioDB adopts shared token bridge where appropriate.
- [x] OpenPencil adopts token bridge only.
- [x] Cross-repo docs clearly say what is shared and what remains local.
- [x] Each repo has proof commands and a pushed clean state.

## Suggested Overnight Execution Order <!-- oc:id=sec_bv -->
- [x] Re-run shared package proof.
- [x] Migrate Elf token bridge.
- [x] Verify Elf
- [x] Migrate FolioDB token bridge.
- [x] Verify FolioDB.
- [x] Migrate OpenPencil token bridge.
- [x] Verify OpenPencil.
- [x] Do cross-product cleanup.
- [x] Run final proof pass.
- [x] Commit/push each repo as coherent slices.

## Success Criteria <!-- oc:id=sec_bw -->
- [x] One canonical Firefly token/design lane exists and is actually consumed across products.
- [x] Shared primitives are used only where proven generic.
- [x] Product-specific identity remains intact.
- [x] Firefly Cloud, Elf, FolioDB, and OpenPencil all have documented migration outcomes.
- [x] No repo depends on a hidden local-only package hack for the standardized lane.
