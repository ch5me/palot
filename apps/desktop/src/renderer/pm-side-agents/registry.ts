/**
 * Static-known PM side-agent registry.
 *
 * Data-only module: declares every known PM-relevant agent family with
 * provenance class, charter status, and docs metadata. No runtime health
 * inference. No UI rendering.
 *
 * Source of truth: `ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md`
 * and draft research notes for prompt-charter gaps.
 *
 * Provenance classes:
 * - `live-fed`: has actual babysitter feed rows from `/pm/babysitter`.
 * - `detected`: inferred from PM state (`/pm/state`, `/pm/queue`, `/pm/health`).
 * - `static`: known from registry only, no runtime signal.
 *
 * Charter status:
 * - `durable-charter`: a persistent doctrine doc exists.
 * - `spawn-brief-only`: only a spawn brief, no durable doc.
 * - `unknown`: charter status not yet determined.
 */

// ── Types ────────────────────────────────────────────────────────────

export type SideAgentProvenance = "live-fed" | "detected" | "static"

export type SideAgentCharterStatus = "durable-charter" | "spawn-brief-only" | "unknown"

interface BaseRegistryEntry {
	/** Stable machine-readable identifier. */
	id: string
	/** Short human label for UI display. */
	label: string
	/** One-line responsibilities description. */
	responsibilities: string
	/** Prompt-charter status. */
	charterStatus: SideAgentCharterStatus
	/** Docs filename or path when source truth exists; null otherwise. */
	docsLink: string | null
}

/** Live-fed entries always have `canHaveLiveFeed: true`. */
interface LiveFedRegistryEntry extends BaseRegistryEntry {
	provenance: "live-fed"
	canHaveLiveFeed: true
}

/** Detected entries are inferred from state; never live-fed. */
interface DetectedRegistryEntry extends BaseRegistryEntry {
	provenance: "detected"
	canHaveLiveFeed: false
}

/** Static entries are registry-only; never live-fed. Type-level guard. */
interface StaticRegistryEntry extends BaseRegistryEntry {
	provenance: "static"
	canHaveLiveFeed: false
}

export type SideAgentRegistryEntry =
	| LiveFedRegistryEntry
	| DetectedRegistryEntry
	| StaticRegistryEntry

// ── Registry ─────────────────────────────────────────────────────────

/**
 * All known PM-relevant agent families.
 *
 * Canonical source: `ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md`.
 * Charter gaps from draft research notes (MergeQueue, Frontier Curator).
 *
 * This array is the single source of truth for static-known agent metadata.
 * UI panels consume it to render agent cards with correct provenance badges.
 */
export const SIDE_AGENT_REGISTRY: readonly SideAgentRegistryEntry[] = [
	{
		id: "dispatch-tick",
		label: "Dispatch tick",
		responsibilities: "Plane Todo+queued tickets, dispatch queue, claims; spawns workers, releases expired claims/jobs",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-daemon.md",
	},
	{
		id: "worker-verify-pass",
		label: "Worker verify pass",
		responsibilities: "Settles jobs only on real worker-exit + durable outcome evidence",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-daemon.md",
	},
	{
		id: "tick-babysitter",
		label: "Tick babysitter",
		responsibilities: "Weak-tier deep-read of new transcript parts; rolling digest + escalate section",
		provenance: "live-fed",
		canHaveLiveFeed: true,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-babysitter-charter.md",
	},
	{
		id: "distributed-babysitter",
		label: "Distributed babysitter",
		responsibilities: "Per-box classification (healthy/idle/wedged/aborted/looping/decision-needed/stale-skip); auto-resume/unwedge/park",
		provenance: "live-fed",
		canHaveLiveFeed: true,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-distributed-babysitter.md",
	},
	{
		id: "idle-watchdog",
		label: "Idle watchdog",
		responsibilities: "PM supervisor loop: nudges, green-light follow-ups, decision flags for Chris",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-watchdog-handoff.md",
	},
	{
		id: "child-liveness-scan",
		label: "Child-liveness scan",
		responsibilities: "Parent→child task() sessions: hung children, pending-human gates; feeds degradedReasons",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "unknown",
		docsLink: null,
	},
	{
		id: "session-scanner",
		label: "Session scanner",
		responsibilities: "Live root sessions: activity state, context usage, stop markers, attention class",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-daemon.md",
	},
	{
		id: "heartbeats",
		label: "Heartbeats",
		responsibilities: "Scheduled per-box liveness/report jobs; emits heartbeat reports for hub",
		provenance: "detected",
		canHaveLiveFeed: false,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-config-reference.md",
	},
	{
		id: "babysitter-loop-health",
		label: "Babysitter loop health",
		responsibilities: "Monitors the distributed-babysitter loop itself; /health degraded on fault",
		provenance: "live-fed",
		canHaveLiveFeed: true,
		charterStatus: "durable-charter",
		docsLink: "ch5pm-distributed-babysitter.md",
	},
	{
		id: "merge-queue",
		label: "MergeQueue",
		responsibilities: "Merge queue management for dispatch jobs",
		provenance: "static",
		canHaveLiveFeed: false,
		charterStatus: "spawn-brief-only",
		docsLink: null,
	},
	{
		id: "frontier-curator",
		label: "Frontier Curator",
		responsibilities: "Ready frontier curation and project progress tracking",
		provenance: "static",
		canHaveLiveFeed: false,
		charterStatus: "spawn-brief-only",
		docsLink: null,
	},
] as const

// ── Lookups ──────────────────────────────────────────────────────────

const registryById = new Map(
	SIDE_AGENT_REGISTRY.map((entry) => [entry.id, entry]),
)

export function getSideAgentEntry(id: string): SideAgentRegistryEntry | undefined {
	return registryById.get(id)
}

export function getSideAgentsByProvenance(
	provenance: SideAgentProvenance,
): readonly SideAgentRegistryEntry[] {
	return SIDE_AGENT_REGISTRY.filter((entry) => entry.provenance === provenance)
}

export function getLiveFedSideAgents(): readonly LiveFedRegistryEntry[] {
	return SIDE_AGENT_REGISTRY.filter(
		(entry): entry is LiveFedRegistryEntry => entry.provenance === "live-fed",
	)
}

export function getSideAgentDocsPath(docsLink: string | null): string | null {
	if (!docsLink) return null
	return `ch5-company/docs/ch5pm/${docsLink}`
}
