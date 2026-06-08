/**
 * Firefly Plugin System V2 — VS Code import classifier + transpile-only architecture
 *
 * Encodes the V2 plan's stance on importing VS Code / Open VSX
 * extensions as Firefly plugins. The stance is intentionally
 * narrow:
 *
 *   1. The import is CLASSIFIER + TRANSPILE-ONLY. The runtime never
 *      loads a vscode shim, never embeds the VS Code runtime, and
 *      never ships a hidden sidecar.
 *   2. `vscode.d.ts` is the **semantic contract** for what VS Code
 *      APIs the importer will translate. We never execute the
 *      importer's output under the VS Code API; we re-emit it as a
 *      V2 manifest.
 *   3. Each extension is given a feasibility tier (GREEN / YELLOW /
 *      ORANGE / RED). The catalog loader rejects RED at load and
 *      gates YELLOW/ORANGE behind explicit operator consent.
 *   4. There is no runtime fallback path for VS Code API calls.
 *      The importer is best-effort: a missing translation yields a
 *      rejected manifest, never a partial-load.
 */

import { z } from "zod"

/**
 * The locked feasibility tier vocabulary. The V2 plan requires all
 * four tiers; new tiers must append rather than rename.
 */
export const VSCODE_IMPORT_FEASIBILITY_TIERS = [
	"green",
	"yellow",
	"orange",
	"red",
] as const
export type VscodeImportFeasibilityTier = (typeof VSCODE_IMPORT_FEASIBILITY_TIERS)[number]

export const vscodeImportFeasibilityTierSchema = z.enum(VSCODE_IMPORT_FEASIBILITY_TIERS)

/**
 * The criteria that move a VS Code / Open VSX extension between
 * tiers. Each row is locked; the importer consults the table to
 * assign a tier and emit a structured `rejectionReasons` array.
 */
export interface VscodeImportTierCriterion {
	readonly criterion: string
	readonly green: string
	readonly yellow: string
	readonly orange: string
	readonly red: string
}

export const VSCODE_IMPORT_TIER_CRITERIA: readonly VscodeImportTierCriterion[] = [
	{
		criterion: "VS Code API surface used",
		green: "Only `vscode.window`, `vscode.workspace`, `vscode.commands` (read-only).",
		yellow: "Adds `vscode.window.showInputBox` / `vscode.window.showQuickPick` (UI prompts).",
		orange: "Adds `vscode.window.createWebviewPanel` (webview) or `vscode.languages.registerHoverProvider` (editor decoration).",
		red: "Uses `vscode.debug`, `vscode.tasks`, or `vscode.env.openExternal` without a Firefly-specific capability replacement.",
	},
	{
		criterion: "Native dependencies declared in package.json",
		green: "Zero native dependencies.",
		yellow: "Optional native dependencies that the extension gates behind a `when` clause.",
		orange: "Native dependencies required for the activation path; would need a Firefly shim.",
		red: "Native dependencies required AND the extension refuses to degrade gracefully without them.",
	},
	{
		criterion: "Tree-shake-friendly main entry",
		green: "Pure ESM/CJS entry; extension is small (<200KB after tree-shake).",
		yellow: "Bundle is mid-size (<1MB) but the entry side-effect-free.",
		orange: "Bundle is >1MB or the entry has side effects on import.",
		red: "Entry side-effectfully writes to the host filesystem at activation time.",
	},
	{
		criterion: "State persistence",
		green: "Uses `context.globalState` / `context.workspaceState` (translatable to V2 storage scopes).",
		yellow: "Uses `globalState` AND has explicit migration logic in the activate() path.",
		orange: "Uses `globalState` AND `secrets`; needs a Firefly secrets capability replacement.",
		red: "Persists state outside `globalState` / `secrets` (writes to disk via `fs` directly).",
	},
	{
		criterion: "Activation event shape",
		green: "Pure `onLanguage:...` / `onCommand:...` / `*` (translatable to V2 activation events).",
		yellow: "Adds `workspaceContains:` / `onView:` (translatable with operator consent).",
		orange: "Adds `onFileSystem:` or `onCustomEditor:`; needs capability broker sign-off.",
		red: "Uses `*` activation AND is not side-effect-free in activate(); cannot gate.",
	},
]

/**
 * A single rejection reason the importer records on a non-GREEN
 * extension. Surfaced in the operator UI so the user knows WHY an
 * extension landed where it did.
 */
export const vscodeImportRejectionReasonSchema = z
	.object({
		criterion: z.string().min(1).max(200),
		observed: z.string().min(1).max(400),
		tier: vscodeImportFeasibilityTierSchema,
		mitigation: z.string().min(1).max(400),
	})
	.strict()
