/**
 * Pure PM side-agent composition layer.
 *
 * Merges snapshot `Ch5PmLiveState` with daemon-fed side-agent sources while
 * preserving source-specific timestamps and health fields for later UI surfaces.
 */

import type {
	Ch5PmAttentionQueue,
	Ch5PmBabysitter,
	Ch5PmFollowUp,
	Ch5PmLineageItem,
	Ch5PmLiveBackgroundAgent,
	Ch5PmLiveBox,
	Ch5PmLiveLane,
	Ch5PmLivePlaneSummary,
	Ch5PmLiveSession,
	Ch5PmLiveState,
	Ch5PmNeedsChrisItem,
} from "../ch5pm-dashboard/types"
import type {
	Ch5PmSideAgentAttentionRow,
	Ch5PmSideAgentFeed,
	Ch5PmSideAgentHealthPayload,
	Ch5PmSideAgentPayload,
	Ch5PmSideAgentQueueClaim,
	Ch5PmSideAgentQueueJob,
	Ch5PmSideAgentQueuePayload,
} from "./types"

export type Ch5PmSideAgentFreshness = "fresh" | "stale" | "missing"
export type Ch5PmSideAgentSeverity = "healthy" | "degraded" | "offline"
export type Ch5PmSideAgentSourceStatus = "present" | "partial" | "missing"
export type Ch5PmLaneStatus = "working" | "done" | "nudged" | "needs-chris" | "idle"

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

export interface Ch5PmDenseConsoleLinks {
	plane: string | null
}

export interface Ch5PmDenseConsoleCounts {
	boxes: number
	sessions: number
	lanes: number
	workingLanes: number
	backgroundAgents: number
	needsChris: number
	followUps: number
	recentCompletions: number
	busySessions: number
	working: number
	tasks: number
	ready: number
	tasksPerBox: number
	tasksPerSession: number
	tasksPerWorker: number
	attention: number
}


export interface Ch5PmDenseConsoleLineageViewModel extends Ch5PmLineageItem {
	sessions: Array<Ch5PmLineageItem["sessions"][number] & { projectSlug?: string }>
}

export interface Ch5PmDenseConsoleViewModel {
	boxes: Ch5PmLiveBox[]
	sessions: Ch5PmLiveSession[]
	lanes: Ch5PmLiveLane[]
	backgroundAgents: Ch5PmLiveBackgroundAgent[]
	plane: Ch5PmLivePlaneSummary
	recentCompletions: string[]
	needsChris: Ch5PmNeedsChrisItem[]
	followUps: Ch5PmFollowUp[]
	babysitter: Ch5PmBabysitter | null
	lineage: Ch5PmDenseConsoleLineageViewModel[]
	attentionQueue: Ch5PmAttentionQueue | null
	links: Ch5PmDenseConsoleLinks
	counts: Ch5PmDenseConsoleCounts
	freshness: {
		pmState: Ch5PmSideAgentFreshness
	}
	sources: {
		status: Ch5PmSideAgentSourceStatus
		freshness: Ch5PmSideAgentFreshness
		severity: Ch5PmSideAgentSeverity
		label: string
	}
}

export type Ch5PmQueueGroupKey =
	| "needs-human"
	| "merge-ready"
	| "retry"
	| "timed-out"
	| "failed"
	| "running"
	| "queued"
	| "other"

export interface Ch5PmQueueGroupViewModel {
	key: Ch5PmQueueGroupKey
	label: string
	jobs: Ch5PmSideAgentQueueJob[]
	claims: Ch5PmSideAgentQueueClaim[]
}

export interface Ch5PmSideAgentProvenanceSummary {
	liveFed: number
	detected: number
	static: number
	missing: number
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
	status: Ch5PmSideAgentSourceStatus
	freshness: Ch5PmSideAgentFreshness
	severity: Ch5PmSideAgentSeverity
	reasons: string[]
}

export interface Ch5PmSideAgentMergeQueueViewModel {
	jobs: Ch5PmSideAgentQueueJob[]
	claims: Ch5PmSideAgentQueueClaim[]
	groups: Ch5PmQueueGroupViewModel[]
	status: Ch5PmSideAgentSourceStatus
	freshness: Ch5PmSideAgentFreshness
	severity: Ch5PmSideAgentSeverity
	reasons: string[]
	updatedAt: string | null
	helper: string | null
}

