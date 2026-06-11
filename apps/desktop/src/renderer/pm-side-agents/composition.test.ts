import { describe, expect, test } from "bun:test"
import { composePmSideAgentsModel } from "./composition"
import type { Ch5PmSideAgentQueuePayload } from "./types"

// Necessary regression guard: Task 1 live contract audit (2026-06-11).
// Documents exact architectural constraint to prevent accidental reversion to legacy flat array shape.
describe("pm side-agents composition", () => {
	test("composes queue model from explicit rows.jobs and rows.claims envelope", () => {
		const queuePayload: Ch5PmSideAgentQueuePayload = {
			ok: false,
			health: "degraded",
			helper: "inbox",
			generatedAt: new Date().toISOString(),
			degradedReasons: ["terminal-jobs-need-reconcile:29"],
			dataAges: { queue: "2m" },
			rows: {
				jobs: [
					{
						jobId: "job-1",
						ticketId: "CH5-1",
						repoId: "palot",
						boxId: "macmini",
						workerId: "worker-1",
						sessionId: "ses_123",
						state: "pending",
						enqueuedAt: new Date().toISOString(),
						completedSteps: ["setup"],
						failedStep: null,
						failedStepReason: null,
						rollbackSteps: [],
						metadata: { kind: "pm-reconcile" },
					},
				],
				claims: [
					{
						claimId: "claim-1",
						jobId: "job-1",
						boxId: "macmini",
						workerId: "worker-1",
						state: "active",
					},
				],
			},
		}

		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload,
			healthPayload: null,
		})

		expect(vm.queue.jobs).toHaveLength(1)
		expect(vm.queue.jobs[0]?.jobId).toBe("job-1")
		expect(vm.queue.jobs[0]?.ticketId).toBe("CH5-1")
		expect(vm.queue.jobs[0]?.sessionId).toBe("ses_123")
		expect(vm.queue.claims).toHaveLength(1)
		expect(vm.queue.claims[0]?.claimId).toBe("claim-1")
		expect(vm.queue.claims[0]?.jobId).toBe("job-1")
		expect(vm.queue.status).toBe("present")
	})

	test("handles missing queue payload gracefully", () => {
		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload: null,
			healthPayload: null,
		})

		expect(vm.queue.jobs).toHaveLength(0)
		expect(vm.queue.claims).toHaveLength(0)
		expect(vm.queue.status).toBe("missing")
		expect(vm.queue.freshness).toBe("missing")
	})

	test("identifies queue freshness correctly", () => {
		const staleGeneratedAt = new Date(Date.now() - 5 * 60 * 1000 - 1000).toISOString()
		const queuePayload: Ch5PmSideAgentQueuePayload = {
			ok: true,
			health: "healthy",
			helper: "inbox",
			generatedAt: staleGeneratedAt,
			rows: { jobs: [], claims: [] },
		}

		const vm = composePmSideAgentsModel({
			pmState: null,
			feedPayload: null,
			queuePayload,
			healthPayload: null,
		})

		expect(vm.queue.freshness).toBe("stale")
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
})
