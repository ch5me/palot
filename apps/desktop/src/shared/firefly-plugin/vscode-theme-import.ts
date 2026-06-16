/**
 * Firefly Plugin System V2 — VS Code theme package converter (§9)
 *
 * Parses a VS Code color-theme package (contributes.themes + the theme JSON:
 * colors / tokenColors / semanticTokenColors / uiTheme) and produces the
 * `ImportedThemeContribution` shape from design §9.
 *
 * Conversion policy:
 *   - `colors`             → app CSS vars via the §9 color-map table;
 *                            unmapped ids preserved in editorTokens.vscodeColors
 *   - `tokenColors`        → editorTokens.textMateTokenColors (Monaco/TextMate)
 *   - `semanticTokenColors`→ editorTokens.semanticTokenColors
 *   - `uiTheme`:
 *       `vs`               → light
 *       `vs-dark`          → dark
 *       `hc-black` | `hc-light` → high-contrast
 *   - Preview never mutates the applied theme.
 *
 * Architecture: data-only, purely functional, no Node fs import. Callers
 * (package store, install pipeline) resolve file bytes and hand them in.
 * This module has zero side effects.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// §9 color-map table (VS Code color id → Firefly CSS token)
// Extend this table over time; unmapped ids go to editorTokens.vscodeColors.
// ---------------------------------------------------------------------------

/**
 * Locked mapping from VS Code workbench color ids to Firefly CSS custom
 * properties. Adding new entries here widens app-chrome theming without
 * changing the converter logic. Do NOT remove or rename existing entries
 * (the set is locked-append).
 */
export const VSCODE_COLOR_MAP: Readonly<Record<string, string>> = {
	"editor.background": "--ff-editor-bg",
	"editor.foreground": "--ff-editor-fg",
	"sideBar.background": "--ff-sidebar-bg",
	"sideBar.foreground": "--ff-sidebar-fg",
	"activityBar.background": "--ff-activity-bg",
	"activityBar.foreground": "--ff-activity-fg",
	"statusBar.background": "--ff-status-bg",
	"statusBar.foreground": "--ff-status-fg",
	"panel.background": "--ff-panel-bg",
	"panel.border": "--ff-panel-border",
	"tab.activeBackground": "--ff-tab-active-bg",
	"tab.inactiveBackground": "--ff-tab-inactive-bg",
	"button.background": "--ff-button-bg",
	"button.foreground": "--ff-button-fg",
	"input.background": "--ff-input-bg",
	"input.foreground": "--ff-input-fg",
	"focusBorder": "--ff-focus-ring",
	"selection.background": "--ff-selection-bg",
} as const

export type FireflyToken = string

/**
 * One row of the VS Code color map, for documentation/UI surfaces.
 */
export interface VscodeColorMapEntry {
	readonly vscodeId: string
	readonly fireflyToken: FireflyToken
}

/** Full table as an array, for UI rendering and auditing. */
export const VSCODE_COLOR_MAP_ENTRIES: readonly VscodeColorMapEntry[] = Object.entries(
	VSCODE_COLOR_MAP,
).map(([vscodeId, fireflyToken]) => ({ vscodeId, fireflyToken }))

// ---------------------------------------------------------------------------
// Input shapes — VS Code package.json + theme JSON
// ---------------------------------------------------------------------------

/**
 * A single VS Code theme declaration from `contributes.themes`.
 */
export const vscodeThemeDeclarationSchema = z
	.object({
		id: z.string().min(1).max(200).optional(),
		label: z.string().min(1).max(200),
		uiTheme: z.enum(["vs", "vs-dark", "hc-black", "hc-light"]).default("vs-dark"),
		path: z.string().min(1).max(400),
	})
	.strip()

export type VscodeThemeDeclaration = z.infer<typeof vscodeThemeDeclarationSchema>

/**
 * Minimal VS Code `package.json` shape for the theme importer.
 * Only `contributes.themes` is required; other fields are stripped.
 */
