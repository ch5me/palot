import { describe, expect, test } from "bun:test"
import type { Ch5PmLiveState } from "../ch5pm-dashboard/types"
import { classifyLaneStatus, composePmSideAgentsModel } from "./composition"
import type {
	Ch5PmSideAgentHealthPayload,
	Ch5PmSideAgentPayload,
	Ch5PmSideAgentQueuePayload,
} from "./types"

const NOW = Date.parse("2026-06-10T12:00:00.000Z")

function makePmState(overrides: Partial<Ch5PmLiveState> = {}): Ch5PmLiveState {
	return {
		updatedAt: "2026-06-10T11:59:00.000Z",
		generatedBy: "daemon",
		boxes: [],
		sessions: [],
		lanes: [],
		backgroundAgents: [],
		plane: {
			workspaceSlug: "palot",
			projects: 1,
			epics: 2,
			readUrl: "https://plane.example",
			readyFrontier: [],
		},
		recentCompletions: [],
		needsChris: [],
		followUps: [],
		attentionQueue: {
			open: [],
			counts: { total: 0, p0: 0, p1: 0, p2: 0 },
		},
		...overrides,
	}
}

function makeFeedPayload(overrides: Partial<Ch5PmSideAgentPayload> = {}): Ch5PmSideAgentPayload {
	return {
		ok: true,
		health: "healthy",
		helper: "babysitter",
		hubBoxId: "hub-1",
		generatedAt: "2026-06-10T11:58:00.000Z",
		boxes: [],
		recentActions: [],
		attention: [],
		babysitterLoop: null,
		degradedReasons: [],
		dataAges: { feed: "1m" },
		...overrides,
	}
}

function makeQueuePayload(overrides: Partial<Ch5PmSideAgentQueuePayload> = {}): Ch5PmSideAgentQueuePayload {
	return {
		ok: true,
		health: "healthy",
		helper: "queue",
		generatedAt: "2026-06-10T11:58:30.000Z",
		degradedReasons: [],
		dataAges: { queue: "90s" },
		rows: {
			jobs: [],
			claims: [],
		},
		...overrides,
	}
}

function makeHealthPayload(overrides: Partial<Ch5PmSideAgentHealthPayload> = {}): Ch5PmSideAgentHealthPayload {
	return {
		ok: true,
		health: "healthy",
		helper: "health",
		generatedAt: "2026-06-10T11:58:45.000Z",
		babysitterLoop: {
			enabled: true,
			running: true,
			intervalSeconds: 30,
			lastRunAt: "2026-06-10T11:58:40.000Z",
			lastDigestAt: "2026-06-10T11:58:35.000Z",
			lastError: null,
			passes: 12,
		},
		dataAges: { health: "75s" },
		degradedReasons: [],
		...overrides,
	}
}

