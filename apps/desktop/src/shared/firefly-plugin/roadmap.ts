/**
 * Firefly Plugin System V2 — Release plan and milestone roadmap
 *
 * The two key early milestones are:
 *   M1. Source-of-truth manifest model is locked in source
 *   M2. First vertical slice (first-party panel through V2 catalog)
 *
 * Subsequent milestones layer scope WITHOUT revisiting M1 or M2.
 * This file encodes the milestones as a typed list, the per-milestone
 * gates that must pass before promotion, and the explicit non-goals
 * (marketplace product, vscode runtime shim, full theme-studio rewrite,
 * hidden first-party bypass paths).
 */

import { z } from "zod"

export const milestoneIdSchema = z.enum([
	"M1-source-of-truth",
	"M2-first-vertical-slice",
	"M3-bridge-projection",
	"M4-renderer-projection",
	"M5-themes",
	"M6-third-party",
	"M7-operator-ui",
	"M8-vscode-import-gate",
	"M9-perf-and-quotas",
	"M10-release-gates",
])
export type MilestoneId = z.infer<typeof milestoneIdSchema>

export const milestoneStatusSchema = z.enum([
	"planned",
	"in-progress",
	"promoted",
	"deferred",
])
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>

export const milestoneSchema = z
	.object({
		id: milestoneIdSchema,
		title: z.string().min(1).max(160),
		status: milestoneStatusSchema,
		summary: z.string().min(1).max(400),
		blockedBy: z.array(milestoneIdSchema).readonly(),
		gates: z.array(z.string().min(1).max(200)).readonly(),
		deferredItems: z.array(z.string().min(1).max(200)).readonly(),
	})
	.strict()
export type Milestone = z.infer<typeof milestoneSchema>

/**
 * The locked roadmap. Order is intentional: M1 must precede M2 must
 * precede M3+. Any reorder invalidates the architecture-first design.
 */
