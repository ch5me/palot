## 2026-05-31T07:03:01Z Session bootstrap <!-- oc:id=sec_aa -->
- Plan resumed in `palot` repo from `.sisyphus/plans/firefly-design-standardization-across-products.md`
- Total unchecked checkboxes currently counted: 148
- Early execution order in plan: Phase 0 baseline lock, then shared package hardening, then Firefly Cloud guardrail, then Palot/FolioDB/OpenPencil adoption
- First local repo focus is Palot, but plan spans external repos too; do not assume all work can happen here

## 2026-05-31T07:12:00Z Subagent abort triage
- Oracle: repeated MessageAbortedError after one timeout = poisoned session, not bad task
- Fix: stop resuming poisoned sessions; use fresh sessions with narrower prompts or direct inspection
- Token source scan agent failed (tool result missing); resolved via direct reads

## 2026-05-31T07:12:00Z Search synthesis <!-- oc:id=sec_ab -->
- Palot token root lives in `packages/ui/src/styles/globals.css`; theme override registry lives in `apps/desktop/src/renderer/lib/themes.ts`; runtime theme injection happens in `apps/desktop/src/renderer/hooks/use-theme.ts`
- Palot currently has zero `@ch5me/firefly-*` imports; preserve Palot-only glass/vibrancy/platform tiers while bridging shared semantics
- Folio already uses a strong token bridge in `apps/web/src/styles/theme.css` with `@theme inline`, `@source`, and `data-folio-theme`; this is likely the clearest second adopter pattern
- OpenPencil keeps a compact local token lane in `src/app.css` plus `src/app/shell/theme.ts`; likely token bridge only, no shared React primitive lane
- Shared package consumption research says: token package should ship CSS vars + Tailwind theme CSS; UI package should keep React as peer dep; beware pnpm workspace/symlink duplicate React risk in Electron/Vite consumers
## 2026-05-31T07:18:00Z Baseline state capture
- `ch5-packages` currently has Firefly extraction already landed and pushed, but repo is not clean: modified `packages/tooling/macuse-cli/*`, untracked `packages/tooling/vaw-auto-research-graph/`, and untracked `packages/workspace/contract/src/panes/SplitPane.tsx` must be preserved while standardization work proceeds
- `firefly-cloud` has migrated shared-package commits pushed on `main`, but repo is still dirty from concurrent chat/auth/event-service work plus local symlinked `packages/firefly-design` and `packages/firefly-ui-web`
- `palot` is dirty with local desktop/layout work in renderer and UI package files; token-bridge migration must avoid overwriting those concurrent changes
- `folio-db` is clean at baseline
- `open-pencil` is dirty in hosted auth/router files and new views; token-bridge work there must preserve concurrent app-auth changes

