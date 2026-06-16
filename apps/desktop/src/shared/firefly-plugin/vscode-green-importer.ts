/**
 * Firefly Plugin System V2 — Green-Tier VS Code Runtime Importer (§14 P4)
 *
 * Converts a green-classified VS Code / Open VSX extension package.json into
 * a partial Firefly V2 manifest. Only three contribution families are in scope
 * for the green tier:
 *
 *   - `commands`      — VS Code `contributes.commands` → V2 command contributions
 *   - `configuration` — VS Code `contributes.configuration` → V2 settings schema
 *     (stored as free-form metadata; Firefly has no configuration contribution
 *      family yet — this lands in `tags` until the family is defined)
 *   - `languages`     — VS Code `contributes.languages` → V2 language metadata
 *     (stored as tags/metadata; Firefly uses this for grammar registration)
 *
 * Architecture constraints (load-bearing per V2 plan §14 P4):
 *
 *   1. TRANSPILE ONLY. The importer converts package.json metadata into a
 *      V2 manifest fragment. It never executes extension code.
 *   2. vscode.d.ts is COMPILE-TIME semantic input only. We use it as the
 *      type contract for what each VS Code contribution means. It is never
 *      imported, shimmed, or shipped at runtime.
 *   3. Unsupported APIs rejected at import. Any non-green API usage causes
 *      `importGreenTierVscodeExtension` to throw `VscodeProbeRejectedError`
 *      before any manifest fragment is emitted. There is no partial-load.
 *   4. No runtime shim. No hidden VS Code sidecar.
 *      `runtimeShim: false`, `hiddenSidecar: false` are asserted on every
 *      result (mirroring `VSCODE_IMPORT_STANCE`).
 *
 * Output type: a `GreenTierImportResult` that callers merge into the broader
 * V2 manifest. The caller (install pipeline, catalog loader) owns the final
 * `PluginManifest` assembly; this module emits only the converted slice.
 */

import { z } from "zod"
import {
	assertGreenProbe,
	classifyFromProbe,
	type VscodeCompatibilityProbe,
	VscodeProbeRejectedError,
} from "./vscode-probe"

// ---------------------------------------------------------------------------
// Input: VS Code package.json shape (green-tier subset)
// ---------------------------------------------------------------------------

/**
 * A single VS Code command contribution from `contributes.commands`.
 * Matches the VS Code package.json contribution schema for commands.
 */
const vscodeCommandContributionSchema = z
	.object({
		command: z.string().min(1).max(200),
		title: z.string().min(1).max(200),
		category: z.string().max(80).optional(),
		icon: z.string().max(200).optional(),
	})
	.strip() // tolerate extra VS Code fields we don't use

export type VscodeCommandContribution = z.infer<typeof vscodeCommandContributionSchema>

/**
 * A single VS Code language contribution from `contributes.languages`.
 */
const vscodeLanguageContributionSchema = z
	.object({
		id: z.string().min(1).max(80),
		aliases: z.array(z.string().min(1).max(80)).optional(),
		extensions: z.array(z.string().min(1).max(40)).optional(),
		filenames: z.array(z.string().min(1).max(200)).optional(),
		mimetypes: z.array(z.string().min(1).max(100)).optional(),
		firstLine: z.string().max(200).optional(),
		configuration: z.string().max(400).optional(), // path to language config JSON
	})
	.strip()

export type VscodeLanguageContribution = z.infer<typeof vscodeLanguageContributionSchema>

/**
 * Minimal VS Code `package.json` input shape for the green-tier importer.
 * Only the fields the importer consumes are declared; extras are stripped.
 */
const vscodePackageJsonSchema = z
	.object({
		name: z.string().min(1).max(200),
		displayName: z.string().min(1).max(200).optional(),
		publisher: z.string().min(1).max(200).optional(),
		version: z.string().min(1).max(80),
		description: z.string().max(800).optional(),
		license: z.string().max(80).optional(),
		homepage: z.string().url().max(400).optional(),
		contributes: z
			.object({
				commands: z.array(vscodeCommandContributionSchema).optional(),
				configuration: z.unknown().optional(), // retained as opaque metadata
				languages: z.array(vscodeLanguageContributionSchema).optional(),
			})
			.strip()
			.optional(),
		activationEvents: z.array(z.string().min(1).max(200)).optional(),
	})
	.strip()

