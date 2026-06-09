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

describe("loom dirty field protection", () => {
	const tree = {
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
	}

	test("clean field accepts patch", () => {
		const sessionId = "ses_dirty_clean"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "dirty" }))
		renderCommand(sessionId, encodeWirePayload({ tree }))
		const result = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "selected", value: "opt_b" } }),
		)
		expect(result.errorCode).toBeUndefined()
		const poll = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toHaveLength(0)
		sessionEndCommand(sessionId)
	})

	test("dirty notes field holds patch and returns conflict", () => {
		const sessionId = "ses_dirty_hold"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "dirty" }))
		renderCommand(sessionId, encodeWirePayload({ tree }))
		stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "decision-root", field: "notes", value: "human note" } }))
		const result = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBe("dirty_field")
		expect((result.held as { policy?: string } | undefined)?.policy).toBe("ask")
		const poll = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toEqual([
			{
				nodeId: "decision-root",
				field: "notes",
				humanValue: "human note",
				agentValue: "agent note",
				policy: "ask",
			},
		])
		sessionEndCommand(sessionId)
	})

	test("merge policy uses registry merge function", async () => {
		const { LoomDirtyTracker } = await import("../dirty")
		const tracker = new LoomDirtyTracker()
		tracker.setDirty("decision-root", "notes", true)
		const resolution = tracker.resolvePatch({
			node: tree,
			patch: { nodeId: "decision-root", field: "notes", value: "agent note" },
			humanValue: "human note",
		})
		expect(resolution.kind).toBe("held")
	})
})
