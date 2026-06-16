/**
 * Firefly Plugin System V2 — VS Code data-contribution converter (Phase 2)
 *
 * Converts VS Code / Open VSX `package.json` `contributes.{snippets,languages,
 * grammars,iconThemes}` into their Firefly V2 manifest family shapes.
 *
 * Design stance (mirrors vscode-theme-import.ts):
 *   - Data-only. No code runs; no runtime shim. All four families have
 *     `hostKind = "data-only"` per the §6 table.
 *   - Purely functional. Callers supply raw package.json content; this
 *     module never touches the filesystem.
 *   - Zod-validated inputs and outputs. Unknown fields are stripped.
 *   - Fails loud: a bad input throws a `z.ZodError`; no silent partial
 *     conversion (CH5 fail-fast).
 *
 * Architecture note on paths:
 *   All `path` fields in the output are relative paths from the
 *   package root, exactly as they appear in `package.json`. Callers
 *   (package store / install pipeline) resolve them against the
 *   unpacked VSIX root.
 *
 * See the design doc §6 (data-only families) and §14 (Phase 2).
 */

import { z } from "zod"

import type {
	GrammarContribution,
	IconThemeContribution,
	LanguageContribution,
	SnippetContribution,
} from "./manifest"

// ---------------------------------------------------------------------------
// VS Code package.json input shapes for the data families
// ---------------------------------------------------------------------------

/**
 * A single snippet declaration from `contributes.snippets`.
 */
export const vscodeSnippetDeclarationSchema = z
	.object({
		language: z.string().min(1).max(80),
		path: z.string().min(1).max(400),
	})
	.strip()

export type VscodeSnippetDeclaration = z.infer<typeof vscodeSnippetDeclarationSchema>

/**
 * A single language declaration from `contributes.languages`.
 * Only the fields that map to V2 `LanguageContribution` are kept.
 */
export const vscodeLanguageDeclarationSchema = z
	.object({
		id: z.string().min(1).max(80),
		aliases: z.array(z.string().min(1).max(80)).optional(),
		extensions: z.array(z.string().min(1).max(40)).optional(),
		filenames: z.array(z.string().min(1).max(120)).optional(),
		configuration: z.string().min(1).max(400).optional(),
	})
	.strip()

export type VscodeLanguageDeclaration = z.infer<typeof vscodeLanguageDeclarationSchema>

/**
 * A single grammar declaration from `contributes.grammars`.
 */
export const vscodeGrammarDeclarationSchema = z
	.object({
		language: z.string().min(1).max(80).optional(),
		scopeName: z.string().min(1).max(120),
		path: z.string().min(1).max(400),
		embeddedLanguages: z.record(z.string(), z.string()).optional(),
	})
	.strip()

export type VscodeGrammarDeclaration = z.infer<typeof vscodeGrammarDeclarationSchema>

/**
 * A single icon theme declaration from `contributes.iconThemes`.
 * VS Code requires `id`, `label`, and `path`.
 */
export const vscodeIconThemeDeclarationSchema = z
	.object({
		id: z.string().min(1).max(64),
		label: z.string().min(1).max(80),
		path: z.string().min(1).max(400),
	})
	.strip()

export type VscodeIconThemeDeclaration = z.infer<typeof vscodeIconThemeDeclarationSchema>

/**
 * Minimal VS Code `package.json` shape for the data-contribution importer.
 * Any combination of the four data families is accepted; all are optional
 * so callers can pass a package.json that only has grammars, etc.
 */
export const vscodeDataContributionsPackageJsonSchema = z
	.object({
		name: z.string().min(1).max(200),
		displayName: z.string().min(1).max(200).optional(),
		publisher: z.string().min(1).max(200).optional(),
		version: z.string().min(1).max(80),
		description: z.string().max(800).optional(),
		license: z.string().max(80).optional(),
		contributes: z
			.object({
				snippets: z.array(vscodeSnippetDeclarationSchema).optional(),
				languages: z.array(vscodeLanguageDeclarationSchema).optional(),
				grammars: z.array(vscodeGrammarDeclarationSchema).optional(),
				iconThemes: z.array(vscodeIconThemeDeclarationSchema).optional(),
			})
			.strip()
			.optional(),
	})
	.strip()

export type VscodeDataContributionsPackageJson = z.infer<typeof vscodeDataContributionsPackageJsonSchema>