export type VscodePackageJson = z.infer<typeof vscodePackageJsonSchema>

// ---------------------------------------------------------------------------
// Output: imported V2 manifest fragment
// ---------------------------------------------------------------------------

/**
 * A V2 command contribution produced by the green-tier importer.
 * Mirrors the shape of `CommandContribution` in `manifest.ts` but is kept
 * intentionally minimal — the catalog loader merges this into the full
 * manifest and fills in defaults.
 */
export interface ImportedCommandContribution {
	/** Firefly projected command id: `<publisher>.<name>.<command>` (sanitized). */
	id: string
	title: string
	category?: string | undefined
}

/**
 * A V2 language metadata entry produced by the green-tier importer.
 * Used by the Monaco grammar-registration projection.
 */
export interface ImportedLanguageMetadata {
	id: string
	aliases: string[]
	extensions: string[]
	filenames: string[]
	mimetypes: string[]
	firstLine?: string | undefined
	configurationPath?: string | undefined
}

/**
 * Result of `importGreenTierVscodeExtension`. The caller merges this into
 * the full V2 manifest being assembled for the extension.
 *
 * Invariants enforced on every result:
 *   - `runtimeShim` is `false` (never ship a VS Code runtime)
 *   - `hiddenSidecar` is `false` (never ship a hidden VS Code sidecar)
 *   - `transpileOnly` is `true` (only manifest metadata is converted)
 *   - `sourcePackageJson` is the normalized, stripped input (not raw bytes)
 */
export interface GreenTierImportResult {
	/** Normalized Firefly plugin id derived from `publisher.name`. */
	pluginId: string
	/** Extension's own version, preserved verbatim. */
	version: string
	/** Human-readable display name. */
	displayName: string
	/** Converted command contributions. */
	commands: ImportedCommandContribution[]
	/** Converted language metadata. */
	languages: ImportedLanguageMetadata[]
	/**
	 * Configuration contribution retained as opaque metadata. Firefly does
	 * not yet have a `configuration` family; this is stored for future use.
	 * Callers MUST NOT interpret or execute this as VS Code settings.
	 */
	configurationMetadataRaw: unknown | null
	/** Import stance invariants — always these exact values. */
	runtimeShim: false
	hiddenSidecar: false
	transpileOnly: true
	/** The normalized (stripped) package.json used as input. */
	sourcePackageJson: VscodePackageJson
}

// ---------------------------------------------------------------------------
// ID sanitization helpers
// ---------------------------------------------------------------------------

/**
 * Produce a Firefly-safe command id from a VS Code command token.
 * VS Code commands are dot-separated (e.g. `editor.action.formatDocument`);
 * Firefly ids must be alphanumeric+dash, start with a letter. We replace
 * dots and underscores with dashes and strip anything else.
 */
function sanitizeCommandId(vscodeCommandToken: string): string {
	return vscodeCommandToken
		.replace(/[._]/g, "-")
		.replace(/[^a-zA-Z0-9-]/g, "")
		.replace(/^-+/, "")
		.replace(/-+/g, "-")
		.slice(0, 64)
}

/**
 * Derive a Firefly plugin id from publisher + extension name.
 * Format: `<publisher-safe>.<name-safe>` (lowercase, dot-separated).
 * Falls back to `imported.<name-safe>` when publisher is absent.
 */
function derivePluginId(packageJson: VscodePackageJson): string {
	const nameSafe = packageJson.name
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)

	if (packageJson.publisher) {
		const publisherSafe = packageJson.publisher
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40)
		return `${publisherSafe}.${nameSafe}`
	}

	return `imported.${nameSafe}`
}

// ---------------------------------------------------------------------------
// Green-tier importer
// ---------------------------------------------------------------------------

