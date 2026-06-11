/**
 * Pure PM side-agent composition layer.
 *
 * Merges snapshot `Ch5PmLiveState` with daemon-fed side-agent sources while
 * preserving source-specific timestamps and health fields for later UI surfaces.
 */

import type { Ch5PmAttentionQueue, Ch5PmLiveState } from "../ch5pm-dashboard/types"
import type {
	Ch5PmSideAgentAttentionRow,
	Ch5PmSideAgentFeed,
	Ch5PmSideAgentHealthPayload,
	Ch5PmSideAgentLoopStatus,
	Ch5PmSideAgentPayload,
	Ch5PmSideAgentQueueClaim,
	Ch5PmSideAgentQueueJob,
	Ch5PmSideAgentQueuePayload,
} from "./types"

export type Ch5PmSideAgentFreshness = "fresh" | "stale" | "missing"
export type Ch5PmSideAgentSeverity = "healthy" | "degraded" | "offline"
export type Ch5PmSideAgentSourceStatus = "present" | "partial" | "missing"


export interface Ch5PmSideAgentsCompositionInput {
	pmState: Ch5PmLiveState | null
	feedPayload?: Ch5PmSideAgentPayload | null
	queuePayload?: Ch5PmSideAgentQueuePayload | null
	healthPayload?: Ch5PmSideAgentHealthPayload | null
	now?: number
	feedStaleAfterMs?: number
	queueStaleAfterMs?: number
	healthStaleAfterMs?: number
	pmStateStaleAfterMs?: number
}

export interface Ch5PmSideAgentSourceSnapshot<T> {
	name: "pm-state" | "feed" | "queue" | "health"
	status: Ch5PmSideAgentSourceStatus
	freshness: Ch5PmSideAgentFreshness
	severity: Ch5PmSideAgentSeverity
	label: string
	ageMs: number | null
	updatedAt: string | null
	data: T | null
	reasons: string[]
}

export interface Ch5PmSideAgentLoopViewModel {
	status: "running" | "stalled" | "failed" | "missing"
	severity: Ch5PmSideAgentSeverity
	updatedAt: string | null
	lastRunAt: string | null
	lastDigestAt: string | null
	passes: number | null
	intervalSeconds: number | null
	lastError: string | null
	reasons: string[]
	source: "feed" | "health" | "none"
}

export interface Ch5PmSideAgentAttentionViewModel {
	live: Ch5PmSideAgentAttentionRow[]
	humanQueue: Ch5PmAttentionQueue | null
}

export interface Ch5PmSideAgentMergeQueueViewModel {
	jobs: Ch5PmSideAgentQueueJob[]
	claims: Ch5PmSideAgentQueueClaim[]
	status: Ch5PmSideAgentSourceStatus
	freshness: Ch5PmSideAgentFreshness
	reasons: string[]
}

export interface Ch5PmSideAgentsViewModel {
	pmState: Ch5PmLiveState | null
	feed: Ch5PmSideAgentFeed | null
	queue: Ch5PmSideAgentMergeQueueViewModel
	attention: Ch5PmSideAgentAttentionViewModel
	loop: Ch5PmSideAgentLoopViewModel
	sources: {
		pmState: Ch5PmSideAgentSourceSnapshot<Ch5PmLiveState>
		feed: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>
		queue: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload>
		health: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload>
	}
	freshness: {
		overall: Ch5PmSideAgentFreshness
		feed: Ch5PmSideAgentFreshness
		queue: Ch5PmSideAgentFreshness
		health: Ch5PmSideAgentFreshness
	}
	degraded: {
		severity: Ch5PmSideAgentSeverity
		bannerReasons: string[]
		feedMissing: boolean
		queuePartial: boolean
		healthDegraded: boolean
		loopDegraded: boolean
	}
}

const FEED_STALE_MS = 5 * 60 * 1000
const PM_STATE_STALE_MS = 2 * 60 * 1000
const HEALTH_STALE_MS = 2 * 60 * 1000
const QUEUE_STALE_MS = 2 * 60 * 1000

