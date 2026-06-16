/**
 * Tests for the data-contribution projection layer (Phase 2).
 *
 * All Monaco runtime calls are mocked with plain objects — no actual
 * monaco-editor import needed. Tests cover:
 *   - Per-family projectors (projectSnippets, projectLanguages, projectGrammars, projectIconThemes)
 *   - Catalog-level projector (projectDataContributionsFromCatalog)
 *   - Monaco shape converters (toMonacoLanguageRegistration, toMonacoGrammarRegistration)
 *   - Snippet completion provider builder (createSnippetCompletionProviders, snippetEntryToCompletionItem)
 *   - Icon theme resolver entries (toIconThemeResolverEntries)
 *   - Unified entry point (registerDataContributionsWithMonaco)
 */

import { describe, expect, mock, test } from "bun:test"

import {
	createSnippetCompletionProviders,
	projectDataContributionsFromCatalog,
	projectGrammars,
	projectIconThemes,
	projectLanguages,
	projectSnippets,
	registerDataContributionsWithMonaco,
	snippetEntryToCompletionItem,
	toIconThemeResolverEntries,
	toMonacoGrammarRegistration,
	toMonacoLanguageRegistration,
	type DataContributionsProjection,
	type MonacoSnippetCompletionProvider,
	type ProjectedGrammar,
	type ProjectedIconTheme,
	type ProjectedLanguage,
	type ProjectedSnippet,
	type ResolvedSnippet,
} from "./data-contributions-projection"
import type { PluginDescriptor } from "./descriptor"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal PluginDescriptor stub with data-contribution families populated.
 * Only the fields used by the projection functions are set; others are cast.
 */
function makeDescriptor(overrides: {
	normalizedId?: string
	snippets?: PluginDescriptor["snippets"]
	languages?: PluginDescriptor["languages"]
	grammars?: PluginDescriptor["grammars"]
	iconThemes?: PluginDescriptor["iconThemes"]
}): PluginDescriptor {
	return {
		normalizedId: overrides.normalizedId ?? "acme.test",
		snippets: overrides.snippets ?? [],
		languages: overrides.languages ?? [],
		grammars: overrides.grammars ?? [],
		iconThemes: overrides.iconThemes ?? [],
	} as unknown as PluginDescriptor
}

const SNIPPET_A = { language: "typescript", path: "./snippets/ts.json" }
const SNIPPET_B = { language: "python", path: "./snippets/py.json" }

const LANGUAGE_SOL = {
	id: "solidity",
	aliases: ["Solidity", "sol"],
	extensions: [".sol"],
	filenames: [],
	configuration: "./lang.json",
}
const LANGUAGE_GQL = {
	id: "graphql",
	aliases: [],
	extensions: [".graphql", ".gql"],
	filenames: [],
}

const GRAMMAR_SOL = {
	scopeName: "source.solidity",
	language: "solidity",
	path: "./syntaxes/sol.tmGrammar.json",
}
const GRAMMAR_GQL = {
	scopeName: "source.graphql",
	path: "./syntaxes/gql.tmLanguage.json",
	embeddedLanguages: { "meta.embedded.block.js": "javascript" },
}

const ICON_THEME_MATERIAL = {
	id: "material",
	label: "Material Icon Theme",
	path: "./material-icons.json",
}

// ---------------------------------------------------------------------------
// projectSnippets
// ---------------------------------------------------------------------------

