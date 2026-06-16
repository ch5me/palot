/**
 * Firefly Plugin System V2 — VS Code Compatibility Probe (§5.3)
 *
 * `VscodeCompatibilityProbe` is the structured input the importer uses to
 * classify a VS Code / Open VSX extension before converting it. It maps
 * directly to the fields the spec names in §5.3 and drives the
 * green/yellow/orange/red tier decision via the existing `classifyFeasibility`
 * function in `vscode-import.ts`.
 *
 * Design constraints (load-bearing, per V2 plan §14 P4):
 *
 *   - `vscode.d.ts` is consumed at compile time only — as the type-level
 *     semantic contract that tells the importer what each API token means.
 *     It is never loaded, shimmed, or shipped as a runtime dependency.
 *   - The probe itself is pure data derived from the extension's
 *     `package.json`. No VS Code runtime is invoked to build it.
 *   - `extensionKind` maps directly to the host's surface model:
 *       "web"       -> portable tier  (web-worker / data-only)
 *       "workspace" -> Node tier      (electron-utility / cloud-host)
 *       "ui"        -> renderer-side  (iframe / declarative)
 *   - A probe that does not satisfy the green-tier criteria is rejected
 *     at the importer boundary; there is no partial-load fallback.
 */

import { z } from "zod"
import {
	classifyFeasibility,
	type VscodeImportFeasibility,
	type VscodeImportFeasibilityTier,
	type VscodeImportRejectionReason,
} from "./vscode-import"

// ---------------------------------------------------------------------------
// Green-tier API allowlist
//
// The ONLY VS Code API namespaces the green-tier importer translates.
// Anything outside this set is UNSUPPORTED and drives an orange/red tier.
// Keys are lowercased dotted namespace paths as they appear in `package.json`
// `extensionDependencies` / static analysis outputs. This is the authoritative
// surface the transpile step may emit; all other tokens are rejected at import.
// ---------------------------------------------------------------------------

export const GREEN_TIER_VSCODE_API_NAMESPACES = [
	"vscode.commands",
	"vscode.window",          // read-only surface only (no webview, no createTerminal)
	"vscode.workspace",       // read-only: onDidChangeConfiguration, getConfiguration
	"vscode.languages",       // metadata queries only (getLanguages, match)
] as const

export type GreenTierVscodeApiNamespace = (typeof GREEN_TIER_VSCODE_API_NAMESPACES)[number]

/** API tokens within `vscode.window` that are GREEN (read-only / benign). */
export const GREEN_TIER_WINDOW_TOKENS = [
	"vscode.window.showInformationMessage",
	"vscode.window.showWarningMessage",
	"vscode.window.showErrorMessage",
	"vscode.window.setStatusBarMessage",
	"vscode.window.activeTextEditor",
	"vscode.window.visibleTextEditors",
	"vscode.window.onDidChangeActiveTextEditor",
] as const

/** API tokens that are YELLOW (require operator gate, not automatically rejected). */
export const YELLOW_TIER_WINDOW_TOKENS = [
	"vscode.window.showInputBox",
	"vscode.window.showQuickPick",
	"vscode.window.showOpenDialog",
	"vscode.window.showSaveDialog",
] as const

/** API tokens that are ORANGE (need capability-broker sign-off). */
export const ORANGE_TIER_TOKENS = [
	"vscode.window.createWebviewPanel",
	"vscode.window.createTerminal",
	"vscode.languages.registerHoverProvider",
	"vscode.languages.registerCompletionItemProvider",
	"vscode.languages.registerDefinitionProvider",
] as const

/** API tokens that are unconditionally RED — no Firefly capability replaces them. */
export const RED_TIER_TOKENS = [
	"vscode.debug",
	"vscode.tasks",
	"vscode.env.openExternal",
	"vscode.env.shell",
	"vscode.env.clipboard",    // needs a Firefly clipboard capability; none exists yet
] as const

// ---------------------------------------------------------------------------
// VscodeCompatibilityProbe — the §5.3 named input type
// ---------------------------------------------------------------------------

export const vscodeDependencyRiskSchema = z.enum(["none", "optional", "required"])
export type VscodeDependencyRisk = z.infer<typeof vscodeDependencyRiskSchema>

export const vscodeExtensionKindSchema = z.enum(["ui", "workspace", "web"])
export type VscodeExtensionKind = z.infer<typeof vscodeExtensionKindSchema>