## 2026-05-31T07:40:00Z Phase 0 baseline lock
- `ch5-packages` baseline repo state: branch `main...origin/main`; latest visible pushed SHA `bdb1308`; dirty exceptions are `packages/tooling/macuse-cli/src/index.ts`, `packages/tooling/macuse-cli/src/lib/client.ts`, `packages/tooling/macuse-cli/src/lib/mac.ts`, `packages/tooling/macuse-cli/src/types/capture.ts`, untracked `packages/tooling/vaw-auto-research-graph/`, and untracked `packages/workspace/contract/src/panes/SplitPane.tsx`; preserve all of them
- `firefly-cloud` baseline repo state: branch `main...origin/main`; latest visible pushed SHA `b0b5ab4f6`; dirty exceptions are concurrent chat/auth/router/event-service edits plus untracked `packages/firefly-design` and `packages/firefly-ui-web`; consumption mode is mixed because manifests use `workspace:*` while linked package directories are still untracked in repo
- `palot` baseline repo state: branch `main...origin/main`; latest visible pushed SHA `3ac37b5`; dirty exceptions are `AGENTS.md`, renderer/UI files, `bun.lock`, and untracked `.omo/` + `.sisyphus/`; Palot dependency mode for shared package work is currently local-only theme lanes plus one external workspace symlink only for `../ch5-packages/packages/workspace/contract`, not Firefly packages
- `folio-db` baseline repo state: branch `main...origin/main`; latest visible pushed SHA `c99b481`; repo clean; current theme authority stays local in `apps/web/src/styles/theme.css` with `components.json` pointing shadcn CSS at that file and no shared Firefly package imports found
- `open-pencil` baseline repo state: branch `master...origin/master`; latest visible pushed SHA `f877f2b3`; dirty exceptions are `AGENTS.md`, `src/app/hosted/session.ts`, `src/router.ts`, and untracked `src/views/AuthCallbackView.vue` + `src/views/LoginView.vue`; current theme authority remains local in `src/app.css` plus `src/app/shell/theme.ts` with no shared Firefly package imports found
- `@ch5me/firefly-design` already looks like written token source of truth for Firefly semantics in shared-package land: package exports token TS surface, `tailwind.css`, semantic aliases, status copy, typography/radius/spacing contract, and Firefly Cloud imports those surfaces broadly
- `@ch5me/firefly-ui-web` appears limited to reusable primitives in current baseline: `FireflyAuroraBackdrop`, `FireflyOrb`, `FireflyWordmark`, `FireflyGlassPanel`, `FireflyPill`, `FireflyStatusBadge`, `FireflyMaskedToken`, `FireflyMetricBars`, `FireflyWorkspaceFrame`, and `FireflyPhoneFrame`; React stays peer dependency
- Phase 0 proof command baseline: `ch5-packages` already defines `pnpm --filter @ch5me/firefly-design test`, `pnpm --filter @ch5me/firefly-design test:boundary`, `pnpm --filter @ch5me/firefly-design build`, `pnpm --filter @ch5me/firefly-ui-web test`, `pnpm --filter @ch5me/firefly-ui-web test:boundary`, `pnpm --filter @ch5me/firefly-ui-web build`; likely product proof commands are `firefly-cloud: pnpm --filter web typecheck`, `pnpm --filter web test`, `pnpm --filter @firefly/storybook typecheck`; `palot: bun run check-types`, `bun run lint`; `folio-db: corepack pnpm typecheck`, `corepack pnpm test`; `open-pencil: bun run check`, `bun run check:vue`

## 2026-06-01T00:22:40Z Shared package hardening re-proof
- Re-proof in `ch5-packages` passed again for both shared packages: `@ch5me/firefly-design` test/boundary/build and `@ch5me/firefly-ui-web` test/boundary/build
- `@ch5me/firefly-design` remains canonical source of truth: package exports root JS, `./tokens`, and `./tailwind.css`; token TS and CSS surfaces still align on `--ff-*` semantic contract
- `@ch5me/firefly-ui-web` still exports only generic web primitives (aurora/orb/wordmark/glass/pill/status/masked token/metric bars/workspace frame/phone frame) and depends only on `@ch5me/firefly-design` plus React peer dependency

## 2026-05-31T08:30:00Z Phase 2 Firefly Cloud guardrail verified
- All token imports in firefly-cloud point to `@ch5me/firefly-design` — no old paths remain
- Web primitive imports correctly use `@ch5me/firefly-ui-web` (apps/web/HeaderLogo, apps/storybook)
- Native lane (`@ch5me/firefly-ui/native`) correctly stays local in apps/firefly — tsconfig maps to packages/firefly-ui/src/native/index.tsx
- No old `@ch5me/firefly-ui/tokens`, `@ch5me/firefly-ui/web`, or `@ch5me/firefly-ui/tailwind.css` imports found
- Workspace strategy: pnpm-workspace.yaml includes firefly packages; consumers use workspace:* for dev, published semver for releases
- Obsolete docs language: `apps/firefly/README.md` line 10 says `@ch5me/firefly-ui` where it really means split packages — should be updated in Phase 6

