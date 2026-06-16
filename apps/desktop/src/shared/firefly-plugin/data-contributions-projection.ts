/**
 * Firefly Plugin System V2 — Data-contribution projection (Phase 2)
 *
 * Projects the four data-only contribution families (snippets, languages,
 * grammars, iconThemes) from the plugin catalog into flat, host-consumable
 * lists. These are the lists the host (Electron main process or firefly-cloud)
 * feeds into Monaco and the file-icon resolver.
 *
 * Design rules:
 *   - Data-only, deterministic, no side effects. Callers own the
 *     Monaco/filesystem registration; this module produces the data to
 *     register.
 *   - Mirrors the pattern of `projectThemesFromCatalog` in
 *     `renderer-projection.ts`: takes a `readonly PluginDescriptor[]` and
 *     returns typed projection objects.
 *   - All four families share the same projection shape envelope
 *     (pluginId, contributionId, projectedId, the contribution data,
 *     and the family contract). Callers can iterate uniformly over any
 *     of the four projection lists.
 *   - Monaco registration entry points are typed here but not executed —
 *     the actual `monaco.languages.register(...)` etc. calls live in the
 *     renderer's Monaco setup (currently `renderer/lib/monaco.ts`) or in
 *     the host-side projection consumer. The entry point types are provided
 *     so those callers have a clear, stable API surface to call against.
 *
 * TextMate grammar note:
 *   Standard `monaco-editor` (v0.x) does not expose TextMate grammar injection
 *   natively. `vscode-textmate` + `vscode-oniguruma` are NOT currently
 *   installed. Grammar registrations therefore pass through the typed
 *   `registerGrammar` callback so callers can wire their own TextMate
 *   integration layer (e.g. `monaco-textmate`) when those deps are added.
 *   Until then, callers may ignore the callback or use it to drive Monarch
 *   tokenizer registration. See `MonacoGrammarRegistration` for the shape.
 *
 * Snippet completion provider note:
 *   Snippet file bodies are JSON on disk and cannot be loaded in this
 *   shared module. Callers supply a `SnippetBodyLoader` that maps a
 *   (pluginId, path) pair to a parsed `SnippetFileBody`. The
 *   `createSnippetCompletionProvider` factory converts those bodies into
 *   a Monaco-compatible `CompletionItemProvider` shape. Callers then call
 *   `monaco.languages.registerCompletionItemProvider(languageId, provider)`.
 *
 * Wiring TODO (Phase 2 follow-up):
 *   - Wire `projectDataContributionsFromCatalog` into the catalog broadcast
 *     flow alongside the existing renderer families.
 *   - Call `registerDataContributionsWithMonaco` from `renderer/lib/monaco.ts`
 *     once catalog projection is wired into the renderer.
 *   - Add `vscode-textmate` + `vscode-oniguruma` to deps and implement a
 *     concrete `registerGrammar` callback that loads grammar JSON and calls
 *     the TextMate registry. Until then the grammar registration shape is
 *     fully typed and ready for wiring.
 */

import type { PluginDescriptor } from "./descriptor"
import {
	GRAMMAR_CONTRACT,
	ICON_THEME_CONTRACT,
	LANGUAGE_CONTRACT,
	SNIPPET_CONTRACT,
	type ContributionFamilyContract,
} from "./family-contracts"
import type {
	GrammarContribution,
	IconThemeContribution,
	LanguageContribution,
	SnippetContribution,
} from "./manifest"

// ---------------------------------------------------------------------------
// Projected types (data-contribution projection envelope)
// ---------------------------------------------------------------------------

/**
 * A snippet registration entry projected from a plugin catalog.
 */
export interface ProjectedSnippet {
	readonly family: "snippets"
	readonly pluginId: string
	readonly contributionId: string
	/** Globally unique projected id: `<pluginId>.snippet.<language>.<index>`. */
	readonly projectedId: string
	readonly contribution: SnippetContribution
	readonly contract: ContributionFamilyContract
}

/**
 * A language metadata entry projected from a plugin catalog.
 */
export interface ProjectedLanguage {
	readonly family: "languages"
	readonly pluginId: string
	readonly contributionId: string
	/** Globally unique projected id: `<pluginId>.language.<languageId>`. */
	readonly projectedId: string
	readonly contribution: LanguageContribution
	readonly contract: ContributionFamilyContract
}

