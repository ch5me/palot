// bun:test (not node:test): node:test files raise NotImplementedError in
// multi-file `bun test` runs (oven-sh/bun#5090) and silently never execute.
import { describe, expect, test } from "bun:test"
import { importedThemeToThemeDefinition, type ImportedThemeTokens } from "./imported-themes"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DARK_IMPORTED: ImportedThemeTokens = {
	id: "OneDark-Pro",
	label: "One Dark Pro",
	kind: "dark",
	appTokens: {
		"--background": "#282C34",
		"--foreground": "#ABB2BF",
		"--primary": "#4D78CC",
		"--primary-foreground": "#FFFFFF",
		"--sidebar": "#21252B",
		"--sidebar-foreground": "#ABB2BF",
		"--ring": "#528BFF",
		"--border": "#181A1F",
		"--card": "#21252B",
		"--secondary": "#21252B",
		"--secondary-foreground": "#ABB2BF",
		"--muted": "#21252B",
		"--input": "#1D1F23",
		"--sidebar-accent": "#21252B",
		"--accent": "#3E4451",
	},
}

const LIGHT_IMPORTED: ImportedThemeTokens = {
	id: "GitHub-Light",
	label: "GitHub Light",
	kind: "light",
	appTokens: {
		"--background": "#FFFFFF",
		"--foreground": "#24292E",
		"--primary": "#0366D6",
		"--primary-foreground": "#FFFFFF",
	},
}

const HC_IMPORTED: ImportedThemeTokens = {
	id: "HC-Dark",
	label: "High Contrast Dark",
	kind: "high-contrast",
	appTokens: {
		"--background": "#000000",
		"--foreground": "#FFFFFF",
		"--border": "#FFFFFF",
	},
}

// ---------------------------------------------------------------------------
// importedThemeToThemeDefinition
// ---------------------------------------------------------------------------

describe("importedThemeToThemeDefinition", () => {
	test("id and name are preserved", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		expect(def.id).toBe("OneDark-Pro")
		expect(def.name).toBe("One Dark Pro")
	})

	test("dark theme tokens land in cssVars.dark, not cssVars.light", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		expect(def.cssVars.dark["--background"]).toBe("#282C34")
		expect(def.cssVars.dark["--foreground"]).toBe("#ABB2BF")
		expect(def.cssVars.dark["--primary"]).toBe("#4D78CC")
		expect(def.cssVars.dark["--ring"]).toBe("#528BFF")
		// Light vars must be empty for a dark-only theme
		expect(Object.keys(def.cssVars.light)).toHaveLength(0)
	})

	test("light theme tokens land in cssVars.light, not cssVars.dark", () => {
		const def = importedThemeToThemeDefinition(LIGHT_IMPORTED)
		expect(def.cssVars.light["--background"]).toBe("#FFFFFF")
		expect(def.cssVars.light["--foreground"]).toBe("#24292E")
		expect(Object.keys(def.cssVars.dark)).toHaveLength(0)
	})

	test("high-contrast tokens land in BOTH cssVars.light and cssVars.dark", () => {
		const def = importedThemeToThemeDefinition(HC_IMPORTED)
		expect(def.cssVars.light["--background"]).toBe("#000000")
		expect(def.cssVars.dark["--background"]).toBe("#000000")
		expect(def.cssVars.light["--foreground"]).toBe("#FFFFFF")
		expect(def.cssVars.dark["--foreground"]).toBe("#FFFFFF")
	})

	test("appTokens use real shadcn/ui token names as keys (not --ff- prefixed)", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		const allKeys = [
			...Object.keys(def.cssVars.light),
			...Object.keys(def.cssVars.dark),
		]
		for (const key of allKeys) {
			expect(key.startsWith("--")).toBe(true)
			expect(key.startsWith("--ff-")).toBe(false)
		}
	})

	test("all appToken entries appear in the correct cssVars bucket", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		for (const [token, value] of Object.entries(DARK_IMPORTED.appTokens)) {
			// Dark theme: token must be in cssVars.dark
			expect(def.cssVars.dark[token]).toBe(value)
		}
	})

	test("produces a valid ThemeDefinition shape (id, name, cssVars)", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		expect(typeof def.id).toBe("string")
		expect(typeof def.name).toBe("string")
		expect(typeof def.cssVars).toBe("object")
		expect(typeof def.cssVars.light).toBe("object")
		expect(typeof def.cssVars.dark).toBe("object")
	})

	test("description mentions kind", () => {
		const def = importedThemeToThemeDefinition(DARK_IMPORTED)
		expect(def.description).toContain("dark")
	})
})
