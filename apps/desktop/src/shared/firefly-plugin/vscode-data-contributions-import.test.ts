/**
 * Tests for the VS Code data-contribution converter (Phase 2).
 *
 * Uses inline fixture data — no filesystem access required.
 */

import { describe, expect, test } from "bun:test"
import { z } from "zod"

import {
	convertVscodeDataContributions,
	convertVscodeGrammar,
	convertVscodeIconTheme,
	convertVscodeLanguage,
	convertVscodeSnippet,
	deriveIconThemeShortId,
	vscodeDataContributionsPackageJsonSchema,
	vscodeGrammarDeclarationSchema,
	vscodeIconThemeDeclarationSchema,
	vscodeLanguageDeclarationSchema,
	vscodeSnippetDeclarationSchema,
	type VscodeDataContributionsConversionResult,
} from "./vscode-data-contributions-import"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PACKAGE_JSON = {
	name: "my-language-pack",
	displayName: "My Language Pack",
	publisher: "acmecorp",
	version: "1.0.0",
	description: "Snippets, grammars, and icon themes for custom languages.",
	license: "MIT",
	contributes: {
		snippets: [
			{ language: "typescript", path: "./snippets/typescript.json" },
			{ language: "python", path: "./snippets/python.json" },
		],
		languages: [
			{
				id: "solidity",
				aliases: ["Solidity", "sol"],
				extensions: [".sol"],
				filenames: [],
				configuration: "./language-configuration.json",
			},
			{
				id: "graphql",
				aliases: ["GraphQL"],
				extensions: [".graphql", ".gql"],
			},
		],
		grammars: [
			{
				language: "solidity",
				scopeName: "source.solidity",
				path: "./syntaxes/solidity.tmGrammar.json",
			},
			{
				scopeName: "source.graphql",
				path: "./syntaxes/graphql.tmLanguage.json",
				embeddedLanguages: { "meta.embedded.block.js": "javascript" },
			},
		],
		iconThemes: [
			{
				id: "material-icon-theme",
				label: "Material Icon Theme",
				path: "./material-icons.json",
			},
		],
	},
}

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("vscode-data-contributions-import schemas", () => {
	test("parses a complete package.json with all four data families", () => {
		const result = vscodeDataContributionsPackageJsonSchema.safeParse(SAMPLE_PACKAGE_JSON)
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.contributes?.snippets).toHaveLength(2)
		expect(result.data.contributes?.languages).toHaveLength(2)
		expect(result.data.contributes?.grammars).toHaveLength(2)
		expect(result.data.contributes?.iconThemes).toHaveLength(1)
	})

	test("accepts package.json with no contributes field", () => {
		const result = vscodeDataContributionsPackageJsonSchema.safeParse({
			name: "empty-pkg",
			version: "0.1.0",
		})
		expect(result.success).toBe(true)
	})

	test("accepts package.json with only some data families", () => {
		const result = vscodeDataContributionsPackageJsonSchema.safeParse({
			name: "grammar-only",
			version: "1.0.0",
			contributes: {
				grammars: [{ scopeName: "source.sol", path: "./sol.json" }],
			},
		})
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.contributes?.snippets).toBeUndefined()
		expect(result.data.contributes?.grammars).toHaveLength(1)
	})

	test("snippet schema requires language and path", () => {
		expect(vscodeSnippetDeclarationSchema.safeParse({ language: "ts", path: "./s.json" }).success).toBe(true)
		expect(vscodeSnippetDeclarationSchema.safeParse({ path: "./s.json" }).success).toBe(false)
		expect(vscodeSnippetDeclarationSchema.safeParse({ language: "ts" }).success).toBe(false)
	})

	test("grammar schema requires scopeName and path, language is optional", () => {
		const withLang = vscodeGrammarDeclarationSchema.safeParse({
			language: "sol",
			scopeName: "source.sol",
			path: "./sol.json",
		})
		expect(withLang.success).toBe(true)
		const withoutLang = vscodeGrammarDeclarationSchema.safeParse({
			scopeName: "source.sol",
			path: "./sol.json",
		})
		expect(withoutLang.success).toBe(true)
		const missingScope = vscodeGrammarDeclarationSchema.safeParse({ path: "./sol.json" })
		expect(missingScope.success).toBe(false)
	})

	test("language schema requires id, other fields optional", () => {
		expect(vscodeLanguageDeclarationSchema.safeParse({ id: "sol" }).success).toBe(true)
		expect(vscodeLanguageDeclarationSchema.safeParse({}).success).toBe(false)
	})

	test("icon theme schema requires id, label, and path", () => {
		const good = vscodeIconThemeDeclarationSchema.safeParse({
			id: "my-icons",
			label: "My Icons",
			path: "./icons.json",
		})
		expect(good.success).toBe(true)
		const missingLabel = vscodeIconThemeDeclarationSchema.safeParse({ id: "x", path: "./x.json" })
		expect(missingLabel.success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Per-family converter tests
// ---------------------------------------------------------------------------

describe("convertVscodeSnippet", () => {
	test("converts a snippet declaration 1:1", () => {
		const result = convertVscodeSnippet({ language: "typescript", path: "./ts.json" })
		expect(result).toEqual({ language: "typescript", path: "./ts.json" })
	})
})

describe("convertVscodeLanguage", () => {
	test("converts a full language declaration", () => {
		const result = convertVscodeLanguage({
			id: "solidity",
			aliases: ["Solidity", "sol"],
			extensions: [".sol"],
			filenames: [],
			configuration: "./lang-config.json",
		})
		expect(result.id).toBe("solidity")
		expect(result.aliases).toEqual(["Solidity", "sol"])
		expect(result.extensions).toEqual([".sol"])
		expect(result.filenames).toEqual([])
		expect(result.configuration).toBe("./lang-config.json")
	})

	test("defaults optional array fields to empty arrays", () => {
		const result = convertVscodeLanguage({ id: "graphql" })
		expect(result.aliases).toEqual([])
		expect(result.extensions).toEqual([])
		expect(result.filenames).toEqual([])
		expect(result.configuration).toBeUndefined()
	})
})

describe("convertVscodeGrammar", () => {
	test("converts a grammar with a language reference", () => {
		const result = convertVscodeGrammar({
			language: "solidity",
			scopeName: "source.solidity",
			path: "./sol.tmGrammar.json",
		})
		expect(result.language).toBe("solidity")
		expect(result.scopeName).toBe("source.solidity")
		expect(result.path).toBe("./sol.tmGrammar.json")
		expect(result.embeddedLanguages).toBeUndefined()
	})

	test("converts a grammar without a language reference", () => {
		const result = convertVscodeGrammar({
			scopeName: "source.graphql",
			path: "./graphql.tmLanguage.json",
			embeddedLanguages: { "meta.embedded.block.js": "javascript" },
		})
		expect(result.language).toBeUndefined()
		expect(result.embeddedLanguages).toEqual({ "meta.embedded.block.js": "javascript" })
	})
})

describe("convertVscodeIconTheme", () => {
	test("converts a standard icon theme declaration", () => {
		const result = convertVscodeIconTheme({
			id: "material-icon-theme",
			label: "Material Icon Theme",
			path: "./material-icons.json",
		})
		expect(result.id).toBe("material-icon-theme")
		expect(result.label).toBe("Material Icon Theme")
		expect(result.path).toBe("./material-icons.json")
	})

	test("sanitizes non-Firefly-safe icon theme ids", () => {
		// VS Code icon theme ids may contain dots, spaces, and other chars
		expect(convertVscodeIconTheme({ id: "My Icon.Theme", label: "L", path: "./p.json" }).id).toBe("My-Icon-Theme")
		expect(convertVscodeIconTheme({ id: "123-icon", label: "L", path: "./p.json" }).id).toBe("icon")
		expect(convertVscodeIconTheme({ id: "a_b_c", label: "L", path: "./p.json" }).id).toBe("a-b-c")
	})
})

// ---------------------------------------------------------------------------
// deriveIconThemeShortId
// ---------------------------------------------------------------------------

describe("deriveIconThemeShortId", () => {
	test("passes through already-valid ids unchanged", () => {
		expect(deriveIconThemeShortId("my-theme")).toBe("my-theme")
		expect(deriveIconThemeShortId("MaterialIcons")).toBe("MaterialIcons")
	})

	test("strips leading digits and non-alpha chars", () => {
		expect(deriveIconThemeShortId("123theme")).toBe("theme")
		expect(deriveIconThemeShortId("---theme")).toBe("theme")
	})

	test("replaces special characters with hyphens", () => {
		expect(deriveIconThemeShortId("my.icon theme")).toBe("my-icon-theme")
	})

	test("collapses consecutive hyphens", () => {
		expect(deriveIconThemeShortId("my--theme")).toBe("my-theme")
	})

	test("trims trailing hyphens", () => {
		expect(deriveIconThemeShortId("my-theme---")).toBe("my-theme")
	})

	test("returns 'icon-theme' for empty-after-sanitization input", () => {
		expect(deriveIconThemeShortId("123")).toBe("icon-theme")
		expect(deriveIconThemeShortId("---")).toBe("icon-theme")
	})

	test("truncates to 64 characters", () => {
		const long = "a".repeat(100)
		expect(deriveIconThemeShortId(long)).toHaveLength(64)
	})
})

// ---------------------------------------------------------------------------
// Batch converter: convertVscodeDataContributions
// ---------------------------------------------------------------------------

describe("convertVscodeDataContributions", () => {
	test("converts all four data families from a full package.json", () => {
		const result: VscodeDataContributionsConversionResult =
			convertVscodeDataContributions(SAMPLE_PACKAGE_JSON)

		expect(result.snippets).toHaveLength(2)
		expect(result.snippets[0]).toEqual({ language: "typescript", path: "./snippets/typescript.json" })
		expect(result.snippets[1]).toEqual({ language: "python", path: "./snippets/python.json" })

		expect(result.languages).toHaveLength(2)
		expect(result.languages[0]?.id).toBe("solidity")
		expect(result.languages[0]?.configuration).toBe("./language-configuration.json")
		expect(result.languages[1]?.id).toBe("graphql")
		expect(result.languages[1]?.aliases).toEqual(["GraphQL"])

		expect(result.grammars).toHaveLength(2)
		expect(result.grammars[0]?.language).toBe("solidity")
		expect(result.grammars[0]?.scopeName).toBe("source.solidity")
		expect(result.grammars[1]?.language).toBeUndefined()
		expect(result.grammars[1]?.embeddedLanguages).toEqual({ "meta.embedded.block.js": "javascript" })

		expect(result.iconThemes).toHaveLength(1)
		expect(result.iconThemes[0]?.id).toBe("material-icon-theme")
		expect(result.iconThemes[0]?.label).toBe("Material Icon Theme")

		expect(result.publisher).toBe("acmecorp")
		expect(result.version).toBe("1.0.0")
	})

	test("returns empty arrays for missing families", () => {
		const result = convertVscodeDataContributions({
			name: "grammar-only",
			version: "2.0.0",
			contributes: {
				grammars: [{ scopeName: "source.foo", path: "./foo.json" }],
			},
		})
		expect(result.snippets).toEqual([])
		expect(result.languages).toEqual([])
		expect(result.grammars).toHaveLength(1)
		expect(result.iconThemes).toEqual([])
		expect(result.publisher).toBeNull()
	})

	test("returns empty arrays when contributes is absent", () => {
		const result = convertVscodeDataContributions({ name: "empty", version: "0.0.1" })
		expect(result.snippets).toEqual([])
		expect(result.languages).toEqual([])
		expect(result.grammars).toEqual([])
		expect(result.iconThemes).toEqual([])
	})

	test("throws ZodError for invalid package.json", () => {
		expect(() => convertVscodeDataContributions({ not: "valid" })).toThrow(z.ZodError)
	})

	test("throws ZodError for a snippet missing language", () => {
		expect(() =>
			convertVscodeDataContributions({
				name: "bad",
				version: "1.0.0",
				contributes: {
					snippets: [{ path: "./s.json" }],
				},
			}),
		).toThrow(z.ZodError)
	})

	test("throws ZodError for a grammar missing scopeName", () => {
		expect(() =>
			convertVscodeDataContributions({
				name: "bad",
				version: "1.0.0",
				contributes: {
					grammars: [{ path: "./g.json" }],
				},
			}),
		).toThrow(z.ZodError)
	})
})