/**
 * A TextMate grammar entry projected from a plugin catalog.
 */
export interface ProjectedGrammar {
	readonly family: "grammars"
	readonly pluginId: string
	readonly contributionId: string
	/** Globally unique projected id: `<pluginId>.grammar.<scopeName>`. */
	readonly projectedId: string
	readonly contribution: GrammarContribution
	readonly contract: ContributionFamilyContract
}

/**
 * An icon-theme entry projected from a plugin catalog.
 */
export interface ProjectedIconTheme {
	readonly family: "iconThemes"
	readonly pluginId: string
	readonly contributionId: string
	/** Globally unique projected id: `<pluginId>.<iconThemeId>`. */
	readonly projectedId: string
	readonly contribution: IconThemeContribution
	readonly contract: ContributionFamilyContract
}

// ---------------------------------------------------------------------------
// Projection helpers
// ---------------------------------------------------------------------------

/**
 * Project all snippet contributions from a single descriptor.
 * Each snippet gets a stable `projectedId` keyed on plugin + language + index.
 */
export function projectSnippets(descriptor: PluginDescriptor): readonly ProjectedSnippet[] {
	return descriptor.snippets.map((snippet, index) => ({
		family: "snippets",
		pluginId: descriptor.normalizedId,
		contributionId: `snippet.${snippet.language}.${index}`,
		projectedId: `${descriptor.normalizedId}.snippet.${snippet.language}.${index}`,
		contribution: snippet,
		contract: SNIPPET_CONTRACT,
	}))
}

/**
 * Project all language contributions from a single descriptor.
 */
export function projectLanguages(descriptor: PluginDescriptor): readonly ProjectedLanguage[] {
	return descriptor.languages.map((language) => ({
		family: "languages",
		pluginId: descriptor.normalizedId,
		contributionId: `language.${language.id}`,
		projectedId: `${descriptor.normalizedId}.language.${language.id}`,
		contribution: language,
		contract: LANGUAGE_CONTRACT,
	}))
}

/**
 * Project all grammar contributions from a single descriptor.
 */
export function projectGrammars(descriptor: PluginDescriptor): readonly ProjectedGrammar[] {
	return descriptor.grammars.map((grammar) => ({
		family: "grammars",
		pluginId: descriptor.normalizedId,
		contributionId: `grammar.${grammar.scopeName}`,
		projectedId: `${descriptor.normalizedId}.grammar.${grammar.scopeName}`,
		contribution: grammar,
		contract: GRAMMAR_CONTRACT,
	}))
}

/**
 * Project all icon-theme contributions from a single descriptor.
 */
export function projectIconThemes(descriptor: PluginDescriptor): readonly ProjectedIconTheme[] {
	return descriptor.iconThemes.map((iconTheme) => ({
		family: "iconThemes",
		pluginId: descriptor.normalizedId,
		contributionId: iconTheme.id,
		projectedId: `${descriptor.normalizedId}.${iconTheme.id}`,
		contribution: iconTheme,
		contract: ICON_THEME_CONTRACT,
	}))
}

// ---------------------------------------------------------------------------
// Catalog-level projectors
// ---------------------------------------------------------------------------

export interface DataContributionsProjection {
	readonly snippets: readonly ProjectedSnippet[]
	readonly languages: readonly ProjectedLanguage[]
	readonly grammars: readonly ProjectedGrammar[]
	readonly iconThemes: readonly ProjectedIconTheme[]
}

/**
 * Project all four data-contribution families from a full plugin catalog.
 *
 * Only descriptors with non-empty contributions are included; plugins that
 * declare none of the four families produce nothing (consistent with the
 * renderer projection pattern).
 *
 * The result is a stable, immutable snapshot suitable for broadcast to
 * renderer and host-side consumers.
 */
export function projectDataContributionsFromCatalog(
	descriptors: readonly PluginDescriptor[],
): DataContributionsProjection {
	const snippets = descriptors.flatMap(projectSnippets)
	const languages = descriptors.flatMap(projectLanguages)
	const grammars = descriptors.flatMap(projectGrammars)
	const iconThemes = descriptors.flatMap(projectIconThemes)
	return { snippets, languages, grammars, iconThemes }
}