export interface Ch5PmSideAgentsViewModel {
	pmState: Ch5PmLiveState | null
	feed: Ch5PmSideAgentFeed | null
	denseConsole: Ch5PmDenseConsoleViewModel
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
		pmState: Ch5PmSideAgentFreshness
	}
	status: {
		live: Ch5PmSideAgentSeverity
		feed: Ch5PmSideAgentSeverity
		queue: Ch5PmSideAgentSeverity
		health: Ch5PmSideAgentSeverity
		pmState: Ch5PmSideAgentSeverity
	}
	provenance: Ch5PmSideAgentProvenanceSummary
	degraded: {
		severity: Ch5PmSideAgentSeverity
		bannerReasons: string[]
		feedMissing: boolean
		feedStale: boolean
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
	const pmStateStaleAfterMs = input.pmStateStaleAfterMs ?? PM_STATE_STALE_MS
	const feedStaleAfterMs = input.feedStaleAfterMs ?? FEED_STALE_MS
	const queueStaleAfterMs = input.queueStaleAfterMs ?? QUEUE_STALE_MS
	const healthStaleAfterMs = input.healthStaleAfterMs ?? HEALTH_STALE_MS
	const pmStateSource = buildPmStateSource(input.pmState, now, pmStateStaleAfterMs)
	const feedSource = buildFeedSource(input.feedPayload, now, feedStaleAfterMs)
	const queueSource = buildQueueSource(input.queuePayload, now, queueStaleAfterMs)
	const healthSource = buildHealthSource(input.healthPayload, now, healthStaleAfterMs)
	const loop = composeLoop(feedSource, healthSource)
	const bannerReasons = collectBannerReasons(feedSource, queueSource, healthSource, loop)
	const severity = deriveOverallSeverity(feedSource, queueSource, healthSource, loop)
	const queueJobs = queueSource.data?.rows.jobs ?? []
	const queueClaims = queueSource.data?.rows.claims ?? []

	return {
		pmState: pmStateSource.data,
		feed: feedSource.data,
		denseConsole: composeDenseConsole(pmStateSource),
		queue: {
			jobs: queueJobs,
			claims: queueClaims,
			groups: buildQueueGroups(queueJobs, queueClaims),
			status: queueSource.status,
			freshness: queueSource.freshness,
			severity: queueSource.severity,
			reasons: queueSource.reasons,
			updatedAt: queueSource.updatedAt,
			helper: queueSource.data?.helper ?? null,
		},
		attention: composeAttention(feedSource, pmStateSource),
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
			pmState: pmStateSource.freshness,
		},
		status: {
			live: severity,
			feed: feedSource.severity,
			queue: queueSource.severity,
			health: healthSource.severity,
			pmState: pmStateSource.severity,
		},
		provenance: summarizeProvenance(feedSource, queueSource, healthSource),
		degraded: {
			severity,
			bannerReasons,
			feedMissing: feedSource.status === "missing",
			feedStale: feedSource.freshness === "stale",
			queuePartial: queueSource.status === "partial",
			healthDegraded: healthSource.severity !== "healthy",
			loopDegraded: loop.severity !== "healthy",
		},
	}
}

export function classifyLaneStatus(status?: string): Ch5PmLaneStatus {
	const normalized = status?.trim().toLowerCase() ?? "idle"
	if (normalized.includes("need") || normalized.includes("human")) return "needs-chris"
	if (normalized.includes("nudge")) return "nudged"
	if (normalized.includes("done") || normalized.includes("claim")) return "done"
	if (normalized.includes("work") || normalized.includes("busy") || normalized.includes("run")) return "working"
	return "idle"
}

