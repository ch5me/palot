# Task 4 — Current Theme Runtime and Precedence Model

> Source-grounded inventory of the current Elf theme system. Goal: define what
> stays host-owned in V2 and what becomes plugin-contributed theme data.

## 1. Source files (canonical references)

| Concern | File | Role |
|---|---|---|
| Theme definitions (3 hardcoded themes) | `apps/desktop/src/renderer/lib/themes.ts` | Static data: `ThemeDefinition` interface, `cortexTheme`, `liquidGlassTheme`, `systemTheme`, `themes[]` registry, `getAvailableThemes`, `getTheme` |
| Theme runtime effect | `apps/desktop/src/renderer/hooks/use-theme.ts` | DOM-side apply: `useThemeEffect` + `useCurrentTheme`, `useColorScheme`, `useAvailableThemes`, `useSetTheme`, `useSetColorScheme` |
| Persisted atoms | `apps/desktop/src/renderer/atoms/preferences.ts` | `themeAtom` (`elf:theme`), `colorSchemeAtom` (`elf:colorScheme`), `opaqueWindowsAtom` (`elf:opaqueWindows`), `chromeTierAtom`, `isTransparentAtom`, Zustand-persist migration shim |
| Tailwind v4 token bridge | `packages/ui/src/styles/globals.css` | `@theme inline` block defines default vars on `:root` / `.dark`; `.theme-*` selectors for theme overrides; `--glass-*` / `--blur-*` tokens |
| Liquid Glass CSS overrides | `packages/ui/src/styles/globals.css` (lines 594–643) | Hand-rolled `!important` overrides scoped to `:root.electron-transparent.theme-liquid-glass` and `:root.electron-vibrancy.theme-liquid-glass` |
| Chrome tier side-effect | `apps/desktop/src/renderer/hooks/use-chrome-tier.ts` | Owns `electron-transparent` / `electron-vibrancy` / `electron-opaque` body class, distinct from theme class |
| System accent sync | `apps/desktop/src/renderer/hooks/use-system-accent-color.ts` | Sets `--system-accent` / `--system-accent-light` / `--system-accent-dark` from `systemPreferences.getAccentColor()` |
| Command palette surface | `apps/desktop/src/renderer/components/command-palette.tsx` (lines 367–422) | Two `<CommandGroup>` blocks: "Appearance" (theme) and "Color Scheme" — write into `themeAtom` / `colorSchemeAtom` |
| Settings surface | `apps/desktop/src/renderer/components/settings/general-settings.tsx` (lines 87–106) | Color scheme radio using `useColorScheme` / `useSetColorScheme` |
| Renderer mount point | `apps/desktop/src/renderer/components/root-layout.tsx` (line 45) | `useThemeEffect()` called once at root |
| Preload bridge — platform | `apps/desktop/src/preload/index.ts` (line 11), `apps/desktop/src/preload/api.d.ts` (line 1033) | `window.elf.platform: NodeJS.Platform` |
| Preload bridge — native theme | `apps/desktop/src/preload/index.ts` (line 239), `apps/desktop/src/preload/api.d.ts` (line 1167) | `setNativeTheme(source: string)` → `ipcRenderer.invoke("theme:set-native", source)` |
| Preload bridge — accent | `apps/desktop/src/preload/index.ts`, `apps/desktop/src/preload/api.d.ts` (line 1171–1173) | `getAccentColor`, `onAccentColorChanged` |
| Main IPC handler — native theme | `apps/desktop/src/main/ipc-handlers.ts` (lines 981–987) | `nativeTheme.themeSource = source` (Electron `nativeTheme` module) |
| Main IPC handler — accent | `apps/desktop/src/main/ipc-handlers.ts` (lines 991–1004) | `systemPreferences.getAccentColor` + `systemPreferences.on("accent-color-changed", …)` broadcast |

## 2. Current end-to-end data flow