export const vscodeThemePackageJsonSchema = z
	.object({
		name: z.string().min(1).max(200),
		displayName: z.string().min(1).max(200).optional(),
		publisher: z.string().min(1).max(200).optional(),
		version: z.string().min(1).max(80),
		description: z.string().max(800).optional(),
		license: z.string().max(80).optional(),
		contributes: z
			.object({
				themes: z.array(vscodeThemeDeclarationSchema).min(1),
			})
			.strip(),
	})
	.strip()

export type VscodeThemePackageJson = z.infer<typeof vscodeThemePackageJsonSchema>

/**
 * A TextMate token-color rule from the theme JSON.
 */
export const vscodeTextMateTokenColorSchema = z
	.object({
		name: z.string().optional(),
		scope: z.union([z.string(), z.array(z.string())]).optional(),
		settings: z.record(z.string(), z.unknown()).optional(),
	})
	.strip()

export type VscodeTextMateTokenColor = z.infer<typeof vscodeTextMateTokenColorSchema>

/**
 * VS Code theme JSON file shape (`*.json` color-theme format).
 * The importer accepts `colors`, `tokenColors`, and `semanticTokenColors`.
 * `.tmTheme` format (XML) is not supported in V1; rejected at parse time.
 */
export const vscodeThemeJsonSchema = z
	.object({
		name: z.string().optional(),
		type: z.enum(["light", "dark", "hc"]).optional(),
		colors: z.record(z.string(), z.string()).default({}),
		tokenColors: z.array(vscodeTextMateTokenColorSchema).default([]),
		semanticTokenColors: z.record(z.string(), z.unknown()).default({}),
		semanticHighlighting: z.boolean().optional(),
	})
	.strip()

export type VscodeThemeJson = z.infer<typeof vscodeThemeJsonSchema>

// ---------------------------------------------------------------------------
// Output: ImportedThemeContribution (design §9)
// ---------------------------------------------------------------------------

/**
 * The canonical output shape produced by `convertVscodeTheme`.
 * This is what gets merged into the V2 `ThemeContribution` envelope in
 * `manifest.ts` with `imports.source = "vscode-theme" | "open-vsx"`.
 *
 * `appTokens`         — VS Code color ids that mapped to Firefly CSS vars.
 * `editorTokens`      — everything editor-specific that the host passes
 *                       directly to Monaco's `defineTheme`.
 * `unsupportedColorIds` — ids that failed to map and also are not editor
 *                         colors; surfaced in the operator UI.
 */
export interface ImportedThemeContribution {
	/** Short, Firefly-safe id (derived from the declaration or label). */
	id: string
	/** Human label from the theme declaration. */
	label: string
	/** Light / dark / high-contrast, derived from `uiTheme`. */
	kind: "light" | "dark" | "high-contrast"
	/** Import provenance for the package store. */
	source: {
		registry: "open-vsx" | "manual-vsix"
		/** Canonical `publisher.name` external id. */
		externalId: string
		/** Published version of the source package. */
		version: string
		/** Path inside the package to the theme JSON (from `contributes.themes[n].path`). */
		themePath: string
		/** SHA-256 hex of the theme JSON content. Empty string if not computed by caller. */
		contentSha256: string
	}
	/**
	 * VS Code `colors` entries that mapped → Firefly CSS custom properties.
	 * Keys are Firefly CSS var names (e.g. `--ff-editor-bg`); values are
	 * the hex/rgba colors from the theme.
	 */
	appTokens: Record<string, string>
	/**
	 * Editor-specific token data for Monaco.
	 * `vscodeColors` preserves unmapped `colors` ids verbatim.
	 */
	editorTokens: {
		/** Unmapped VS Code color ids preserved verbatim. */
		vscodeColors: Record<string, string>
		/** `tokenColors` → Monaco/TextMate token theme rules. */
		textMateTokenColors: VscodeTextMateTokenColor[]
		/** `semanticTokenColors` → Monaco semantic token theme. */
		semanticTokenColors: Record<string, unknown>
	}
	/** Color ids that had no mapping AND are not in editorTokens. Informational. */
	unsupportedColorIds: string[]
}