// ---------------------------------------------------------------------------
// Monaco language registration
// ---------------------------------------------------------------------------

/**
 * Monaco language registration shape.
 * Matches `monaco.languages.ILanguageExtensionPoint`.
 */
export interface MonacoLanguageRegistration {
	id: string
	aliases?: string[]
	extensions?: string[]
	filenames?: string[]
}

/**
 * Derive a Monaco language registration from a `ProjectedLanguage`.
 * The host resolves the language configuration path separately.
 */
export function toMonacoLanguageRegistration(projected: ProjectedLanguage): MonacoLanguageRegistration {
	return {
		id: projected.contribution.id,
		aliases: projected.contribution.aliases.length > 0 ? [...projected.contribution.aliases] : undefined,
		extensions: projected.contribution.extensions.length > 0 ? [...projected.contribution.extensions] : undefined,
		filenames: projected.contribution.filenames.length > 0 ? [...projected.contribution.filenames] : undefined,
	}
}

// ---------------------------------------------------------------------------
// Monaco grammar registration
// ---------------------------------------------------------------------------

/**
 * Monaco grammar registration shape.
 *
 * Standard `monaco-editor` does not expose TextMate grammar injection
 * natively. This type targets the `monaco-textmate` / `vscode-textmate`
 * integration layer. Pass the registration to your Monaco TextMate setup.
 *
 * **Dep gap:** `vscode-textmate` + `vscode-oniguruma` are not yet installed.
 * Add them and wire a concrete `registerGrammar` callback in
 * `renderer/lib/monaco.ts` to complete the grammar pipeline. The registration
 * shape here is stable and ready.
 *
 * Typical caller pattern (once deps are added):
 * ```ts
 * import { Registry } from "vscode-textmate"
 * import { loadWASM } from "vscode-oniguruma"
 *
 * // ... set up registry ...
 * registerDataContributionsWithMonaco(projection, monaco.languages, (reg) => {
 *   registry.addGrammar({
 *     scopeName: reg.scopeName,
 *     path: reg.path,          // resolve against package root
 *     language: reg.language,
 *     embeddedLanguages: reg.embeddedLanguages,
 *   })
 * })
 * ```
 */
export interface MonacoGrammarRegistration {
	/** TextMate scope name, e.g. "source.ts". */
	scopeName: string
	/** Language id to associate the grammar with, if any. */
	language?: string
	/** Path to the grammar JSON/PLIST relative to the plugin package root. */
	path: string
	embeddedLanguages?: Record<string, string>
}

/**
 * Derive a Monaco grammar registration from a `ProjectedGrammar`.
 */
export function toMonacoGrammarRegistration(projected: ProjectedGrammar): MonacoGrammarRegistration {
	return {
		scopeName: projected.contribution.scopeName,
		language: projected.contribution.language,
		path: projected.contribution.path,
		embeddedLanguages: projected.contribution.embeddedLanguages
			? { ...projected.contribution.embeddedLanguages }
			: undefined,
	}
}

// ---------------------------------------------------------------------------
// Snippet completion provider
// ---------------------------------------------------------------------------

/**
 * A single snippet entry as stored in a VS Code / Firefly snippet JSON file.
 * See https://code.visualstudio.com/docs/editor/userdefinedsnippets for the
 * full format. Body is a string (single-line) or string array (multi-line).
 */
export interface SnippetEntry {
	readonly prefix: string
	readonly body: string | readonly string[]
	readonly description?: string
}

/**
 * The parsed contents of a snippet JSON file.
 * Keys are snippet names (human-readable, not necessarily the prefix).
 */
export type SnippetFileBody = Record<string, SnippetEntry>

/**
 * A resolved snippet: the projected snippet + the loaded body, ready for
 * registration with Monaco.
 *
 * Callers produce these by loading the snippet file from the package store
 * and pairing it with the `ProjectedSnippet`.
 */
export interface ResolvedSnippet {
	readonly projected: ProjectedSnippet
	readonly body: SnippetFileBody
}

/**
 * A Monaco-compatible completion item shape for a single snippet entry.
 * This mirrors `monaco.languages.CompletionItem` without importing monaco
 * into this shared module.
 *
 * Kind 28 = `CompletionItemKind.Snippet`.
 * insertTextRules 4 = `CompletionItemInsertTextRule.InsertAsSnippet`.
 */
