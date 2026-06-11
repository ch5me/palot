# Task 16 — Theme Contribution Pipeline and Precedence Model <!-- oc:id=sec_aa -->

> Wave 3, Task 16 of plan `firefly-plugin-system-v2`. Source-grounded in Task 4
> (`task-4-theme-runtime.md`) and Task 8 (`task-8-family-contracts.md`).
> Do not modify the plan file.

## 0. Pipeline at a glance <!-- oc:id=sec_ab -->

```
plugin manifest (contributes.themes[])
  └─▶ main: Zod parse → PluginDescriptor (normalized)
        └─▶ main: id uniqueness + capability check (theme:contribute)
              └─▶ main: project to host catalog (themes registry)
                    └─▶ renderer: host apply via useThemeEffect
                          └─▶ <html> class + injected <style id="elf-theme-vars">
                                + setNativeTheme IPC + font inline vars
```

Plugins ship data. Host owns every DOM/IPC/native mutation. `plugin.theme.apply`
is a host wrapper, not a plugin handler. `plugin.theme.preview` is the only
theme tool that may call into plugin code (when the plugin declares a handler).

## 1. Theme precedence matrix (5 rows) <!-- oc:id=sec_ac -->

Lock the exact winner per row. Highest precedence wins. Ties broken by stable
id sort ascending (deterministic, never random).

| # | Precedence (highest wins) | Source | Apply path | Winner | User-observable result |
|---|---|---|---|---|---|
| 1 | `themeAtom` user pick (persisted) | `localStorage["elf:theme"]` resolved against host catalog | `useThemeEffect` → `getTheme(id)` → `buildThemeCss` → classList + injected `<style>` + `setNativeTheme` IPC + font inline | user pick | picked theme applied; no plugin/import/default can override it |
| 2 | active plugin-provided theme (no user pick) | `contributes.themes[]` from enabled `PluginDescriptor`s | `useThemeEffect` with the same host apply path; chosen by id-stable sort of plugin registry | plugin catalog | first plugin theme in id-sorted order; if multiple plugins ship, deterministic pick |
| 3 | imported theme (VS Code / Open VSX converted) when no plugin/user pick | importer registry (sparse JSONC → host token fallback chain) | identical host apply path; chosen by id-stable sort of import registry | import catalog | imported theme applied with host token fallbacks for any token the importer did not declare |
| 4 | bundled system default (no pick, no plugin, no import) | built-in plugin `contributes.themes[]` ships `cortexTheme` as baseline | identical host apply path; only branch the host runs when no other layer is reachable | `cortexTheme` (built-in) | default app look |
| F | preview-only request from `plugin.theme.preview` (any time) | agent tool request + optional plugin handler | host renders preview pane only; never writes `themeAtom`, never calls `setNativeTheme`, never injects `<style id="elf-theme-vars">` for the active document | preview pane | applied theme unchanged; preview shown in dedicated surface (side panel widget or modal) |

Two locked invariants:

- **Plugins cannot set the applied theme directly.** They declare `contributes.themes[]` data. The host picks and applies per the matrix.
- **Row 1 always wins over rows 2-4.** User pick trumps plugin/import/default.

## 2. Per-row apply path and user-observable result <!-- oc:id=sec_ad -->

### Row 1 — explicit user pick <!-- oc:id=sec_aj -->

- **Resolve:** `useAtomValue(themeAtom)` → id. Host looks id up in merged catalog
  (built-in + active plugins + imports). If unresolvable, see Section 3
  (uninstall fallback).
- **Apply:** `useThemeEffect` (Task 4 §2) — classList swap, `<style id="elf-theme-vars">`
  injection, `window.elf.setNativeTheme` IPC, `--font-sans/--font-mono` inline.
- **Observable:** picked theme rendered; macOS native chrome tint matches;
  font swap visible. Toasts/animations on switch come from existing
  `command-palette.tsx` "Appearance" group.

### Row 2 — active plugin-provided theme (no user pick) <!-- oc:id=sec_ak -->

- **Resolve:** merged catalog scan, plugin-contributed themes only, id-stable
  sort. First id wins. `chromeTierAtom` + `platforms` filter apply.
- **Apply:** identical to Row 1 — same `useThemeEffect`. The fact that the
  source is a plugin is invisible to the apply path; only the resolver changes.
- **Observable:** plugin theme rendered. No banner. If the plugin is later
  disabled or uninstalled, see Section 3.
- **Tool call:** `plugin.theme.apply` resolves to id; host apply happens in
  renderer. Plugin code is never invoked for apply.

### Row 3 — imported theme (no user pick, no plugin) <!-- oc:id=sec_al -->

- **Resolve:** import registry scan, id-stable sort. Importer must populate
  the import registry at install time using the sparse JSONC → host token
  fallback chain (Section 5).
- **Apply:** identical to Row 1.
- **Observable:** imported theme rendered with host defaults filling every
  token the importer did not declare. Source is invisible to the user; theme
  picker labels it as a regular entry.

