import { describe, expect, test } from "bun:test"

import {
	patchCommand,
	pollCommand,
	renderCommand,
	sessionEndCommand,
	sessionOpenCommand,
	stateCommand,
} from "../commands"
import { encodeWirePayload } from "../wire"

describe("loom bindings", () => {
	test("state mutation accumulates for poll and signal queues on next poll", () => {
		const sessionId = "ses_bindings"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "bindings" }))
		renderCommand(
			sessionId,
			encodeWirePayload({
				tree: {
					id: "decision-root",
					component: "decision_card",
					props: {
						title: "Pick",
						options: [
							{ id: "opt_a", label: "A" },
							{ id: "opt_b", label: "B" },
						],
						selected: null,
						notes: "",
					},
				},
			}),
		)
		stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "decision-root", field: "notes", value: "draft note" } }))
		const eventResult = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
		expect(eventResult.stateDelta).toEqual([
			{ nodeId: "decision-root", field: "notes", value: "draft note" },
		])
		stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "decision-root", field: "notes", value: "next draft" } }))
		const patch = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: eventResult.rev, nodeId: "decision-root", field: "selected", value: "opt_b" } }),
		)
		expect(patch.errorCode).toBeUndefined()
		const afterPatch = pollCommand(sessionId, encodeWirePayload({ rev: eventResult.rev }))
		expect(afterPatch.events.some((frame) => frame.kind === "patch")).toBe(true)
		sessionEndCommand(sessionId)
	})

	test("signal event queues for next poll", async () => {
		const sessionId = "ses_signal"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "signal" }))
		renderCommand(
			sessionId,
			encodeWirePayload({
				tree: {
					id: "decision-root",
					component: "decision_card",
					props: {
						title: "Pick",
						options: [{ id: "opt_a", label: "A" }],
						selected: "opt_a",
						notes: "",
					},
				},
			}),
		)
		const { queueLoomEvent } = await import("../session-store")
		queueLoomEvent(sessionId, { type: "submit", nodeId: "decision-root", payload: { optionId: "opt_a" } })
		const result = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
		expect(result.events.some((frame) => frame.kind === "event" && frame.event?.type === "submit")).toBe(true)
		sessionEndCommand(sessionId)
	})
})
