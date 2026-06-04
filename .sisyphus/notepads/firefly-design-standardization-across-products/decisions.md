## 2026-05-31T07:03:01Z Initial orchestration decisions <!-- oc:id=sec_aa -->
- Use search-first workflow: parallel explore/librarian agents before deeper execution
- Treat plan checkboxes as source of truth; ignore nested non-checkbox bullets
- Decompose plan into granular todo items before starting any code changes

## 2026-05-31T07:12:00Z Cross-repo design decisions <!-- oc:id=sec_ab -->
- Baseline lock should document each repo's current token authority and dependency mode before any migration changes
- Elf is first external adopter because it has the richest theme registry and the highest Electron duplicate-React risk
- Folio should be treated as proof of generalizable token bridge semantics, not brand identity convergence
- OpenPencil should stay token-bridge-only unless later evidence proves a shared React primitive is worthwhile
## 2026-05-31T07:40:00Z Phase 0 baseline decisions
- Classify `ch5-packages` as shared-package source repo, not consumer; internal dependency relation between `@ch5me/firefly-ui-web` and `@ch5me/firefly-design` is valid `workspace:*` monorepo coupling
- Classify `firefly-cloud` as mixed dependency mode at baseline because consumer manifests use `workspace:*` and repo also carries local linked package directories; do not call it published semver yet
- Classify `elf` as repo-local alias/workspace-symlink baseline overall because root workspaces include `../ch5-packages/packages/workspace/contract`; for Firefly standardization specifically, current mode is local-only theme lane with no shared Firefly package consumption
- Classify `folio-db` as published-semver/local-only app baseline with no shared Firefly package dependency; shared-token adoption starts from `apps/web/src/styles/theme.css`
- Classify `open-pencil` as local-only baseline with no shared Firefly package dependency; only compact local CSS-var theme lane exists today
## 2026-05-31T07:22:00Z Baseline dependency mode
- `@ch5me/firefly-design` and `@ch5me/firefly-ui-web` are canonical shared packages in `ch5-packages`
- `elf` currently has no direct dependency on either shared Firefly package
- `folio-db` currently has no direct dependency on either shared Firefly package and remains on its own local theme bridge
- `open-pencil` currently has no direct dependency on either shared Firefly package and remains fully local in token/theme lanes
- `firefly-cloud` consumes shared packages through local workspace-linked package directories (`packages/firefly-design`, `packages/firefly-ui-web`) rather than published semver at baseline
## 2026-06-01T00:24:10Z Firefly Cloud package resolution baseline
- Firefly Cloud currently resolves `@ch5me/firefly-design` and `@ch5me/firefly-ui-web` through local linked package directories under `packages/`, discovered by root `pnpm-workspace.yaml`
- Native-only `@ch5me/firefly-ui/native` remains local and still uses shared token exports from `@ch5me/firefly-design`
- Until a publish-first or alternate federation lane replaces this, unattended work must treat local linked package directories as required runtime infrastructure for Firefly Cloud dev/build flows

## 2026-05-31T08:10:00Z Baseline classification decisions
- Record latest observed repo SHAs from current `git log --oneline -n 5` runs as Phase 0 lock values: `ch5-packages` `f9a8e24`, `firefly-cloud` `b0b5ab4f6`, `elf` `3ac37b5`, `folio-db` `c99b481`, `open-pencil` `f877f2b3`
- Classify dependency mode per repo as: `ch5-packages` workspace-symlink source monorepo, `firefly-cloud` mixed, `elf` repo-local alias/workspace symlink overall but local-only for Firefly lane, `folio-db` published-semver/internal-workspace monorepo with no Firefly dependency, `open-pencil` mixed overall because of local `file:` auth client but local-only for Firefly lane
- Treat `@ch5me/firefly-design` as written canonical token authority unless later phase finds real drift between `packages/firefly/design/src/tokens.ts` and `packages/firefly/design/src/tailwind.css`; current baseline evidence does not show competing written shared source
- Treat `@ch5me/firefly-ui-web` as reusable-primitives-only until later audit proves product-specific assumptions; current export surface is generic enough to keep Elf/Folio selective-adoption path open

## 2026-06-01T00:40:00Z Phase 2 guardrail decisions
- Treat Firefly Cloud split-package migration as import-clean in active source when grep shows zero live references to `@ch5me/firefly-ui/tokens`, `@ch5me/firefly-ui/web`, and `@ch5me/firefly-ui/tailwind.css`; compatibility exports in `packages/firefly-ui/package.json` alone do not count as active migration failure
- Treat `packages/firefly-ui/src/native/index.tsx` plus `apps/firefly/tsconfig.json` path alias as required local native bridge until a real shared native package exists; do not collapse `@ch5me/firefly-ui/native` into web split-package work yet
- Treat Firefly Cloud package resolution as workspace-local infrastructure today: `workspace:*` dependencies plus repo-local `packages/firefly-design` and `packages/firefly-ui-web` directories are part of intended dev/build resolution, not accidental leftovers
- Count obsolete docs language separately from code migration: `brand.md:143`, `docs/firefly-app-boundary.md:10`, and `apps/firefly/README.md:10` still mention old `firefly-ui` package surfaces and should be cleaned later without treating them as source-code import regressions
## 2026-06-01T00:27:30Z Elf dependency-mode correction
- Earlier note claiming Elf had no direct `@ch5me/firefly-design` dependency was stale; current baseline shows `packages/ui/package.json` already depends on `@ch5me/firefly-design` and `packages/ui/src/styles/globals.css` already imports `@ch5me/firefly-design/tailwind.css`
- Therefore Elf adoption work should be treated as semantic-token reconciliation and local-palette cleanup, not first-time package introduction

## 2026-06-01T08:25:00Z Cross-product completion decisions
- Treat Elf primitive adoption as intentionally deferred/no-op: no direct-fit surface currently overlaps `@ch5me/firefly-ui-web` in a way that reduces duplication without churn
- Treat FolioDB bridge as complete enough for this lane because shared Firefly design is already layered under local editorial tokens and product build passes; Turbo/Corepack failure in shared package typecheck is a tooling blocker, not a Folio adoption blocker
- Treat OpenPencil bridge as complete enough for this lane because shared Firefly design is already layered under local editor tokens, install succeeds, and no shared React primitive requirement emerged
- Phase 6 should focus on documentation normalization, package-lane clarity, and final proof/cleanup rather than more product-level token surgery unless a later visual review finds concrete regressions

## 2026-06-01T08:35:00Z Final cleanup and release stance
- Do not mark package publishing complete: current standardization proof uses workspace/local-link consumption, and no new semver publish was executed as part of this run
- Do not mark clean-repo deliverables complete while all five repos still contain unrelated or concurrent dirty state
- Treat this run as architecture/token-standardization completion with cleanup/release deferred behind repo-state reconciliation