## 2026-05-31T08:10:00Z Phase 0 baseline re-lock
- Re-locked baseline from primary repo state instead of relying on earlier copied notes; all five repos re-inspected for SHA, dirty state, dependency mode, token authority, and proof commands
- `ch5-packages` baseline now records latest visible commit `f9a8e24`; repo still dirty only from untracked `packages/tooling/vaw-auto-research-graph/` and untracked `packages/workspace/contract/src/panes/SplitPane.tsx`, so those remain preserve-only exceptions during design-standardization work
- `firefly-cloud` baseline still shows consumer adoption of shared packages through `workspace:*` deps in `apps/web/package.json`, `apps/storybook/package.json`, runtime/mobile/service manifests, plus untracked local package dirs `packages/firefly-design` and `packages/firefly-ui-web`; dependency mode stays mixed, not published-semver
- `palot` baseline remains local-only for Firefly design: `packages/ui/src/styles/globals.css`, `apps/desktop/src/renderer/lib/themes.ts`, and `apps/desktop/src/renderer/hooks/use-theme.ts` define local token/theme authority; repo-level workspace symlink only targets `../ch5-packages/packages/workspace/contract`, not Firefly packages
- `folio-db` baseline remains local token-bridge authority only: `apps/web/src/styles/theme.css` owns semantic bridge via `@theme inline` and `@source "../"`; `apps/web/components.json` points shadcn CSS at that file; no shared Firefly package imports found
- `open-pencil` baseline remains local token lane only: `src/app.css` owns Tailwind v4 `@theme` vars and `src/app/shell/theme.ts` propagates theme/ruler vars; no shared Firefly package imports found, and no signal that React primitive sharing belongs here
- `@ch5me/firefly-design` is already one written shared token source of truth: package exports TS tokens, `./tailwind.css`, semantic aliases, status copy, typography/radius/spacing contract, and Firefly Cloud imports those surfaces broadly across web/mobile/runtime/native lanes

## 2026-06-01T00:50:00Z OpenPencil token bridge lane specifics
- `src/app.css` already imports `@ch5me/firefly-design/tailwind.css` between Tailwind and `tw-animate-css`, so shared `--ff-*` bridge was already layered under OpenPencil's local editor token block
- `package.json` already depends on `@ch5me/firefly-design` via `workspace:*` and already lists `../ch5-packages/packages/firefly/design` in `workspaces`, so Phase 5 manifest/workspace edits were already satisfied
- `@ch5me/firefly-ui-web` still appears limited to reusable primitives: source exports only aurora/orb/wordmark/glass/pill/status/masked-token/metric-bars/workspace-frame/phone-frame primitives and takes React as peer dependency
- Baseline proof command set captured directly from repo scripts/manifests: `ch5-packages` package test/boundary/build lanes; `firefly-cloud` root `pnpm typecheck`, `pnpm test`, `pnpm lint`, plus narrower `pnpm --filter web typecheck|test|build`; `palot` `bun run check-types`, `bun run lint`; `folio-db` `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`; `open-pencil` `bun run check`, `bun run check:vue`, `bun run test:unit`

## 2026-06-01T00:26:10Z Palot adoption lane specifics
- Palot already depends on `@ch5me/firefly-design` in `packages/ui/package.json`, and `packages/ui/src/styles/globals.css` already imports `@ch5me/firefly-design/tailwind.css`
- Palot still keeps a large local Firefly-ish warm palette in `packages/ui/src/styles/globals.css`; first real adoption step is not package add, but replacing the local base palette with canonical Firefly semantic lanes while preserving Palot-specific diff and glass tuning
- Palot workspace shell CSS in `apps/desktop/src/renderer/styles/workspace.css` already bridges `--ws-*` vars onto existing semantic vars (`--background`, `--foreground`, `--primary`), so shared-token adoption must preserve this bridge
- Palot theme registry in `apps/desktop/src/renderer/lib/themes.ts` mainly overrides glass/surface/accent details, so migration should keep the registry but make it sit on top of canonical Firefly tokens instead of a separate local warm baseline