describe("projectSnippets", () => {
	test("returns empty array for a descriptor with no snippets", () => {
		const desc = makeDescriptor({})
		expect(projectSnippets(desc)).toEqual([])
	})

	test("projects each snippet with stable projectedId and correct family", () => {
		const desc = makeDescriptor({ snippets: [SNIPPET_A, SNIPPET_B] })
		const result = projectSnippets(desc)
		expect(result).toHaveLength(2)

		const first = result[0]!
		expect(first.family).toBe("snippets")
		expect(first.pluginId).toBe("acme.test")
		expect(first.contributionId).toBe("snippet.typescript.0")
		expect(first.projectedId).toBe("acme.test.snippet.typescript.0")
		expect(first.contribution).toEqual(SNIPPET_A)

		const second = result[1]!
		expect(second.projectedId).toBe("acme.test.snippet.python.1")
		expect(second.contribution).toEqual(SNIPPET_B)
	})

	test("projectedIds are globally unique across different plugins", () => {
		const descA = makeDescriptor({ normalizedId: "acme.alpha", snippets: [SNIPPET_A] })
		const descB = makeDescriptor({ normalizedId: "acme.beta", snippets: [SNIPPET_A] })
		const idsA = projectSnippets(descA).map((p) => p.projectedId)
		const idsB = projectSnippets(descB).map((p) => p.projectedId)
		expect(idsA[0]).not.toBe(idsB[0])
	})
})

// ---------------------------------------------------------------------------
// projectLanguages
// ---------------------------------------------------------------------------

describe("projectLanguages", () => {
	test("returns empty array for a descriptor with no languages", () => {
		expect(projectLanguages(makeDescriptor({}))).toEqual([])
	})

	test("projects each language with correct ids", () => {
		const desc = makeDescriptor({ languages: [LANGUAGE_SOL, LANGUAGE_GQL] })
		const result = projectLanguages(desc)
		expect(result).toHaveLength(2)

		const sol = result[0]!
		expect(sol.family).toBe("languages")
		expect(sol.contributionId).toBe("language.solidity")
		expect(sol.projectedId).toBe("acme.test.language.solidity")
		expect(sol.contribution).toEqual(LANGUAGE_SOL)

		const gql = result[1]!
		expect(gql.projectedId).toBe("acme.test.language.graphql")
	})
})

// ---------------------------------------------------------------------------
// projectGrammars
// ---------------------------------------------------------------------------

describe("projectGrammars", () => {
	test("returns empty array for a descriptor with no grammars", () => {
		expect(projectGrammars(makeDescriptor({}))).toEqual([])
	})

	test("projects each grammar with correct scope-keyed ids", () => {
		const desc = makeDescriptor({ grammars: [GRAMMAR_SOL, GRAMMAR_GQL] })
		const result = projectGrammars(desc)
		expect(result).toHaveLength(2)

		const sol = result[0]!
		expect(sol.family).toBe("grammars")
		expect(sol.contributionId).toBe("grammar.source.solidity")
		expect(sol.projectedId).toBe("acme.test.grammar.source.solidity")
		expect(sol.contribution).toEqual(GRAMMAR_SOL)

		const gql = result[1]!
		expect(gql.projectedId).toBe("acme.test.grammar.source.graphql")
		expect(gql.contribution.embeddedLanguages).toEqual({ "meta.embedded.block.js": "javascript" })
	})
})

// ---------------------------------------------------------------------------
// projectIconThemes
// ---------------------------------------------------------------------------

describe("projectIconThemes", () => {
	test("returns empty array for a descriptor with no icon themes", () => {
		expect(projectIconThemes(makeDescriptor({}))).toEqual([])
	})

	test("projects each icon theme with correct ids", () => {
		const desc = makeDescriptor({ iconThemes: [ICON_THEME_MATERIAL] })
		const result = projectIconThemes(desc)
		expect(result).toHaveLength(1)

		const mat = result[0]!
		expect(mat.family).toBe("iconThemes")
		expect(mat.contributionId).toBe("material")
		expect(mat.projectedId).toBe("acme.test.material")
		expect(mat.contribution).toEqual(ICON_THEME_MATERIAL)
	})
})

// ---------------------------------------------------------------------------
// projectDataContributionsFromCatalog
// ---------------------------------------------------------------------------