// ---------------------------------------------------------------------------
// uiTheme → kind mapping
// ---------------------------------------------------------------------------

/** Map a VS Code `uiTheme` string to the Firefly theme kind. */
export function uiThemeToKind(uiTheme: VscodeThemeDeclaration["uiTheme"]): "light" | "dark" | "high-contrast" {
	switch (uiTheme) {
		case "vs":
			return "light"
		case "vs-dark":
			return "dark"
		case "hc-black":
		case "hc-light":
			return "high-contrast"
	}
}

// ---------------------------------------------------------------------------
// ID sanitization
// ---------------------------------------------------------------------------

/**
 * Derive a Firefly-safe short id from a theme label or VS Code theme id.
 * Firefly short ids must be `[a-zA-Z][a-zA-Z0-9-]*`.
 */
export function deriveThemeShortId(raw: string): string {
	return raw
		.replace(/[^a-zA-Z0-9-]/g, "-")
		.replace(/^[-0-9]+/, "")
		.replace(/-{2,}/g, "-")
		.replace(/-+$/, "")
		.slice(0, 64) || "theme"
}

/**
 * Derive the canonical `publisher.name` external id from the package.json.
 * Falls back to `unknown.<name>` when publisher is absent.
 */
export function deriveExternalId(pkg: VscodeThemePackageJson): string {
	const name = pkg.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60)
	const publisher = pkg.publisher
		? pkg.publisher.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40)
		: "unknown"
	return `${publisher}.${name}`
}

// ---------------------------------------------------------------------------
// Core converter
// ---------------------------------------------------------------------------

/**
 * Options for `convertVscodeTheme`.
 */
export interface ConvertVscodeThemeOptions {
	/**
	 * The registry source to embed in `source.registry`.
	 * Use `"open-vsx"` for packages fetched from Open VSX;
	 * `"manual-vsix"` for locally imported VSIX files.
	 */
	registry: "open-vsx" | "manual-vsix"
	/**
	 * SHA-256 hex of the theme JSON content, provided by the package store
	 * after it has read and hashed the file. Pass empty string when not
	 * computed (preview / dry-run mode).
	 */
	contentSha256?: string
}

/**
 * Convert a single VS Code theme declaration + its parsed theme JSON
 * into a `ImportedThemeContribution`.
 *
 * This is the load-bearing transformation. The caller (package store /
 * install pipeline) is responsible for:
 *   - Resolving `declaration.path` inside the VSIX → reading + parsing
 *     the theme JSON bytes (pass as `themeJsonRaw`).
 *   - Computing `contentSha256` from those bytes and passing it via
 *     `options.contentSha256`.
 *
 * @param pkg       Parsed `package.json` (already validated by
 *                  `vscodeThemePackageJsonSchema`).
 * @param declaration  One element of `contributes.themes` (already
 *                  validated by `vscodeThemeDeclarationSchema`).
 * @param themeJsonRaw  Raw unknown content of the theme JSON file.
 * @param options   Registry source + optional sha256.
 * @throws `z.ZodError` when `themeJsonRaw` fails schema validation.
 */
