## 2026-05-31T07:03:01Z Known starting constraints <!-- oc:id=sec_aa -->
- Active repo is `elf`; later phases require external repos (`ch5-packages`, `firefly-cloud`, `foliodb`, `openpencil`) and may block on workspace availability
- No `.opencode/memory/` knowledge base present in this repo at session start
- Need exhaustive task decomposition before implementation per `/start-work` contract

## 2026-05-31T07:12:00Z Discovery constraints <!-- oc:id=sec_ab -->
- Elf Phase 3 likely touches shared CSS + theme registry files before component-level primitives
- Folio instructions explicitly require preserving `@theme inline` and `@source` behavior in `apps/web/src/styles/theme.css`
- OpenPencil AGENTS indicates Tailwind 4, Vue, and local editor-specific design tokens must stay local unless clearly shared
## 2026-05-31T07:18:00Z Baseline blockers and cautions
- All target repos except `folio-db` are currently dirty with unrelated or concurrent work; standardization execution must commit coherent slices without trampling adjacent changes
- `firefly-cloud` root push gate can fail on unrelated formatting/lint drift and linked shared-package directories, even when standardization changes themselves are sound
- `ch5-packages` shared-package repo is not clean after extraction due to concurrent tooling/workspace work; package hardening must stage only intended files
- `open-pencil` already has hosted-auth work in flight, so token-bridge migration there should defer until local auth/router changes are classified or integrated safely

## 2026-05-31T07:40:00Z Phase 0 baseline cautions
- `firefly-cloud` dependency mode is intentionally not clean semver yet: `workspace:*` manifests plus untracked linked package directories mean later phases must separate package-hardening from consumer-hardening carefully
- `elf` still carries Firefly-like default palette values inside `packages/ui/src/styles/globals.css`, but zero shared Firefly imports; Phase 3 must treat this as local duplication baseline, not shared-package adoption
- `folio-db` theme bridge is strong but fully local; later migration must preserve `@theme inline`, `@source "../"`, and `data-folio-theme` behavior exactly
- `open-pencil` has no shared Firefly dependency and no React primitive fit signal; Phase 4/5 should stay token-bridge-only unless later evidence changes

## 2026-06-01T00:24:10Z Firefly Cloud guardrail re-audit
- `firefly-cloud` still has split-package migration pushed, but baseline is again dirty from concurrent billing/chat/runtime work; any further guardrail cleanup must stage only intended files
- Shared package directories still appear under `firefly-cloud/packages/` as local linked entries, and root `pnpm-workspace.yaml` includes `packages/*`, so local workspace resolution still depends on these directories existing
- Current grep confirms old token/web/tailwind imports are gone from active Firefly Cloud codepaths, but local native bridge `packages/firefly-ui/src/native/index.tsx` still depends on shared design tokens and must remain resolvable in local workspace mode

## 2026-05-31T08:10:00Z Baseline lock cautions
- `firefly-cloud` still has many unrelated dirty files plus untracked local shared-package copies, so later migration proof must distinguish consumer regressions from concurrent app/auth/event-service work
- `elf` root workspace symlink to `../ch5-packages/packages/workspace/contract` is unrelated to Firefly packages, but it keeps duplicate-React risk relevant if future phases add more cross-repo local linking
- `folio-db` AGENTS forbids losing `@theme inline`, `@source`, and `data-folio-theme` semantics in `apps/web/src/styles/theme.css`; any token-bridge work must preserve that exact runtime contract
- `open-pencil` already uses separate local `file:` dependency only for `@ch5me/elf-auth-client` in `api/package.json`; that does not change Firefly design baseline, but it means repo dependency mode is mixed overall even while design/theme lane stays local-only

## 2026-06-01T00:40:00Z Phase 2 push-gate blockers and doc drift
- `pnpm --filter web typecheck` is currently blocked by repo install-state drift, not split-package imports: pnpm aborts with `[ERR_PNPM_VERIFY_DEPS_BEFORE_RUN] The value of the allowBuilds setting has changed` and asks for `pnpm install`
- `pnpm install --ignore-scripts --no-frozen-lockfile` succeeds, but it mutates install state to accommodate untracked local `packages/firefly-design/package.json`; this confirms local linked package dirs are still part of dev resolution and can perturb lock/install proof independently of migration correctness
- `pnpm --filter @firefly/storybook typecheck` still fails on unrelated existing app error in `apps/web/src/components/PostHogProvider.tsx:25` (`string | undefined` passed to `posthog.init`), so storybook push gate is not yet clean even though split-package imports resolve
- `.npmrc`/`~/.npmrc` emit missing token env warnings (`${NODE_AUTH_TOKEN}`, `${NPM_TOKEN}`) during pnpm commands; warnings did not block grep or native typecheck, but they add noise to proof logs
- Repo remains dirty from unrelated concurrent web/chat/event-service work plus untracked `packages/firefly-design` and `packages/firefly-ui-web`, so any future guardrail cleanup must isolate migration proof from ambient repo state

## 2026-06-01T00:28:10Z Elf migration caution
- Elf Phase 3 is not blocked on package introduction; it is blocked on safely reconciling the existing local warm palette in `packages/ui/src/styles/globals.css` with canonical Firefly semantics without breaking concurrent renderer/UI work already dirty in the repo

## 2026-06-01T08:10:00Z Elf verification blockers
- `bun run check-types` fails because `turbo` is not available in current environment; this blocks repo-level typecheck proof but is unrelated to Firefly token mapping itself
- `bun run lint` fails on pre-existing Biome schema-version mismatch in root/app/package config plus unrelated `devmux.config.json` formatting drift; these are repo-environment/config issues, not evidence of a broken token bridge
- LSP diagnostics for the Elf workspace returned zero TSX errors in the scanned files, which is the strongest local proof currently available without repairing toolchain drift

## 2026-06-01T08:20:00Z OpenPencil verification blockers
- `bun install` succeeded in `open-pencil`, confirming the shared package workspace link resolves locally
- `bun run check` still fails from broad pre-existing lint/test debt in unrelated engine/e2e/scripts areas (`no-app-vue-core-barrel-imports`, complexity, no-explicit-any, hosted-collab/file naming, etc.); no new token-bridge-specific failure surfaced in the output
- OpenPencil token-bridge lane remains low-risk because the shared-package import and local editor token authority were already in place before this verification pass

## 2026-06-01T08:30:00Z Cross-product regression blockers
- None of the target repos are clean at this point: `ch5-packages`, `firefly-cloud`, `elf`, `folio-db`, and `open-pencil` all have concurrent dirty changes unrelated to this standardization pass
- `firefly-cloud` and `ch5-packages` are already pushed for the shared-package extraction/migration baseline, but both repos still carry unrelated local changes that prevent a clean final-state claim for this plan
- `elf`, `folio-db`, and `open-pencil` each now have local uncommitted theme/workspace updates from this standardization lane, plus unrelated dirty files that must be classified before any 'clean repo' deliverable can be claimed