```
                       PERSIST                                  REACT                                       DOM
                       ──────                                   ─────                                       ───

[User picks theme in   ┌───────────────────┐                    useAtomValue(themeAtom)
 command palette  ───▶ │ atomWithStorage   │   ─── reads ───▶  useAtomValue(colorSchemeAtom)
 OR settings panel]    │   "elf:theme"     │                    useThemeEffect()
                       │   "elf:color-     │                         │
[User toggles color    │    Scheme"        │                         ▼
 scheme "system"]      │   "elf:opaque-    │                    useMemo(() => getTheme(id))
                       │    Windows"       │                         │
                       │  localStorage     │                         │ (registry from
                       │  + Zustand legacy │                         │  lib/themes.ts)
                       │  migration)       │                         ▼
                       └───────────────────┘              buildThemeCss(theme)
                                                             │
                                                             ▼
                            ┌─────────────────────────────────────────────────────────────────────┐
                            │  1. classList: remove "dark" | "light", add resolved scheme        │
                            │  2. classList: remove "theme-*", add "theme-<id>" (skip if "default")│
                            │  3. if theme.glass.disabled: force "electron-opaque"               │
                            │  4. inject <style id="elf-theme-vars"> with :root / .dark blocks     │
                            │  5. setProperty(--font-sans / --font-mono) inline                  │
                            │  6. window.elf.setNativeTheme("light" | "dark" | "system") IPC     │
                            │  7. if scheme == "system": subscribe to prefers-color-scheme changes│
                            └─────────────────────────────────────────────────────────────────────┘
                                                             │
                                                             ▼
                                                  <html> element reflects:
                                                  - class="dark|light"
                                                  - class="theme-<id>"
                                                  - inline --font-sans/--font-mono
                                                  - injected <style> overrides

[Side-effect hook    useSystemAccentColor()  ─── reads ───▶  window.elf.getAccentColor()
 on mount]                                                           │
                                                                     ▼
                                                       setProperty(--system-accent*)
                                                       (System theme references these vars
                                                        with fallbacks to Elf Blue)

[use-chrome-tier.ts  chromeTierAtom (in-memory, NOT persisted) ◀── set from main process
 on mount]                                                            │
                                                                      ▼
                                                  classList: "electron-transparent" |
                                                             "electron-vibrancy" |
                                                             "electron-opaque"

[OS accent changes]  systemPreferences.on("accent-color-changed", …)  ◀── main process
                     win.webContents.send("theme:accent-color-changed", newColor)
                                                                  │
                                                                  ▼
                                                  onAccentColorChanged callback →
                                                  re-apply --system-accent* vars
```

## 3. Precedence model (current)

Resolution order for what styles take effect on `<html>`:

1. **Cortex baseline** — globals.css `@theme inline` block defines the canonical
   tokens on `:root` (light) and `.dark`. These are unconditional defaults.
2. **Active theme** — injected `<style id="elf-theme-vars">` overrides
   `:root` (light) and `.dark` blocks per `ThemeDefinition.cssVars`.
   - `glass` entries are emitted first; `cssVars` entries override them
     (CSS-source-order wins because they come later in the same stylesheet).
3. **Theme class** — `theme-<id>` class on `<html>` enables theme-specific CSS
   that lives in globals.css (e.g. `.theme-liquid-glass` rules on lines 594+).
4. **Color scheme class** — `dark` or `light` class on `<html>` toggles between
   the two CSS variable sets inside the injected stylesheet and in
   globals.css defaults.
5. **Glass (macOS) class** — `electron-transparent` / `electron-vibrancy` /
   `electron-opaque` class on `<html>` controls whether semi-transparent
   surfaces render. Set independently of theme, except:
   - `theme.glass.disabled === true` forces `electron-opaque`.
6. **Native theme** — `window.elf.setNativeTheme(source)` is called to make
   macOS's native glass tint match the CSS color scheme. Independent of
   which theme is selected.
7. **System accent** — `--system-accent*` CSS vars set by
   `useSystemAccentColor`. The `systemTheme` ("default") definition
   references these vars; other themes ignore them.

Effective cascade (innermost wins for non-CSS specifics):
```
globals.css defaults
  ⊕ injected <style> (theme.cssVars + density + radius + glass)
    ⊕ .theme-<id> class rules (liquid-glass overrides)
      ⊕ .dark | .light class rules
        ⊕ .electron-* class rules
          ⊕ --system-accent* from accent hook
            ⊕ inline style (--font-sans / --font-mono)
```

## 4. The three current persisted surfaces (and how they interrelate)

