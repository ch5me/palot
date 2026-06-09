# Port Plan: uselayouts → `@ch5me/elf-ui` (palot/packages/ui)

Status: planned, not started
Date: 2026-06-09
Source library: `uselayouts` — local clone at `/Users/hassoncs/src/ch5/uselayouts`, components under `registry/default/example/*.tsx` (shadcn-registry-style framer-motion + Tailwind components, light-only, hugeicons, hardcoded palettes)
Target package: `@ch5me/elf-ui` at `/Users/hassoncs/src/ch5/palot/packages/ui`

## Goal

Adapt the genuinely useful animated interaction patterns from uselayouts into `@ch5me/elf-ui` as first-class, theme-correct, accessible components — NOT a wholesale copy. Every port is rewritten onto the palot stack: Tailwind v4 semantic tokens (`@ch5me/firefly-design`), `motion/react` v12 with CH5 semantic motion tokens, lucide-react icons, elf-ui code conventions, data-slot glass theming, and mandatory reduced-motion support. Marketing one-offs are skipped; one component (smooth-dropdown) is folded into an existing primitive instead of forked.

## Audit Summary

26 components audited from `uselayouts/registry/default/example/`:

- **16 port** — novel, app-relevant animated patterns we lack (list reflow, morphing toolbars/inputs/buttons, shared-element galleries, animated tabs, inline edit, wizard, stacked list, pricing odometer).
- **9 skip** — marketing-page one-offs (3d-book, bento-card, bucket, discover-button, empty-testimonial, feature-carousel, folder-interaction, magnified-bento, shake-testimonial-card): hardcoded art/palettes, light-only, no product-app surface.
- **1 adapt-existing** — smooth-dropdown: apply its spring-height + layoutId highlight to our existing accessible base-ui `dropdown-menu.tsx` later; do not ship a second non-accessible dropdown.

Cross-cutting port rules (from the audit):

1. `motion` is already a dependency (only `src/components/ai-elements/shimmer.tsx` uses it today) — all ports import from `"motion/react"`; normalize fluid-expanding-grid's `"framer-motion"` import.
2. Replace `@hugeicons/*` with `lucide-react` (already installed) in every port — do NOT add hugeicons.
3. `clsx`/`tailwind-merge` already present via `cn()`; rewrite all `@/lib/cn`, `@/lib/utils`, and relative ui imports to `@ch5me/elf-ui/lib/utils` and `@ch5me/elf-ui/components/*`.
4. uselayouts has ZERO `dark:` variants and many hardcoded hexes — map accents to semantic tokens (`destructive`, `primary`, `muted`, `accent`) during port; stacked-list needs a small token-based tag palette.
5. Follow elf-ui conventions: plain functions (no forwardRef), `data-slot` attrs, kebab-case files, biome tabs/double-quotes/no-semicolons, `export const` per symbol.
6. `use-mobile` hook already exists; port `use-outside-click` as `src/hooks/use-outside-click.ts`; standardize measure-driven components on the `react-use-measure` npm package instead of uselayouts' local `@/hooks/use-measure`.
7. expandable-gallery: swap `next/image` for plain `img`.
8. smooth-dropdown is the only adapt-existing: fold its spring height + layoutId highlight into the existing base-ui `dropdown-menu.tsx` later rather than shipping a second non-accessible dropdown.

## Decision Matrix

Source files live at `/Users/hassoncs/src/ch5/uselayouts/registry/default/example/<name>.tsx`. Target paths under `/Users/hassoncs/src/ch5/palot/packages/ui/`.

