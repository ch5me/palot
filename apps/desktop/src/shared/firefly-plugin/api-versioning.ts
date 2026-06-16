/**
 * Firefly Plugin System V2 — API tiering, versioning, and manifest evolution
 *
 * Sits between the manifest schema (static on-disk contract) and the
 * descriptor (host-validated, normalized form). Encodes the evolution
 * rules that govern:
 *
 *   - the explicit tier vocabulary:  stable | proposed | internal
 *   - manifest revision negotiation   (host-known max vs plugin-declared)
 *   - host app version vs the per-revision minimum-host-version floor
 *   - bridge / tool / tool-result-envelope / inspection-tool surface
 *     revision records
 *   - deprecation metadata and the codemod expectation surface that
 *     downstream migration tooling reads from
 *
 * Pure & deterministic, mirroring the discipline of `descriptor.ts` — the
 * catalog loader can re-run negotiation after any reload without state
 * drift, and the codemod surface stays greppable for migration authors.
 *
 * Tier vocabulary (intentional and locked):
 *   - "stable":   the host guarantees wire + semantic compatibility for
 *                 the lifetime of the V2 major; every trust tier may
 *                 consume and contribute stable surfaces.
 *   - "proposed": exported but explicitly marked unstable; the host still
 *                 accepts the surface and flags it in the operator UI so
 *                 authors can opt in early, but the contract may change
 *                 before promotion to "stable".
 *   - "internal": host-only; never made available to third-party plugin
 *                 surface, regardless of consent. Built-in plugins can
 *                 still bind to internal surfaces because they ship in
 *                 the host repo and move in lockstep with the host API.
 */

import { z } from "zod"

import type { TrustTier } from "./manifest"
import { satisfiesSemverRange } from "./descriptor"

// ---------------------------------------------------------------------------
// Wire / revision constants
// ---------------------------------------------------------------------------

/**
 * Wire apiVersion string every V2 manifest must declare. Kept in lockstep
 * with `manifestApiVersionSchema` in `./manifest`.
 */
export const API_VERSION = "firefly.plugin/v2" as const

/**
 * Pinned current manifest revision. Bump only when a manifest shape change
 * is approved (and register the new revision in `MANIFEST_REVISION_RULES`
 * with its own minimum-host-version floor + tier).
 */
export const CURRENT_MANIFEST_REVISION = 1

/**
 * Lowest manifest revision a V2 host will accept. Mirrors the lower bound
 * of the `manifestRevision` Zod integer in `./manifest`.
 */
export const MIN_MANIFEST_REVISION = 1

/**
 * Upper bound of the `manifestRevision` Zod integer in `./manifest`. The
 * negotiation helpers reject revisions above this even if the host could
 * hypothetically load them — schema drift is not graceful.
 */
export const MAX_MANIFEST_REVISION = 64

/**
 * Pinned current host app version. Bumped alongside the desktop app; used
 * as the default `currentHostVersion` argument when callers do not pass
 * one. Mirrors `engines.desktop` for the current first-party manifests.
 */
export const CURRENT_HOST_VERSION = "0.11.0"

/**
 * Tier vocabulary. The order is meaningful: index 0 is the most
 * permissive, index 2 the most restrictive.
 */
export const API_TIERS = ["stable", "proposed", "internal"] as const
export type ApiTier = (typeof API_TIERS)[number]

/**
 * The full set of API surface kinds that participate in tiering. Every
 * kind listed here MUST have a corresponding record in one of the
 * `*_REVISIONS` maps below so the operator UI can show a complete
 * evolution timeline.
 */
export const API_SURFACE_KINDS = [
	"manifest",
	"tool",
	"tool-result-envelope",
	"bridge",
	"panel",
	"widget",
	"command",
	"theme",
	"inspection-tool",
] as const
export type ApiSurfaceKind = (typeof API_SURFACE_KINDS)[number]

/**
 * Codemod availability vocabulary. Drives the codemod expectation
 * surface that downstream migration tooling reads.
 */
export const CODEMOD_AVAILABILITY = ["none", "available", "required", "manual-only"] as const
export type CodemodAvailability = (typeof CODEMOD_AVAILABILITY)[number]

// ---------------------------------------------------------------------------
// Semver helper (local copy; descriptor.ts keeps its own)
// ---------------------------------------------------------------------------