// ---------------------------------------------------------------------------
// Per-family converters
// ---------------------------------------------------------------------------

/**
 * Convert a single VS Code snippet declaration to a V2 `SnippetContribution`.
 * The mapping is 1:1 — snippet contributions carry only `language` + `path`.
 */
export function convertVscodeSnippet(decl: VscodeSnippetDeclaration): SnippetContribution {
	return {
		language: decl.language,
		path: decl.path,
	}
}

/**
 * Convert a single VS Code language declaration to a V2 `LanguageContribution`.
 * Optional array fields default to empty arrays when absent in the source.
 */
export function convertVscodeLanguage(decl: VscodeLanguageDeclaration): LanguageContribution {
	return {
		id: decl.id,
		aliases: decl.aliases ?? [],
		extensions: decl.extensions ?? [],
		filenames: decl.filenames ?? [],
		configuration: decl.configuration,
	}
}

/**
 * Convert a single VS Code grammar declaration to a V2 `GrammarContribution`.
 */
export function convertVscodeGrammar(decl: VscodeGrammarDeclaration): GrammarContribution {
	return {
		language: decl.language,
		scopeName: decl.scopeName,
		path: decl.path,
		embeddedLanguages: decl.embeddedLanguages,
	}
}

/**
 * Convert a single VS Code icon-theme declaration to a V2 `IconThemeContribution`.
 *
 * VS Code `id` fields in `contributes.iconThemes` are free-form strings;
 * the V2 `shortIdSchema` requires `[a-zA-Z][a-zA-Z0-9-]*`. This converter
 * sanitizes the id using `deriveIconThemeShortId`.
 */
export function convertVscodeIconTheme(decl: VscodeIconThemeDeclaration): IconThemeContribution {
	return {
		id: deriveIconThemeShortId(decl.id),
		label: decl.label,
		path: decl.path,
	}
}

// ---------------------------------------------------------------------------
// ID sanitization
// ---------------------------------------------------------------------------

/**
 * Derive a Firefly-safe short id from a VS Code icon-theme id or label.
 * Firefly short ids must be `[a-zA-Z][a-zA-Z0-9-]*` (max 64 chars).
 */
export function deriveIconThemeShortId(raw: string): string {
	return (
		raw
			.replace(/[^a-zA-Z0-9-]/g, "-")
			.replace(/^[-0-9]+/, "")
			.replace(/-{2,}/g, "-")
			.replace(/-+$/g, "")
			.slice(0, 64) || "icon-theme"
	)
}

// ---------------------------------------------------------------------------
// Batch converter: all data families from one package.json
// ---------------------------------------------------------------------------

/**
 * The result of converting all data-only contributions from a single
 * VS Code package.
 */
export interface VscodeDataContributionsConversionResult {
	snippets: SnippetContribution[]
	languages: LanguageContribution[]
	grammars: GrammarContribution[]
	iconThemes: IconThemeContribution[]
	/** Publisher + version from the package.json for provenance tracking. */
	publisher: string | null
	version: string
}

/**
 * Parse + validate a raw `package.json` payload, then convert every
 * data-family contribution (`snippets`, `languages`, `grammars`,
 * `iconThemes`) to their V2 forms.
 *
 * Families absent from `contributes` produce empty arrays in the result.
 * This lets callers always destructure the four arrays without checking.
 *
 * @throws `z.ZodError` when `packageJsonRaw` fails schema validation.
 */
export function convertVscodeDataContributions(
	packageJsonRaw: unknown,
): VscodeDataContributionsConversionResult {
	const pkg = vscodeDataContributionsPackageJsonSchema.parse(packageJsonRaw)
	const contributes = pkg.contributes ?? {}

	return {
		snippets: (contributes.snippets ?? []).map((raw) =>
			convertVscodeSnippet(vscodeSnippetDeclarationSchema.parse(raw)),
		),
		languages: (contributes.languages ?? []).map((raw) =>
			convertVscodeLanguage(vscodeLanguageDeclarationSchema.parse(raw)),
		),
		grammars: (contributes.grammars ?? []).map((raw) =>
			convertVscodeGrammar(vscodeGrammarDeclarationSchema.parse(raw)),
		),
		iconThemes: (contributes.iconThemes ?? []).map((raw) =>
			convertVscodeIconTheme(vscodeIconThemeDeclarationSchema.parse(raw)),
		),
		publisher: pkg.publisher ?? null,
		version: pkg.version,
	}
}
