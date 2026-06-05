import { describe, expect, test } from "bun:test"
import { mapSnapshotBundleToCards } from "./project-manager-cards"
import { composePmPrompt, markPendingAssignment, markPendingFailure } from "./project-manager-launcher"
import { createPendingSubmission } from "./project-manager-types"

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
})
