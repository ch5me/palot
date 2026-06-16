/**
 * Tests for the VS Code theme converter (§9).
 *
 * Uses inline fixture data — no filesystem access required.
 */

import { describe, expect, test } from "bun:test"
import { z } from "zod"

import {
	computeColorMapCoverage,
	convertVscodeTheme,
	convertVscodeThemePackage,
	deriveExternalId,
	deriveThemeShortId,
	getUnmappedColorIds,
	type ImportedThemeContribution,
	uiThemeToKind,
	VSCODE_COLOR_MAP,
	VSCODE_COLOR_MAP_ENTRIES,
	vscodeThemeDeclarationSchema,
	vscodeThemeJsonSchema,
	vscodeThemePackageJsonSchema,
} from "./vscode-theme-import"

// ---------------------------------------------------------------------------
// Inline fixtures
// ---------------------------------------------------------------------------

/** Minimal VS Code "One Dark Pro"-style package.json fixture. */
const SAMPLE_PACKAGE_JSON = {
	name: "one-dark-pro",
	displayName: "One Dark Pro",
	publisher: "zhuangtongfa",
	version: "3.21.5",
	description: "Atom's iconic One Dark theme for VS Code",
	license: "MIT",
	contributes: {
		themes: [
			{
				id: "OneDark-Pro",
				label: "One Dark Pro",
				uiTheme: "vs-dark",
				path: "./themes/OneDark-Pro.json",
			},
			{
				label: "One Dark Pro Flat",
				uiTheme: "vs-dark",
				path: "./themes/OneDark-Pro-flat.json",
			},
		],
	},
}

/** Minimal theme JSON that exercises all converter paths. */
const SAMPLE_THEME_JSON = {
	name: "One Dark Pro",
	colors: {
		// Mapped colors (in VSCODE_COLOR_MAP)
		"editor.background": "#282C34",
		"editor.foreground": "#ABB2BF",
		"sideBar.background": "#21252B",
		"sideBar.foreground": "#ABB2BF",
		"activityBar.background": "#21252B",
		"activityBar.foreground": "#ABB2BF",
		"statusBar.background": "#21252B",
		"statusBar.foreground": "#ABB2BF",
		"panel.background": "#21252B",
		"panel.border": "#181A1F",
		"tab.activeBackground": "#282C34",
		"tab.inactiveBackground": "#21252B",
		"button.background": "#4D78CC",
		"button.foreground": "#FFFFFF",
		"input.background": "#1D1F23",
		"input.foreground": "#ABB2BF",
		"focusBorder": "#528BFF",
		"selection.background": "#3E4451",
		// Unmapped colors — should go to editorTokens.vscodeColors
		"editor.selectionBackground": "#3E4451",
		"editor.lineHighlightBackground": "#2C313C",
		"editorCursor.foreground": "#528BFF",
	},
	tokenColors: [
		{
			name: "Comments",
			scope: ["comment", "punctuation.definition.comment"],
			settings: { foreground: "#5C6370", fontStyle: "italic" },
		},
		{
			name: "Strings",
			scope: "string",
			settings: { foreground: "#98C379" },
		},
	],
	semanticTokenColors: {
		"variable.readonly": { foreground: "#E06C75" },
		"function.declaration": { foreground: "#61AFEF", bold: true },
	},
}

/** High-contrast light theme fixture. */
const HC_LIGHT_THEME_JSON = {
	colors: {
		"editor.background": "#FFFFFF",
		"editor.foreground": "#000000",
		"focusBorder": "#0066BF",
	},
	tokenColors: [],
	semanticTokenColors: {},
}

// ---------------------------------------------------------------------------
// uiThemeToKind
// ---------------------------------------------------------------------------

describe("uiThemeToKind", () => {
	test("vs → light", () => {
		expect(uiThemeToKind("vs")).toBe("light")
	})
	test("vs-dark → dark", () => {
		expect(uiThemeToKind("vs-dark")).toBe("dark")
	})
	test("hc-black → high-contrast", () => {
		expect(uiThemeToKind("hc-black")).toBe("high-contrast")
	})
	test("hc-light → high-contrast", () => {
		expect(uiThemeToKind("hc-light")).toBe("high-contrast")
	})
})