## 2026-06-01T00:40:00Z Phase 2 Firefly Cloud guardrail findings
- Grep audit in `firefly-cloud` shows active token imports already point at `@ch5me/firefly-design`: hits in `apps/web/src/app/globals.css`, `apps/web/src/lib/email-templates.ts`, `apps/firefly/src/ui/theme.ts`, `apps/mobile/src/lib/hooks/use-theme-colors.ts`, `services/firefly-runtime/src/routes/access-gateway.ts`, `services/deploy-infra/dispatcher/src/banner/inject-banner.ts`, and `packages/firefly-ui/src/native/index.tsx`; no active code hits remain for `@ch5me/firefly-ui/tokens`, `@ch5me/firefly-ui/web`, or `@ch5me/firefly-ui/tailwind.css`
- Web primitive audit shows split package consumption is clean in active code: `apps/web/src/components/HeaderLogo.tsx` and `apps/storybook/stories/design-system/FireflyFoundations.stories.tsx` import from `@ch5me/firefly-ui-web`, while grep for old `@ch5me/firefly-ui/web` returns no matches
- Native lane still resolves locally through `@ch5me/firefly-ui/native`: consumers live in `apps/firefly/src/screens/ChatScreen.tsx`, `apps/firefly/src/screens/AuthScreen.tsx`, `apps/firefly/src/workspace/surfaces/FireflyAssistantHomeSurface.tsx`, `apps/firefly/src/workspace/surfaces/FireflyPrivacyCenterSurface.tsx`, `apps/firefly/src/workspace/components/workspace-sidebar.tsx`, and `apps/firefly/src/chat/FireflyChatSlots.tsx`; `apps/firefly/tsconfig.json` maps that import to `packages/firefly-ui/src/native/index.tsx`
- `packages/firefly-ui/src/native/index.tsx` now consumes shared tokens directly from `@ch5me/firefly-design/tokens` for colors, status copy, and runtime status types, so native bridge no longer depends on deleted local token files
- Workspace resolution strategy is deliberate but local-only: root `pnpm-workspace.yaml` includes `packages/*`; consumer manifests like `apps/web/package.json`, `apps/storybook/package.json`, `apps/firefly-api/package.json`, `apps/mobile/package.json`, `services/firefly-runtime/package.json`, and `services/deploy-infra/dispatcher/package.json` depend on `@ch5me/firefly-design` or `@ch5me/firefly-ui-web` via `workspace:*`; local directories `packages/firefly-design` and `packages/firefly-ui-web` publish metadata pointing back to `ch5-packages`
- Native bridge package still carries old compatibility exports in `packages/firefly-ui/package.json` (`./web`, `./tokens`, `./tailwind.css`, plus root web/native conditional entry), but current grep found no live consumer references to those deleted web/token surfaces

## 2026-06-01T00:28:10Z Palot theme split summary
- Shared/canonical-ready surfaces in Palot: `packages/ui/package.json` already depends on `@ch5me/firefly-design`, `packages/ui/src/styles/globals.css` already imports shared `tailwind.css`, and `apps/desktop/src/renderer/styles/workspace.css` already maps `--ws-*` onto semantic vars
- Palot-local surfaces that should remain local: glass opacity/blur scale tokens, platform accent handling in `apps/desktop/src/renderer/lib/themes.ts`, diff colors, density tuning, and macOS transparency/vibrancy controls
- Hardcoded warm Firefly-like palette still lives in `packages/ui/src/styles/globals.css` (`#fefcf8`, `#0f0f0f`, `#f59e0b`, etc.); that is the main semantic reconciliation target for Phase 3