export function composePmSideAgentsModel(
	input: Ch5PmSideAgentsCompositionInput,
): Ch5PmSideAgentsViewModel {
	const now = input.now ?? Date.now()
	const pmStateSource = buildPmStateSource(input.pmState, now)
	const feedSource = buildFeedSource(input.feedPayload, now)
	const queueSource = buildQueueSource(input.queuePayload, now)
	const healthSource = buildHealthSource(input.healthPayload, now)
	const loop = composeLoop(feedSource, healthSource)
	const bannerReasons = collectBannerReasons(feedSource, queueSource, healthSource, loop)
	const severity = deriveOverallSeverity(feedSource, queueSource, healthSource, loop)

	return {
		pmState: pmStateSource.data,
		feed: feedSource.data,
		queue: {
			jobs: queueSource.data?.jobs ?? [],
			claims: queueSource.data?.claims ?? [],
			status: queueSource.status,
			freshness: queueSource.freshness,
			reasons: queueSource.reasons,
		},
		attention: {
			live: feedSource.data?.attention ?? [],
			humanQueue: pmStateSource.data?.attentionQueue ?? null,
		},
		loop,
		sources: {
			pmState: pmStateSource,
			feed: feedSource,
			queue: queueSource,
			health: healthSource,
		},
		freshness: {
			overall: severity === "offline"
				? "missing"
				: pickWorstFreshness(feedSource.freshness, queueSource.freshness, healthSource.freshness),
			feed: feedSource.freshness,
			queue: queueSource.freshness,
			health: healthSource.freshness,
		},
		degraded: {
			severity,
			bannerReasons,
			feedMissing: feedSource.status === "missing",
			queuePartial: queueSource.status === "partial",
			healthDegraded: healthSource.severity !== "healthy",
			loopDegraded: loop.severity !== "healthy",
		},
	}
}