function composeDenseConsole(
	pmStateSource: Ch5PmSideAgentSourceSnapshot<Ch5PmLiveState>,
): Ch5PmDenseConsoleViewModel {
	const state = pmStateSource.data
	const lanes = state?.lanes ?? []
	const sessions = state?.sessions ?? []
	const boxes = state?.boxes ?? []
	const backgroundAgents = state?.backgroundAgents ?? []
	const followUps = state?.followUps ?? []
	const recentCompletions = state?.recentCompletions ?? []
	const needsChris = state?.needsChris ?? []
	const attentionQueue = state?.attentionQueue ?? null
	const plane: Ch5PmLivePlaneSummary = state?.plane ?? {
		readyFrontier: [],
	}
	const sessionsById = new Map(sessions.map((session) => [session.id, session]))
	const workingLanes = lanes.filter((lane) => classifyLaneStatus(lane.status) === "working")
	const busySessions = sessions.filter((session) =>
		["busy", "settling", "running"].includes(session.state?.trim().toLowerCase() ?? ""),
	)
	const working = workingLanes.length || busySessions.length
	const lineage = (state?.lineage ?? []).map((item) => ({
		...item,
		sessions: item.sessions.map((session) => ({
			...session,
			projectSlug: session.projectSlug ?? sessionsById.get(session.id)?.projectSlug,
		})),
	}))
	const asks = plane.projects ?? 0
	const ready = plane.readyFrontier.length

	return {
		boxes,
		sessions,
		lanes,
		backgroundAgents,
		plane,
		recentCompletions,
		needsChris,
		followUps,
		babysitter: state?.babysitter ?? null,
		lineage,
		attentionQueue,
		links: {
			plane: typeof plane.readUrl === "string" ? plane.readUrl : null,
		},
		counts: {
			boxes: boxes.length,
			sessions: sessions.length,
			lanes: lanes.length,
			workingLanes: workingLanes.length,
			backgroundAgents: backgroundAgents.length,
			needsChris: needsChris.length,
			followUps: followUps.length,
			recentCompletions: recentCompletions.length,
			busySessions: busySessions.length,
			working,
			tasks: asks,
			ready,
			tasksPerBox: asks,
			tasksPerSession: sessions.length,
			tasksPerWorker: backgroundAgents.length,
			attention: attentionQueue?.counts?.total ?? 0,

		},
		freshness: {
			pmState: pmStateSource.freshness,
		},
		sources: {
			status: pmStateSource.status,
			freshness: pmStateSource.freshness,
			severity: pmStateSource.severity,
			label: pmStateSource.label,
		},
	}
}

function composeAttention(
	feedSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>,
	pmStateSource: Ch5PmSideAgentSourceSnapshot<Ch5PmLiveState>,
): Ch5PmSideAgentAttentionViewModel {
	const live = feedSource.data?.attention ?? []
	const humanQueue = pmStateSource.data?.attentionQueue ?? null
	const status: Ch5PmSideAgentSourceStatus = feedSource.status === "missing" && !humanQueue
		? "missing"
		: humanQueue && feedSource.status !== "present"
			? "partial"
			: "present"
	const freshness = pickWorstFreshness(feedSource.freshness, pmStateSource.freshness)
	const severity = feedSource.severity !== "healthy" ? feedSource.severity : pmStateSource.severity
	const reasons = dedupe([
		...feedSource.reasons,
		...(humanQueue ? [] : ["attention-queue-missing"]),
	])

	return {
		live,
		humanQueue,
		status,
		freshness,
		severity,
		reasons,
	}
}

function getJobGroupKey(job: Ch5PmSideAgentQueueJob): Ch5PmQueueGroupKey {
	const state = job.state?.toLowerCase() ?? ""
	const failedReason = (job.failedStepReason ?? "").toLowerCase()
	const metadata = (job.metadata as Record<string, unknown>) ?? {}

	// 1. needs-human (highest precedence)
	if (
		state.includes("needs-human") ||
		state.includes("needs_human") ||
		metadata.verifyPending === true ||
		failedReason.includes("human") ||
		failedReason.includes("verify") ||
		failedReason.includes("reconcile")
	) {
		return "needs-human"
	}

	// 2. merge-ready (requires concrete durable-success evidence, not absence of failure)
	const hasMergeStep = Array.isArray(job.completedSteps) && job.completedSteps.some((s: string) => s.toLowerCase().includes("merge"))
	if (
		(state === "done" || state === "merged" || state === "success") &&
		(hasMergeStep || (metadata as any).kind === "merge" || state === "merged")
	) {
		return "merge-ready"
	}

	// 3. retry
	if (
		state === "retry" ||
		(metadata as any).retryable === true ||
		(state === "failed" && !job.failedStep && (!job.rollbackSteps || job.rollbackSteps.length === 0))
	) {
		return "retry"
	}

	// 4. timed-out
	if (state.includes("timeout") || failedReason.includes("timeout")) {
		return "timed-out"
	}

	// 5. failed
	if (state === "failed" || job.failedStep) {
		return "failed"
	}

	// Fallbacks
	if (state === "active" || state === "running" || state === "claimed" || state === "executing") return "running"
	if (state === "pending" || state === "queued" || state === "waiting") return "queued"
	return "other"
}