describe("pm side-agents composition", () => {
	test("composes shared dense-console and side-agent authority from one mapper", () => {
		const pmState = makePmState({
			boxes: [{ id: "box-1", role: "hub", daemon: { health: "healthy", url: "http://daemon" } }],
			sessions: [{ id: "ses-1", title: "Worker 1", repo: "palot", state: "running", box: "box-1" }],
			lanes: [{ name: "lane-1", status: "working", session: "ses-1", goal: "ship" }],
			backgroundAgents: [{ task: "digest", status: "running", milestones: { phase: "scan" } }],
			needsChris: [{ ticket: "CH5-1", title: "Need answer", source: "daemon", priority: "p1" }],
			followUps: [{ source: "queue", item: "check worker", status: "open", resolution: "pending" }],
			recentCompletions: ["ticket closed"],
			attentionQueue: {
				open: [
					{
						id: "attn-1",
						createdAt: NOW - 1_000,
						updatedAt: NOW - 500,
						priority: "p1",
						state: "open",
						what: "Need review",
						whyNow: "blocked",
						options: [{ label: "review" }],
					},
				],
				counts: { total: 1, p0: 0, p1: 1, p2: 0 },
			},
		})
		const feedPayload = makeFeedPayload({
			attention: [
				{ boxId: "box-1", sessionId: "ses-1", title: "Worker 1", classification: "decision-needed", reason: "waiting", gist: "Need human" },
			],
		})
		const queuePayload = makeQueuePayload({
			rows: {
				jobs: [
					{ jobId: "job-1", ticketId: "CH5-1", sessionId: "ses-1", state: "running", startedAt: "2026-06-10T11:58:20.000Z" },
					{ jobId: "job-2", ticketId: "CH5-2", state: "pending", enqueuedAt: "2026-06-10T11:58:00.000Z" },
				],
				claims: [
					{ claimId: "claim-1", jobId: "job-1", state: "active" },
					{ claimId: "claim-2", jobId: "job-2", state: "pending" },
				],
			},
		})
		const healthPayload = makeHealthPayload()

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload,
			queuePayload,
			healthPayload,
			now: NOW,
		})

		expect(vm.denseConsole.counts.workingLanes).toBe(1)
		expect(vm.denseConsole.counts.busySessions).toBe(1)
		expect(vm.denseConsole.counts.working).toBe(1)
		expect(vm.denseConsole.counts.tasks).toBe(1)
		expect(vm.denseConsole.counts.ready).toBe(0)
		expect(vm.denseConsole.counts.tasksPerBox).toBe(1)
		expect(vm.denseConsole.counts.tasksPerSession).toBe(1)
		expect(vm.denseConsole.counts.tasksPerWorker).toBe(1)
		expect(vm.denseConsole.counts.attention).toBe(1)
		expect(vm.denseConsole.links.plane).toBe("https://plane.example")
		expect(vm.denseConsole.sources.label).toBe("PM snapshot")
		expect(vm.denseConsole.lineage).toEqual([])
		// Groups with no jobs/claims are filtered out
		expect(vm.queue.groups.map((group) => group.key)).toEqual(["running", "queued"])
		expect(vm.queue.groups[0]?.jobs[0]?.jobId).toBe("job-1")
		expect(vm.queue.groups[1]?.claims[0]?.claimId).toBe("claim-2")
		expect(vm.attention.status).toBe("present")
		expect(vm.attention.live[0]?.sessionId).toBe("ses-1")
		expect(vm.sources.feed.label).toBe("Side-agent live feed")
		expect(vm.provenance).toEqual({ liveFed: 2, detected: 1, static: 0, missing: 0 })
	})

	test("keeps state-led dense console alive when feed missing and queue degraded", () => {
		const pmState = makePmState()
		const queuePayload = makeQueuePayload({
			ok: false,
			health: "degraded",
			degradedReasons: ["terminal-jobs-need-reconcile:29"],
			rows: {
				jobs: [{ jobId: "job-1", state: "pending" }],
				claims: [],
			},
		})
		const healthPayload = makeHealthPayload()

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload: null,
			queuePayload,
			healthPayload,
			now: NOW,
		})

		expect(vm.denseConsole.counts.sessions).toBe(0)
		expect(vm.denseConsole.counts.working).toBe(0)
		expect(vm.denseConsole.counts.attention).toBe(0)
		expect(vm.denseConsole.sources.severity).toBe("healthy")
		expect(vm.degraded.severity).toBe("degraded")
		expect(vm.degraded.feedMissing).toBe(true)
		expect(vm.degraded.healthDegraded).toBe(false)
		expect(vm.queue.severity).toBe("degraded")
		expect(vm.queue.reasons).toContain("terminal-jobs-need-reconcile:29")
		expect(vm.attention.status).toBe("partial")
		expect(vm.attention.reasons).toContain("side-agent-feed-missing")
	})

	test("marks degraded source snapshots for stale and missing combinations", () => {
		const stalePmState = makePmState({
			updatedAt: "2026-06-10T11:40:00.000Z",
		})
		const staleQueuePayload = makeQueuePayload({
			generatedAt: "2026-06-10T11:40:00.000Z",
		})
		const degradedHealthPayload = makeHealthPayload({
			ok: false,
			health: "degraded",
			degradedReasons: ["health check failed"],
			babysitterLoop: {
				enabled: true,
				running: false,
				intervalSeconds: 30,
				lastRunAt: "2026-06-10T11:39:00.000Z",
				lastDigestAt: "2026-06-10T11:39:00.000Z",
				lastError: null,
				passes: 1,
			},
		})

		const vm = composePmSideAgentsModel({
			pmState: stalePmState,
			feedPayload: null,
			queuePayload: staleQueuePayload,
			healthPayload: degradedHealthPayload,
			now: NOW,
		})

		expect(vm.sources.pmState.freshness).toBe("stale")
		expect(vm.denseConsole.freshness.pmState).toBe("stale")
		expect(vm.sources.feed.status).toBe("missing")
		expect(vm.sources.queue.freshness).toBe("stale")
		expect(vm.sources.health.severity).toBe("degraded")
		expect(vm.loop.status).toBe("stalled")
		expect(vm.degraded.loopDegraded).toBe(true)
		expect(vm.degraded.bannerReasons).toContain("side-agent-feed-missing")
		expect(vm.degraded.bannerReasons).toContain("dispatch-queue-stale")
		expect(vm.degraded.bannerReasons).toContain("daemon-health-degraded")
	})

	test("handles missing queue payload gracefully", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.queue.jobs).toHaveLength(0)
		expect(vm.queue.claims).toHaveLength(0)
		expect(vm.queue.status).toBe("missing")
		expect(vm.queue.freshness).toBe("missing")
		expect(vm.provenance.missing).toBe(3)
	})

	test("keeps queue degraded while feed missing and health healthy", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: makeQueuePayload({
				health: "degraded",
				degradedReasons: ["terminal-jobs-need-reconcile:29"],
			}),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.sources.feed.status).toBe("missing")
		expect(vm.sources.queue.severity).toBe("degraded")
		expect(vm.sources.health.severity).toBe("healthy")
		expect(vm.degraded.feedMissing).toBe(true)
		expect(vm.degraded.healthDegraded).toBe(false)
		expect(vm.degraded.bannerReasons).toContain("side-agent-feed-missing")
		expect(vm.degraded.bannerReasons).toContain("terminal-jobs-need-reconcile:29")
	})

	test("counts detected and static registry sources without promoting them to live", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.provenance.liveFed).toBe(1)
		expect(vm.provenance.detected).toBeGreaterThan(0)
		expect(vm.provenance.static).toBe(0)
		expect(vm.status.queue).toBe("healthy")
	})
})