### Row 4 — bundled system default <!-- oc:id=sec_am -->

- **Resolve:** built-in plugin `contributes.themes[]` ships `cortexTheme`
  plus `liquidGlassTheme` plus `systemTheme`. Row 4 picks the first id-stable
  match from this built-in set when no other layer is reachable.
- **Apply:** identical to Row 1.
- **Observable:** Cortex look (the baseline palette that ships with the app).

### Row F — preview-only <!-- oc:id=sec_an -->

- **Resolve:** agent calls `plugin.theme.preview` with a theme id. Host looks
  the id up in the merged catalog (preview can target any reachable theme,
  plugin or import or built-in). If the plugin contributed a preview handler
  in its manifest, host may delegate the visual transformation rules to it;
  the host still owns the rendering surface and the
  `<style id="elf-theme-vars">` injection (limited to a scoped preview
  stylesheet, not the active document).
- **Apply:** scoped stylesheet + scoped classList on the preview surface
  only. The active document keeps its current applied theme. `themeAtom` is
  never written. `setNativeTheme` IPC is never called.
- **Observable:** preview surface shows the target theme. Closing the preview
  (or session end) discards it. Applied theme never changes.

## 3. Picked-theme uninstall fallback behavior <!-- oc:id=sec_ae -->

When the user pick (Row 1) becomes unresolvable, host must deterministically
fall through. Triggers:

- Plugin that contributed the picked id is uninstalled or disabled.
- Import that provided the picked id is removed.
- Built-in theme was removed in a host downgrade (rare, treat as plugin case).

Behavior, ordered:

1. **Detect unresolvable id at apply time.** `getTheme(id)` returns `undefined`. <!-- oc:id=item_aa -->
1. **Preserve the user pick in `themeAtom` for one cycle.** Do not silently <!-- oc:id=item_ab -->
   rewrite persisted state on a transient resolver miss; the plugin may be
   in the middle of an update restart.
1. **Emit a one-time non-blocking notice** in the side panel (or status bar): <!-- oc:id=item_ac -->
   "Picked theme `<id>` is no longer available. Falling back to next layer."
1. **Re-resolve through the matrix starting at Row 2.** First reachable <!-- oc:id=item_ad -->
   candidate wins. The new effective theme is applied by the same
   `useThemeEffect` path.
1. **`themeAtom` is not rewritten** during the fallback. The pick stays <!-- oc:id=item_ae -->
   recorded as-is. The next time the picked id becomes resolvable (e.g.
   the plugin is reinstalled), the pick re-applies automatically without
   a user action.
1. **`plugin.theme.reset` is the explicit user escape hatch.** It clears <!-- oc:id=item_af -->
   `themeAtom` to `null` so Row 1 stops winning and the next layer (Row 2
   plugin / Row 3 import / Row 4 default) becomes the effective pick. After
   reset, the user can re-pick from the command palette.

Edge cases:

- **Picked theme + picked plugin both uninstalled:** the pick stays; if the
  plugin is reinstalled, pick resumes automatically. If the user wants to
  forget the pick, they call `plugin.theme.reset` or pick another theme.
- **Picked theme id collides with a newly installed plugin's theme id:** host
  catalog rejects the new theme at activation (per Task 8 reserved-namespace
  + uniqueness rules). Existing pick is unaffected.
- **Picked theme is shadowed by a `chromeTier` mismatch:** host applies the
  picked theme but with `electron-opaque` forced when `theme.glass.disabled`
  is true. Behavior unchanged from Task 4 §7.

## 4. Preview-only path <!-- oc:id=sec_af -->

`plugin.theme.preview` is the only theme tool that may call plugin code, and
only when the contributing plugin declared a preview handler in its manifest.
The host owns the surface and the scoped stylesheet.

Flow:

1. Agent calls `plugin.theme.preview({ themeId, surface?: "side-panel" | "modal" })`. <!-- oc:id=item_ag -->
1. Host validates `themeId` against the merged catalog. Unknown id → <!-- oc:id=item_ah -->
   `status: "failed"`, `errorCode: "FF_THEME_UNKNOWN"`.
1. Host opens the requested surface (default `side-panel` widget) if not <!-- oc:id=item_ai -->
   already open.
