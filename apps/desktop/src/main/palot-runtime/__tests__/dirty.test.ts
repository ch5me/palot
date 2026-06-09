import { describe, expect, test } from "bun:test"

import {
	getLoomSessionState,
	patchCommand,
	pollCommand,
	renderCommand,
	sessionEndCommand,
	sessionOpenCommand,
	stateCommand,
} from "../commands"
import { encodeWirePayload } from "../wire"

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

describe("loom dirty field protection", () => {
	test("clean field accepts patch and increments node rev", () => {
		const sessionId = "ses_dirty_clean"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "dirty" }))
		renderCommand(sessionId, encodeWirePayload({ tree }))
		const initialTree = getLoomSessionState(sessionId)?.tree
		expect(initialTree?.rev).toBe(1)
		const result = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "selected", value: "opt_b" } }),
		)
		expect(result.errorCode).toBeUndefined()
		expect(result.rev).toBe(2)
		const state = getLoomSessionState(sessionId)
		expect(state?.tree?.rev).toBe(2)
		const poll = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toHaveLength(0)
		expect(poll.events.find((frame) => frame.kind === "patch")?.patch?.rev).toBe(2)
		sessionEndCommand(sessionId)
	})

	test("dirty notes field holds patch and returns conflict without bumping node rev", () => {
		const sessionId = "ses_dirty_hold"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "dirty" }))
		renderCommand(sessionId, encodeWirePayload({ tree }))
		stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "decision-root", field: "notes", value: "human note" } }))
		const result = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBe("dirty_field")
		expect(result.rev).toBe(1)
		expect((result.held as { policy?: string } | undefined)?.policy).toBe("ask")
		expect(getLoomSessionState(sessionId)?.tree?.rev).toBe(1)
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

	test("stale per-node rev returns node delta", () => {
		const sessionId = "ses_stale_rev"
		sessionOpenCommand(sessionId, encodeWirePayload({ title: "dirty" }))
		renderCommand(sessionId, encodeWirePayload({ tree }))
		const firstPatch = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "selected", value: "opt_b" } }),
		)
		expect(firstPatch.errorCode).toBeUndefined()
		const stalePatch = patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(stalePatch.errorCode).toBe("stale_rev")
		expect(stalePatch.rev).toBe(2)
		expect(stalePatch.delta).toEqual([
			{ nodeId: "decision-root", field: "selected", value: "opt_b", rev: 2 },
		])
		sessionEndCommand(sessionId)
	})
})