describe("pm side-agents types contract", () => {
	test("queue payload strictly nests jobs and claims inside rows", () => {
		const payload: Ch5PmSideAgentQueuePayload = {
			ok: true,
			health: "healthy",
			helper: "inbox",
			rows: {
				jobs: [{ jobId: "j1", state: "pending" }],
				claims: [{ claimId: "c1", state: "active" }],
			},
		}

		expect(payload.rows).toBeDefined()
		expect(payload.rows.jobs).toBeDefined()
		expect(payload.rows.claims).toBeDefined()
		expect((payload as any).jobs).toBeUndefined()
		expect((payload as any).claims).toBeUndefined()
	})

	test("groups queue jobs by precedence: needs-human > merge-ready > retry > timed-out > failed", () => {
		const pmState = makePmState()
		const queuePayload = makeQueuePayload({
			rows: {
				jobs: [
					{ jobId: "j-needs-human", state: "pending", metadata: { verifyPending: true } },
					{ jobId: "j-merge-ready", state: "done", completedSteps: ["build", "merge"] },
					{ jobId: "j-retry", state: "failed", failedStep: undefined, rollbackSteps: [] },
					{ jobId: "j-timeout", state: "failed", failedStep: "execute", failedStepReason: "timeout after 30s" },
					{ jobId: "j-failed", state: "failed", failedStep: "commit" },
					{ jobId: "j-running", state: "running" },
					{ jobId: "j-queued", state: "pending" },
				],
				claims: [
					{ claimId: "c1", jobId: "j-needs-human", state: "active" },
					{ claimId: "c2", jobId: "j-merge-ready", state: "active" },
				],
			},
		})
		const healthPayload = makeHealthPayload()

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload: null,
			queuePayload,
			healthPayload,
			now: NOW,
		})

		const groupKeys = vm.queue.groups.map((g) => g.key)
		expect(groupKeys).toContain("needs-human")
		expect(groupKeys).toContain("merge-ready")
		expect(groupKeys).toContain("retry")
		expect(groupKeys).toContain("timed-out")
		expect(groupKeys).toContain("failed")
		expect(groupKeys).toContain("running")
		expect(groupKeys).toContain("queued")

		expect(vm.queue.groups.find((g) => g.key === "needs-human")?.jobs[0]?.jobId).toBe("j-needs-human")
		expect(vm.queue.groups.find((g) => g.key === "merge-ready")?.jobs[0]?.jobId).toBe("j-merge-ready")
		expect(vm.queue.groups.find((g) => g.key === "retry")?.jobs[0]?.jobId).toBe("j-retry")
		expect(vm.queue.groups.find((g) => g.key === "timed-out")?.jobs[0]?.jobId).toBe("j-timeout")
		expect(vm.queue.groups.find((g) => g.key === "failed")?.jobs[0]?.jobId).toBe("j-failed")
	})

	test("queue groups ordered by precedence: needs-human first, other last", () => {
		const queuePayload = makeQueuePayload({
			rows: {
				jobs: [
					{ jobId: "j-other", state: "unknown-state" },
					{ jobId: "j-running", state: "running" },
					{ jobId: "j-needs-human", state: "pending", metadata: { verifyPending: true } },
					{ jobId: "j-failed", state: "failed", failedStep: "commit" },
				],
				claims: [],
			},
		})

		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload,
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		const keys = vm.queue.groups.map((g) => g.key)
		expect(keys.indexOf("needs-human")).toBeLessThan(keys.indexOf("failed"))
		expect(keys.indexOf("failed")).toBeLessThan(keys.indexOf("running"))
		expect(keys.indexOf("running")).toBeLessThan(keys.indexOf("other"))
	})

	test("queue groups unknown job state into other bucket", () => {
		const queuePayload = makeQueuePayload({
			rows: {
				jobs: [{ jobId: "j-weird", state: "cancelled" }],
				claims: [],
			},
		})

		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload,
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		const otherGroup = vm.queue.groups.find((g) => g.key === "other")
		expect(otherGroup).toBeDefined()
		expect(otherGroup?.jobs[0]?.jobId).toBe("j-weird")
	})
})