// ---------------------------------------------------------------------------
// deriveThemeShortId
// ---------------------------------------------------------------------------

describe("deriveThemeShortId", () => {
	test("strips non-alphanumeric to dashes", () => {
		expect(deriveThemeShortId("One Dark Pro")).toBe("One-Dark-Pro")
	})
	test("strips leading digits", () => {
		expect(deriveThemeShortId("123abc")).toBe("abc")
	})
	test("collapses multiple dashes", () => {
		expect(deriveThemeShortId("One  Dark  Pro")).toBe("One-Dark-Pro")
	})
	test("falls back to 'theme' for empty result", () => {
		expect(deriveThemeShortId("---")).toBe("theme")
	})
	test("truncates at 64 chars", () => {
		const long = "A".repeat(100)
		expect(deriveThemeShortId(long).length).toBeLessThanOrEqual(64)
	})
})

// ---------------------------------------------------------------------------
// deriveExternalId
// ---------------------------------------------------------------------------

describe("deriveExternalId", () => {
	test("produces publisher.name format", () => {
		const pkg = vscodeThemePackageJsonSchema.parse(SAMPLE_PACKAGE_JSON)
		expect(deriveExternalId(pkg)).toBe("zhuangtongfa.one-dark-pro")
	})
	test("falls back to unknown.name when no publisher", () => {
		const pkg = vscodeThemePackageJsonSchema.parse({ ...SAMPLE_PACKAGE_JSON, publisher: undefined })
		expect(deriveExternalId(pkg)).toBe("unknown.one-dark-pro")
	})
})

// ---------------------------------------------------------------------------
// vscodeThemePackageJsonSchema
// ---------------------------------------------------------------------------