export function convertVscodeTheme(
	pkg: VscodeThemePackageJson,
	declaration: VscodeThemeDeclaration,
	themeJsonRaw: unknown,
	options: ConvertVscodeThemeOptions,
): ImportedThemeContribution {
	const themeJson = vscodeThemeJsonSchema.parse(themeJsonRaw)

	const kind = uiThemeToKind(declaration.uiTheme)
	const rawId = declaration.id ?? declaration.label
	const id = deriveThemeShortId(rawId)
	const externalId = deriveExternalId(pkg)

	// Split `colors` into mapped (appTokens) and unmapped (vscodeColors)
	const appTokens: Record<string, string> = {}
	const vscodeColors: Record<string, string> = {}
	const unsupportedColorIds: string[] = []

	for (const [colorId, colorValue] of Object.entries(themeJson.colors)) {
		const fireflyToken = VSCODE_COLOR_MAP[colorId]
		if (fireflyToken !== undefined) {
			appTokens[fireflyToken] = colorValue
		} else {
			// Unmapped: preserve in editorTokens.vscodeColors for Monaco
			vscodeColors[colorId] = colorValue
		}
	}

	// Ids that are neither mapped nor editor colors are informational
	// (in V1 all unmapped colors go to vscodeColors, so unsupportedColorIds
	// is always empty; this field is reserved for future filtering logic).

	return {
		id,
		label: declaration.label,
		kind,
		source: {
			registry: options.registry,
			externalId,
			version: pkg.version,
			themePath: declaration.path,
			contentSha256: options.contentSha256 ?? "",
		},
		appTokens,
		editorTokens: {
			vscodeColors,
			textMateTokenColors: themeJson.tokenColors,
			semanticTokenColors: themeJson.semanticTokenColors,
		},
		unsupportedColorIds,
	}
}

// ---------------------------------------------------------------------------
// Batch converter: all themes in a package
// ---------------------------------------------------------------------------

/**
 * Result of converting all themes declared in a VS Code package.
 */
export interface VscodeThemePackageConversionResult {
	/** Converted theme contributions — one per `contributes.themes` entry. */
	themes: ImportedThemeContribution[]
	/** External id derived from the package (same for all themes in this package). */
	externalId: string
	/** Publisher + version from the package.json. */
	publisher: string | null
	version: string
}

/**
 * Parse + validate a raw `package.json` payload, then convert every
 * `contributes.themes` entry to an `ImportedThemeContribution`.
 *
 * The caller must supply a `resolveThemeJson` function that, given a
 * declaration, returns the parsed (unknown) content of the theme JSON file.
 * This keeps the converter pure — it never reads the filesystem.
 *
 * @throws `z.ZodError` when `packageJsonRaw` or any theme JSON fails schema
 *         validation.
 * @throws any error raised by `resolveThemeJson`.
 */
export function convertVscodeThemePackage(
	packageJsonRaw: unknown,
	resolveThemeJson: (declaration: VscodeThemeDeclaration) => unknown,
	options: ConvertVscodeThemeOptions,
): VscodeThemePackageConversionResult {
	const pkg = vscodeThemePackageJsonSchema.parse(packageJsonRaw)
	const themes: ImportedThemeContribution[] = []

	for (const rawDecl of pkg.contributes.themes) {
		const declaration = vscodeThemeDeclarationSchema.parse(rawDecl)
		const themeJsonRaw = resolveThemeJson(declaration)
		const contribution = convertVscodeTheme(pkg, declaration, themeJsonRaw, options)
		themes.push(contribution)
	}

	return {
		themes,
		externalId: deriveExternalId(pkg),
		publisher: pkg.publisher ?? null,
		version: pkg.version,
	}
}

// ---------------------------------------------------------------------------
// Coverage helper
// ---------------------------------------------------------------------------

/**
 * Return the set of VS Code color ids in the provided `colors` map that
 * did NOT map to a Firefly token. Useful for the operator UI's "coverage"
 * indicator and for unit tests that assert mapping completeness.
 */
export function getUnmappedColorIds(colors: Record<string, string>): string[] {
	return Object.keys(colors).filter((id) => VSCODE_COLOR_MAP[id] === undefined)
}

/**
 * Return the fraction of VS Code color ids in `colors` that mapped to a
 * Firefly token (0.0 – 1.0). Used in the operator UI's coverage badge.
 */
export function computeColorMapCoverage(colors: Record<string, string>): number {
	const total = Object.keys(colors).length
	if (total === 0) return 1.0
	const mapped = Object.keys(colors).filter((id) => VSCODE_COLOR_MAP[id] !== undefined).length
	return mapped / total
}