export interface MonacoSnippetCompletionItem {
	readonly label: string
	readonly kind: 28
	readonly insertText: string
	readonly insertTextRules: 4
	readonly detail?: string
	readonly documentation?: string
	readonly range: "auto"
}

/**
 * A Monaco-compatible completion provider shape.
 *
 * `range: "auto"` is a sentinel telling the actual Monaco integration to
 * supply the word range at call time. Callers must replace it with the
 * real `IRange` before passing to Monaco's `CompletionList`.
 *
 * Usage (once wired in renderer/lib/monaco.ts):
 * ```ts
 * const providers = createSnippetCompletionProviders(resolvedSnippets)
 * for (const [languageId, provider] of providers) {
 *   monaco.languages.registerCompletionItemProvider(languageId, {
 *     provideCompletionItems(model, position) {
 *       const word = model.getWordUntilPosition(position)
 *       const range = {
 *         startLineNumber: position.lineNumber,
 *         endLineNumber: position.lineNumber,
 *         startColumn: word.startColumn,
 *         endColumn: word.endColumn,
 *       }
 *       return {
 *         suggestions: provider.items.map((item) => ({ ...item, range })),
 *       }
 *     },
 *   })
 * }
 * ```
 */
export interface MonacoSnippetCompletionProvider {
	readonly languageId: string
	readonly items: readonly MonacoSnippetCompletionItem[]
}

/**
 * Convert a `SnippetEntry` to a `MonacoSnippetCompletionItem`.
 * Body arrays are joined with newlines (VS Code multi-line snippet format).
 */
export function snippetEntryToCompletionItem(
	name: string,
	entry: SnippetEntry,
): MonacoSnippetCompletionItem {
	const insertText = Array.isArray(entry.body) ? entry.body.join("\n") : entry.body
	return {
		label: entry.prefix,
		kind: 28,
		insertText: insertText as string,
		insertTextRules: 4,
		detail: name,
		documentation: entry.description,
		range: "auto",
	}
}

/**
 * Build Monaco snippet completion providers from a list of resolved snippets.
 *
 * Returns one provider per language id, merging items from all plugins that
 * contribute snippets for the same language. The provider shape is
 * registration-ready; callers supply the actual `monaco.languages.register*`
 * call (which cannot be invoked in this shared module).
 */
export function createSnippetCompletionProviders(
	resolvedSnippets: readonly ResolvedSnippet[],
): readonly MonacoSnippetCompletionProvider[] {
	const byLanguage = new Map<string, MonacoSnippetCompletionItem[]>()

	for (const { projected, body } of resolvedSnippets) {
		const languageId = projected.contribution.language
		if (!byLanguage.has(languageId)) {
			byLanguage.set(languageId, [])
		}
		const items = byLanguage.get(languageId)!
		for (const [name, entry] of Object.entries(body)) {
			items.push(snippetEntryToCompletionItem(name, entry))
		}
	}

	return Array.from(byLanguage.entries()).map(([languageId, items]) => ({
		languageId,
		items,
	}))
}

// ---------------------------------------------------------------------------
// Icon-theme resolver entry
// ---------------------------------------------------------------------------

/**
 * An icon-theme resolver entry projected from the catalog.
 *
 * The host's file-icon resolver iterates these entries to build the
 * icon-theme catalog. `resolvedPath` must be an absolute path supplied by
 * the caller (this module only knows the relative path inside the package).
 *
 * Usage (once wired in host):
 * ```ts
 * const entries = toIconThemeResolverEntries(projection.iconThemes, resolvePackagePath)
 * iconThemeRegistry.register(entries)
 * ```
 */
export interface IconThemeResolverEntry {
	/** Globally unique projected id (from `ProjectedIconTheme.projectedId`). */
	readonly projectedId: string
	/** Human-readable label from the contribution. */
	readonly label: string
	/** Package-relative path to the icon theme JSON file. */
	readonly relativePath: string
	/** The originating plugin id. */
	readonly pluginId: string
}

/**
 * Convert a list of projected icon themes to resolver entries.
 * The `relativePath` field preserves the package-relative path from the
 * manifest; callers must resolve it against the installed package root to
 * get an absolute path before loading the icon theme JSON.
 */