## 2026-06-01T08:00:00Z Palot Phase 3 semantic bridge — COMPLETED
- Root cause: Palot's `:root` and `.dark` referenced non-existent `--ff-background`, `--ff-surface-primary`, `--ff-surface-secondary`, `--ff-surface-tertiary`, `--ff-foreground-muted`, `--ff-border-primary`, `--ff-danger-primary`, `--ff-focus-ring` as fallback vars. Firefly never defined these aliases — it defines `--ff-bg`, `--ff-text`, `--ff-card`, `--ff-surface`, `--ff-surface-strong`, `--ff-subtle`, `--ff-border`, `--ff-primary`, `--ff-danger`, `--ff-destructive-foreground` in its `:root`.
- Fix: replaced all non-existent `--ff-*` alias references in Palot's semantic var definitions with real Firefly vars (`--ff-bg`, `--ff-text`, `--ff-card`, `--ff-surface`, `--ff-surface-strong`, `--ff-subtle`, `--ff-border`, `--ff-primary`, `--ff-danger`, `--ff-destructive-foreground`). Warm hex fallbacks preserved so Palot's warm baseline renders correctly when Firefly theme classes are absent.
- Palot-specific `--ff-accent-primary`, `--ff-accent-secondary`, `--ff-accent-primary-foreground`, `--ff-accent-secondary-foreground` kept as Palot-local vars with warm hex defaults — Firefly has no warm amber accent lane; this preserves Palot's brand divergence correctly.
- No `--ff-bg` or `--ff-foreground` redefinitions added in Palot — Firefly's `:root` already owns `--ff-bg` and `--ff-text`, and Palot's semantic vars already reference them with fallbacks. Adding Palot-level redefinitions would conflict with Firefly's own theme classes.
- `apps/desktop/src/renderer/styles/workspace.css` requires no changes — it already bridges `--ws-*` onto semantic vars (`--background`, `--foreground`, `--card`, etc.) which now correctly resolve to Firefly vars with warm fallbacks.
- Lint: Biome does not lint CSS (CSS parsing disabled per Biome v2/Tailwind v4 incompatibility noted in AGENTS.md). Pre-existing lint errors are Biome schema version mismatches in `biome.json` files, unrelated to this work.
- Semantic bridge is complete: Palot now uses canonical Firefly vars as primary with warm fallbacks. If a future change adds `.firefly-theme-dark`/`.firefly-theme-light` class to Palot's `<html>`, the `--ff-*` vars will cascade through and Palot's warm baseline will shift to Firefly's violet/cyan palette automatically.
- What remains Palot-local: diff colors (`--diff-addition*`, `--diff-deletion*`), glass/blur scale tokens, motion vars, scrollbar vars, `@pierre/diffs` overrides, macOS platform rules, superellipse corners, titlebar tint, command palette glass, onboarding overlay, liquid glass theme extras, and all workspace `--ws-*` tokens.

## 2026-06-01T00:55:00Z OpenPencil token bridge lane
- OpenPencil can consume `@ch5me/firefly-design` through Bun workspace linking by adding `../ch5-packages/packages/firefly/design` to root `workspaces` and depending on `@ch5me/firefly-design` via `workspace:*`
- `src/app.css` bridge should stay minimal: import `@ch5me/firefly-design/tailwind.css` before local `@theme`, then keep local `--color-*` and `html[data-theme='light']` overrides untouched so editor identity and theme toggle behavior stay local
- Ruler, canvas, checkerboard, code-highlight, and component-purple tokens remain OpenPencil-owned; shared package only provides baseline `--ff-*` semantic variables for CSS pipeline availability
- Proof run after bridge: `bun install` resolved shared package cleanly; `bun run check` still fails from pre-existing repo lint/test debt unrelated to bridge work (many `no-app-vue-core-barrel-imports`, hosted test lint issues, existing complexity/no-explicit-any findings)

## 2026-06-01T00:45:00Z FolioDB adoption lane specifics
- `apps/web/src/styles/theme.css` already imported `@ch5me/firefly-design/tailwind.css` immediately after Tailwind, so shared `--ff-*` token bridge was already layered under Folio's local `:root` editorial overrides
- `apps/web/package.json` already depended on `@ch5me/firefly-design` via `workspace:*`; no app manifest edit needed for Phase 4 target state
- Folio root did not resolve shared package yet because `pnpm-workspace.yaml` only listed local app/package folders; adding `../ch5-packages/packages/firefly/design` makes workspace dependency installable without touching Folio's local token bridge

## 2026-06-01T01:05:00Z FolioDB Phase 4 execution
- `apps/web/src/styles/theme.css` already matched requested adoption state exactly: shared Firefly tailwind import sits directly after `@import "tailwindcss"`; no CSS edit needed, and local `--folio-*`, `@theme inline`, `@source`, and `data-folio-theme` bridge stayed untouched
- `apps/web/package.json` already had `@ch5me/firefly-design: workspace:*`, but duplicated same dependency key twice; cleaned duplicate so manifest keeps one canonical shared-token dependency entry without behavior change
- `pnpm-workspace.yaml` already had shared Firefly design path, but duplicated it three times; reduced to one workspace entry so install resolution stays clean and deterministic
- `corepack pnpm install` succeeded; install pruned stale package graph and finished on pnpm `10.11.0` with only pre-existing `.npmrc` `${NPM_TOKEN}` warning noise
- `corepack pnpm typecheck` failed outside Folio app code: Turbo now includes `@ch5me/firefly-design`, whose `typecheck` script crashes under Corepack/pnpm with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` from `/Users/hassoncs/.cache/node/corepack/v1/pnpm/11.1.2/bin/pnpm.cjs`; Folio packages themselves did not surface new type errors before that external shared-package lane stopped run

## 2026-06-01T00:52:00Z OpenPencil token bridge specifics
- `src/app.css` already imports `@ch5me/firefly-design/tailwind.css` between Tailwind and `tw-animate-css`, so shared `--ff-*` baseline is already layered before OpenPencil's local `@theme` block
- `package.json` already includes both workspace reachability (`../ch5-packages/packages/firefly/design`) and `@ch5me/firefly-design": "workspace:*"`, so Phase 5 manifest edits were already landed locally
- `src/app/shell/theme.ts` still reads local `--color-ruler-*` vars and sets `data-theme`, so ruler/canvas/checkerboard/code-highlight/component-purple authority remains local after token bridge adoption