export type VscodeImportRejectionReason = z.infer<typeof vscodeImportRejectionReasonSchema>

/**
 * The result of a feasibility classification. The catalog loader
 * reads the tier and decides whether to load (green), gate
 * (yellow/orange), or reject (red).
 */
export const vscodeImportFeasibilitySchema = z
	.object({
		tier: vscodeImportFeasibilityTierSchema,
		rejectionReasons: z.array(vscodeImportRejectionReasonSchema).readonly(),
		transpileOnly: z.literal(true),
		runtimeShim: z.literal(false),
		hiddenSidecar: z.literal(false),
	})
	.strict()
export type VscodeImportFeasibility = z.infer<typeof vscodeImportFeasibilitySchema>

/**
 * The locked V2 stance on VS Code import. This object is what the
 * plan says about the architecture: classifier + transpile only, no
 * runtime shim, no hidden VS Code sidecar. The runtime consults
 * the object to surface a "How does VS Code import work?" card in
 * the operator UI.
 */
export const VSCODE_IMPORT_STANCE = {
	architecture: "classifier + transpile-only" as const,
	runtimeShim: false as const,
	hiddenSidecar: false as const,
	transpileContract: "vscode.d.ts" as const,
	transpileTarget: "firefly.plugin/v2 manifest" as const,
	notes: [
		"VS Code extensions are imported as V2 manifest contributions, not as runtime extensions.",
		"The importer uses vscode.d.ts as a type-only semantic contract; no VS Code runtime is loaded.",
		"Plugins asking for a runtime shim, hidden sidecar, or VS Code API runtime are rejected at the classifier boundary.",
		"There is no partial-load: a missing translation yields a rejected manifest, never a half loaded extension.",
	],
} as const

/**
 * Build a feasibility verdict from a set of criterion observations.
 * Pure & deterministic; the catalog loader consults the result to
 * decide green / yellow / orange / red.
 */
export function classifyFeasibility(input: {
	observations: { criterion: string; observed: string; tier: VscodeImportFeasibilityTier }[]
}): VscodeImportFeasibility {
	const tierOrder: Record<VscodeImportFeasibilityTier, number> = {
		green: 0,
		yellow: 1,
		orange: 2,
		red: 3,
	}
	let worst: VscodeImportFeasibilityTier = "green"
	for (const obs of input.observations) {
		if (tierOrder[obs.tier] > tierOrder[worst]) worst = obs.tier
	}
	const rejectionReasons: VscodeImportRejectionReason[] = input.observations
		.filter((obs) => obs.tier !== "green")
		.map((obs) => {
			const criterionRow = VSCODE_IMPORT_TIER_CRITERIA.find((c) => c.criterion === obs.criterion)
			return {
				criterion: obs.criterion,
				observed: obs.observed,
				tier: obs.tier,
				mitigation: criterionRow?.[obs.tier] ?? "no mitigation defined",
			}
		})
	return {
		tier: worst,
		rejectionReasons,
		transpileOnly: true,
		runtimeShim: false,
		hiddenSidecar: false,
	}
}

/**
 * Sample feasibility verdicts for the locked import stance. The
 * matrix covers one of each tier so tests can lock the locked
 * shape; runtime code that needs to import a real extension calls
 * `classifyFeasibility` directly with the appropriate observations.
 */
export const SAMPLE_VSCODE_IMPORT_VERDICTS = {
	green: classifyFeasibility({ observations: [] }),
	yellow: classifyFeasibility({
		observations: [
			{
				criterion: "Native dependencies declared in package.json",
				observed: "One optional native dep gated behind a `when` clause.",
				tier: "yellow",
			},
		],
	}),
	orange: classifyFeasibility({
		observations: [
			{
				criterion: "VS Code API surface used",
				observed: "Uses vscode.window.createWebviewPanel for an editor surface.",
				tier: "orange",
			},
		],
	}),
	red: classifyFeasibility({
		observations: [
			{
				criterion: "Native dependencies declared in package.json",
				observed: "Requires a native module; refuses to degrade gracefully without it.",
				tier: "red",
			},
		],
	}),
} as const satisfies Readonly<Record<VscodeImportFeasibilityTier, VscodeImportFeasibility>>

/**
 * Convenience: was the verdict accepted by the catalog loader? A
 * verdict is accepted when its tier is `green`; yellow/orange are
 * gated; red is rejected outright.
 */
export function isVerdictAccepted(verdict: VscodeImportFeasibility): boolean {
	return verdict.tier === "green"
}