describe("vscodeThemePackageJsonSchema", () => {
	test("accepts valid package.json", () => {
		const parsed = vscodeThemePackageJsonSchema.parse(SAMPLE_PACKAGE_JSON)
		expect(parsed.name).toBe("one-dark-pro")
		expect(parsed.contributes.themes).toHaveLength(2)
	})
	test("rejects missing contributes.themes", () => {
		expect(() =>
			vscodeThemePackageJsonSchema.parse({ ...SAMPLE_PACKAGE_JSON, contributes: { themes: [] } }),
		).toThrow()
	})
	test("rejects package without contributes", () => {
		const { contributes: _, ...rest } = SAMPLE_PACKAGE_JSON
		expect(() => vscodeThemePackageJsonSchema.parse(rest)).toThrow()
	})
	test("strips extra fields", () => {
		const parsed = vscodeThemePackageJsonSchema.parse({ ...SAMPLE_PACKAGE_JSON, engines: { vscode: "^1.50.0" } })
		expect((parsed as Record<string, unknown>)["engines"]).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// vscodeThemeJsonSchema
// ---------------------------------------------------------------------------

describe("vscodeThemeJsonSchema", () => {
	test("accepts valid theme JSON", () => {
		const parsed = vscodeThemeJsonSchema.parse(SAMPLE_THEME_JSON)
		expect(parsed.colors["editor.background"]).toBe("#282C34")
		expect(parsed.tokenColors).toHaveLength(2)
	})
	test("defaults empty fields", () => {
		const parsed = vscodeThemeJsonSchema.parse({})
		expect(parsed.colors).toEqual({})
		expect(parsed.tokenColors).toEqual([])
		expect(parsed.semanticTokenColors).toEqual({})
	})
	test("strips unknown fields", () => {
		const parsed = vscodeThemeJsonSchema.parse({ ...SAMPLE_THEME_JSON, $schema: "...", include: "./base.json" })
		expect((parsed as Record<string, unknown>)["$schema"]).toBeUndefined()
		expect((parsed as Record<string, unknown>)["include"]).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// convertVscodeTheme — core mapping logic
// ---------------------------------------------------------------------------

describe("convertVscodeTheme", () => {
	const pkg = vscodeThemePackageJsonSchema.parse(SAMPLE_PACKAGE_JSON)
	const decl = vscodeThemeDeclarationSchema.parse(SAMPLE_PACKAGE_JSON.contributes.themes[0])

	test("produces correct kind for vs-dark", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, {
			registry: "open-vsx",
			contentSha256: "a".repeat(64),
		})
		expect(result.kind).toBe("dark")
	})

	test("maps all §9 table colors to appTokens", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		// All 18 entries in VSCODE_COLOR_MAP should map when present in the theme
		for (const [vscodeId, fireflyToken] of Object.entries(VSCODE_COLOR_MAP)) {
			if (SAMPLE_THEME_JSON.colors[vscodeId as keyof typeof SAMPLE_THEME_JSON.colors]) {
				expect(result.appTokens[fireflyToken]).toBeDefined()
			}
		}
	})

	test("appTokens uses shadcn/ui CSS var names as keys", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.appTokens["--background"]).toBe("#282C34")
		expect(result.appTokens["--foreground"]).toBe("#ABB2BF")
		expect(result.appTokens["--ring"]).toBe("#528BFF")
		expect(result.appTokens["--accent"]).toBe("#3E4451")
	})

	test("unmapped colors go to editorTokens.vscodeColors", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.editorTokens.vscodeColors["editor.selectionBackground"]).toBe("#3E4451")
		expect(result.editorTokens.vscodeColors["editor.lineHighlightBackground"]).toBe("#2C313C")
		expect(result.editorTokens.vscodeColors["editorCursor.foreground"]).toBe("#528BFF")
	})

	test("no Firefly token leaks into vscodeColors", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		for (const key of Object.keys(result.editorTokens.vscodeColors)) {
			expect(VSCODE_COLOR_MAP[key]).toBeUndefined()
		}
	})

	test("no vscode color id leaks into appTokens", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		for (const key of Object.keys(result.appTokens)) {
			// All keys must be CSS custom properties (start with --)
			expect(key.startsWith("--")).toBe(true)
			// No old-style --ff- prefixed tokens should appear
			expect(key.startsWith("--ff-")).toBe(false)
		}
	})

	test("tokenColors preserved in editorTokens.textMateTokenColors", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.editorTokens.textMateTokenColors).toHaveLength(2)
		expect(result.editorTokens.textMateTokenColors[0]?.name).toBe("Comments")
	})

	test("semanticTokenColors preserved", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.editorTokens.semanticTokenColors["variable.readonly"]).toBeDefined()
		expect(result.editorTokens.semanticTokenColors["function.declaration"]).toBeDefined()
	})

	test("source provenance fields populated", () => {
		const sha = "b".repeat(64)
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, {
			registry: "manual-vsix",
			contentSha256: sha,
		})
		expect(result.source.registry).toBe("manual-vsix")
		expect(result.source.externalId).toBe("zhuangtongfa.one-dark-pro")
		expect(result.source.version).toBe("3.21.5")
		expect(result.source.themePath).toBe("./themes/OneDark-Pro.json")
		expect(result.source.contentSha256).toBe(sha)
	})

	test("contentSha256 defaults to empty string when omitted", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.source.contentSha256).toBe("")
	})

	test("id derives from declaration.id (VS Code theme id)", () => {
		const result = convertVscodeTheme(pkg, decl, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.id).toBe("OneDark-Pro")
	})

	test("id falls back to label when declaration.id absent", () => {
		const declNoId = vscodeThemeDeclarationSchema.parse(SAMPLE_PACKAGE_JSON.contributes.themes[1])
		const result = convertVscodeTheme(pkg, declNoId, SAMPLE_THEME_JSON, { registry: "open-vsx" })
		expect(result.id).toBe("One-Dark-Pro-Flat")
	})

	test("high-contrast light uiTheme → high-contrast kind", () => {
		const hcPkg = vscodeThemePackageJsonSchema.parse({
			...SAMPLE_PACKAGE_JSON,
			contributes: {
				themes: [{ label: "HC Light", uiTheme: "hc-light", path: "./themes/hc.json" }],
			},
		})
		const hcDecl = vscodeThemeDeclarationSchema.parse(hcPkg.contributes.themes[0])
		const result = convertVscodeTheme(hcPkg, hcDecl, HC_LIGHT_THEME_JSON, { registry: "open-vsx" })
		expect(result.kind).toBe("high-contrast")
	})

	test("light uiTheme (vs) → light kind", () => {
		const lightPkg = vscodeThemePackageJsonSchema.parse({
			...SAMPLE_PACKAGE_JSON,
			contributes: {
				themes: [{ label: "Light Plus", uiTheme: "vs", path: "./themes/light.json" }],
			},
		})
		const lightDecl = vscodeThemeDeclarationSchema.parse(lightPkg.contributes.themes[0])
		const result = convertVscodeTheme(lightPkg, lightDecl, HC_LIGHT_THEME_JSON, { registry: "open-vsx" })
		expect(result.kind).toBe("light")
	})

	test("throws ZodError on invalid theme JSON", () => {
		// A string that is not even an object
		expect(() =>
			convertVscodeTheme(pkg, decl, "not-valid-json", { registry: "open-vsx" }),
		).toThrow(z.ZodError)
	})
})