/**
 * Structured input derived from a VS Code / Open VSX package.json.
 * The importer builds this from the package manifest; it is never
 * derived from runtime introspection or VS Code process state.
 *
 * Field semantics:
 *
 *   vscodeEngineRange     - the `engines.vscode` semver range from package.json.
 *                           Treated as an import input, NOT a Firefly claim (§5.3).
 *   extensionKind         - the `extensionKind` array from package.json.
 *                           Maps to host surfaces: "web" = portable,
 *                           "workspace" = Node, "ui" = renderer-side.
 *   activationEvents      - the `activationEvents` array from package.json.
 *   contributionPoints    - top-level keys of `contributes` in package.json
 *                           (e.g. "commands", "configuration", "languages").
 *   apiUsage              - dotted API token strings the importer detected via
 *                           static analysis or package.json metadata. Must not
 *                           require running the extension to populate.
 *   nativeDependencyRisk  - whether the extension requires native modules.
 */
export const vscodeCompatibilityProbeSchema = z
	.object({
		vscodeEngineRange: z.string().min(1).max(80),
		extensionKind: z.array(vscodeExtensionKindSchema).min(1),
		activationEvents: z.array(z.string().min(1).max(200)),
		contributionPoints: z.array(z.string().min(1).max(80)),
		apiUsage: z.array(z.string().min(1).max(200)),
		nativeDependencyRisk: vscodeDependencyRiskSchema,
	})
	.strict()

export type VscodeCompatibilityProbe = z.infer<typeof vscodeCompatibilityProbeSchema>

// ---------------------------------------------------------------------------
// Probe → observations → classification
// ---------------------------------------------------------------------------

/** A single observation the probe derives before passing to `classifyFeasibility`. */
export interface ProbeObservation {
	criterion: string
	observed: string
	tier: VscodeImportFeasibilityTier
}

/**
 * Classify the API-usage dimension of the probe.
 *
 * Rules (strict precedence — worst tier wins within each token):
 *   - Any RED_TIER_TOKENS hit → red
 *   - Any ORANGE_TIER_TOKENS hit → orange
 *   - Any YELLOW_TIER_WINDOW_TOKENS hit → yellow
 *   - Otherwise → green
 *
 * Returns null when the API surface is cleanly green (no observation needed).
 */
function classifyApiUsage(apiUsage: string[]): ProbeObservation | null {
	const redHits = apiUsage.filter((t) =>
		(RED_TIER_TOKENS as readonly string[]).some((r) => t === r || t.startsWith(r + ".")),
	)
	if (redHits.length > 0) {
		return {
			criterion: "VS Code API surface used",
			observed: `Uses unsupported red-tier APIs: ${redHits.slice(0, 3).join(", ")}${redHits.length > 3 ? " (and more)" : ""}.`,
			tier: "red",
		}
	}

	const orangeHits = apiUsage.filter((t) =>
		(ORANGE_TIER_TOKENS as readonly string[]).some((r) => t === r || t.startsWith(r + ".")),
	)
	if (orangeHits.length > 0) {
		return {
			criterion: "VS Code API surface used",
			observed: `Uses orange-tier APIs requiring capability broker sign-off: ${orangeHits.slice(0, 3).join(", ")}.`,
			tier: "orange",
		}
	}

	const yellowHits = apiUsage.filter((t) =>
		(YELLOW_TIER_WINDOW_TOKENS as readonly string[]).some((r) => t === r || t.startsWith(r + ".")),
	)
	if (yellowHits.length > 0) {
		return {
			criterion: "VS Code API surface used",
			observed: `Uses yellow-tier UI-prompt APIs: ${yellowHits.slice(0, 3).join(", ")}.`,
			tier: "yellow",
		}
	}

	return null
}

/**
 * Classify the native-dependency dimension of the probe.
 * Returns null for `none` (fully green — no observation needed).
 */
function classifyNativeDeps(risk: VscodeDependencyRisk): ProbeObservation | null {
	if (risk === "none") return null
	if (risk === "optional") {
		return {
			criterion: "Native dependencies declared in package.json",
			observed: "Optional native dependencies gated behind a when clause.",
			tier: "yellow",
		}
	}
	return {
		criterion: "Native dependencies declared in package.json",
		observed: "Required native dependencies; would need a Firefly shim or must be absent.",
		tier: "red",
	}
}

/**
 * Classify the activation-event dimension of the probe.
 * Returns null when all events are green-tier.
 */