function compareSemver(a: string, b: string): number {
	const [aMajor, aMinor, aPatch] = a.split("-")[0].split(".").map((n) => Number.parseInt(n, 10))
	const [bMajor, bMinor, bPatch] = b.split("-")[0].split(".").map((n) => Number.parseInt(n, 10))
	if (aMajor !== bMajor) return aMajor - bMajor
	if (aMinor !== bMinor) return aMinor - bMinor
	return aPatch - bPatch
}

function isValidSemver(value: string): boolean {
	return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(value)
}

// ---------------------------------------------------------------------------
// Codemod + deprecation schemas
// ---------------------------------------------------------------------------

/**
 * Codemod expectation metadata. Carries enough information for a migration
 * tool to:
 *   - know whether a codemod is available
 *   - know whether the codemod is required before the host can advance
 *   - provide manual steps when no codemod exists
 *   - hand the user a stable codemodId to invoke
 */
export const codemodExpectationSchema = z
	.object({
		availability: z.enum(CODEMOD_AVAILABILITY),
		codemodId: z.string().min(1).max(120).optional(),
		manualSteps: z.array(z.string().min(1).max(400)).max(20).optional(),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (value.availability === "required" || value.availability === "available") {
			if (!value.codemodId) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["codemodId"],
					message: `codemod availability "${value.availability}" requires a codemodId`,
				})
			}
		}
		if (value.availability === "manual-only") {
			if (!value.manualSteps || value.manualSteps.length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["manualSteps"],
					message: 'codemod availability "manual-only" requires at least one manualStep',
				})
			}
		}
		if (value.availability === "none") {
			if (value.codemodId || (value.manualSteps && value.manualSteps.length > 0)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'codemod availability "none" must not carry codemodId or manualSteps',
				})
			}
		}
	})
export type CodemodExpectation = z.infer<typeof codemodExpectationSchema>

/**
 * Deprecation policy metadata. Attaches a removal target (either a host
 * app version or a manifest revision), a concrete replacement, the
 * codemod expectation, and a human migration note. Replacement is
 * required because silent deprecation is a footgun.
 */
export const deprecationPolicySchema = z
	.object({
		replacement: z.string().min(1).max(160),
		removalTarget: z
			.string()
			.regex(
				/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
				"removalTarget must be a valid semver string",
			)
			.optional(),
		removalRevision: z.number().int().positive().max(MAX_MANIFEST_REVISION).optional(),
		codemod: codemodExpectationSchema,
		migrationNote: z.string().min(1).max(2000),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (!value.removalTarget && !value.removalRevision) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "deprecation policy must declare at least one of removalTarget or removalRevision",
			})
		}
		if (value.removalTarget && !isValidSemver(value.removalTarget)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["removalTarget"],
				message: "removalTarget must be a valid semver string",
			})
		}
	})
export type DeprecationPolicy = z.infer<typeof deprecationPolicySchema>

// ---------------------------------------------------------------------------
// Surface annotation
// ---------------------------------------------------------------------------

/**
 * An annotation describing one API surface the host exposes (or accepts
 * from a plugin). The tier decides which trust levels may bind to it.
 */
export const apiSurfaceAnnotationSchema = z
	.object({
		kind: z.enum(API_SURFACE_KINDS),
		name: z.string().min(1).max(160),
		tier: z.enum(API_TIERS),
		revision: z.number().int().positive().max(MAX_MANIFEST_REVISION).optional(),
		deprecation: deprecationPolicySchema.optional(),
	})
	.strict()
export type ApiSurfaceAnnotation = z.infer<typeof apiSurfaceAnnotationSchema>

/**
 * Build an `ApiSurfaceAnnotation`. Pure & deterministic; the helper exists
 * so callers do not have to import the Zod schema for trivial annotations.
 */
export function annotateApiSurface(input: {
	kind: ApiSurfaceKind
	name: string
	tier: ApiTier
	revision?: number
	deprecation?: DeprecationPolicy
}): ApiSurfaceAnnotation {
	return {
		kind: input.kind,
		name: input.name,
		tier: input.tier,
		revision: input.revision,
		deprecation: input.deprecation,
	}
}

// ---------------------------------------------------------------------------
// Manifest revision rules
// ---------------------------------------------------------------------------

