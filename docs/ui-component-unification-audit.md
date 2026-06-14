# UI Component Unification Audit — Palette Themeability Migration

**Status: COMPLETE (2026-06-14).** `@ch5me/elf-ui` (`packages/ui`) is a 100%
compat layer — all 133 components re-export from CH5-owned themeable packages.

## Final state

| | Count |
|---|---|
| elf-ui components total | 133 |
| Migrated to compat shims | **133** (`export * from "<upstream>"`) |
| Still local (Palot-specific) | 0 |

Mapper proof: `node scripts/map-elf-ui-shim-candidates.mjs` → MIGRATED 133,
BLOCKED 0, READY_* 0.

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

## Verification (2026-06-14)

- agent-ui-web: typecheck 0, build OK, boundary PASS, test PASS.
- ch5-ui-web: typecheck 0, build OK.
- palot elf-ui `check-types`: 0. apps/desktop `check-types`: 0.
- Storybook (`devmux ensure storybook`, :10618): 150 entries, no resolve errors.

## Optional follow-ups (not blocking; Non-Goals of "all elements upstream")

- Step-2 side-by-side comparison harness (ports are verbatim; palot SB is the
  parity reference).
- Native agent-ui-web stories (palot SB already renders all 150).
- Human app visual smoke (sidebar, command palette, chat composer, message
  rendering, settings, onboarding, side-panel route).