| # | Component | Status | Decision | Complexity | New deps | Reason |
|---|---|---|---|---|---|---|
| 1 | `3d-book` | missing | **skip** | medium | — | Marketing flourish (3D fanning book, forces literal `light` class); no use in a chat/agent desktop or general app surface. |
| 2 | `animated-collection` | missing | **port** → `src/components/animate/animated-collection.tsx` | medium | — | Animated add/remove list reflow (AnimatePresence + layoutId) is directly reusable for sessions/attachments/queue lists; nothing in elf-ui animates list mutations. |
| 3 | `bento-card` | missing | **skip** | high | — | Marketing-page bento with mock workspace preview; one-off landing-page content, not a product-app primitive. |
| 4 | `bottom-menu` | missing | **port** → `src/components/animate/bottom-menu.tsx` | medium | `react-use-measure` | Floating expanding pill menu with measured-height morph + theme picker; strong fit as a desktop dock/quick-actions surface, pattern we lack entirely. |
| 5 | `bucket` | missing | **skip** | high | — | Figma-exported SVG marketing gag (chips tossed into a bucket); zero app utility, hard-coded art. |
| 6 | `day-picker` | partial | **port** → `src/components/animate/day-picker.tsx` | medium | — | We have static Calendar (react-day-picker); their layoutId selection ring + animated month swaps make a premium picker. Port as the animated picker option. |
| 7 | `delete-button` | partial | **port** → `src/components/animate/delete-button.tsx` | low | — | Two-stage delete/confirm with icon-label morph; ubiquitous app interaction (delete session/file) we only cover via heavyweight AlertDialog. Map #FE322A palette to destructive tokens, hugeicons→lucide. |
| 8 | `discover-button` | missing | **skip** | low | — | One-off marketing like/discover expansion, light-only raw-gray palette; duplicative with status/delete button morph patterns being ported. |
| 9 | `discrete-tabs` | partial | **port** → `src/components/animate/discrete-tabs.tsx` | low | — | Our Tabs only animates indicator opacity; layoutId sliding indicator + content crossfade is the canonical animated-tabs upgrade. Zero deps. |
| 10 | `dynamic-toolbar` | missing | **port** → `src/components/animate/dynamic-toolbar.tsx` | medium | `react-use-measure` | Width-morphing toolbar is a perfect chat-composer/canvas-toolbar pattern; our only Toolbar is xyflow-specific. Replace local use-measure hook with react-use-measure, hugeicons→lucide. |
| 11 | `empty-testimonial` | partial | **skip** | low | — | Testimonial-specific marketing empty state; we already have a generic Empty component. Folder-open hover gag too site-specific. |
| 12 | `expandable-gallery` | missing | **port** → `src/components/animate/expandable-gallery.tsx` | medium | — | Shared-element grid→detail expansion is directly useful for image attachments/generated-image galleries in chat. Swap next/image→img, port use-outside-click into hooks/, use our Button. |
| 13 | `feature-carousel` | partial | **skip** | medium | — | Marketing feature carousel with Unsplash imagery + hardcoded brand blue; we already have embla Carousel for product needs. |
| 14 | `fluid-expanding-grid` | missing | **port** → `src/components/animate/fluid-expanding-grid.tsx` | medium | — | FLIP layout reflow grid (click-to-expand with sibling reflow) complements expandable-gallery for dashboards/media grids; zero deps. Normalize framer-motion import to motion/react and tokenize zinc/alpha colors. |
| 15 | `folder-interaction` | missing | **skip** | medium | — | Figma-exported SVG folder with fully hardcoded lavender palette; pure marketing eye-candy requiring a total retheme for near-zero app value. |
| 16 | `inline-edit` | missing | **port** → `src/components/animate/inline-edit.tsx` | low | — | Read↔edit inline text crossfade is a core app interaction (rename session/title/field); we have no equivalent. Fix cn import to @ch5me/elf-ui/lib/utils, use our Input. |
| 17 | `list-item` | partial | **port** → `src/components/animate/list-item.tsx` | low | — | Animated shared selection highlight over list rows; our Item is static. Pattern applies to sidebar/session/filter lists everywhere. hugeicons→lucide, clsx→cn. |
| 18 | `magnified-bento` | missing | **skip** | high | — | Draggable magnifier lens over marquee chips — marketing bento one-off with hardcoded gray ramp; no app surface needs it. |
| 19 | `morphing-input` | partial | **port** → `src/components/animate/morphing-input.tsx` | low | — | Collapsed-button→expanded-input morph fits search toggles and compact toolbars; our Input/InputGroup are static. Fix relative shadcn input import to our Input, hugeicons→lucide. |
| 20 | `multi-step-form` | partial | **port** → `src/components/animate/multi-step-form.tsx` | high | `react-use-measure` | Animated wizard (measured height + step transitions + validation) is a real gap for onboarding/setup flows; every heavy dep (RHF, zod, resolvers, date-fns, sonner, lucide, all 9 shadcn primitives) already exists in elf-ui. Only react-use-measure is new. Tokenize bg-slate-950. |
| 21 | `pricing-card` | missing | **port** → `src/components/animate/pricing-card.tsx` | medium | `@number-flow/react` | Firefly has billing/plan surfaces; odometer price digits + layoutId billing toggle is the cleanest-themed component of the set (already semantic tokens). Needs @number-flow/react. |
| 22 | `shake-testimonial-card` | missing | **skip** | low | — | Marketing testimonial card with hardcoded pastel sticky-note hexes; site-specific, light-only, no app use. |
| 23 | `smooth-dropdown` | have | **adapt-existing** → `src/components/dropdown-menu.tsx` | medium | `react-use-measure` | We already have an accessible base-ui DropdownMenu; porting this from-scratch div dropdown would fork the menu surface and lose keyboard/a11y. Instead, later apply its measured-height spring + layoutId hover highlight to our dropdown-menu.tsx. |
| 24 | `stacked-list` | missing | **port** → `src/components/animate/stacked-list.tsx` | medium | — | Stacked-cards→full-list FLIP morph maps directly to notifications/queued-messages/agent-task widgets in the desktop app. Replace ~12 hardcoded pastel tag hexes with a token-based tag palette, hugeicons→lucide, use our Input/Button. |
| 25 | `status-button` | partial | **port** → `src/components/animate/status-button.tsx` | low | — | Idle→loading→success button with animated icon/label swaps; universal submit/save affordance our static Button + Spinner don't cover. Use our Button, hugeicons→lucide. |
| 26 | `vertical-tabs` | partial | **port** → `src/components/animate/vertical-tabs.tsx` | low | — | Animated vertical tab rail with variant-based panel transitions; pairs with discrete-tabs to round out animated tab coverage for settings/inspector panes. Tokenize from-black/20 gradient. |