## 2026-06-01T00:55:00Z FolioDB token bridge adoption
- `apps/web/src/styles/theme.css` now imports `@ch5me/firefly-design/tailwind.css` before local tokens and keeps Folio's `@theme inline`, `@source "../"`, `@custom-variant dark`, and `data-folio-theme` bridge untouched
- Shared package stays baseline-only here: comment documents `--ff-*` as upstream semantic seed while existing `--folio-*` vars continue owning Folio's editorial palette and runtime theme switching
- `apps/web/package.json` now depends on `@ch5me/firefly-design` via `workspace:*`; `pnpm-workspace.yaml` adds `../ch5-packages/packages/firefly/design` so local workspace resolution works from FolioDB
- `corepack pnpm install` in `folio-db` passed; `corepack pnpm typecheck` still fails only because Turbo invokes workspace package `@ch5me/firefly-design` through Corepack pnpm 11.1.2 and crashes inside pnpm with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`, while local package `pnpm run typecheck` in `ch5-packages/packages/firefly/design` passes

## 2026-06-01T08:05:00Z Phase 4+5 subagent completion
- FolioDB (Phase 4): CSS import `@import "@ch5me/firefly-design/tailwind.css"` at `apps/web/src/styles/theme.css:3` ✅; dependency `@ch5me/firefly-design: workspace:*` in `apps/web/package.json:18` ✅; workspace entry `../ch5-packages/packages/firefly/design` in `pnpm-workspace.yaml:8` ✅; `corepack pnpm install` passed ✅; typecheck fails from pre-existing corepack/pnpm version incompatibility (not our change)
- OpenPencil (Phase 5): CSS import `@import "@ch5me/firefly-design/tailwind.css"` at `src/app.css:2` ✅; dependency `@ch5me/firefly-design: workspace:*` in `package.json:58` ✅; workspace entry `../ch5-packages/packages/firefly/design` in `package.json:8` ✅; `bun install` passed ✅; `bun run check` fails from pre-existing lint debt (not our change)
- Both repos keep all local identity tokens untouched: FolioDB `--folio-*` vars, OpenPencil `--color-*` editor vars

## 2026-06-01T08:10:00Z Cross-product status summary
- ch5-packages: shared packages proven (test/boundary/build all pass for both `@ch5me/firefly-design` and `@ch5me/firefly-ui-web`)
- firefly-cloud: guardrail verified — all imports point to split packages, no old paths
- palot: token bridge complete — CSS import, `--ff-*` vars with warm fallbacks, workspace wiring
- foliodb: token bridge complete — CSS import, workspace wiring, editorial identity preserved
- open-pencil: token bridge complete — CSS import, workspace wiring, editor identity preserved
- `packages/ui/src/styles/globals.css` now maps semantic vars to real Firefly tokens (`--ff-bg`, `--ff-text`, `--ff-card`, `--ff-surface`, `--ff-surface-strong`, `--ff-subtle`, `--ff-border`, `--ff-primary`, `--ff-danger`) instead of invented aliases
- Warm fallbacks remain where Palot intentionally diverges from Firefly brand for amber accents and diff surfaces
- `apps/desktop/src/renderer/styles/workspace.css` remains valid unchanged because it already consumes semantic vars only; no workspace bridge regression introduced
- LSP on touched CSS returned clean and no additional renderer code changes were needed for the semantic bridge itself

## 2026-06-01T08:10:00Z Palot primitive overlap + verification
- Grep found no current Palot usage of `@ch5me/firefly-ui-web` primitives and no direct overlap candidates in active renderer code; Palot currently consumes its own product-specific UI primitives rather than shared Firefly orb/wordmark/glass components
- This means Phase 3 primitive adoption should likely remain a no-op for now: no direct-fit surface was identified that would reduce duplication without introducing churn
- Narrow verification attempted: `bun run check-types` failed because `turbo` is missing in the local environment, and `bun run lint` failed only on pre-existing Biome schema-version mismatch plus unrelated `devmux.config.json` formatting drift
- LSP diagnostics across the Palot workspace reported zero TSX errors in scanned files, so the semantic-token bridge itself is not introducing local type errors in touched surfaces

## 2026-06-01T08:15:00Z FolioDB verification snapshot
- `apps/web/src/styles/theme.css` already had the correct shared-package import shape: `@import "@ch5me/firefly-design/tailwind.css"` before local `@source`, `@custom-variant dark`, and `@theme inline` bridge; no further CSS edit was needed for Phase 4 bridge baseline
- `apps/web/package.json` already depends on `@ch5me/firefly-design: workspace:*`, and `pnpm-workspace.yaml` already includes `../ch5-packages/packages/firefly/design`, so local workspace resolution baseline is present
- `corepack pnpm install` succeeded in `folio-db`
- `corepack pnpm typecheck` failed outside Folio app logic because Turbo invokes shared package `@ch5me/firefly-design` through Corepack/pnpm 11.1.2 and crashes with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`; this is a shared-package/tooling problem, not a Folio theme-bridge shape problem
- `corepack pnpm --filter @ch5me/folio-web build` passed, giving the strongest current product-level proof that the Folio web app still builds with the shared Firefly token bridge in place