function buildPmStateSource(
	pmState: Ch5PmLiveState | null | undefined,
	now: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmLiveState> {
	const updatedAt = pmState?.updatedAt ?? null
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = pmState ? deriveFreshness(ageMs, PM_STATE_STALE_MS) : "missing"
	return {
		name: "pm-state",
		status: pmState ? "present" : "missing",
		freshness,
		severity: pmState ? "healthy" : "offline",
		label: "PM snapshot",
		ageMs,
		updatedAt,
		data: pmState ?? null,
		reasons: pmState ? [] : ["pm-state-unavailable"],
	}
}

function buildFeedSource(
	payload: Ch5PmSideAgentPayload | null | undefined,
	now: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed> {
	if (!payload) {
		return missingSource("feed", "Side-agent live feed", "side-agent-feed-missing")
	}

	const data: Ch5PmSideAgentFeed = {
		generatedAt: payload.generatedAt,
		hubBoxId: payload.hubBoxId,
		boxes: payload.boxes,
		recentActions: payload.recentActions,
		attention: payload.attention,
	}
	const ageMs = parseDurationMs(payload.dataAges?.feed) ?? parseAgeMs(payload.generatedAt, now)
	const freshness = deriveFreshness(ageMs, FEED_STALE_MS)
	const reasons = dedupe([
		...(payload.degradedReasons ?? []),
		...(payload.ok === false ? ["side-agent-feed-not-ok"] : []),
		...(freshness === "stale" ? ["side-agent-feed-stale"] : []),
	])
	return {
		name: "feed",
		status: "present",
		freshness,
		severity: reasons.length > 0 || payload.health === "degraded" ? "degraded" : "healthy",
		label: "Side-agent live feed",
		ageMs,
		updatedAt: payload.generatedAt,
		data,
		reasons,
	}
}

function buildQueueSource(
	payload: Ch5PmSideAgentQueuePayload | null | undefined,
	now: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload> {
	if (!payload) {
		return missingSource("queue", "Dispatch queue", "dispatch-queue-missing")
	}

	const jobs = Array.isArray(payload.jobs) ? payload.jobs : []
	const claims = Array.isArray(payload.claims) ? payload.claims : []
	const updatedAt = payload.updatedAt ?? payload.generatedAt ?? newestTimestamp([
		...jobs.map((job) => job.updatedAt ?? job.createdAt ?? null),
		...claims.map((claim) => claim.updatedAt ?? claim.createdAt ?? null),
	])
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = deriveFreshness(ageMs, QUEUE_STALE_MS)
	const partial = !Array.isArray(payload.jobs) || !Array.isArray(payload.claims)
	const reasons = dedupe([
		...(partial ? ["dispatch-queue-partial"] : []),
		...(freshness === "stale" ? ["dispatch-queue-stale"] : []),
	])
	return {
		name: "queue",
		status: partial ? "partial" : "present",
		freshness,
		severity: reasons.length > 0 ? "degraded" : "healthy",
		label: "Dispatch queue",
		ageMs,
		updatedAt,
		data: {
			jobs,
			claims,
			updatedAt,
			generatedAt: payload.generatedAt ?? null,
		},
		reasons,
	}
}

function buildHealthSource(
	payload: Ch5PmSideAgentHealthPayload | null | undefined,
	now: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload> {
	if (!payload) {
		return missingSource("health", "Daemon health", "daemon-health-missing")
	}

	const updatedAt = payload.updatedAt ?? payload.babysitterLoop?.lastRunAt ?? payload.babysitterLoop?.lastDigestAt ?? null
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = deriveFreshness(ageMs, HEALTH_STALE_MS)
	const reasons = dedupe([
		...(payload.degradedReasons ?? []),
		...(payload.health === "degraded" ? ["daemon-health-degraded"] : []),
		...(payload.ok === false ? ["daemon-health-not-ok"] : []),
		...(freshness === "stale" ? ["daemon-health-stale"] : []),
	])
	return {
		name: "health",
		status: "present",
		freshness,
		severity: reasons.length > 0 ? "degraded" : "healthy",
		label: "Daemon health",
		ageMs,
		updatedAt,
		data: payload,
		reasons,
	}
}

function composeLoop(
	feedSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>,
	healthSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload>,
): Ch5PmSideAgentLoopViewModel {
	const healthLoop = healthSource.data?.babysitterLoop ?? null
	const feedLoop = null
	const loop = healthLoop ?? feedLoop
	if (!loop) {
		return {
			status: "missing",
			severity: feedSource.status === "missing" && healthSource.status === "missing" ? "offline" : "degraded",
			updatedAt: healthSource.updatedAt,
			lastRunAt: null,
			lastDigestAt: null,
			passes: null,
			intervalSeconds: null,
			lastError: null,
			reasons: ["babysitter-loop-missing"],
			source: "none",
		}
	}

	const stalled = !loop.running && !loop.lastError
	const failed = Boolean(loop.lastError)
	const status = failed ? "failed" : stalled ? "stalled" : "running"
	const reasons = dedupe([
		...(status === "stalled" ? ["babysitter-loop-stalled"] : []),
		...(status === "failed" ? ["babysitter-loop-failed"] : []),
	])
	return {
		status,
		severity: status === "running" ? "healthy" : "degraded",
		updatedAt: healthSource.updatedAt,
		lastRunAt: loop.lastRunAt,
		lastDigestAt: loop.lastDigestAt,
		passes: loop.passes,
		intervalSeconds: loop.intervalSeconds,
		lastError: loop.lastError,
		reasons,
		source: healthLoop ? "health" : "feed",
	}
}

function collectBannerReasons(
	feedSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>,
	queueSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload>,
	healthSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload>,
	loop: Ch5PmSideAgentLoopViewModel,
): string[] {
	return dedupe([
		...feedSource.reasons,
		...queueSource.reasons,
		...healthSource.reasons,
		...loop.reasons,
	])
}

function deriveOverallSeverity(
	feedSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>,
	queueSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload>,
	healthSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload>,
	loop: Ch5PmSideAgentLoopViewModel,
): Ch5PmSideAgentSeverity {
	if (feedSource.status === "missing" && healthSource.status === "missing") {
		return "offline"
	}
	if (
		feedSource.severity !== "healthy" ||
		queueSource.severity !== "healthy" ||
		healthSource.severity !== "healthy" ||
		loop.severity !== "healthy"
	) {
		return "degraded"
	}
	return "healthy"
}

function missingSource<T>(
	name: "feed" | "queue" | "health",
	label: string,
	reason: string,
): Ch5PmSideAgentSourceSnapshot<T> {
	return {
		name,
		status: "missing",
		freshness: "missing",
		severity: "offline",
		label,
		ageMs: null,
		updatedAt: null,
		data: null,
		reasons: [reason],
	}
}

function deriveFreshness(
	ageMs: number | null,
	staleMs: number,
): Ch5PmSideAgentFreshness {
	if (ageMs == null) return "missing"
	return ageMs > staleMs ? "stale" : "fresh"
}

function pickWorstFreshness(...values: Ch5PmSideAgentFreshness[]): Ch5PmSideAgentFreshness {
	if (values.includes("missing")) return "missing"
	if (values.includes("stale")) return "stale"
	return "fresh"
}

function parseAgeMs(value: string | null | undefined, now: number): number | null {
	if (!value) return null
	const ts = Date.parse(value)
	if (Number.isNaN(ts)) return null
	return Math.max(0, now - ts)
}

function newestTimestamp(values: Array<string | null | undefined>): string | null {
	let latestTs = -1
	let latestValue: string | null = null
	for (const value of values) {
		if (!value) continue
		const ts = Date.parse(value)
		if (Number.isNaN(ts) || ts <= latestTs) continue
		latestTs = ts
		latestValue = value
	}
	return latestValue
}

function parseDurationMs(value: string | null | undefined): number | null {
	if (!value) return null
	const match = value.trim().match(/^(\d+)(ms|s|m|h)$/)
	if (!match) return null
	const amount = Number(match[1])
	const unit = match[2]
	if (!Number.isFinite(amount)) return null
	if (unit === "ms") return amount
	if (unit === "s") return amount * 1000
	if (unit === "m") return amount * 60 * 1000
	return amount * 60 * 60 * 1000
}

function dedupe(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))]
}