export function toIconThemeResolverEntries(
	projectedIconThemes: readonly ProjectedIconTheme[],
): readonly IconThemeResolverEntry[] {
	return projectedIconThemes.map((projected) => ({
		projectedId: projected.projectedId,
		label: projected.contribution.label,
		relativePath: projected.contribution.path,
		pluginId: projected.pluginId,
	}))
}

// ---------------------------------------------------------------------------
// Unified Monaco registration entry point
// ---------------------------------------------------------------------------

/**
 * Register language metadata, grammars, snippet completion providers, and
 * icon-theme resolver entries from a catalog projection with Monaco.
 *
 * This is the entry point the renderer should call during Monaco init
 * (after `initMonaco()` in `renderer/lib/monaco.ts`) to register any
 * language contributions from the installed plugin catalog.
 *
 * **Grammar registration** requires a TextMate integration layer (not
 * included in base `monaco-editor`). The `registerGrammar` callback
 * lets callers wire their own TextMate setup. Until `vscode-textmate` +
 * `vscode-oniguruma` are installed, pass `undefined` or leave it out.
 *
 * **Snippet registration** requires resolved snippet bodies (the actual
 * JSON file contents). The `registerSnippetProvider` callback receives
 * one `MonacoSnippetCompletionProvider` per language id. Callers call
 * `monaco.languages.registerCompletionItemProvider` for each.
 *
 * **Icon theme registration** uses the `registerIconThemeEntry` callback;
 * callers wire this into the host's file-icon resolver.
 *
 * @param projection             Result of `projectDataContributionsFromCatalog`.
 * @param monacoLanguages        The `monaco.languages` namespace (avoids a
 *                               static import of monaco-editor in this shared
 *                               module).
 * @param opts.registerGrammar   Optional callback per grammar registration.
 * @param opts.resolvedSnippets  Pre-loaded snippet file bodies (caller
 *                               resolves paths + loads JSON from the package
 *                               store before calling here).
 * @param opts.registerSnippetProvider  Optional callback per language's
 *                               snippet completion provider.
 * @param opts.registerIconThemeEntry   Optional callback per icon theme entry.
 *
 * Wiring TODO: call from renderer/lib/monaco.ts once catalog projection is
 * wired into the renderer (Phase 2 follow-up).
 */
export interface RegisterDataContributionsOpts {
	/** Called once per grammar; use to wire a TextMate registry. */
	registerGrammar?: (registration: MonacoGrammarRegistration) => void
	/** Pre-loaded snippet bodies keyed by projected snippet id. */
	resolvedSnippets?: readonly ResolvedSnippet[]
	/** Called once per language that has snippet contributions. */
	registerSnippetProvider?: (provider: MonacoSnippetCompletionProvider) => void
	/** Called once per icon theme entry. */
	registerIconThemeEntry?: (entry: IconThemeResolverEntry) => void
}

export function registerDataContributionsWithMonaco(
	projection: DataContributionsProjection,
	monacoLanguages: {
		register(language: MonacoLanguageRegistration): void
		getLanguages(): Array<{ id: string }>
	},
	opts: RegisterDataContributionsOpts = {},
): void {
	const { registerGrammar, resolvedSnippets, registerSnippetProvider, registerIconThemeEntry } = opts

	// Register language metadata (skip duplicates already known to Monaco)
	const existingIds = new Set(monacoLanguages.getLanguages().map((l) => l.id))
	for (const projected of projection.languages) {
		if (!existingIds.has(projected.contribution.id)) {
			monacoLanguages.register(toMonacoLanguageRegistration(projected))
		}
	}

	// Register grammars (requires caller to supply a TextMate integration)
	if (registerGrammar) {
		for (const projected of projection.grammars) {
			registerGrammar(toMonacoGrammarRegistration(projected))
		}
	}

	// Register snippet completion providers when resolved bodies are available
	if (resolvedSnippets && resolvedSnippets.length > 0 && registerSnippetProvider) {
		const providers = createSnippetCompletionProviders(resolvedSnippets)
		for (const provider of providers) {
			registerSnippetProvider(provider)
		}
	}

	// Register icon theme resolver entries
	if (registerIconThemeEntry && projection.iconThemes.length > 0) {
		const entries = toIconThemeResolverEntries(projection.iconThemes)
		for (const entry of entries) {
			registerIconThemeEntry(entry)
		}
	}
}