| Atom | Storage key | Default | Scope | Set by |
|---|---|---|---|---|
| `themeAtom` | `localStorage["elf:theme"]` | `"default"` (System) | App | Command palette, settings |
| `colorSchemeAtom` | `localStorage["elf:colorScheme"]` | `"dark"` | App | Command palette, settings |
| `opaqueWindowsAtom` | `localStorage["elf:opaqueWindows"]` | `false` | App | Command palette (Window group) |
| `chromeTierAtom` | in-memory only | `"opaque"` (browser) | App | Set from main process at startup |

A legacy Zustand `persist` blob under key `elf-preferences` is migrated to the
three new `elf:*` keys at module load time (`migrateFromZustandPersist`).
A separate one-shot `migrateDisplayMode` rewrites the old `"compact"`
display mode to `"default"`.

## 5. Hardcoded assets in the current system (must be replaced or projected)

- `themes.ts` exports exactly three themes: `systemTheme`, `cortexTheme`,
  `liquidGlassTheme`. The default theme id is `"default"` (System), not
  `"cortex"` — important for the skip-class behavior in `useThemeEffect`.
- The `glass` block (bodyOpacity / sidebarOpacity / surfaceOpacity /
  elevatedOpacity / cardOpacity / contentOpacity / blurScale / disabled) is
  the only way themes currently tune transparency.
- The `density` block only covers `--text-xs` and `--text-sm` and their
  line-heights; broader density tuning would be a new contribution shape.
- A subset of `cortexTheme` is effectively the **base** — its `cssVars` are
  just tweaks, not full color systems. Replacing or omitting the Cortex
  theme requires the host to have a fallback chain to defaults in
  globals.css.
- Tailwind v4 in monorepo has the gotcha: `globals.css` must keep
  `@source "../components";` or utilities used only in the UI package
  don't generate CSS. Theme class scoping must therefore be careful to
  re-import the theme rules into the same bundle that scans them.

## 6. V2 split — what becomes plugin-contributed data vs host-owned machinery

The plan's "Contribution families" already states the principle: "Theme
contributions are data-only. Theme application stays host-owned." This
inventory operationalizes that split.

### Plugin-contributed (data only)

These are the fields a plugin manifest can declare; the host validates,
normalizes, and projects them. Plugins do not import or mutate DOM.

| Field | Source of truth today | What plugin supplies in V2 |
|---|---|---|
| `id` | `ThemeDefinition.id` | Globally unique theme id (host reserves `firefly.*` / `core.*` namespace) |
| `name`, `description` | `ThemeDefinition.name` | User-facing label, optional description |
| `platforms` | `ThemeDefinition.platforms` | Restrict to platform set; omit = available everywhere |
| `cssVars.light` / `cssVars.dark` | `ThemeDefinition.cssVars` | Map of CSS custom property → value overrides per scheme |
| `fonts.sans` / `fonts.mono` | `ThemeDefinition.fonts` | Optional font stack overrides |
| `radius` | `ThemeDefinition.radius` | Optional `--radius` override |
| `density` | `ThemeDefinition.density` | Optional `--text-xs`, `--text-xs--line-height`, `--text-sm`, `--text-sm--line-height` |
| `glass` | `ThemeDefinition.glass` | Optional transparency tuning block (body/sidebar/surface/elevated/card/content opacity + blurScale + disabled flag) |
| `precedence` (new) | implicit (first in `themes[]` wins for id collisions) | Manifest may declare `default`, `extends`, or `override` semantics; manifest version too |
| `appliesWhen` (new) | implicit (always applies) | Optional predicates like `requiresChromeTier: "liquid-glass" \| "vibrancy" \| "any"` |
| extension fields (new, future) | none | Optional extension point for future: `colorPalette`, `syntaxHighlighting`, `diffColors`, etc. — not in V2 scope but the data shape should not preclude it |

Plugins ship only the data. Validation is host-owned: Zod-parse the
contribution, reject id collisions, check capability grant
(`theme:contribute` is required — see "Capability hook" below), apply
platform filter against host's known platform, validate CSS var names
against an allowlist (or at minimum against `--*` shape), validate that
the values parse to safe strings.

### Host-owned (machinery, never plugin code)

Every node and edge in the data-flow diagram that performs an action on
DOM, IPC, native API, or persisted state stays in the host. Plugins do
not import these modules.