describe("pm side-agents loop status", () => {
	test("loop running when health reports running=true and no error", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload({
				babysitterLoop: {
					enabled: true,
					running: true,
					intervalSeconds: 30,
					lastRunAt: "2026-06-10T11:58:40.000Z",
					lastDigestAt: "2026-06-10T11:58:35.000Z",
					lastError: null,
					passes: 12,
				},
			}),
			now: NOW,
		})

		expect(vm.loop.status).toBe("running")
		expect(vm.loop.severity).toBe("healthy")
		expect(vm.loop.source).toBe("health")
		expect(vm.loop.passes).toBe(12)
	})

	test("loop failed when health reports lastError", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload({
				babysitterLoop: {
					enabled: true,
					running: false,
					intervalSeconds: 30,
					lastRunAt: "2026-06-10T11:58:40.000Z",
					lastDigestAt: "2026-06-10T11:58:35.000Z",
					lastError: "sqlite busy timeout",
					passes: 5,
				},
			}),
			now: NOW,
		})

		expect(vm.loop.status).toBe("failed")
		expect(vm.loop.severity).toBe("degraded")
		expect(vm.loop.lastError).toBe("sqlite busy timeout")
		expect(vm.degraded.loopDegraded).toBe(true)
		expect(vm.degraded.bannerReasons).toContain("babysitter-loop-failed")
	})

	test("loop missing when both feed and health absent", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.loop.status).toBe("missing")
		expect(vm.loop.source).toBe("none")
		expect(vm.loop.severity).toBe("offline")
	})
})