export const V2_ROADMAP: readonly Milestone[] = [
	{
		id: "M1-source-of-truth",
		title: "Source-of-truth plugin model is locked in source",
		status: "promoted",
		summary:
			"Manifest Zod schema, descriptor derivation, capability taxonomy, and tool projection 9-state machine are committed as the single canonical source of truth.",
		blockedBy: [],
		gates: [
			"pluginManifestSchema enforces all reserved host prefixes",
			"PluginDescriptor derivation is total over valid manifests",
			"Capability broker is deny-by-default with explicit grants",
		],
		deferredItems: [],
	},
	{
		id: "M2-first-vertical-slice",
		title: "First vertical slice ships one first-party panel through V2 catalog",
		status: "planned",
		summary:
			"One first-party side-panel is migrated to the V2 path end-to-end: manifest, descriptor, projection, runtime supervision, hot reload, and operator row.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"first-party-migration matrix names the slice and its landing point",
			"hot reload round-trips the slice in dev mode",
			"operator surface renders the slice row with all required fields",
		],
		deferredItems: ["All other first-party panels and widgets"],
	},
	{
		id: "M3-bridge-projection",
		title: "OpenCode bridge projection layer is wired",
		status: "planned",
		summary:
			"bridge-projection and palot-bridge V2 manifest are committed; bridge migration matrix names every legacy call site and its V2 landing point.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"server-mode matrix covers managed-only, attached, offline, reconnect",
			"bridge-migration matrix covers browser, side-panel, connected-app discovery, hooks",
		],
		deferredItems: ["Production rollout behind a flag"],
	},
	{
		id: "M4-renderer-projection",
		title: "Renderer projection helpers are wired",
		status: "planned",
		summary:
			"renderer-projection and family contracts are committed; host-owned DOM is enforced; React singleton drift is guarded.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"Family contracts cover all four contribution families",
			"Host-owned DOM invariant has a runtime check",
		],
		deferredItems: ["React 19 concurrent render experimentation"],
	},
	{
		id: "M5-themes",
		title: "Theme pipeline + precedence model is wired",
		status: "planned",
		summary:
			"theme-pipeline precedence (user-pick > active-plugin > imported > bundled) is enforced; preview never mutates applied state.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"Precedence matrix covers every source combination",
			"Preview path synthesises a winner with a placeholder id",
		],
		deferredItems: ["Full theme-studio authoring rewrite (out of scope)"],
	},
	{
		id: "M6-third-party",
		title: "Third-party / AI-authored plugin support is enabled",
		status: "planned",
		summary:
			"acme-notebook exemplar and trust-tier classification (built-in, local-dev, signed-third-party, unsigned-third-party) are committed; storage scopes per plugin id.",
		blockedBy: ["M2-first-vertical-slice"],
		gates: [
			"Trust tier gate rejects unsigned bundles from production",
			"Storage scopes are namespaced per plugin id",
		],
		deferredItems: ["Marketplace browse / discover / purchase (explicit non-goal)"],
	},
	{
		id: "M7-operator-ui",
		title: "Operator UI plan is complete and integrated",
		status: "promoted",
		summary:
			"operator-surface source contract locks 8 actions, 11 fields, scope boundary; review-permissions and view-logs are always present.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"Score boundary keeps marketplace OUT of operator surface",
			"All required fields render in the operator row",
		],
		deferredItems: [],
	},
	{
		id: "M8-vscode-import-gate",
		title: "VS Code import stance is locked",
		status: "promoted",
		summary:
			"vscode-import classifier commits the 4-tier feasibility (green/yellow/orange/red); runtimeShim=false and hiddenSidecar=false in source.",
		blockedBy: ["M1-source-of-truth"],
		gates: [
			"Transpile-only architecture is the only path",
			"vscode.d.ts is the semantic contract, not a runtime shim",
		],
		deferredItems: ["Full VS Code extension API compatibility (out of scope)"],
	},
	{
		id: "M9-perf-and-quotas",
		title: "Performance and quotas contract is wired",
		status: "planned",
		summary:
			"Worker counts, memory budgets, event fan-out, and per-plugin AI/tool metering are enforced with telemetry.",
		blockedBy: ["M2-first-vertical-slice", "M3-bridge-projection"],
		gates: [
			"Per-plugin AI/tool cost attribution is logged to telemetry",
			"Quotas abort runaway plugins before they affect the host",
		],
		deferredItems: ["Per-tenant multi-user metering (not in V2 scope)"],
	},
	{
		id: "M10-release-gates",
		title: "Release gates are wired into pre-merge and release CI",
		status: "planned",
		summary:
			"Verification matrix (Task 28) gates local, pre-merge, and release confidence for plugin runtime, bridge, renderer, and theme contributions.",
		blockedBy: ["M2-first-vertical-slice", "M3-bridge-projection", "M7-operator-ui", "M9-perf-and-quotas"],
		gates: [
			"Local, pre-merge, and release gates each have explicit obligations",
			"Plugin runtime, bridge, renderer, and themes each have explicit obligations",
		],
		deferredItems: [],
	},
] as const

/**
 * The explicit non-goals. Locked in source so a future contributor
 * cannot silently expand V2 scope into marketplace product, vscode
 * runtime shim, full theme-studio rewrite, or hidden first-party
 * bypass paths.
 */
export const V2_NON_GOALS = [
	"marketplace browse / discover / ranking / purchase",
	"vscode runtime shim or hidden sidecar",
	"full theme-studio authoring rewrite",
	"hidden first-party bypass paths (first-party uses the SAME runtime path as third-party)",
	"per-tenant multi-user metering",
	"production rollout behind flags in M3 (deferred to a later ship)",
] as const

/**
 * Compute the next milestone eligible for work. Returns the lowest
 * milestone id that is not yet promoted and has all blockers promoted.
 */
export function nextPromotableMilestone(roadmap: readonly Milestone[] = V2_ROADMAP): Milestone | null {
	const promoted = new Set(roadmap.filter((m) => m.status === "promoted").map((m) => m.id))
	for (const m of roadmap) {
		if (m.status !== "planned") continue
		if (m.blockedBy.every((b) => promoted.has(b))) return m
	}
	return null
}