describe("projectDataContributionsFromCatalog", () => {
	test("returns empty projections for an empty catalog", () => {
		const result = projectDataContributionsFromCatalog([])
		expect(result.snippets).toEqual([])
		expect(result.languages).toEqual([])
		expect(result.grammars).toEqual([])
		expect(result.iconThemes).toEqual([])
	})

	test("merges contributions from multiple descriptors", () => {
		const descA = makeDescriptor({
			normalizedId: "acme.alpha",
			snippets: [SNIPPET_A],
			languages: [LANGUAGE_SOL],
			grammars: [GRAMMAR_SOL],
			iconThemes: [ICON_THEME_MATERIAL],
		})
		const descB = makeDescriptor({
			normalizedId: "acme.beta",
			snippets: [SNIPPET_B],
			languages: [LANGUAGE_GQL],
			grammars: [GRAMMAR_GQL],
		})
		const result = projectDataContributionsFromCatalog([descA, descB])
		expect(result.snippets).toHaveLength(2)
		expect(result.languages).toHaveLength(2)
		expect(result.grammars).toHaveLength(2)
		expect(result.iconThemes).toHaveLength(1)
	})

	test("a descriptor with no data families produces no items", () => {
		const desc = makeDescriptor({})
		const result = projectDataContributionsFromCatalog([desc])
		expect(result.snippets).toHaveLength(0)
		expect(result.languages).toHaveLength(0)
		expect(result.grammars).toHaveLength(0)
		expect(result.iconThemes).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// toMonacoLanguageRegistration
// ---------------------------------------------------------------------------

describe("toMonacoLanguageRegistration", () => {
	function makeProjectedLanguage(
		contribution: PluginDescriptor["languages"][number],
	): ProjectedLanguage {
		return {
			family: "languages",
			pluginId: "acme.test",
			contributionId: `language.${contribution.id}`,
			projectedId: `acme.test.language.${contribution.id}`,
			contribution,
			contract: {} as never,
		}
	}

	test("maps all fields correctly", () => {
		const reg = toMonacoLanguageRegistration(makeProjectedLanguage(LANGUAGE_SOL))
		expect(reg.id).toBe("solidity")
		expect(reg.aliases).toEqual(["Solidity", "sol"])
		expect(reg.extensions).toEqual([".sol"])
		expect(reg.filenames).toBeUndefined() // empty array → omitted
	})

	test("omits aliases, extensions, filenames when empty", () => {
		const reg = toMonacoLanguageRegistration(
			makeProjectedLanguage({ id: "bare", aliases: [], extensions: [], filenames: [] }),
		)
		expect(reg.aliases).toBeUndefined()
		expect(reg.extensions).toBeUndefined()
		expect(reg.filenames).toBeUndefined()
	})

	test("includes filenames when non-empty", () => {
		const reg = toMonacoLanguageRegistration(
			makeProjectedLanguage({
				id: "make",
				aliases: [],
				extensions: [],
				filenames: ["Makefile", "makefile"],
			}),
		)
		expect(reg.filenames).toEqual(["Makefile", "makefile"])
	})
})

// ---------------------------------------------------------------------------
// toMonacoGrammarRegistration
// ---------------------------------------------------------------------------

describe("toMonacoGrammarRegistration", () => {
	function makeProjectedGrammar(contribution: PluginDescriptor["grammars"][number]): ProjectedGrammar {
		return {
			family: "grammars",
			pluginId: "acme.test",
			contributionId: `grammar.${contribution.scopeName}`,
			projectedId: `acme.test.grammar.${contribution.scopeName}`,
			contribution,
			contract: {} as never,
		}
	}

	test("maps scopeName, language, path, embeddedLanguages", () => {
		const reg = toMonacoGrammarRegistration(makeProjectedGrammar(GRAMMAR_GQL))
		expect(reg.scopeName).toBe("source.graphql")
		expect(reg.language).toBeUndefined()
		expect(reg.path).toBe("./syntaxes/gql.tmLanguage.json")
		expect(reg.embeddedLanguages).toEqual({ "meta.embedded.block.js": "javascript" })
	})

	test("sets language when present", () => {
		const reg = toMonacoGrammarRegistration(makeProjectedGrammar(GRAMMAR_SOL))
		expect(reg.language).toBe("solidity")
		expect(reg.embeddedLanguages).toBeUndefined()
	})

	test("embeddedLanguages is a copy, not the original reference", () => {
		const grammar = { ...GRAMMAR_GQL }
		const projected = makeProjectedGrammar(grammar)
		const reg = toMonacoGrammarRegistration(projected)
		// mutating the registration should not affect the original
		;(reg.embeddedLanguages as Record<string, string>)["new.key"] = "rust"
		expect(projected.contribution.embeddedLanguages?.["new.key"]).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// snippetEntryToCompletionItem
// ---------------------------------------------------------------------------

describe("snippetEntryToCompletionItem", () => {
	test("converts a single-line body", () => {
		const item = snippetEntryToCompletionItem("Console log", {
			prefix: "clog",
			body: "console.log($1)",
			description: "Log to console",
		})
		expect(item.label).toBe("clog")
		expect(item.kind).toBe(28) // CompletionItemKind.Snippet
		expect(item.insertText).toBe("console.log($1)")
		expect(item.insertTextRules).toBe(4) // InsertAsSnippet
		expect(item.detail).toBe("Console log")
		expect(item.documentation).toBe("Log to console")
		expect(item.range).toBe("auto")
	})

	test("joins multi-line body arrays with newlines", () => {
		const item = snippetEntryToCompletionItem("For loop", {
			prefix: "for",
			body: ["for (let i = 0; i < $1; i++) {", "\t$0", "}"],
		})
		expect(item.insertText).toBe("for (let i = 0; i < $1; i++) {\n\t$0\n}")
	})

	test("sets documentation to undefined when not provided", () => {
		const item = snippetEntryToCompletionItem("Arrow fn", { prefix: "af", body: "($1) => $0" })
		expect(item.documentation).toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// createSnippetCompletionProviders
// ---------------------------------------------------------------------------

describe("createSnippetCompletionProviders", () => {
	function makeResolvedSnippet(
		pluginId: string,
		language: string,
		body: Record<string, { prefix: string; body: string; description?: string }>,
	): ResolvedSnippet {
		const projected: ProjectedSnippet = {
			family: "snippets",
			pluginId,
			contributionId: `snippet.${language}.0`,
			projectedId: `${pluginId}.snippet.${language}.0`,
			contribution: { language, path: "./snippets.json" },
			contract: {} as never,
		}
		return { projected, body }
	}

	test("returns empty array for no resolved snippets", () => {
		expect(createSnippetCompletionProviders([])).toEqual([])
	})

	test("creates one provider per language id", () => {
		const resolved = [
			makeResolvedSnippet("acme.alpha", "typescript", {
				"Console log": { prefix: "clog", body: "console.log($1)" },
			}),
			makeResolvedSnippet("acme.alpha", "python", {
				Print: { prefix: "p", body: "print($1)" },
			}),
		]
		const providers = createSnippetCompletionProviders(resolved)
		expect(providers).toHaveLength(2)
		const langIds = providers.map((p) => p.languageId).sort()
		expect(langIds).toEqual(["python", "typescript"])
	})

	test("merges items from multiple plugins for the same language", () => {
		const resolved = [
			makeResolvedSnippet("acme.alpha", "typescript", {
				"Log": { prefix: "clog", body: "console.log($1)" },
			}),
			makeResolvedSnippet("acme.beta", "typescript", {
				"Warn": { prefix: "cwarn", body: "console.warn($1)" },
			}),
		]
		const providers = createSnippetCompletionProviders(resolved)
		expect(providers).toHaveLength(1)
		expect(providers[0]!.items).toHaveLength(2)
	})

	test("each item has correct kind and insertTextRules sentinels", () => {
		const resolved = [
			makeResolvedSnippet("acme.test", "rust", {
				"Fn": { prefix: "fn", body: "fn $1() {\n\t$0\n}" },
			}),
		]
		const providers = createSnippetCompletionProviders(resolved)
		const item = providers[0]!.items[0]!
		expect(item.kind).toBe(28)
		expect(item.insertTextRules).toBe(4)
		expect(item.range).toBe("auto")
	})
})

// ---------------------------------------------------------------------------
// toIconThemeResolverEntries
// ---------------------------------------------------------------------------

describe("toIconThemeResolverEntries", () => {
	function makeProjectedIconTheme(
		pluginId: string,
		contribution: PluginDescriptor["iconThemes"][number],
	): ProjectedIconTheme {
		return {
			family: "iconThemes",
			pluginId,
			contributionId: contribution.id,
			projectedId: `${pluginId}.${contribution.id}`,
			contribution,
			contract: {} as never,
		}
	}

	test("returns empty array for no icon themes", () => {
		expect(toIconThemeResolverEntries([])).toEqual([])
	})

	test("maps to resolver entry fields correctly", () => {
		const projected = makeProjectedIconTheme("acme.test", ICON_THEME_MATERIAL)
		const entries = toIconThemeResolverEntries([projected])
		expect(entries).toHaveLength(1)
		const entry = entries[0]!
		expect(entry.projectedId).toBe("acme.test.material")
		expect(entry.label).toBe("Material Icon Theme")
		expect(entry.relativePath).toBe("./material-icons.json")
		expect(entry.pluginId).toBe("acme.test")
	})

	test("handles multiple icon themes from different plugins", () => {
		const p1 = makeProjectedIconTheme("acme.alpha", { id: "dark", label: "Dark Icons", path: "./dark.json" })
		const p2 = makeProjectedIconTheme("acme.beta", { id: "light", label: "Light Icons", path: "./light.json" })
		const entries = toIconThemeResolverEntries([p1, p2])
		expect(entries).toHaveLength(2)
		expect(entries[0]!.pluginId).toBe("acme.alpha")
		expect(entries[1]!.pluginId).toBe("acme.beta")
	})
})

// ---------------------------------------------------------------------------
// registerDataContributionsWithMonaco (integration)
// ---------------------------------------------------------------------------

describe("registerDataContributionsWithMonaco", () => {
	function makeMonacoLanguages(existingIds: string[] = []) {
		const registered: Array<{ id: string }> = []
		return {
			register: mock((lang: { id: string }) => { registered.push(lang) }),
			getLanguages: () => existingIds.map((id) => ({ id })),
			_registered: registered,
		}
	}

	function makeProjection(overrides: Partial<DataContributionsProjection> = {}): DataContributionsProjection {
		return {
			snippets: [],
			languages: [],
			grammars: [],
			iconThemes: [],
			...overrides,
		}
	}

	test("calls monacoLanguages.register for each new language", () => {
		const desc = makeDescriptor({ languages: [LANGUAGE_SOL, LANGUAGE_GQL] })
		const projection = projectDataContributionsFromCatalog([desc])
		const monacoLanguages = makeMonacoLanguages()

		registerDataContributionsWithMonaco(projection, monacoLanguages)

		expect(monacoLanguages.register).toHaveBeenCalledTimes(2)
		const registeredIds = monacoLanguages._registered.map((l) => l.id)
		expect(registeredIds).toContain("solidity")
		expect(registeredIds).toContain("graphql")
	})

	test("skips languages already known to Monaco", () => {
		const desc = makeDescriptor({ languages: [LANGUAGE_SOL, LANGUAGE_GQL] })
		const projection = projectDataContributionsFromCatalog([desc])
		const monacoLanguages = makeMonacoLanguages(["solidity"])

		registerDataContributionsWithMonaco(projection, monacoLanguages)

		// only graphql should be newly registered
		expect(monacoLanguages.register).toHaveBeenCalledTimes(1)
		expect(monacoLanguages._registered[0]?.id).toBe("graphql")
	})

	test("calls registerGrammar callback for each grammar", () => {
		const desc = makeDescriptor({ grammars: [GRAMMAR_SOL, GRAMMAR_GQL] })
		const projection = projectDataContributionsFromCatalog([desc])
		const grammarCalls: string[] = []

		registerDataContributionsWithMonaco(projection, makeMonacoLanguages(), {
			registerGrammar: (reg) => grammarCalls.push(reg.scopeName),
		})

		expect(grammarCalls).toEqual(["source.solidity", "source.graphql"])
	})

	test("does not call registerGrammar when no callback supplied", () => {
		const desc = makeDescriptor({ grammars: [GRAMMAR_SOL] })
		const projection = projectDataContributionsFromCatalog([desc])
		// should not throw even without the callback
		expect(() =>
			registerDataContributionsWithMonaco(projection, makeMonacoLanguages()),
		).not.toThrow()
	})

	test("calls registerSnippetProvider when resolvedSnippets and callback are provided", () => {
		const desc = makeDescriptor({ snippets: [SNIPPET_A] })
		const projection = projectDataContributionsFromCatalog([desc])
		const resolvedSnippets: ResolvedSnippet[] = [
			{
				projected: projection.snippets[0]!,
				body: { "Log": { prefix: "clog", body: "console.log($1)" } },
			},
		]
		const providers: MonacoSnippetCompletionProvider[] = []

		registerDataContributionsWithMonaco(projection, makeMonacoLanguages(), {
			resolvedSnippets,
			registerSnippetProvider: (p) => providers.push(p),
		})

		expect(providers).toHaveLength(1)
		expect(providers[0]!.languageId).toBe("typescript")
		expect(providers[0]!.items).toHaveLength(1)
	})

	test("skips snippet registration when no resolvedSnippets provided", () => {
		const desc = makeDescriptor({ snippets: [SNIPPET_A] })
		const projection = projectDataContributionsFromCatalog([desc])
		const providers: MonacoSnippetCompletionProvider[] = []

		registerDataContributionsWithMonaco(projection, makeMonacoLanguages(), {
			registerSnippetProvider: (p) => providers.push(p),
			// no resolvedSnippets
		})

		expect(providers).toHaveLength(0)
	})

	test("calls registerIconThemeEntry for each icon theme", () => {
		const desc = makeDescriptor({ iconThemes: [ICON_THEME_MATERIAL] })
		const projection = projectDataContributionsFromCatalog([desc])
		const iconThemeEntries: string[] = []

		registerDataContributionsWithMonaco(projection, makeMonacoLanguages(), {
			registerIconThemeEntry: (entry) => iconThemeEntries.push(entry.projectedId),
		})

		expect(iconThemeEntries).toEqual(["acme.test.material"])
	})

	test("works with empty projection and no callbacks", () => {
		const projection = makeProjection()
		expect(() =>
			registerDataContributionsWithMonaco(projection, makeMonacoLanguages()),
		).not.toThrow()
	})

	test("all four callback paths fire independently in a single call", () => {
		const desc = makeDescriptor({
			snippets: [SNIPPET_A],
			languages: [LANGUAGE_SOL],
			grammars: [GRAMMAR_SOL],
			iconThemes: [ICON_THEME_MATERIAL],
		})
		const projection = projectDataContributionsFromCatalog([desc])
		const resolvedSnippets: ResolvedSnippet[] = [
			{
				projected: projection.snippets[0]!,
				body: { "Log": { prefix: "clog", body: "console.log($1)" } },
			},
		]

		const grammarCalls: string[] = []
		const snippetProviders: string[] = []
		const iconThemeEntries: string[] = []
		const monacoLanguages = makeMonacoLanguages()

		registerDataContributionsWithMonaco(projection, monacoLanguages, {
			registerGrammar: (reg) => grammarCalls.push(reg.scopeName),
			resolvedSnippets,
			registerSnippetProvider: (p) => snippetProviders.push(p.languageId),
			registerIconThemeEntry: (entry) => iconThemeEntries.push(entry.projectedId),
		})

		expect(monacoLanguages.register).toHaveBeenCalledTimes(1)
		expect(grammarCalls).toEqual(["source.solidity"])
		expect(snippetProviders).toEqual(["typescript"])
		expect(iconThemeEntries).toEqual(["acme.test.material"])
	})
})