/**
 * Per-revision evolution rule. The host consults the entry that matches
 * the plugin-declared `manifestRevision` to decide whether the host can
 * load the plugin.
 */
export interface ManifestRevisionRule {
	readonly revision: number
	readonly minHostVersion: string
	readonly status: ApiTier
	readonly deprecation: DeprecationPolicy | null
	readonly notes: string
}

/**
 * The current manifest revision table. New revisions MUST be appended
 * here (never mutate prior entries — older entries stay locked so old
 * plugins keep loading). When a revision is deprecated, mark it with a
 * `deprecation` rather than deleting it.
 */
export const MANIFEST_REVISION_RULES: Readonly<Record<number, ManifestRevisionRule>> = {
	1: {
		revision: 1,
		minHostVersion: "0.11.0",
		status: "stable",
		deprecation: null,
		notes: "Initial V2 manifest contract. Wire format firefly.plugin/v2.",
	},
}

/**
 * Generic revision record. Used for sub-manifest surfaces (tool result
 * envelope, bridge schema, inspection tool set) that evolve independently
 * of the manifest revision.
 */
export interface SurfaceRevisionRecord {
	readonly surface: ApiSurfaceKind
	readonly revision: number
	readonly status: ApiTier
	readonly minHostVersion: string
	readonly deprecation: DeprecationPolicy | null
	readonly notes: string
}

function buildRevisionRecord(input: {
	surface: ApiSurfaceKind
	revision: number
	status: ApiTier
	minHostVersion: string
	deprecation?: DeprecationPolicy | null
	notes: string
}): SurfaceRevisionRecord {
	return {
		surface: input.surface,
		revision: input.revision,
		status: input.status,
		minHostVersion: input.minHostVersion,
		deprecation: input.deprecation ?? null,
		notes: input.notes,
	}
}

/**
 * Tool result envelope revisions. Bump when the envelope shape changes
 * (e.g. new required field). Mirrors `toolResultEnvelopeSchema` in
 * `./tool-projection`.
 */
export const TOOL_RESULT_ENVELOPE_REVISIONS: readonly SurfaceRevisionRecord[] = [
	buildRevisionRecord({
		surface: "tool-result-envelope",
		revision: 1,
		status: "stable",
		minHostVersion: "0.11.0",
		notes: "Initial envelope: status, errorCode, data, uiHints, provenance, retryable.",
	}),
]

/**
 * Bridge schema revisions. Bump when `bridgeMetadataSchema` or the
 * `systemContextBlock` contract changes. The bridge is the host's
 * OpenCode-facing surface, so revisions here drive downstream
 * OpenCode / agent compatibility.
 */
export const BRIDGE_SCHEMA_REVISIONS: readonly SurfaceRevisionRecord[] = [
	buildRevisionRecord({
		surface: "bridge",
		revision: 1,
		status: "stable",
		minHostVersion: "0.11.0",
		notes: "Initial bridge schema. schemaVersion literal 1; requiresSessionBinding default false.",
	}),
]

/**
 * Inspection tool set revisions. Bump when the host's reserved
 * `plugins.*` inspection tool ids change (added, removed, or had an
 * arg/result schema changed).
 */
