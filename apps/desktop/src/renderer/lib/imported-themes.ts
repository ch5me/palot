/**
 * Renderer-side adapter for VS Code themes installed via the marketplace.
 *
 * Bridges the main-process `ImportedThemeContribution` / `MarketplaceInstalledTheme`
 * shapes to the renderer's `ThemeDefinition` type, and maintains a runtime
 * in-memory registry that `getTheme` / `getAvailableThemes` consult.
 *
 * Architecture:
 *   - No imports from shared/firefly-plugin/* — only the types we need are
 *     copied inline via the preload bridge shape.
 *   - `registerImportedTheme` is idempotent: re-registering the same id just
 *     replaces the existing entry.
 *   - The registry is cleared on page reload (renderer process lifetime).
 */

import type { ThemeDefinition } from "./themes"
import { registerImportedTheme as _register } from "./themes"

// ---------------------------------------------------------------------------
// Minimal input shape — mirrors MarketplaceInstalledTheme from host-authority-types
// but kept local so this file has no cross-layer imports.
// ---------------------------------------------------------------------------

export interface ImportedThemeTokens {
	id: string
	label: string
	kind: "light" | "dark" | "high-contrast"
	appTokens: Record<string, string>
}

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

/**
 * Convert a marketplace theme's app tokens into a `ThemeDefinition` that the
 * existing `useThemeEffect` can inject as CSS vars.
 *
 * Token placement strategy:
 *   - `kind === "light"`:         tokens → cssVars.light only
 *   - `kind === "dark"`:          tokens → cssVars.dark only
 *   - `kind === "high-contrast"`: tokens → both cssVars.light and cssVars.dark
 *     (best-effort; high-contrast themes usually work in both schemes)
 *
 * This means the theme always takes effect regardless of the user's current
 * color-scheme setting, which is the expected behaviour for "apply theme".
 */
export function importedThemeToThemeDefinition(imported: ImportedThemeTokens): ThemeDefinition {
	const { id, label, kind, appTokens } = imported

	// Deduplicate multi-mapped tokens (e.g. editor.foreground and input.foreground
	// both map to --foreground — last-write wins, which is fine).
	const lightVars: Record<string, string> = {}
	const darkVars: Record<string, string> = {}

	if (kind === "light") {
		Object.assign(lightVars, appTokens)
	} else if (kind === "dark") {
		Object.assign(darkVars, appTokens)
	} else {
		// high-contrast: apply to both so the theme works regardless of scheme
		Object.assign(lightVars, appTokens)
		Object.assign(darkVars, appTokens)
	}

	return {
		id,
		name: label,
		description: `Imported VS Code theme (${kind})`,
		cssVars: {
			light: lightVars,
			dark: darkVars,
		},
	}
}

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Convert and register an imported theme so `getTheme(id)` resolves it.
 * Safe to call multiple times with the same id (idempotent replace).
 */
export function registerAndActivateImportedTheme(imported: ImportedThemeTokens): ThemeDefinition {
	const def = importedThemeToThemeDefinition(imported)
	_register(def)
	return def
}