describe("pm side-agents overall severity", () => {
	test("offline when feed and health both missing", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: makeQueuePayload(),
			healthPayload: null,
			now: NOW,
		})

		expect(vm.degraded.severity).toBe("offline")
		expect(vm.status.live).toBe("offline")
		expect(vm.freshness.overall).toBe("missing")
	})

	test("degraded when one source unhealthy but not all missing", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: makeFeedPayload({ ok: false }),
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.degraded.severity).toBe("degraded")
		expect(vm.status.live).toBe("degraded")
		expect(vm.sources.feed.reasons).toContain("side-agent-feed-not-ok")
	})

	test("healthy when all sources present and ok", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: makeFeedPayload(),
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.degraded.severity).toBe("healthy")
		expect(vm.status.live).toBe("healthy")
		expect(vm.degraded.bannerReasons).toEqual([])
	})
})

describe("pm side-agents attention composition", () => {
	test("merges live feed attention with pmState human queue", () => {
		const feedPayload = makeFeedPayload({
			attention: [
				{ boxId: "box-1", sessionId: "ses-1", title: "Worker 1", classification: "decision-needed", reason: "waiting", gist: "Need human" },
			],
		})
		const pmState = makePmState({
			attentionQueue: {
				open: [
					{
						id: "attn-1",
						createdAt: NOW - 1_000,
						updatedAt: NOW - 500,
						priority: "p1",
						state: "open",
						what: "Need review",
						whyNow: "blocked",
						options: [{ label: "review" }],
					},
				],
				counts: { total: 1, p0: 0, p1: 1, p2: 0 },
			},
		})

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload,
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.attention.live).toHaveLength(1)
		expect(vm.attention.live[0]?.sessionId).toBe("ses-1")
		expect(vm.attention.humanQueue).toBeDefined()
		expect(vm.attention.humanQueue?.open).toHaveLength(1)
		expect(vm.attention.status).toBe("present")
	})

	test("attention partial when feed missing but human queue present", () => {
		const pmState = makePmState({
			attentionQueue: {
				open: [],
				counts: { total: 0, p0: 0, p1: 0, p2: 0 },
			},
		})

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload: null,
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		expect(vm.attention.status).toBe("partial")
		expect(vm.attention.live).toHaveLength(0)
		expect(vm.attention.humanQueue).toBeDefined()
	})

	test("attention missing when feed missing and no human queue", () => {
		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.attention.status).toBe("missing")
		expect(vm.attention.humanQueue).toBeNull()
	})
})

describe("pm side-agents freshness boundaries", () => {
	test("fresh when ageMs exactly at stale threshold", () => {
		// pmState updatedAt 120s ago = exactly at PM_STATE_STALE_MS (2min)
		const pmState = makePmState({ updatedAt: "2026-06-10T11:58:00.000Z" })

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.sources.pmState.freshness).toBe("fresh")
	})

	test("stale when ageMs exceeds stale threshold by 1ms", () => {
		// pmState updatedAt 120s+1ms ago
		const pmState = makePmState({ updatedAt: "2026-06-10T11:57:59.999Z" })

		const vm = composePmSideAgentsModel({
			pmState,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.sources.pmState.freshness).toBe("stale")
	})

	test("feed freshness derived from dataAges.feed duration string", () => {
		const feedPayload = makeFeedPayload({
			dataAges: { feed: "3m" },
		})

		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		// 3m = 180s > FEED_STALE_MS (5min = 300s)? No, 180s < 300s → fresh
		expect(vm.sources.feed.freshness).toBe("fresh")
	})

	test("feed stale when dataAges.feed exceeds threshold", () => {
		const feedPayload = makeFeedPayload({
			dataAges: { feed: "6m" },
		})

		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		// 6m = 360s > FEED_STALE_MS (300s) → stale
		expect(vm.sources.feed.freshness).toBe("stale")
		expect(vm.sources.feed.reasons).toContain("side-agent-feed-stale")
	})
})