## Target Directory Convention

New subdir `/Users/hassoncs/src/ch5/palot/packages/ui/src/components/animate/` (mirrors the existing flat `components/` + `components/ai-elements/` precedent); add `"./components/animate/*": "./src/components/animate/*.tsx"` to the package.json exports map. Supporting hooks (`use-outside-click`; `use-measure` replaced by `react-use-measure`) go in `src/hooks/`. All ports are new files only.

Additional shared module: `src/lib/motion-tokens.ts` — the semantic motion token mirror (see Motion Engine Decision below); exported via the existing `"./lib/*"` exports entry.

## Shared Deps to Add

Add to `packages/ui/package.json` dependencies:

- `react-use-measure` (bottom-menu, dynamic-toolbar, multi-step-form; later smooth-dropdown adaptation) — already in bun.lock transitively via @react-three/fiber, but must be a direct dependency.
- `@number-flow/react` (pricing-card)

No other new deps. No gsap/react-spring/lottie. No hugeicons.

## Motion Engine Decision: `useCh5Motion = false`

Ported components use `motion/react` directly, NOT `@ch5me/motion`. Evidence:

1. `@ch5me/motion`'s web engine is `@react-spring/web`, not framer — its declarative surface (`Motion.View` with from/animate + semantic transition strings) has no AnimatePresence, variants, exit, layout, whileHover/whileTap/whileInView, or drag, so porting third-party framer-motion components onto it is a rewrite, not a mechanical port.
2. `palot/packages/ui` already ships framer `motion` ^12.33.0 and uses `motion/react` today (`src/components/ai-elements/shimmer.tsx`); it does NOT depend on `@ch5me/motion`.
3. `@ch5me/motion` is `private:true` and only reaches palot via root bun-workspace relative links plus per-app vite aliases to its web entry (`apps/desktop/electron.vite.config.ts:72`) — making the ui package depend on it adds wiring fragility for zero engine benefit on web.