export const PLUGIN_INSPECTION_TOOL_REVISIONS: readonly SurfaceRevisionRecord[] = [
	buildRevisionRecord({
		surface: "inspection-tool",
		revision: 1,
		status: "stable",
		minHostVersion: "0.11.0",
		notes: "Initial inspection tool set: list, describe, tools, panels, widgets, commands, themes, state, permissions, lifecycle.",
	}),
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up the rule for a manifest revision. Returns `null` if the
 * revision is out of bounds (below `MIN_MANIFEST_REVISION` or above
 * `MAX_MANIFEST_REVISION`) or unknown to the host.
 */
export function getManifestRevisionRule(revision: number): ManifestRevisionRule | null {
	if (revision < MIN_MANIFEST_REVISION || revision > MAX_MANIFEST_REVISION) return null
	return MANIFEST_REVISION_RULES[revision] ?? null
}

/**
 * Look up a surface revision record. Returns `null` if the (surface,
 * revision) pair is not registered.
 */
export function getSurfaceRevisionRecord(
	surface: ApiSurfaceKind,
	revision: number,
): SurfaceRevisionRecord | null {
	let records: readonly SurfaceRevisionRecord[] = []
	switch (surface) {
		case "tool-result-envelope":
			records = TOOL_RESULT_ENVELOPE_REVISIONS
			break
		case "bridge":
			records = BRIDGE_SCHEMA_REVISIONS
			break
		case "inspection-tool":
			records = PLUGIN_INSPECTION_TOOL_REVISIONS
			break
		default:
			return null
	}
	return records.find((r) => r.revision === revision) ?? null
}

/**
 * Latest known revision for a given surface. Returns 0 when the host
 * registers no revisions for that surface (so callers can treat 0 as
 * "no coverage yet").
 */
export function getLatestSurfaceRevision(surface: ApiSurfaceKind): number {
	let records: readonly SurfaceRevisionRecord[] = []
	switch (surface) {
		case "tool-result-envelope":
			records = TOOL_RESULT_ENVELOPE_REVISIONS
			break
		case "bridge":
			records = BRIDGE_SCHEMA_REVISIONS
			break
		case "inspection-tool":
			records = PLUGIN_INSPECTION_TOOL_REVISIONS
			break
		default:
			return 0
	}
	if (records.length === 0) return 0
	return records[records.length - 1].revision
}

// ---------------------------------------------------------------------------
// Tier-aware availability
// ---------------------------------------------------------------------------

/**
 * Returns `true` when a surface with this annotation is allowed to be
 * exposed to a plugin of the given `trust` tier. The lock is:
 *   - "internal" tier is NEVER exposed to non-built-in plugins, even
 *     with explicit consent — internal means host-only.
 *   - "proposed" and "stable" tiers are exposed to every trust tier
 *     (the host's broker still gates the actual operation, but the
 *     surface is at least visible).
 */
export function isApiSurfaceAvailableToTrust(
	annotation: ApiSurfaceAnnotation,
	trust: TrustTier,
): boolean {
	if (annotation.tier === "internal" && trust !== "built-in") return false
	return true
}

/**
 * Returns `true` when a surface is marked unstable. "proposed" and
 * "internal" are both considered unstable; "stable" is not. Callers
 * use this to decide whether to surface an "unstable API" badge in the
 * operator UI.
 */
export function isApiSurfaceUnstable(annotation: ApiSurfaceAnnotation): boolean {
	return annotation.tier === "proposed" || annotation.tier === "internal"
}

/**
 * Convenience wrapper that returns a structured decision so callers can
 * render a precise reason string in logs / operator UI without
 * reconstructing the logic.
 */
export interface ApiSurfaceAvailabilityDecision {
	readonly available: boolean
	readonly reason: string
	readonly unstable: boolean
}

export function evaluateApiSurfaceAvailability(
	annotation: ApiSurfaceAnnotation,
	trust: TrustTier,
): ApiSurfaceAvailabilityDecision {
	if (annotation.tier === "internal" && trust !== "built-in") {
		return {
			available: false,
			reason: `surface "${annotation.name}" is internal-tier; not available to ${trust} plugins`,
			unstable: true,
		}
	}
	if (annotation.tier === "internal") {
		return {
			available: true,
			reason: `surface "${annotation.name}" is internal-tier; available to built-in only`,
			unstable: true,
		}
	}
	if (annotation.tier === "proposed") {
		return {
			available: true,
			reason: `surface "${annotation.name}" is proposed-tier; explicitly unstable`,
			unstable: true,
		}
	}
	return {
		available: true,
		reason: `surface "${annotation.name}" is stable-tier`,
		unstable: false,
	}
}

// ---------------------------------------------------------------------------
// Manifest revision compatibility
// ---------------------------------------------------------------------------

/**
 * Result of a host-vs-plugin revision negotiation. `compatible: false`
 * means the catalog loader MUST reject the manifest outright; the
 * `reason` string is safe to render to the user.
 */
export interface ManifestRevisionDecision {
	readonly compatible: boolean
	readonly reason: string
	readonly rule: ManifestRevisionRule | null
}

export interface NegotiateManifestRevisionInput {
	readonly manifestRevision: number
	readonly hostAppVersion: string
	readonly hostKnownMaxRevision: number
}

/**
 * Negotiate whether the host can load a plugin that declares
 * `manifestRevision`. The host passes the maximum revision it knows
 * about (typically `CURRENT_MANIFEST_REVISION` for the current build;
 * tests can pass a lower value to exercise the "host too old" path).
 */
export function negotiateManifestRevision(
	input: NegotiateManifestRevisionInput,
): ManifestRevisionDecision {
	if (input.manifestRevision < MIN_MANIFEST_REVISION) {
		return {
			compatible: false,
			reason: `manifest revision ${input.manifestRevision} is below host minimum ${MIN_MANIFEST_REVISION}`,
			rule: null,
		}
	}
	if (input.manifestRevision > MAX_MANIFEST_REVISION) {
		return {
			compatible: false,
			reason: `manifest revision ${input.manifestRevision} exceeds host maximum ${MAX_MANIFEST_REVISION}`,
			rule: null,
		}
	}
	if (input.manifestRevision > input.hostKnownMaxRevision) {
		return {
			compatible: false,
			reason: `host only knows up to manifest revision ${input.hostKnownMaxRevision}; manifest declares ${input.manifestRevision}`,
			rule: null,
		}
	}
	const rule = getManifestRevisionRule(input.manifestRevision)
	if (!rule) {
		return {
			compatible: false,
			reason: `no rule registered for manifest revision ${input.manifestRevision}`,
			rule: null,
		}
	}
	if (compareSemver(input.hostAppVersion, rule.minHostVersion) < 0) {
		return {
			compatible: false,
			reason: `host appVersion ${input.hostAppVersion} is below manifest revision ${input.manifestRevision} floor ${rule.minHostVersion}`,
			rule,
		}
	}
	return { compatible: true, reason: "manifest revision is compatible", rule }
}

/**
 * Convenience wrapper that also folds in the optional `engines.firefly`
 * range check (or the deprecated `engines.desktop` floor alias) from the
 * manifest. Either check failing causes rejection; the returned `rule`
 * reflects the manifest revision rule, not the engines range, so the
 * caller can log both.
 */
export interface NegotiateApiVersionInput {
	readonly hostAppVersion: string
	readonly hostKnownMaxRevision: number
	readonly manifestRevision: number
	/**
	 * SemVer range from `engines.firefly` (canonical, §5.2).
	 * When both `enginesFireflyRange` and `enginesDesktopFloor` are
	 * provided, `enginesFireflyRange` takes precedence.
	 */
	readonly enginesFireflyRange: string | null
	/**
	 * @deprecated Migration alias for `engines.desktop` (bare floor).
	 * Ignored when `enginesFireflyRange` is non-null.
	 */
	readonly enginesDesktopFloor?: string | null
}

export interface NegotiateApiVersionDecision {
	readonly compatible: boolean
	readonly reason: string
	readonly revisionDecision: ManifestRevisionDecision
	readonly enginesFloorOk: boolean
}

export function negotiateApiVersion(input: NegotiateApiVersionInput): NegotiateApiVersionDecision {
	const revisionDecision = negotiateManifestRevision({
		manifestRevision: input.manifestRevision,
		hostAppVersion: input.hostAppVersion,
		hostKnownMaxRevision: input.hostKnownMaxRevision,
	})

	// Resolve the effective range: canonical field first, then alias.
	const effectiveRange: string | null =
		input.enginesFireflyRange ?? (input.enginesDesktopFloor ? `>=${input.enginesDesktopFloor}` : null)

	let enginesFloorOk = true
	if (effectiveRange) {
		if (!satisfiesSemverRange(input.hostAppVersion, effectiveRange)) {
			enginesFloorOk = false
		}
	}
	const compatible = revisionDecision.compatible && enginesFloorOk
	let reason = revisionDecision.reason
	if (!enginesFloorOk) {
		const rangeLabel = input.enginesFireflyRange
			? `engines.firefly range "${effectiveRange}"`
			: `engines.desktop floor ${input.enginesDesktopFloor}`
		reason = `${reason}; ${rangeLabel} not satisfied by host ${input.hostAppVersion}`
	}
	return { compatible, reason, revisionDecision, enginesFloorOk }
}

// ---------------------------------------------------------------------------
// Codemod expectation
// ---------------------------------------------------------------------------

/**
 * Structured result of evaluating a codemod expectation. Migration
 * tooling can use this to decide whether to (a) auto-run a codemod, (b)
 * prompt the user, (c) show a manual steps checklist, or (d) take no
 * action.
 */
export interface CodemodExpectationEvaluation {
	readonly availability: CodemodAvailability
	readonly required: boolean
	readonly available: boolean
	readonly hasCodemodId: boolean
	readonly hasManualSteps: boolean
}

export function evaluateCodemodExpectation(codemod: CodemodExpectation): CodemodExpectationEvaluation {
	return {
		availability: codemod.availability,
		required: codemod.availability === "required",
		available: codemod.availability === "available" || codemod.availability === "required",
		hasCodemodId: typeof codemod.codemodId === "string" && codemod.codemodId.length > 0,
		hasManualSteps: Array.isArray(codemod.manualSteps) && codemod.manualSteps.length > 0,
	}
}

// ---------------------------------------------------------------------------
// Deprecation status
// ---------------------------------------------------------------------------

/**
 * Resolve whether a deprecation policy has reached its removal target
 * in the current host context. Mirrors how a plugin author would read
 * the policy: they want a single boolean plus a reason.
 */
export interface DeprecationStatus {
	readonly isDeprecated: boolean
	readonly removalPassed: boolean
	readonly reason: string
	readonly replacement: string
}

export interface ComputeDeprecationStatusInput {
	readonly deprecation: DeprecationPolicy
	readonly currentHostVersion: string
	readonly currentManifestRevision: number
}

export function computeDeprecationStatus(
	input: ComputeDeprecationStatusInput,
): DeprecationStatus {
	const { deprecation } = input
	if (deprecation.removalTarget) {
		if (compareSemver(input.currentHostVersion, deprecation.removalTarget) >= 0) {
			return {
				isDeprecated: true,
				removalPassed: true,
				reason: `removal target ${deprecation.removalTarget} reached at host version ${input.currentHostVersion}`,
				replacement: deprecation.replacement,
			}
		}
	}
	if (typeof deprecation.removalRevision === "number") {
		if (input.currentManifestRevision >= deprecation.removalRevision) {
			return {
				isDeprecated: true,
				removalPassed: true,
				reason: `removal revision ${deprecation.removalRevision} reached at current revision ${input.currentManifestRevision}`,
				replacement: deprecation.replacement,
			}
		}
	}
	return {
		isDeprecated: true,
		removalPassed: false,
		reason: "still within deprecation window",
		replacement: deprecation.replacement,
	}
}

// ---------------------------------------------------------------------------
// Manifest revision comparison
// ---------------------------------------------------------------------------

/**
 * Compare two manifest revisions. Returns negative if `a < b`, 0 if
 * equal, positive if `a > b`. The comparison is purely numeric; the
 * function is separate from `compareSemver` because revisions are not
 * semvers.
 */
export function compareManifestRevisions(a: number, b: number): number {
	return a - b
}

// ---------------------------------------------------------------------------
// Bridge / tool / inspection schema evolution
// ---------------------------------------------------------------------------

/**
 * Negotiate whether the host can satisfy a plugin that declares a
 * `bridge.schemaVersion` (or any other sub-manifest surface revision).
 * The host passes the maximum revision it supports; the helper returns
 * a decision mirroring `negotiateManifestRevision` so downstream
 * loading code can use a single decision shape.
 */
export interface SurfaceRevisionDecision {
	readonly compatible: boolean
	readonly reason: string
	readonly record: SurfaceRevisionRecord | null
}

export function negotiateSurfaceRevision(input: {
	surface: ApiSurfaceKind
	revision: number
	hostAppVersion: string
	hostKnownMaxRevision: number
}): SurfaceRevisionDecision {
	if (input.revision <= 0) {
		return {
			compatible: false,
			reason: `surface "${input.surface}" revision ${input.revision} is not positive`,
			record: null,
		}
	}
	if (input.revision > input.hostKnownMaxRevision) {
		return {
			compatible: false,
			reason: `host only knows up to ${input.surface} revision ${input.hostKnownMaxRevision}; caller declares ${input.revision}`,
			record: null,
		}
	}
	const record = getSurfaceRevisionRecord(input.surface, input.revision)
	if (!record) {
		return {
			compatible: false,
			reason: `no ${input.surface} revision ${input.revision} registered in host`,
			record: null,
		}
	}
	if (compareSemver(input.hostAppVersion, record.minHostVersion) < 0) {
		return {
			compatible: false,
			reason: `host appVersion ${input.hostAppVersion} is below ${input.surface} revision ${input.revision} floor ${record.minHostVersion}`,
			record,
		}
	}
	return { compatible: true, reason: "surface revision is compatible", record }
}

// ---------------------------------------------------------------------------
// Bridge schema negotiation
// ---------------------------------------------------------------------------

/**
 * The bridge `schemaVersion` field is the literal that the host stamps
 * onto the `bridgeMetadata` block. Negotiation reuses the surface
 * revision table so bridge evolution is auditable in one place.
 */
export interface NegotiateBridgeSchemaInput {
	readonly bridgeSchemaVersion: number
	readonly hostAppVersion: string
	readonly hostKnownMaxBridgeRevision: number
}

export function negotiateBridgeSchema(input: NegotiateBridgeSchemaInput): SurfaceRevisionDecision {
	return negotiateSurfaceRevision({
		surface: "bridge",
		revision: input.bridgeSchemaVersion,
		hostAppVersion: input.hostAppVersion,
		hostKnownMaxRevision: input.hostKnownMaxBridgeRevision,
	})
}

// ---------------------------------------------------------------------------
// Tool result envelope negotiation
// ---------------------------------------------------------------------------

export interface NegotiateToolResultEnvelopeInput {
	readonly envelopeRevision: number
	readonly hostAppVersion: string
	readonly hostKnownMaxEnvelopeRevision: number
}

export function negotiateToolResultEnvelope(
	input: NegotiateToolResultEnvelopeInput,
): SurfaceRevisionDecision {
	return negotiateSurfaceRevision({
		surface: "tool-result-envelope",
		revision: input.envelopeRevision,
		hostAppVersion: input.hostAppVersion,
		hostKnownMaxRevision: input.hostKnownMaxEnvelopeRevision,
	})
}

// ---------------------------------------------------------------------------
// Inspection tool set negotiation
// ---------------------------------------------------------------------------

export interface NegotiateInspectionToolSetInput {
	readonly inspectionToolRevision: number
	readonly hostAppVersion: string
	readonly hostKnownMaxInspectionRevision: number
}

export function negotiateInspectionToolSet(
	input: NegotiateInspectionToolSetInput,
): SurfaceRevisionDecision {
	return negotiateSurfaceRevision({
		surface: "inspection-tool",
		revision: input.inspectionToolRevision,
		hostAppVersion: input.hostAppVersion,
		hostKnownMaxRevision: input.hostKnownMaxInspectionRevision,
	})
}

// ---------------------------------------------------------------------------
// Summary helper (operator UI / logs)
// ---------------------------------------------------------------------------

/**
 * Build a JSON-serializable summary of one surface annotation. Useful
 * for the operator UI "API surface" tab and for structured logs.
 */
export interface ApiSurfaceSummary {
	readonly kind: ApiSurfaceKind
	readonly name: string
	readonly tier: ApiTier
	readonly unstable: boolean
	readonly revision: number | null
	readonly deprecation: {
		readonly replacement: string
		readonly removalTarget: string | null
		readonly removalRevision: number | null
		readonly codemodAvailability: CodemodAvailability
		readonly codemodId: string | null
		readonly hasManualSteps: boolean
	} | null
}

export function summarizeApiSurface(annotation: ApiSurfaceAnnotation): ApiSurfaceSummary {
	return {
		kind: annotation.kind,
		name: annotation.name,
		tier: annotation.tier,
		unstable: isApiSurfaceUnstable(annotation),
		revision: annotation.revision ?? null,
		deprecation: annotation.deprecation
			? {
					replacement: annotation.deprecation.replacement,
					removalTarget: annotation.deprecation.removalTarget ?? null,
					removalRevision: annotation.deprecation.removalRevision ?? null,
					codemodAvailability: annotation.deprecation.codemod.availability,
					codemodId: annotation.deprecation.codemod.codemodId ?? null,
					hasManualSteps:
						Array.isArray(annotation.deprecation.codemod.manualSteps) &&
						annotation.deprecation.codemod.manualSteps.length > 0,
				}
			: null,
	}
}
