import { describe, expect, test } from "bun:test"
import { isTaggedProjectManagerSession } from "./atoms/project-manager"
import { mapSnapshotBundleToCards, resolvePmTicketProjectSlug } from "./project-manager-cards"
import { composePmPrompt, markPendingAssignment, markPendingFailure } from "./project-manager-launcher"
import { createPendingSubmission } from "./project-manager-types"

type ActiveSessionCountArgs = {
	selectedDirectory: string
	activeSessionSnapshot:
		| {
				sessions: Array<{ directory: string }>
			}
		| null
	allAgents: Array<{ directory: string; status: string; isAttached: boolean }>
}

function countProjectManagerActiveSessions({
	selectedDirectory,
	activeSessionSnapshot,
	allAgents,
}: ActiveSessionCountArgs): number {
	const liveAttachedCount =
		activeSessionSnapshot?.sessions.filter((session) => session.directory === selectedDirectory).length ?? 0
	if (liveAttachedCount > 0) return liveAttachedCount
	return allAgents.filter(
		(a) =>
			a.directory === selectedDirectory &&
			(a.status === "running" || a.status === "waiting" || (a.isAttached && a.status === "idle")),
	).length
}

describe("project manager launcher", () => {
	test("composePmPrompt appends the user request below the prompt document", () => {
		const result = composePmPrompt("# PM", "Ship the sidebar")
		expect(result).toContain("# PM")
		expect(result).toContain("## User Request")
		expect(result).toContain("Ship the sidebar")
	})

	test("pending submission can transition to assigned and failed states", () => {
		const pending = createPendingSubmission({
			projectDirectory: "/tmp/palot",
			projectName: "palot",
			projectSlug: "palot-123",
			prompt: "Audit PM lane",
		})

		const assigned = markPendingAssignment(pending, {
			sessionId: "ses_pm_1",
			projectDirectory: pending.projectDirectory,
			projectSlug: pending.projectSlug,
			projectName: pending.projectName,
			sessionTitle: "Project Manager",
		})
		expect(assigned.status).toBe("assigned")
		expect(assigned.assignedSessionId).toBe("ses_pm_1")

		const failed = markPendingFailure(pending, "boom")
		expect(failed.status).toBe("failed")
		expect(failed.error).toBe("boom")
	})
})

describe("project manager cards", () => {
	test("snapshot tickets map into sparse cards", () => {
		const cards = mapSnapshotBundleToCards({
			activeTickets: [
				{
					ticketId: "CH5-1",
					name: "Fix PM card",
					repo: "palot",
					boxId: "macmini",
					slotId: "slot-a",
					sessionId: "ses_1",
					classification: "worker",
				},
			],
			queueTickets: [
				{
					ticketId: "CH5-2",
					name: "Queue PM task",
					priority: "high",
				},
			],
			blockedTickets: [
				{
					ticketId: "CH5-3",
					name: "Blocked PM task",
					classification: "needs_human",
				},
			],
		})

		expect(cards).toHaveLength(3)
		expect(cards[0]?.status).toBe("active")
		expect(cards[1]?.status).toBe("queued")
		expect(cards[2]?.status).toBe("blocked")
		expect(cards[0]?.meta).toContain("palot")
	})

	test("ticket route resolution prefers live session slug", () => {
		const [card] = mapSnapshotBundleToCards({
			activeTickets: [
				{
					ticketId: "CH5-1",
					name: "Fix PM route",
					repo: "palot",
					sessionId: "ses_1",
				},
			],
			queueTickets: [],
			blockedTickets: [],
		})

		expect(
			resolvePmTicketProjectSlug(card!, {
				projects: [{ name: "palot", directory: "/repo/palot", slug: "palot-local" }],
				sessions: [{ id: "ses_1", sessionId: "ses_1", projectSlug: "fitbot-live" }],
				fallbackProjectSlug: "fallback",
			}),
		).toBe("fitbot-live")
	})

	test("ticket route resolution falls back to repo project match", () => {
		const [card] = mapSnapshotBundleToCards({
			activeTickets: [
				{
					ticketId: "CH5-1",
					name: "Fix PM route",
					repo: "palot",
					sessionId: "ses_missing",
				},
			],
			queueTickets: [],
			blockedTickets: [],
		})

		expect(
			resolvePmTicketProjectSlug(card!, {
				projects: [{ name: "palot", directory: "/repo/palot", slug: "palot-local" }],
				sessions: [],
				fallbackProjectSlug: "fallback",
			}),
		).toBe("palot-local")
	})
})

describe("project manager active session count", () => {
	test("prefers live attached session snapshot over partially hydrated agents", () => {
		expect(
			countProjectManagerActiveSessions({
				selectedDirectory: "/repo/palot",
				activeSessionSnapshot: {
					sessions: [
						{ directory: "/repo/palot" },
						{ directory: "/repo/palot" },
						{ directory: "/repo/palot" },
						{ directory: "/repo/palot" },
					],
				},
				allAgents: [
					{ directory: "/repo/palot", status: "running", isAttached: true },
					{ directory: "/repo/palot", status: "idle", isAttached: true },
				],
			}),
		).toBe(4)
	})

	test("falls back to hydrated agents when no live snapshot exists", () => {
		expect(
			countProjectManagerActiveSessions({
				selectedDirectory: "/repo/palot",
				activeSessionSnapshot: null,
				allAgents: [
					{ directory: "/repo/palot", status: "running", isAttached: true },
					{ directory: "/repo/palot", status: "waiting", isAttached: false },
					{ directory: "/repo/palot", status: "idle", isAttached: true },
					{ directory: "/repo/palot", status: "idle", isAttached: false },
					{ directory: "/repo/other", status: "running", isAttached: true },
				],
			}),
		).toBe(3)
	})
})

describe("project manager session tags", () => {
	test("identifies tagged PM sessions by session id", () => {
		expect(
			isTaggedProjectManagerSession(
				{
					ses_pm_1: {
						sessionId: "ses_pm_1",
						projectDirectory: "/tmp/palot",
						projectSlug: "palot-123",
						projectName: "palot",
						createdAt: 1,
					},
				},
				"ses_pm_1",
			),
		).toBe(true)
		expect(isTaggedProjectManagerSession({}, "ses_pm_1")).toBe(false)
	})
})