| Node | File | Why host-owned |
|---|---|---|
| `themeAtom` / `colorSchemeAtom` | `apps/desktop/src/renderer/atoms/preferences.ts` | Persisted app state, scope = `app`, mutating goes through host atoms |
| Zustand migration shim | `apps/desktop/src/renderer/atoms/preferences.ts:69-94` | One-time data migration; never plugin |
| `migrateDisplayMode` | `apps/desktop/src/renderer/atoms/preferences.ts:97-104` | Same — one-time host data hygiene |
| `getTheme` / `getAvailableThemes` | `apps/desktop/src/renderer/lib/themes.ts:255-265` | Resolves against host's compiled-in contribution projection, not a plugin's export |
| `useThemeEffect` | `apps/desktop/src/renderer/hooks/use-theme.ts:72-129` | All DOM mutations, IPC calls, `matchMedia` subscriptions |
| `buildThemeCss` | `apps/desktop/src/renderer/hooks/use-theme.ts:49-70` | String assembly for the injected `<style>` element |
| `buildGlassVars` | `apps/desktop/src/renderer/hooks/use-theme.ts:29-47` | Translates plugin data into CSS var tuples |
| `getOrCreateStyleElement` | `apps/desktop/src/renderer/hooks/use-theme.ts:12-20` | DOM element lifecycle |
| `resolveColorSchemeClass` | `apps/desktop/src/renderer/hooks/use-theme.ts:22-27` | Hosts the only `matchMedia` call |
| Class toggling on `<html>` | `apps/desktop/src/renderer/hooks/use-theme.ts:81-96` | Direct DOM mutation; plugins must not bypass |
| `<style id="elf-theme-vars">` injection | `apps/desktop/src/renderer/hooks/use-theme.ts:98-99` | Sanitization must happen before this point |
| `setNativeTheme` IPC | `apps/desktop/src/renderer/hooks/use-theme.ts:104-106` → preload → main `nativeTheme.themeSource` | Cross-process privilege-bearing call |
| Font inline-style writes | `apps/desktop/src/renderer/hooks/use-theme.ts:108-117` | Direct DOM mutation |
| `prefers-color-scheme` listener | `apps/desktop/src/renderer/hooks/use-theme.ts:119-127` | Host-owned observer |
| `chromeTierAtom` + `use-chrome-tier` | `apps/desktop/src/renderer/hooks/use-chrome-tier.ts`, `apps/desktop/src/renderer/atoms/preferences.ts:127-137` | In-memory chrome tier state + class application |
| `useSystemAccentColor` | `apps/desktop/src/renderer/hooks/use-system-accent-color.ts` | Hosts the OS-side accent-color IPC and inline var writes |
| `opaqueWindowsAtom` | `apps/desktop/src/renderer/atoms/preferences.ts:120` | User preference host-owned |
| `@theme inline` baseline in globals.css | `packages/ui/src/styles/globals.css:44-` | Tailwind v4 token bridge; host owns the *default* palette |
| `.theme-liquid-glass` overrides | `packages/ui/src/styles/globals.css:594-643` | Theme-class-scoped CSS; in V2 the *selector* stays host-owned, the *values* may come from plugin data via the injected stylesheet |
| `window.elf.platform` | `apps/desktop/src/preload/index.ts:11` | Host provides platform; plugins read indirectly via host filter |
| `setNativeTheme` preload | `apps/desktop/src/preload/index.ts:239`, `apps/desktop/src/preload/api.d.ts:1167` | Host IPC surface; plugins call via `plugin.theme.apply` tool, not direct preload |
| `nativeTheme.themeSource` setter | `apps/desktop/src/main/ipc-handlers.ts:981-987` | Electron `nativeTheme` module — main process only |
| `systemPreferences.getAccentColor` / `on("accent-color-changed")` | `apps/desktop/src/main/ipc-handlers.ts:991-1004` | Main process only; renderer side routes through preload bridge |

### Capability hook (new in V2, must be added by Task 10/16)

For V2 to enforce "plugins may not write theme CSS directly", the
capability broker needs a new capability class `theme:contribute`
(declared in manifest to ship a theme contribution) and `theme:apply`
(granted only to introspection tools and the host itself, never directly
to plugin code). The broker mediates every `setNativeTheme`, every
`style.textContent` write, and every classList mutation on `<html>`.