// ---------------------------------------------------------------------------
// convertVscodeThemePackage — batch converter
// ---------------------------------------------------------------------------

describe("convertVscodeThemePackage", () => {
	test("converts all themes in the package", () => {
		const result = convertVscodeThemePackage(
			SAMPLE_PACKAGE_JSON,
			(_decl) => SAMPLE_THEME_JSON,
			{ registry: "open-vsx" },
		)
		expect(result.themes).toHaveLength(2)
		expect(result.externalId).toBe("zhuangtongfa.one-dark-pro")
		expect(result.publisher).toBe("zhuangtongfa")
		expect(result.version).toBe("3.21.5")
	})

	test("each theme has distinct id from its declaration", () => {
		const result = convertVscodeThemePackage(
			SAMPLE_PACKAGE_JSON,
			(_decl) => SAMPLE_THEME_JSON,
			{ registry: "open-vsx" },
		)
		const ids = result.themes.map((t) => t.id)
		// First theme has declaration.id = "OneDark-Pro"
		expect(ids[0]).toBe("OneDark-Pro")
		// Second theme has no id, falls back to label "One Dark Pro Flat"
		expect(ids[1]).toBe("One-Dark-Pro-Flat")
	})

	test("throws ZodError when package.json is invalid", () => {
		expect(() =>
			convertVscodeThemePackage(
				{ name: "bad", version: "1.0.0" }, // missing contributes
				(_d) => SAMPLE_THEME_JSON,
				{ registry: "open-vsx" },
			),
		).toThrow(z.ZodError)
	})

	test("propagates resolveThemeJson error", () => {
		expect(() =>
			convertVscodeThemePackage(
				SAMPLE_PACKAGE_JSON,
				(_decl) => { throw new Error("file not found") },
				{ registry: "open-vsx" },
			),
		).toThrow("file not found")
	})
})

// ---------------------------------------------------------------------------
// Color-map coverage helpers
// ---------------------------------------------------------------------------

describe("getUnmappedColorIds", () => {
	test("returns ids not in VSCODE_COLOR_MAP", () => {
		const colors = {
			"editor.background": "#000",
			"editor.selectionBackground": "#111",
			"editorCursor.foreground": "#222",
		}
		const unmapped = getUnmappedColorIds(colors)
		expect(unmapped).toContain("editor.selectionBackground")
		expect(unmapped).toContain("editorCursor.foreground")
		expect(unmapped).not.toContain("editor.background")
	})

	test("returns empty array when all ids are mapped", () => {
		const allMapped = Object.fromEntries(
			Object.keys(VSCODE_COLOR_MAP).map((id) => [id, "#000"]),
		)
		expect(getUnmappedColorIds(allMapped)).toHaveLength(0)
	})
})