describe("pm side-agents health degradation", () => {
	test("health ok:false produces daemon-health-not-ok reason", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: null,
			healthPayload: makeHealthPayload({ ok: false }),
			now: NOW,
		})

		expect(vm.sources.health.reasons).toContain("daemon-health-not-ok")
		expect(vm.sources.health.severity).toBe("degraded")
	})

	test("health degraded string produces daemon-health-degraded reason", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: null,
			queuePayload: null,
			healthPayload: makeHealthPayload({ health: "degraded" }),
			now: NOW,
		})

		expect(vm.sources.health.reasons).toContain("daemon-health-degraded")
		expect(vm.sources.health.severity).toBe("degraded")
	})
})

describe("pm side-agents dense console null state", () => {
	test("dense console handles null pmState gracefully", () => {
		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.denseConsole.counts.boxes).toBe(0)
		expect(vm.denseConsole.counts.sessions).toBe(0)
		expect(vm.denseConsole.counts.lanes).toBe(0)
		expect(vm.denseConsole.counts.workingLanes).toBe(0)
		expect(vm.denseConsole.counts.busySessions).toBe(0)
		expect(vm.denseConsole.links.plane).toBeNull()
		expect(vm.sources.pmState.status).toBe("missing")
		expect(vm.sources.pmState.freshness).toBe("missing")
	})
})

describe("pm side-agents provenance counts", () => {
	test("all sources present yields correct provenance", () => {
		const vm = composePmSideAgentsModel({
			pmState: makePmState(),
			feedPayload: makeFeedPayload(),
			queuePayload: makeQueuePayload(),
			healthPayload: makeHealthPayload(),
			now: NOW,
		})

		// feed + health = live-fed (2), queue = detected (1)
		expect(vm.provenance.liveFed).toBe(2)
		expect(vm.provenance.detected).toBe(1)
		expect(vm.provenance.missing).toBe(0)
	})

	test("all sources missing yields correct provenance", () => {
		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
			now: NOW,
		})

		expect(vm.provenance.liveFed).toBe(0)
		expect(vm.provenance.detected).toBe(0)
		expect(vm.provenance.missing).toBe(3)
	})
})

describe("classifyLaneStatus", () => {
	test("classifies working states", () => {
		expect(classifyLaneStatus("working")).toBe("working")
		expect(classifyLaneStatus("busy")).toBe("working")
		expect(classifyLaneStatus("running")).toBe("working")
	})

	test("classifies done states", () => {
		expect(classifyLaneStatus("done")).toBe("done")
		expect(classifyLaneStatus("claimed")).toBe("done")
	})

	test("classifies nudged states", () => {
		expect(classifyLaneStatus("nudged")).toBe("nudged")
	})

	test("classifies needs-chris states", () => {
		expect(classifyLaneStatus("needs-human")).toBe("needs-chris")
		expect(classifyLaneStatus("need human review")).toBe("needs-chris")
	})

	test("classifies idle as default", () => {
		expect(classifyLaneStatus("idle")).toBe("idle")
		expect(classifyLaneStatus(undefined)).toBe("idle")
		expect(classifyLaneStatus("")).toBe("idle")
		expect(classifyLaneStatus("something-else")).toBe("idle")
	})
})