### Tool projection (data derived from plugin descriptor)

The plan already lists `plugin.theme.list`, `plugin.theme.apply`,
`plugin.theme.reset`, optional `plugin.theme.preview`. These tools are
generated by the host from the `themes` projection of `PluginDescriptor`
plus `PluginInstance` state. They never call into a plugin's runtime
code for theme *application*; plugin code may contribute business logic
for `plugin.theme.preview` only if the plugin declares a handler. Apply
itself is host-only.

## 7. Precedence and collision rules that must survive V2

Carried forward as required V2 semantics:

1. **Id uniqueness is global** — host catalog enforces this; collision
   rejects activation (per plan reserved-namespace rule).
2. **Cortex is the baseline palette** — values in globals.css match
   Cortex; the Cortex theme only ships *deltas*. If Cortex is replaced
   or removed in V2, the host must keep an equivalent baseline defaults
   block.
3. **Glass defaults are emitted before `cssVars` overrides** in the
   injected stylesheet so plugin CSS vars can override glass tokens
   (current behavior in `buildThemeCss` lines 57-58).
4. **Theme class is omitted when `theme.id === "default"`** — the
   "default" theme is the System theme and does not get a
   `theme-default` class on `<html>`. New themes in V2 must not collide
   with this id and must opt into class generation (or opt out by
   declaring their contribution as a default-equivalent).
5. **`prefers-color-scheme` listener is only attached when
   `colorScheme === "system"`** — and is properly torn down via the
   effect's cleanup return. This is correct; V2 must preserve it.
6. **`setNativeTheme` is called on every theme or color-scheme change**
   — even if the value didn't change, to keep macOS glass tint in sync.
   V2 must preserve this; capability broker must allow this single IPC
   call without per-call grants.
7. **`theme.glass.disabled === true` forces `electron-opaque`**,
   removing the `electron-transparent` and `electron-vibrancy` classes
   regardless of what `chromeTierAtom` says. V2 must preserve this
   override; the host can still set chrome tier afterward, so plugins
   cannot pin the user to transparent mode against their preference.
8. **System accent vars are referenced by the System theme only** with
   fallback hex. Other themes currently ignore the OS accent. V2 should
   preserve this and let plugins reference `--system-accent*` in their
   own `cssVars` if they want OS-accent-aware themes.

## 8. Migration seam into V2 (directional notes — work for Task 16/19)

- `apps/desktop/src/renderer/lib/themes.ts` becomes a thin file
  re-exporting a default registry populated by the host's
  built-in-plugin loader. The three first-party themes ship as a single
  built-in plugin whose manifest contributes the same three
  `ThemeDefinition` objects.
- `apps/desktop/src/renderer/hooks/use-theme.ts` keeps its
  `useThemeEffect` body essentially unchanged; only the source of the
  `ThemeDefinition` changes (it now comes from the projected registry,
  not the static `themes[]` array). `getTheme` becomes a lookup
  against the host's plugin-derived catalog, with a guaranteed
  built-in default.
- `apps/desktop/src/renderer/atoms/preferences.ts` keeps
  `themeAtom` and `colorSchemeAtom` as app-scoped persisted state; V2
  does not move them. The `chromeTierAtom` / `opaqueWindowsAtom` /
  `isTransparentAtom` chain stays exactly where it is.
- `apps/desktop/src/main/ipc-handlers.ts` keeps `theme:set-native` and
  `theme:accent-color` handlers; V2 may rename them
  (`theme.native.set`, `theme.accent.get|subscribe`) for consistency
  with the V2 IPC namespace but the wire shape doesn't have to change.
- `packages/ui/src/styles/globals.css` keeps the `@theme inline`
  baseline; the `.theme-liquid-glass` selectors become a *convention*
  the host emits as part of theme application (i.e. when a theme
  contributes a `glass` block, the host could in theory emit matching
  selector rules — but to keep CSS static and cache-friendly, the
  better path is to let the host's built-in CSS provide the selector
  shapes and only inject data-side values).

## 9. Acceptance criteria check

- [x] Theme runtime source and precedence path are documented
      (Sections 1, 2, 3, 7).
- [x] V2 split between plugin-contributed theme data and host-owned
      apply logic is explicit (Section 6 tables, plus capability hook
      note, plus tool-projection note).