describe("computeColorMapCoverage", () => {
	test("returns 1.0 for empty map", () => {
		expect(computeColorMapCoverage({})).toBe(1.0)
	})

	test("returns 1.0 when all colors are mapped", () => {
		const allMapped = Object.fromEntries(
			Object.keys(VSCODE_COLOR_MAP).map((id) => [id, "#000"]),
		)
		expect(computeColorMapCoverage(allMapped)).toBe(1.0)
	})

	test("returns fraction for partial coverage", () => {
		// 1 mapped, 1 unmapped = 0.5
		const colors = {
			"editor.background": "#000", // mapped
			"editorCursor.foreground": "#fff", // not mapped
		}
		expect(computeColorMapCoverage(colors)).toBe(0.5)
	})

	test("returns 0.0 when nothing is mapped", () => {
		const colors = {
			"editorCursor.foreground": "#fff",
			"editorLineNumber.foreground": "#ccc",
		}
		expect(computeColorMapCoverage(colors)).toBe(0.0)
	})
})

// ---------------------------------------------------------------------------
// VSCODE_COLOR_MAP_ENTRIES shape lock
// ---------------------------------------------------------------------------

describe("VSCODE_COLOR_MAP_ENTRIES", () => {
	test("has at least 18 entries (§9 table is complete)", () => {
		expect(VSCODE_COLOR_MAP_ENTRIES.length).toBeGreaterThanOrEqual(18)
	})

	test("every entry has vscodeId and fireflyToken", () => {
		for (const entry of VSCODE_COLOR_MAP_ENTRIES) {
			expect(typeof entry.vscodeId).toBe("string")
			expect(typeof entry.fireflyToken).toBe("string")
			// All tokens must be CSS custom properties (start with --)
			expect(entry.fireflyToken.startsWith("--")).toBe(true)
		}
	})

	test("matches VSCODE_COLOR_MAP (consistency)", () => {
		for (const entry of VSCODE_COLOR_MAP_ENTRIES) {
			expect(VSCODE_COLOR_MAP[entry.vscodeId]).toBe(entry.fireflyToken)
		}
	})
})

// ---------------------------------------------------------------------------
// Full round-trip: convertVscodeThemePackage → ImportedThemeContribution shape
// ---------------------------------------------------------------------------

describe("ImportedThemeContribution shape lock", () => {
	test("result satisfies expected shape", () => {
		const result = convertVscodeThemePackage(
			SAMPLE_PACKAGE_JSON,
			(_decl) => SAMPLE_THEME_JSON,
			{ registry: "open-vsx", contentSha256: "c".repeat(64) },
		)
		const theme = result.themes[0] as ImportedThemeContribution

		// Top-level fields
		expect(typeof theme.id).toBe("string")
		expect(typeof theme.label).toBe("string")
		expect(["light", "dark", "high-contrast"]).toContain(theme.kind)

		// source block
		expect(["open-vsx", "manual-vsix"]).toContain(theme.source.registry)
		expect(typeof theme.source.externalId).toBe("string")
		expect(typeof theme.source.version).toBe("string")
		expect(typeof theme.source.themePath).toBe("string")
		expect(typeof theme.source.contentSha256).toBe("string")

		// appTokens: only CSS custom property keys (shadcn/ui tokens)
		for (const key of Object.keys(theme.appTokens)) {
			expect(key.startsWith("--")).toBe(true)
		}

		// editorTokens
		expect(typeof theme.editorTokens.vscodeColors).toBe("object")
		expect(Array.isArray(theme.editorTokens.textMateTokenColors)).toBe(true)
		expect(typeof theme.editorTokens.semanticTokenColors).toBe("object")

		// unsupportedColorIds
		expect(Array.isArray(theme.unsupportedColorIds)).toBe(true)
	})
})
