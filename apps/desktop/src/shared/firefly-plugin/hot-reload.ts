/**
 * Firefly Plugin System V2 — Hot reload and dev loop
 *
 * Pure contract for the edit -> rebuild -> restart -> reprojection
 * cycle. The runtime layer (main process + devmux) implements the
 * watcher and the worker restarter; this module encodes the
 * deterministic state machine so the runtime can stay
 * implementation-agnostic and the tests can lock the contract.
 *
 * Locked rules (from the V2 plan, Task 18):
 *   - Hot reload REQUIRES a process restart. Module-cache hacks are
 *     explicitly forbidden.
 *   - Renderer and OpenCode projections refresh together. The host
 *     never publishes a renderer projection that disagrees with the
 *     OpenCode tool projection.
 *   - Dev mode keeps unsigned plugins enabled but flags them with the
 *     unsigned trust tier; the broker still applies its policy.
 *   - State preservation boundaries are explicit: session-scoped state
 *     survives; project-scoped state survives; app-scoped state
 *     survives; only the plugin worker's in-memory cache is dropped.
 */

import { z } from "zod"

import type { PluginId } from "./manifest"

/**
 * The closed vocabulary of hot-reload phases. Each phase has a
 * strict -> next-phase transition. The runtime consults the table
 * to publish renderer + OpenCode projections coherently.
 */
export const HOT_RELOAD_PHASES = [
	"idle",
	"detected",
	"queued",
	"tearingDown",
	"rebuilding",
	"reprojecting",
	"republishing",
	"ready",
	"failed",
] as const
export type HotReloadPhase = (typeof HOT_RELOAD_PHASES)[number]

/**
 * Locked phase transition table. The runtime MUST consult this
 * table before advancing the phase; the test suite locks every
 * transition row.
 */
export const HOT_RELOAD_TRANSITIONS: Readonly<Record<HotReloadPhase, readonly HotReloadPhase[]>> = {
	idle: ["detected", "failed"],
	detected: ["queued", "failed"],
	queued: ["tearingDown", "failed"],
	tearingDown: ["rebuilding", "failed"],
	rebuilding: ["reprojecting", "failed"],
	reprojecting: ["republishing", "failed"],
	republishing: ["ready", "failed"],
	ready: [],
	failed: [],
}

export const HOT_RELOAD_TERMINAL_PHASES: ReadonlySet<HotReloadPhase> = new Set(["ready", "failed"])

/**
 * The kinds of source-change events the watcher reports. Each kind
 * maps to a different teardown decision (config -> soft reload;
 * manifest -> hard reload; worker code -> process restart).
 */
export const HOT_RELOAD_EVENT_KINDS = [
	"manifest-changed",
	"contribution-changed",
	"worker-code-changed",
	"config-changed",
] as const
export type HotReloadEventKind = (typeof HOT_RELOAD_EVENT_KINDS)[number]

export const hotReloadEventKindSchema = z.enum(HOT_RELOAD_EVENT_KINDS)

/**
 * Locked event kind -> reload policy. Manifest or worker-code
 * changes ALWAYS require a full process restart; contribution
 * changes can be hot-projected when the descriptor surface did not
 * change; config changes are the lightest path.
 */
export const HOT_RELOAD_KIND_POLICY: Readonly<Record<HotReloadEventKind, "restart" | "soft" | "project">> = {
	"manifest-changed": "restart",
	"contribution-changed": "project",
	"worker-code-changed": "restart",
	"config-changed": "soft",
}

/**
 * A hot-reload event from the watcher. The runtime turns it into a
 * phase advance via `applyHotReloadEvent`.
 */
export const hotReloadEventSchema = z
	.object({
		pluginId: z.string().min(1).max(160),
		kind: hotReloadEventKindSchema,
		observedAt: z.number().int().nonnegative(),
		source: z.string().min(1).max(160),
	})
	.strict()
export type HotReloadEvent = z.infer<typeof hotReloadEventSchema>

/**
 * Pure transition gate. Returns `true` when the runtime is allowed
 * to advance from `from` to `to`. Mirrors the runtime-supervision
 * pattern: a single transition gate so the runtime never
 * over-advances a phase.
 */
export function isHotReloadTransitionAllowed(
	from: HotReloadPhase,
	to: HotReloadPhase,
): boolean {
	return (HOT_RELOAD_TRANSITIONS[from] as readonly HotReloadPhase[]).includes(to)
}

export function isHotReloadTerminalPhase(phase: HotReloadPhase): boolean {
	return HOT_RELOAD_TERMINAL_PHASES.has(phase)
}

/**
 * Dev-mode behavior. In dev mode, unsigned plugins are kept enabled
 * (vs production where they require explicit consent) so the
 * developer's local loop stays short. The broker still applies
 * tier-specific policy; unsigned does not equal privileged.
 */
export interface DevModePolicy {
	readonly enableUnsignedPlugins: boolean
	readonly skipManifestSignatureCheck: boolean
	readonly requireSoftReloadForContributionChanges: boolean
	readonly maxSoftReloadIntervalMs: number
}