1. Host looks up the theme; if the contributing plugin declared a <!-- oc:id=item_aj -->
   `previewHandler` module path, host calls it (within the plugin's worker)
   to obtain any extra transformation rules. The plugin returns
   pure-data deltas (CSS var map); it never touches DOM.
1. Host injects a **scoped** stylesheet (`<style id="elf-theme-vars-preview">`) <!-- oc:id=item_ak -->
   limited to the preview surface's DOM scope. The active document's
   `<style id="elf-theme-vars">` is untouched.
1. `themeAtom` is not read for write. `setNativeTheme` IPC is not called. <!-- oc:id=item_al -->
   No `chromeTier` class change.
1. Closing the preview surface removes the scoped stylesheet. Applied theme <!-- oc:id=item_am -->
   is unchanged throughout.

Result envelope follows the standard tool result envelope from the plan
(`status`, `errorCode`, `data`, `uiHints`, `provenance`).

## 5. Compatibility import stance (bounded and realistic) <!-- oc:id=sec_ag -->

VS Code and Open VSX are valid sources. The host's stance is **bounded
importer**, not runtime compatibility. No `vscode` shim, no sidecar, no
sandboxed VS Code process.

### What the importer accepts <!-- oc:id=sec_ao -->

- **VS Code / Open VSX theme JSON.** Reads `package.json` `contributes.themes`
  + the theme `.json` payload.
- **Sparse JSONC.** Most themes are incomplete; the host token fallback chain
  fills every missing token.
- **`uiTheme` classification:** `vs`, `vs-dark`, `hc-black`, `hc-light`.
  Used to pick light/dark initial scheme; not used to drive a custom renderer.

### What the importer does NOT accept <!-- oc:id=sec_ap -->

- No VS Code workbench/contrib extensions, no `workbench.colorCustomizations`
  scoped to other surfaces, no `editor.tokenColorCustomizations` overrides
  (out of scope for V2; would need a separate token-engine workstream).
- No VSIX bundle install. The importer is **theme-only**; full VSIX install
  is a separate architecture call (Task 23 covers classifier/transpile, not
  install).
- No runtime `vscode` API shim. Importer never executes imported code.
- No `extensionDependencies` resolution. The host treats each imported theme
  as a self-contained contribution; it does not chase extension dependencies.
- No token-studio scope. Importer does not author or edit theme files. Users
  pick from a flat theme picker; there is no visual editor, no palette swatch
  UI, no density/diff-color sliders.

### Fallback-chain mapping (host-side) <!-- oc:id=sec_aq -->

The host owns the fallback chain. Importer is not allowed to write a
fallback. Resolution per token:

1. Token declared in imported theme's `colors` / `tokenColors` (mapped to <!-- oc:id=item_an -->
   `cssVars.light` / `cssVars.dark`) → use it.
1. Else token declared in built-in `cortexTheme` → use built-in default. <!-- oc:id=item_ao -->
1. Else token declared in `packages/ui/src/styles/globals.css` `@theme inline` <!-- oc:id=item_ap -->
   baseline → use baseline.
1. Else token has no value → CSS engine treats it as `unset`; the consuming <!-- oc:id=item_aq -->
   component must handle `unset` safely.

### Trust model <!-- oc:id=sec_ar -->

Imported themes are subject to the same trust tier as third-party plugins
(per Task 6). Themes imported from untrusted registries land in the user's
import catalog with a "imported" badge in the picker. Host may mark or
revoke an import if the upstream registry revokes or moves the package.

### Capability hook <!-- oc:id=sec_as -->

`theme:contribute` capability is required for any plugin (built-in, local,
third-party, or importer) to add a theme to the catalog. `theme:apply` is
host-only — plugin code never calls it directly; the host calls it on the
plugin's behalf when `plugin.theme.apply` runs.

## 6. Locked rules <!-- oc:id=sec_ah -->

- Theme contributions are data-only (`dataOnly: true` is a manifest invariant).
- Plugins cannot mutate `themeAtom`, `colorSchemeAtom`, or any DOM/CSS
  related to themes. Capability broker rejects any such call.
- `plugin.theme.apply` is a host wrapper; the apply path is
  `useThemeEffect`, never a plugin worker call.
- `plugin.theme.preview` may call into a plugin's worker for transformation
  rules, but only pure data in, pure data out.
- `plugin.theme.reset` clears `themeAtom`. It does not touch
  `colorSchemeAtom` or `chromeTierAtom`.
- The host catalog rejects any theme id that collides with an existing one
  at activation time. Built-in ids are reserved under the host's namespace
  (`firefly.*` / `core.*` / `default`).
- The precedence matrix in Section 1 is the single source of truth for
  effective theme resolution. No other layer may be inserted without an
  explicit plan amendment.

## 7. Acceptance summary <!-- oc:id=sec_ai -->

- [x] 5-row theme precedence matrix with explicit winner per row
      (Section 1).
- [x] Per-row apply path and user-observable result (Section 2).
- [x] Picked-theme uninstall fallback behavior (Section 3).
- [x] Preview-only path that never mutates applied theme (Section 4).
- [x] Compatibility import stance, bounded and realistic (Section 5).
- [x] Theme contribution path and host precedence rules are explicit
      (Sections 0, 1, 2, 6).
- [x] Import compatibility stance is bounded and realistic (Section 5).
- [x] User-picked theme always wins over plugin/imported/default (Row 1 in
      Section 1 + locked rule in Section 6).
- [x] `plugin.theme.preview` never mutates applied theme (Section 4).