function classifyActivationEvents(events: string[]): ProbeObservation | null {
	const redEvents = events.filter(
		(e) => e.startsWith("*") && events.length > 1,
	)
	// `*` alone is green (VS Code standard catch-all); combined with others is a smell
	const customEditorOrFilesystem = events.filter(
		(e) => e.startsWith("onCustomEditor:") || e.startsWith("onFileSystem:"),
	)
	if (customEditorOrFilesystem.length > 0) {
		return {
			criterion: "Activation event shape",
			observed: `Uses orange-tier activation events: ${customEditorOrFilesystem.slice(0, 2).join(", ")}.`,
			tier: "orange",
		}
	}

	const yellowEvents = events.filter(
		(e) => e.startsWith("workspaceContains:") || e.startsWith("onView:"),
	)
	if (yellowEvents.length > 0) {
		return {
			criterion: "Activation event shape",
			observed: `Uses yellow-tier activation events requiring operator consent: ${yellowEvents.slice(0, 2).join(", ")}.`,
			tier: "yellow",
		}
	}

	if (redEvents.length > 0) {
		return {
			criterion: "Activation event shape",
			observed: "Uses `*` activation alongside other events — cannot guarantee side-effect-free activate().",
			tier: "red",
		}
	}

	return null
}

/**
 * Classify the `extensionKind` array against Firefly's surface model.
 *
 * `workspace`-only extensions require Node (electron-utility / cloud-host).
 * On the web build they are unsupported unless `webStrategy: "cloud-host"` is
 * present. This function emits a yellow observation so the catalog loader can
 * gate workspace extensions when running in the web build.
 */
function classifyExtensionKind(extensionKind: VscodeExtensionKind[]): ProbeObservation | null {
	const needsNode = extensionKind.includes("workspace") && !extensionKind.includes("web")
	if (needsNode) {
		return {
			criterion: "Activation event shape",
			observed:
				'extensionKind is "workspace"-only: requires Node runtime. Runs on electron-utility or cloud-host; unsupported in the web build without cloud-host.',
			tier: "yellow",
		}
	}
	return null
}

/**
 * Convert a `VscodeCompatibilityProbe` into the flat observation array that
 * `classifyFeasibility` consumes. Pure and deterministic.
 */
export function probeToObservations(probe: VscodeCompatibilityProbe): ProbeObservation[] {
	const observations: ProbeObservation[] = []

	const apiObs = classifyApiUsage(probe.apiUsage)
	if (apiObs) observations.push(apiObs)

	const nativeObs = classifyNativeDeps(probe.nativeDependencyRisk)
	if (nativeObs) observations.push(nativeObs)

	const activationObs = classifyActivationEvents(probe.activationEvents)
	if (activationObs) observations.push(activationObs)

	const kindObs = classifyExtensionKind(probe.extensionKind)
	if (kindObs) observations.push(kindObs)

	return observations
}

/**
 * Classify a `VscodeCompatibilityProbe` into a full `VscodeImportFeasibility`
 * verdict. Convenience wrapper over `probeToObservations` + `classifyFeasibility`.
 */
export function classifyFromProbe(probe: VscodeCompatibilityProbe): VscodeImportFeasibility {
	return classifyFeasibility({ observations: probeToObservations(probe) })
}

// ---------------------------------------------------------------------------
// Rejection error (fail-fast; no partial-load)
// ---------------------------------------------------------------------------

/**
 * Thrown by `assertGreenProbe` when a probe is not green-tier.
 * Contains the full verdict so the caller can surface rejection reasons.
 */
export class VscodeProbeRejectedError extends Error {
	readonly verdict: VscodeImportFeasibility

	constructor(verdict: VscodeImportFeasibility, reasons?: VscodeImportRejectionReason[]) {
		const reasonSummary = (reasons ?? verdict.rejectionReasons)
			.map((r) => `[${r.tier}] ${r.criterion}: ${r.observed}`)
			.join("; ")
		super(
			`VS Code extension rejected at import boundary (tier=${verdict.tier}): ${reasonSummary || "unknown reason"}`,
		)
		this.name = "VscodeProbeRejectedError"
		this.verdict = verdict
	}
}

/**
 * Assert that a probe is green-tier. Throws `VscodeProbeRejectedError` for
 * any non-green result. Use this at the catalog-loader / importer boundary to
 * enforce the "no partial-load" rule: a missing translation yields a rejected
 * import, never a half-loaded extension.
 */
export function assertGreenProbe(probe: VscodeCompatibilityProbe): void {
	const verdict = classifyFromProbe(probe)
	if (verdict.tier !== "green") {
		throw new VscodeProbeRejectedError(verdict)
	}
}