export const DEV_MODE_POLICY: DevModePolicy = {
	enableUnsignedPlugins: true,
	skipManifestSignatureCheck: true,
	requireSoftReloadForContributionChanges: true,
	maxSoftReloadIntervalMs: 5_000,
}

export const PRODUCTION_MODE_POLICY: DevModePolicy = {
	enableUnsignedPlugins: false,
	skipManifestSignatureCheck: false,
	requireSoftReloadForContributionChanges: false,
	maxSoftReloadIntervalMs: 0,
}

/**
 * The full hot-reload result for one cycle. Returned by
 * `planHotReloadCycle` so the runtime can log the decision and the
 * operator UI can render the current reload status.
 */
export interface HotReloadCyclePlan {
	readonly pluginId: PluginId
	readonly startingPhase: HotReloadPhase
	readonly policy: "restart" | "soft" | "project"
	readonly phaseSequence: readonly HotReloadPhase[]
	readonly reusesRendererProjection: boolean
	readonly reusesOpenCodeProjection: boolean
	readonly preservesSessionState: boolean
	readonly preservesProjectState: boolean
	readonly preservesAppState: boolean
	readonly expectedDurationMs: number
}

/**
 * Default state-preservation policy. Session + project + app state
 * always survive a hot reload; only the worker's in-memory cache
 * is dropped. Project and app state may also be preserved through a
 * full process restart because the host stores them durably.
 */
export const DEFAULT_STATE_PRESERVATION = {
	session: true,
	project: true,
	app: true,
} as const satisfies {
	readonly session: boolean
	readonly project: boolean
	readonly app: boolean
}

/**
 * Locked phase sequence per reload policy. Used by the operator UI
 * to render a progress indicator that matches the runtime's actual
 * progress.
 */
export const HOT_RELOAD_PHASE_SEQUENCE: Readonly<Record<"restart" | "soft" | "project", readonly HotReloadPhase[]>> = {
	restart: ["idle", "detected", "queued", "tearingDown", "rebuilding", "reprojecting", "republishing", "ready"],
	soft: ["idle", "detected", "queued", "reprojecting", "republishing", "ready"],
	project: ["idle", "detected", "queued", "republishing", "ready"],
}

/**
 * Projections are reused only on soft reloads. Hard restarts
 * always re-derive both projections; contribution-only changes can
 * reuse the OpenCode projection if the tool surface is unchanged.
 */
function determineProjectionReuse(
	policy: "restart" | "soft" | "project",
	toolSurfaceChanged: boolean,
): { reusesRendererProjection: boolean; reusesOpenCodeProjection: boolean } {
	if (policy === "restart") return { reusesRendererProjection: false, reusesOpenCodeProjection: false }
	if (policy === "soft") return { reusesRendererProjection: true, reusesOpenCodeProjection: true }
	return {
		reusesRendererProjection: !toolSurfaceChanged,
		reusesOpenCodeProjection: !toolSurfaceChanged,
	}
}

/**
 * Rough upper bound for each reload kind. Used to populate the
 * "expectedDurationMs" field on the cycle plan so the operator UI
 * can render a rough progress estimate.
 */
export const HOT_RELOAD_DURATION_BUDGET_MS: Readonly<Record<"restart" | "soft" | "project", number>> = {
	restart: 8_000,
	soft: 1_500,
	project: 2_500,
}

/**
 * Plan one hot-reload cycle. Pure: the runtime consults the
 * returned plan and walks the phase sequence. The plan is
 * deterministic so the operator UI can render progress without
 * re-deriving the same logic.
 */
export function planHotReloadCycle(input: {
	pluginId: PluginId
	event: HotReloadEvent
	mode: "dev" | "production"
	toolSurfaceChanged?: boolean
}): HotReloadCyclePlan {
	const policy = HOT_RELOAD_KIND_POLICY[input.event.kind]
	const toolSurfaceChanged = input.toolSurfaceChanged ?? policy === "restart"
	const { reusesRendererProjection, reusesOpenCodeProjection } = determineProjectionReuse(
		policy,
		toolSurfaceChanged,
	)
	return {
		pluginId: input.pluginId,
		startingPhase: "idle",
		policy,
		phaseSequence: HOT_RELOAD_PHASE_SEQUENCE[policy],
		reusesRendererProjection,
		reusesOpenCodeProjection,
		preservesSessionState: DEFAULT_STATE_PRESERVATION.session,
		preservesProjectState: DEFAULT_STATE_PRESERVATION.project,
		preservesAppState: DEFAULT_STATE_PRESERVATION.app,
		expectedDurationMs: HOT_RELOAD_DURATION_BUDGET_MS[policy],
	}
}

/**
 * Resolve the dev-mode policy to use for the current host run. The
 * runtime calls this once at startup; the result is the policy
 * the watcher + broker consult.
 */
export function resolveHotReloadModePolicy(
	mode: "dev" | "production",
): DevModePolicy {
	return mode === "dev" ? DEV_MODE_POLICY : PRODUCTION_MODE_POLICY
}
