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
 * TODO (Phase 2 follow-up):
 *   - Wire `projectDataContributionsFromCatalog` into the catalog broadcast
 *     flow alongside the existing renderer families.
 *   - Implement `registerDataContributionsWithMonaco` in the renderer's
 *     Monaco init path (blocked on Monaco API research for TextMate grammar
 *     injection — `monaco-editor` v0.x does not expose `registerTextMateGrammar`
 *     natively; VSCode's Monaco fork adds it separately).
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
// Monaco registration entry points
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
 * Monaco grammar registration shape.
 * Note: standard `monaco-editor` does not expose TextMate grammar injection
 * natively. This type targets the `monaco-textmate` / `vscode-textmate`
 * integration layer. Pass the registration to your Monaco TextMate setup.
 *
 * TODO: integrate with the Monaco TextMate setup in renderer/lib/monaco.ts
 * once the Monaco TextMate layer is added.
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

/**
 * Register language metadata and grammars from a catalog projection with Monaco.
 *
 * This is the entry point the renderer should call during Monaco init
 * (after `initMonaco()` in `renderer/lib/monaco.ts`) to register any
 * language contributions from the installed plugin catalog.
 *
 * Grammar registration requires a TextMate integration layer (not
 * included in base `monaco-editor`); the `registerGrammar` callback
 * lets callers wire their own TextMate setup.
 *
 * @param projection       Result of `projectDataContributionsFromCatalog`.
 * @param monacoLanguages  The `monaco.languages` namespace (avoids a static
 *                         import of monaco-editor in this shared module).
 * @param registerGrammar  Optional callback for grammar registration; called
 *                         once per grammar with the registration shape.
 *
 * TODO: call from renderer/lib/monaco.ts once catalog projection is wired
 * into the renderer (Phase 2 follow-up ticket).
 */
export function registerDataContributionsWithMonaco(
	projection: DataContributionsProjection,
	monacoLanguages: {
		register(language: MonacoLanguageRegistration): void
		getLanguages(): Array<{ id: string }>
	},
	registerGrammar?: (registration: MonacoGrammarRegistration) => void,
): void {
	// Register language metadata
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

	// Snippets and icon themes are not registered with Monaco directly;
	// snippet registration is done via the snippet completion provider, and
	// icon themes via the file-icon resolver. Both are caller responsibilities.
}