So: ported components use `motion/react` directly, but ALL transition values come from a single shared token module (`src/lib/motion-tokens.ts`) mirroring `ch5-packages/packages/motion/motion/src/tokens.ts` (springs are shape-identical to framer's `{type:"spring",stiffness,damping,mass}`; durations ms→s; CSS easing strings→framer ease arrays). This keeps the CH5 semantic motion language (enter/exit/press/emphasis + overlayEnter/overlayExit/layout/indicator/feedback/hover/panel/reveal/press/inertia/ambient/chart) while using the engine the source components were written for. Reduced-motion policy must match `@ch5me/motion`: reduced = instant (duration 0, snap to final), implemented via `motion/react` useReducedMotion/MotionConfig and `@media (prefers-reduced-motion)` blocks for CSS keyframes. If `@ch5me/motion` later gets a framer-compatible web surface or is published, swap the token-mirror module for an import of `@ch5me/motion/tokens` (pure data, engine-free) — components won't change.

## Adaptation Contract (porting cheat sheet — verbatim)

# CH5 Porting Cheat Sheet — third-party framer-motion + Tailwind → palot `@ch5me/elf-ui`

Target stack: Tailwind v4 (`@theme inline` tokens), `@ch5me/firefly-design/tailwind.css` (`--ff-*` vars), shadcn data-slot conventions, framer `motion` v12 (`motion/react`) with values aligned to `@ch5me/motion` semantic tokens.

Hard rules:
1. **Zero literal colors** in ported code (no hex, no `bg-zinc-*`/`bg-gray-*`/`bg-white`/`text-black`, no raw `rgba()`). Any literal color left = port bug.
2. **No `dark:` + raw palette.** Semantic tokens flip automatically via `.dark`. Only use `dark:` for genuinely asymmetric semantics (rare).
3. **No hardcoded framer transitions.** Every `transition={{...}}` must come from the semantic motion table below.
4. **Reduced motion is mandatory** on every animated component (rules at bottom).
5. Strip third-party font imports (Inter/Geist/Google Fonts) — use `font-sans` / `font-mono` only.

---

## 1. Color mapping (hardcoded → token utility)

| Third-party pattern | Replace with |
|---|---|
| `bg-white`, `bg-gray-50`, `bg-zinc-950`, `bg-[#0a0a0a]` (page bg) | `bg-background` |
| panel/card surfaces (`bg-white shadow`, `bg-zinc-900`) | `bg-card text-card-foreground` (+ `data-slot="card"`) |
| dropdown/menu/tooltip/popover surfaces | `bg-popover text-popover-foreground` (+ proper `data-slot`) |
| `bg-gray-100`, `bg-zinc-800` (subtle fills, code blocks, badges) | `bg-muted` (or `bg-muted/50` — opacity-modified tokens are fine; glass themes restyle them) |
| secondary buttons / user bubbles | `bg-secondary text-secondary-foreground` |
| `text-black`, `text-gray-900`, `text-white` | `text-foreground` |
| `text-gray-500/400`, `text-zinc-400` | `text-muted-foreground` |
| `border-gray-200/300`, `divide-gray-*` | `border-border` (base layer already applies `border-border` to `*` — usually just `border`) |
| primary CTA (`bg-blue-600`, `bg-indigo-600`, `bg-black` button) | `bg-primary text-primary-foreground` |
| highlight/hover accent | `bg-accent text-accent-foreground` (warm amber in Elf baseline) |
| `red-*` errors/danger | `bg-destructive text-destructive-foreground` / `text-destructive` |
| focus rings (`ring-blue-500`, `outline-*`) | `ring-ring` / rely on global `outline-ring/50`; focus shadows: `var(--shadow-focus-soft)` / `var(--shadow-focus-strong)` |
| input borders | `border-input` (note: `--input` is a **border** color, not a fill) |
| chart series colors | `text-chart-1`…`chart-5` / `var(--chart-1..5)` |
| sidebar-area colors | `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `border-sidebar-border`, `ring-sidebar-ring` |
| diff green/red | `var(--diff-addition)` / `var(--diff-deletion)` (+ `-foreground`) |
| modal overlay `bg-black/50` | keep shadcn `DialogOverlay`; custom: `bg-black/35` max, never opaque |

Deeper Firefly lane (when semantic vars aren't enough): `--ff-primary`, `--ff-danger`, `--ff-success`, `--ff-warm`, `--ff-cyan`, `--ff-indigo`, `--ff-violet` + `-soft` variants, `--ff-surface`, `--ff-surface-strong`, `--ff-surface-glass`, `--ff-overlay`, `--ff-disabled`, `--ff-selected-surface/border`, `--ff-agent-*` (per-agent identity colors), `--ff-chart-*`. Use `var(--ff-*)` directly or `color-mix(in srgb, var(--token) N%, transparent)` — never bake a new hex.

**Glass/transparency system:** palot has 3 chrome tiers (`.electron-transparent` / `.electron-vibrancy` / opaque) that restyle surfaces via `data-slot` selectors. Ported containers MUST carry the matching `data-slot` (`card`, `dialog-content`, `popover-content`, `dropdown-menu-content`, `select-content`, `sheet-content`, `tabs-list`, `input-group`, …) so glass theming reaches them. Custom glass: `color-mix(in srgb, var(--popover) var(--glass-elevated), transparent)` + `backdrop-filter: blur(var(--blur-lg))` — never raw `rgba(255,255,255,0.1)` + `backdrop-blur-md`. Glass opacity scale: `--glass-body 40%`, `--glass-sidebar 45%`, `--glass-surface 60%`, `--glass-elevated 82%`, `--glass-card 90%`, `--glass-content 80%`. Blur scale: `--blur-sm 8px`, `--blur-md 12px`, `--blur-lg 16px`, `--blur-xl 24px`.

## 2. Radius (base `--radius: 0.75rem` = 12px)

| Token | Computed | Use for |
|---|---|---|
| `rounded-sm` (8px), `rounded-md` (10px) | radius−4 / −2 | small controls, menu items, badges |
| `rounded-lg` (12px) | `var(--radius)` | buttons, inputs, cards (default) |
| `rounded-xl` (16px) | radius+4 | dialogs, sheets, content cards |
| `rounded-2xl` (20px) → `rounded-4xl` (28px) | radius+8/+12/+16 | hero cards, large panels |

Rules: replace arbitrary `rounded-[10px]`→`rounded-md`, `rounded-[12px]`→`rounded-lg`, `rounded-[16px]`→`rounded-xl`; inline `border-radius: Npx` → `var(--radius-*)`. `rounded-full` for pills/avatars is fine. Never hardcode px — `--radius` is theme-overridable and scales ×1.25 under macOS Tahoe superellipse (`corner-shape`), which components get free via `data-slot`.

## 3. Shadows

Replace raw `box-shadow: 0 4px 6px rgba(0,0,0,.1)` / Tailwind palette shadows with Firefly shadow tokens: `--ff-shadow-sm/md/lg/xl/2xl/inner/drop`, or semantic aliases `--shadow-flat` (sm), `--shadow-layered` (lg), `--shadow-glassy` (2xl), `--shadow-focus-soft/strong`. Tailwind arbitrary form: `shadow-[var(--ff-shadow-md)]`. On glass tiers heavy shadows look wrong — prefer borders + blur; the glass CSS strips shadows from slotted surfaces anyway.

## 4. Typography

- Families: `font-sans` (system stack) and `font-mono` only. Delete `next/font`, Google Fonts links, `font-[Inter]`.
- Sizes: palot overrides `text-xs` = 0.8125rem/1.125rem (13px) and `text-sm` = 0.9375rem/1.375rem (15px). So `text-[13px]` → `text-xs`, `text-[15px]` → `text-sm`. Other sizes use standard Tailwind steps; no arbitrary `text-[Npx]`.
- Body already gets antialiasing + font-features globally — strip per-component smoothing hacks.

## 5. Motion — semantic transitions (framer `motion/react`, token-aligned values)

Engine decision: **keep `motion/react` (already a dep of `@ch5me/elf-ui`); do NOT import `@ch5me/motion` from ported web components** (see useCh5Motion rationale). Keep OUR semantic language by using these exact token values. Put them in one shared module — `src/lib/motion-tokens.ts` in palot ui — mirroring `@ch5me/motion` `src/tokens.ts` (add a provenance comment pointing at `ch5-packages/packages/motion/motion/src/tokens.ts`); components import constants, never inline numbers.

### Springs (shape is framer-compatible as-is: `{ type: "spring", stiffness, damping, mass }`)

| Token | stiffness/damping/mass | Use for |
|---|---|---|
| `gentle` | 120 / 18 / 1 | default **enter** intent |
| `snappy` | 320 / 22 / 1 | **press** intent, quick UI response |
| `bouncy` | 320 / 14 / 1 | **emphasis**, playful pop, charts |
| `stiff` | 500 / 30 / 1 | instant-feel snaps |
| `lazy` | 80 / 20 / 1.2 | slow drifts |
| `iconiqPress` | 640 / 38 / 0.85 | press/feedback preset |
| `iconiqHover` | 340 / 28 / 0.8 | hover preset |
| `iconiqOverlay` | 300 / 25 / 0.8 | overlay/modal/menu **enter** |
| `iconiqOverlayExit` | 400 / 30 / 1 | overlay **exit** |
| `iconiqPanel` | 240 / 22 / 0.78 | panel slide/resize |
| `iconiqReveal` | 146 / 23 / 0.98 | content reveal |
| `iconiqLayout` | 420 / 34 / 0.9 | layout/position/width changes |
| `iconiqIndicator` | 360 / 24 / 1 | tabs underline, toggles, state indicators |
| `iconiqInertia` | 58 / 16 / 1.35 | drifty inertial follow |

### Durations (token ms → framer seconds: divide by 1000)

`instant` 0 · `fast` 150 · `base` 250 · `expressive` 350 · `slow` 400 · `showcase` 420 · `ambient` 1000.

### Easings (CSS string → framer `ease`)

| Token | CSS | framer |
|---|---|---|
| `standard` | `ease-in-out` | `"easeInOut"` |
| `decelerate` | `ease-out` | `"easeOut"` |
| `accelerate` | `ease-in` | `"easeIn"` |
| `linear` | `linear` | `"linear"` |
| `expressive` | `cubic-bezier(0.22, 1, 0.36, 1)` | `[0.22, 1, 0.36, 1]` |
| `iconiqSoft` | `cubic-bezier(0.18, 1, 0.32, 1)` | `[0.18, 1, 0.32, 1]` |

### Semantic preset → what to write in framer

| Surface | Preset | framer `transition` |
|---|---|---|
| Modal/menu/sheet/popover enter | `overlayEnter` | `{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }` |
| Modal/menu/sheet exit (`AnimatePresence` exit) | `overlayExit` | `{ type: "spring", stiffness: 400, damping: 30, mass: 1 }` (CSS fallback: 200ms ease-in) |
| Layout/width/position shifts (`layout` prop) | `layout` | `{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }` |
| Tab indicator / toggle / active marker | `indicator` | `{ type: "spring", stiffness: 360, damping: 24, mass: 1 }` |
| Hover (`whileHover`) | `hover` | `{ type: "spring", stiffness: 340, damping: 28, mass: 0.8 }` |
| Press (`whileTap`) / button feedback | `press`/`feedback` | `{ type: "spring", stiffness: 640, damping: 38, mass: 0.85 }` |
| Content/section reveal, in-view entrance | `reveal` | `{ type: "spring", stiffness: 146, damping: 23, mass: 0.98 }` |
| Panel slide/collapse | `panel` | `{ type: "spring", stiffness: 240, damping: 22, mass: 0.78 }` |
| Drag release / inertial drift | `inertia` | `{ type: "spring", stiffness: 58, damping: 16, mass: 1.35 }` |
| Ambient pulse/glow loops | `ambient` | `{ duration: 1, ease: "linear" }` |
| Chart/dashboard entrance | `chart` | `{ type: "spring", stiffness: 320, damping: 14, mass: 1 }` (bouncy) |
| Generic element enter | intent `enter` | `{ type: "spring", stiffness: 120, damping: 18, mass: 1 }` |
| Generic element exit | intent `exit` | `{ duration: 0.15, ease: "easeIn" }` |

### Translating a third-party hardcoded transition (mechanical rules)

- Any `{type:"spring", stiffness:S, damping:D}` → pick the nearest semantic row by **surface role** (what it animates), not by numeric closeness. When role is ambiguous: S≥500 → `iconiqPress`/`stiff`; 300–450 → `snappy`/`iconiqIndicator`; 150–300 → `iconiqOverlay`/`iconiqPanel`; <150 → `gentle`/`iconiqReveal`; damping <16 → `bouncy`.
- `{duration: d}` tweens: d≤0.15 → `fast` 0.15; 0.16–0.3 → `base` 0.25; 0.3–0.38 → `expressive` 0.35; ~0.4 → `slow` 0.4; ≥0.42 → `showcase` 0.42. Map `ease` arrays to the nearest easing token (default unknown decel-style curves to `expressive` `[0.22,1,0.36,1]`).
- `delay`/stagger: keep, but derive steps from duration tokens (e.g. stagger step = `fast/4` ≈ 0.04s), no magic numbers.
- Keep framer features (`AnimatePresence`, variants, `layout`, `whileHover/whileTap`) — they're supported; only the **values** get tokenized.

### CSS-side motion (non-framer: transitions/keyframes in CSS)

Use palot globals vars: easings `--ease-enter` (cubic-bezier(0.19,1,0.22,1) — dialogs/overlays), `--ease-out`, `--ease-default`, `--ease-bounce` (cubic-bezier(0.175,0.885,0.32,1) — toasts/popovers); durations `--duration-fast` 0.15s, `--duration-normal` 0.2s, `--duration-relaxed` 0.3s. Firefly equivalents: `--ff-duration-instant/fast/normal/slow/slower`, `--ff-easing-*` (`--ff-easing-bounce` = expressive). Example: `transition: background var(--duration-fast) var(--ease-out);` — never `transition: all 0.3s ease`.

## 6. Reduced motion (required, matches @ch5me/motion policy)

Policy: reduced motion = **instant** (duration 0 / snap to final state), never "slower animation".

- framer components: call `useReducedMotion()` from `motion/react` and pass `transition={reduced ? { duration: 0 } : SEMANTIC}` (or render the final state directly); or wrap the subtree in `<MotionConfig reducedMotion="user">` and verify transform-based animations actually disable.
- Infinite/ambient loops (shimmer, pulse, marquee, cursor demos): must fully stop — see `.loading-shimmer`'s `@media (prefers-reduced-motion: reduce) { animation: none; ... }` pattern in globals.css. Every CSS `@keyframes` you port needs this block.
- Entrances may snap; opacity-only fades ≤150ms are acceptable to keep.
- Honor system preference by default; don't invent per-component toggles.

## 7. Misc port checklist

- Add `data-slot="..."` to every shadcn-shaped container so glass tiers + superellipse corners apply.
- Prefer reusing existing elf-ui/shadcn primitives (Dialog, Popover, DropdownMenu, Card, Tabs) over porting a third-party copy of the same primitive — port only the novel content.
- `tw-animate-css` is loaded; its `animate-in/out` utilities respect `--tw-enter-*`/`--tw-exit-*` and can be tuned with `animation-duration: var(--duration-fast)` overrides (see command-palette pattern in globals.css).
- Scrollable regions: use `.scrollbar-thin` / `.scrollbar-auto` / `.scrollbar-none`, not custom webkit scrollbar CSS.
- No new npm deps for animation (no gsap/react-spring/lottie additions) without explicit approval.

## Verification Commands

Both verified runnable on 2026-06-09 (currently pass; `packages/ui/biome.json` emits a harmless `biome migrate` info):

```bash
# Typecheck (matches packages/ui "check-types" script)
cd /Users/hassoncs/src/ch5/palot/packages/ui && bunx tsgo --noEmit

# Lint/format (matches packages/ui "lint" script; biome config: packages/ui/biome.json extending root biome.json)
cd /Users/hassoncs/src/ch5/palot/packages/ui && bunx biome check .
```

Repo-wide equivalents (turbo/biome from root): `cd /Users/hassoncs/src/ch5/palot && bun run check-types` and `cd /Users/hassoncs/src/ch5/palot && bun run lint`.

After implementation also confirm: `packages/ui/package.json` exports map contains `"./components/animate/*": "./src/components/animate/*.tsx"`, and `react-use-measure` + `@number-flow/react` appear as direct dependencies (then `bun install` from repo root).