function buildQueueGroups(
	jobs: Ch5PmSideAgentQueueJob[],
	claims: Ch5PmSideAgentQueueClaim[],
): Ch5PmQueueGroupViewModel[] {
	const groupKeys: Ch5PmQueueGroupKey[] = [
		"needs-human",
		"merge-ready",
		"retry",
		"timed-out",
		"failed",
		"running",
		"queued",
		"other",
	]

	const groups: Record<Ch5PmQueueGroupKey, { jobs: Ch5PmSideAgentQueueJob[]; claims: Ch5PmSideAgentQueueClaim[] }> = {} as any
	for (const key of groupKeys) {
		groups[key] = { jobs: [], claims: [] }
	}

	for (const job of jobs) {
		const key = getJobGroupKey(job)
		groups[key].jobs.push(job)
	}

	const jobIdsByGroup: Record<Ch5PmQueueGroupKey, Set<string>> = {} as any
	for (const key of groupKeys) {
		jobIdsByGroup[key] = new Set(groups[key].jobs.map((j) => j.jobId))
	}

	for (const claim of claims) {
		const jobId = claim.jobId ?? ""
		let assigned = false
		for (const key of groupKeys) {
			if (jobIdsByGroup[key].has(jobId)) {
				groups[key].claims.push(claim)
				assigned = true
				break
			}
		}
		if (!assigned) {
			// Fallback: assign to "other" or infer from claim state
			groups.other.claims.push(claim)
		}
	}

	const labels: Record<Ch5PmQueueGroupKey, string> = {
		"needs-human": "needs human",
		"merge-ready": "merge ready",
		retry: "retry",
		"timed-out": "timed out",
		failed: "failed",
		running: "running",
		queued: "queued",
		other: "other",
	}

	return groupKeys
		.filter((key) => groups[key].jobs.length > 0 || groups[key].claims.length > 0)
		.map((key) => ({
			key,
			label: labels[key],
			jobs: groups[key].jobs,
			claims: groups[key].claims,
		}))
}

function summarizeProvenance(
	feedSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentFeed>,
	queueSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload>,
	healthSource: Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload>,
): Ch5PmSideAgentProvenanceSummary {
	return {
		liveFed: countPresentSources(feedSource, healthSource),
		detected: countPresentSources(queueSource),
		static: 0,
		missing: countMissingSources(feedSource, queueSource, healthSource),
	}
}

function buildPmStateSource(
	pmState: Ch5PmLiveState | null | undefined,
	now: number,
	staleAfterMs: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmLiveState> {
	const updatedAt = pmState?.updatedAt ?? null
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = pmState ? deriveFreshness(ageMs, staleAfterMs) : "missing"
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
	staleAfterMs: number,
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
	const freshness = deriveFreshness(ageMs, staleAfterMs)
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
	staleAfterMs: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentQueuePayload> {
	if (!payload) {
		return missingSource("queue", "Dispatch queue", "dispatch-queue-missing")
	}

	const rows = payload.rows ?? { jobs: [], claims: [] }
	const jobs = Array.isArray(rows.jobs) ? rows.jobs : []
	const claims = Array.isArray(rows.claims) ? rows.claims : []
	const updatedAt = payload.generatedAt ?? newestTimestamp([
		...jobs.map((job) => job.endedAt ?? job.startedAt ?? job.enqueuedAt ?? null),
		...claims.map((claim) => claim.releasedAt ?? claim.claimedAt ?? null),
	])
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = deriveFreshness(ageMs, staleAfterMs)
	const partial = !Array.isArray(rows.jobs) || !Array.isArray(rows.claims)
	const reasons = dedupe([
		...(payload.degradedReasons ?? []),
		...(partial ? ["dispatch-queue-partial"] : []),
		...(freshness === "stale" ? ["dispatch-queue-stale"] : []),
		...(payload.health && payload.health !== "healthy" ? ["dispatch-queue-health-degraded"] : []),
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
			ok: payload.ok,
			health: payload.health,
			helper: payload.helper,
			rows: { jobs, claims },
			generatedAt: payload.generatedAt,
			degradedReasons: payload.degradedReasons,
			dataAges: payload.dataAges ?? null,
		},
		reasons,
	}
}

function buildHealthSource(
	payload: Ch5PmSideAgentHealthPayload | null | undefined,
	now: number,
	staleAfterMs: number,
): Ch5PmSideAgentSourceSnapshot<Ch5PmSideAgentHealthPayload> {
	if (!payload) {
		return missingSource("health", "Daemon health", "daemon-health-missing")
	}

	const updatedAt = payload.generatedAt ?? payload.babysitterLoop?.lastRunAt ?? payload.babysitterLoop?.lastDigestAt ?? null
	const ageMs = parseAgeMs(updatedAt, now)
	const freshness = deriveFreshness(ageMs, staleAfterMs)
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
	const loop = healthLoop
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

function countPresentSources(...sources: Array<Ch5PmSideAgentSourceSnapshot<unknown>>): number {
	return sources.filter((source) => source.status !== "missing").length
}

function countMissingSources(...sources: Array<Ch5PmSideAgentSourceSnapshot<unknown>>): number {
	return sources.filter((source) => source.status === "missing").length
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
