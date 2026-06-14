# UI Component Unification Audit — Palette Themeability Migration

**Status: COMPLETE + BURNED DOWN (2026-06-14).** Palot imports all UI directly
from the CH5-owned themeable packages. The intermediate `@ch5me/elf-ui` shim
layer was deleted — it added no behavior and its per-component subpaths were
fictional (every file was an identical whole-barrel re-export). `packages/ui`
(`@ch5me/elf-ui`) is now only a Storybook + global-styles host.

## Final state (after burn-down)

| | Count |
|---|---|
| elf-ui shim component files | **0** (deleted; were 133 identical `export *`) |
| App/story import sites rewritten to upstream | 204 files / 381 decls |
| Remaining elf-ui surface | `./styles/globals.css` only |
| Direct upstream imports in apps | all UI |

The intermediate migration first turned 133 components into compat shims
(`export * from "@ch5me/ch5-ui-web"` / `@ch5me/agent-ui-web`), then the
burn-down (`scripts/codemod-elf-ui-to-upstream.mjs`) rewrote every consumer to
import the upstream barrels directly and deleted the shims. The 133-shim state
is preserved in git history; the mapper (`scripts/map-elf-ui-shim-candidates.mjs`)
remains for reference.

## Why burn down instead of keeping the shims

The shim layer was the worst-of-both: an indirection that added zero value (0
non-pure shims, no Palot theming/composition) while lying about its structure
(all 133 files were one of two identical whole-barrel re-exports, so e.g.
`@ch5me/elf-ui/components/button` re-exported the *entire* upstream barrel).
Palot's divergence point is tokens/theme (`firefly-design` / `ch5-design-web`),
not component wrappers — so the wrappers were pure tech debt. Burn-down makes the
CH5-owned packages the single source of truth.

## Guardrails (so the fictional layer can't return)

- `scripts/check-no-elf-ui-shim-imports.mjs` fails CI (lint job) if any
  `@ch5me/elf-ui/{components,hooks,lib}/*` import reappears.
- elf-ui `exports` only exposes `./styles/globals.css`, so the old subpaths no
  longer resolve (fail-fast at typecheck/build).

## Where each thing lives now

- **`@ch5me/ch5-ui-web`** (`ch5-packages/packages/web/ch5-ui-web`) — generic web
  primitives, layout shells, themeable building blocks, `chart` (recharts 2.15.4),
  `direction`. elf-ui re-exports ~83 components from here.
- **`@ch5me/agent-ui-web`** (`ch5-packages/packages/web/agent-ui-web`, 50
  ai-elements) — all reusable AI/agent/chat surfaces, product-neutral. elf-ui
  re-exports ~50 ai-elements from here.
- **`@ch5me/elf-ui`** (`palot/packages/ui`) — thin compat layer only; each file is
  `export * from "@ch5me/ch5-ui-web"` or `export * from "@ch5me/agent-ui-web"`.

## How it was done

1. Backported P0/P1 primitives + API-gap exports into ch5-ui-web (base-ui engine,
   CH5 semantic tokens). [prior sessions]
2. Created `@ch5me/agent-ui-web`; ported all 50 ai-elements verbatim (imports
   rewired: `@ch5me/elf-ui/lib/utils`→ch5-ui-web `cn`,
   `@ch5me/elf-ui/hooks/use-controllable-state`→ch5-ui-web, primitives→ch5-ui-web
   barrel, siblings→`./x.tsx`).
3. Ported `chart` + `direction` into ch5-ui-web.
4. Converted elf-ui to shims with `scripts/map-elf-ui-shim-candidates.mjs --apply`
   (deterministic: a component is shim-ready iff the upstream barrel exports all
   its symbols).

## Cross-repo dependency dedup (load-bearing)

React types are structural; different physical copies of `@types/react` /
`lucide-react` / `react-hook-form` across the bun(palot)↔pnpm(ch5-packages)
boundary broke type assignability at the package seam. Fixed by pinning identical
exact versions in BOTH repos:

- palot: `overrides` in root `package.json`.
- ch5-packages: `overrides:` in `pnpm-workspace.yaml` (NOT package.json).
- Versions: `@types/react@19.2.14`, `@types/react-dom@19.2.3`,
  `lucide-react@0.564.0`, `react-hook-form@7.76.1` (rhf held at mature 7.76.1 —
  7.79 fails ch5's 7-day `minimumReleaseAge` gate).

Reuse this pattern for any new dependency whose types cross the elf-ui↔CH5 seam.

## Tailwind v4 styling fix (caught during burn-down — was a latent bug)

Tailwind v4 auto-detection ignores `node_modules`, and the components live in the
sibling `ch5-packages` repo, so their utility classes (`bg-primary`, `h-9`,
`px-4`, `inline-flex`, …) were **never being generated** — components rendered
unstyled (transparent bg, no padding/height). The pre-burn-down `@source
"../components"` only scanned the classless shim files, so this was already broken
and unnoticed (the earlier "150 entries render" check never verified styling).

Fix in `packages/ui/src/styles/globals.css`: explicitly `@source` the upstream
package builds (relative to the CSS file, so it works for app + Storybook):

```css
@source "../stories";
@source "../../../../node_modules/@ch5me/ch5-ui-web/dist";
@source "../../../../node_modules/@ch5me/agent-ui-web/dist";
```

## Verification (2026-06-14)

- agent-ui-web / ch5-ui-web: typecheck 0, build OK.
- palot elf-ui `check-types`: 0. apps/desktop `check-types`: 0 (after 381-decl
  codemod across 204 files).
- Burn-down guard (`scripts/check-no-elf-ui-shim-imports.mjs`): PASS.
- Storybook (:10618) boots from burned-down state: 150 entries, no resolve errors.
- **Behavioral (browser) styling proof** after the `@source` fix: Button
  (`bg: rgb(245,158,11)`, `h: 36px`, `inline-flex`, padding present — was
  transparent/0/inline), Badge variants (filled/secondary/outline/destructive/
  ghost/link all correct), and an `agent-ui-web` Message (bubble + syntax-
  highlighted code block + actions) all render correctly styled.

## Optional follow-ups (not blocking)

- **Behavioral verification gate**: add `@storybook/test-runner` to CI to render
  all 150 stories headlessly on every push (catches render/interaction
  regressions); then a Playwright/Chromatic visual baseline for load-bearing
  surfaces. Today's proof is a manual browser spot-check, not a gate.
- Relocate stories upstream (co-locate with `ch5-ui-web` / `agent-ui-web`) so
  upstream changes fail their own stories instead of drifting from palot's.
- Trim elf-ui `dependencies` (most are now only transitively needed by stories).
- Human app visual smoke (sidebar, command palette, chat composer, message
  rendering, settings, onboarding, side-panel route).