/**
 * Convert a VS Code extension's `package.json` into a Firefly V2 manifest
 * fragment — but ONLY when the `VscodeCompatibilityProbe` for that extension
 * classifies as green.
 *
 * Rejection policy (fail-fast, no partial-load):
 *   - Non-green probe → throws `VscodeProbeRejectedError` immediately.
 *   - Malformed `packageJson` input → throws `ZodError`.
 *   - Missing translation for any contribution → that family is silently
 *     dropped (only commands/configuration/languages are in scope for P4);
 *     other families (themes, grammars) have their own importers.
 *
 * The importer NEVER:
 *   - Loads or executes extension code.
 *   - Imports `vscode` at runtime.
 *   - Ships a hidden VS Code sidecar.
 *   - Emits a partial result for a red/orange/yellow probe.
 *
 * @throws `VscodeProbeRejectedError` when `probe` is not green-tier.
 * @throws `z.ZodError` when `packageJsonRaw` fails schema validation.
 */
export function importGreenTierVscodeExtension(
	probe: VscodeCompatibilityProbe,
	packageJsonRaw: unknown,
): GreenTierImportResult {
	// Step 1: Classify probe — reject immediately if not green.
	// This is the gating check; we do not proceed to parse package.json
	// when the probe fails. Fail-fast: typed error, never a partial result.
	assertGreenProbe(probe)

	// Step 2: Parse and normalize the package.json input.
	const packageJson = vscodePackageJsonSchema.parse(packageJsonRaw)

	// Step 3: Convert contributions — green families only.
	const commands = convertCommands(packageJson)
	const languages = convertLanguages(packageJson)
	const configurationMetadataRaw = packageJson.contributes?.configuration ?? null

	return {
		pluginId: derivePluginId(packageJson),
		version: packageJson.version,
		displayName: packageJson.displayName ?? packageJson.name,
		commands,
		languages,
		configurationMetadataRaw,
		runtimeShim: false,
		hiddenSidecar: false,
		transpileOnly: true,
		sourcePackageJson: packageJson,
	}
}

/**
 * Like `importGreenTierVscodeExtension` but returns a structured result
 * instead of throwing. Callers that want to surface UI-level errors without
 * a try/catch use this variant.
 */
export type GreenTierImportOutcome =
	| { ok: true; result: GreenTierImportResult }
	| { ok: false; error: "probe-rejected"; verdict: ReturnType<typeof classifyFromProbe>; message: string }
	| { ok: false; error: "parse-error"; message: string }

export function tryImportGreenTierVscodeExtension(
	probe: VscodeCompatibilityProbe,
	packageJsonRaw: unknown,
): GreenTierImportOutcome {
	try {
		const result = importGreenTierVscodeExtension(probe, packageJsonRaw)
		return { ok: true, result }
	} catch (err) {
		if (err instanceof VscodeProbeRejectedError) {
			return {
				ok: false,
				error: "probe-rejected",
				verdict: err.verdict,
				message: err.message,
			}
		}
		if (err instanceof z.ZodError) {
			return {
				ok: false,
				error: "parse-error",
				message: `package.json validation failed: ${err.issues.map((i) => i.message).join("; ")}`,
			}
		}
		return {
			ok: false,
			error: "parse-error",
			message: err instanceof Error ? err.message : String(err),
		}
	}
}

// ---------------------------------------------------------------------------
// Contribution converters (green-tier families only)
// ---------------------------------------------------------------------------

function convertCommands(packageJson: VscodePackageJson): ImportedCommandContribution[] {
	const rawCommands = packageJson.contributes?.commands ?? []
	return rawCommands.map((cmd) => ({
		id: sanitizeCommandId(cmd.command),
		title: cmd.title,
		...(cmd.category !== undefined ? { category: cmd.category } : {}),
	}))
}

function convertLanguages(packageJson: VscodePackageJson): ImportedLanguageMetadata[] {
	const rawLanguages = packageJson.contributes?.languages ?? []
	return rawLanguages.map((lang) => ({
		id: lang.id,
		aliases: lang.aliases ?? [],
		extensions: lang.extensions ?? [],
		filenames: lang.filenames ?? [],
		mimetypes: lang.mimetypes ?? [],
		...(lang.firstLine !== undefined ? { firstLine: lang.firstLine } : {}),
		...(lang.configuration !== undefined ? { configurationPath: lang.configuration } : {}),
	}))
}