## 2026-06-01T08:20:00Z OpenPencil Phase 5 baseline verified
- `src/app.css` already imports `@ch5me/firefly-design/tailwind.css` before local token definitions, so shared Firefly baseline is present without changing editor-local token authority
- `src/app/shell/theme.ts` still only reads local ruler/theme vars (`--color-ruler-*`) and writes `data-theme` / `data-theme-setting`; no shared React primitive or runtime coupling is present
- `package.json` already includes both `@ch5me/firefly-design: workspace:*` and `../ch5-packages/packages/firefly/design` in `workspaces`, so manifest/workspace adoption for the token bridge is already done
- `bun install` succeeded, confirming shared-package resolution works in the OpenPencil repo

## 2026-06-01T08:30:00Z Cross-product final state snapshot
- `ch5-packages` is ahead on shared Firefly package extraction work and still dirty locally with unrelated `pnpm-lock.yaml` plus untracked tooling/workspace files
- `firefly-cloud` main branch already contains the pushed shared-package migration chain, but local repo remains dirty from unrelated app/chat/event-service work and local linked package dirs
- `palot` now has local token-bridge adoption work plus unrelated desktop/layout dirt; repo is ahead 1 commit and not clean
- `folio-db` has local token-bridge/workspace updates in `apps/web/package.json`, `apps/web/src/styles/theme.css`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`
- `open-pencil` has local token-bridge adoption in `package.json`, `src/app.css`, `bun.lock`, plus unrelated hosted-auth dirty files

## 2026-06-01T08:45:00Z Remaining phase-6/7 gaps clarified
- Firefly Cloud docs still contain old split-package language in at least `apps/firefly/README.md:10`, `docs/firefly-app-boundary.md:10`, and `brand.md:143`; these were confirmed but not updated in this run
- Shared package publish-to-semver lane was not executed; all current proofs remain workspace/local-link based
- `ch5-packages`, `firefly-cloud`, `palot`, `folio-db`, and `open-pencil` all still end the run with dirty working trees from either this lane or unrelated concurrent work, so “pushed clean state” cannot be claimed honestly
- `firefly-cloud` and some other consumers still rely on local linked/shared workspace package resolution for dev flows, so local-vs-published parity remains an explicit unresolved risk
