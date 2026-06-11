import { afterEach, describe, expect, test } from "bun:test"

import {
	patchCommand,
	pollCommand,
	renderCommand,
	sessionEndCommand,
	sessionOpenCommand,
	stateCommand,
} from "../commands"
import { encodeWirePayload } from "../wire"

const baseTree = {
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

function buildTree(policy: "agent-wins" | "human-wins" | "merge" | "ask") {
	return {
		...baseTree,
		meta: {
			loomBindings: {
				events: ["submit"],
				state: ["notes", "selected"],
				conflictPolicy: policy,
			},
		},
	}
}

function setupDirtySession(sessionId: string, policy: "agent-wins" | "human-wins" | "merge" | "ask") {
	sessionOpenCommand(sessionId, encodeWirePayload({ title: policy }))
	renderCommand(sessionId, encodeWirePayload({ tree: buildTree(policy) }))
	stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "decision-root", field: "notes", value: "human note" } }))
}

afterEach(() => {
	for (const sessionId of [
		"ses_conflict_agent",
		"ses_conflict_human",
		"ses_conflict_merge",
		"ses_conflict_ask",
	]) {
		try {
			sessionEndCommand(sessionId)
		} catch {}
	}
})

describe("loom conflict policies", () => {
	test("agent-wins applies patch and emits conflict_resolved event", () => {
		setupDirtySession("ses_conflict_agent", "agent-wins")
		const result = patchCommand(
			"ses_conflict_agent",
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBeUndefined()
		expect(result.rev).toBe(2)
		const poll = pollCommand("ses_conflict_agent", encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toEqual([])
		expect(poll.events.find((frame) => frame.kind === "patch")?.patch?.value).toBe("agent note")
		expect(poll.events.find((frame) => frame.kind === "event")?.event).toEqual({
			type: "conflict_resolved",
			nodeId: "decision-root",
			payload: {
				field: "notes",
				policy: "agent-wins",
				humanValue: "human note",
				agentValue: "agent note",
				resolvedValue: "agent note",
			},
		})
	})

	test("human-wins drops patch and emits conflict_resolved event", () => {
		setupDirtySession("ses_conflict_human", "human-wins")
		const result = patchCommand(
			"ses_conflict_human",
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBeUndefined()
		expect(result.rev).toBe(2)
		const poll = pollCommand("ses_conflict_human", encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toEqual([])
		expect(poll.events.some((frame) => frame.kind === "patch")).toBe(false)
		expect(poll.events.find((frame) => frame.kind === "event")?.event).toEqual({
			type: "conflict_resolved",
			nodeId: "decision-root",
			payload: {
				field: "notes",
				policy: "human-wins",
				humanValue: "human note",
				agentValue: "agent note",
				resolvedValue: "human note",
			},
		})
	})

	test("merge applies merged value and emits conflict_resolved event", () => {
		setupDirtySession("ses_conflict_merge", "merge")
		const result = patchCommand(
			"ses_conflict_merge",
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBeUndefined()
		expect(result.rev).toBe(2)
		const poll = pollCommand("ses_conflict_merge", encodeWirePayload({ rev: 0 }))
		expect(poll.conflicts).toEqual([])
		expect(poll.events.find((frame) => frame.kind === "patch")?.patch?.value).toBe("human note agent note")
		expect(poll.events.find((frame) => frame.kind === "event")?.event).toEqual({
			type: "conflict_resolved",
			nodeId: "decision-root",
			payload: {
				field: "notes",
				policy: "merge",
				humanValue: "human note",
				agentValue: "agent note",
				resolvedValue: "human note agent note",
			},
		})
	})

	test("ask holds patch and surfaces conflict on poll", () => {
		setupDirtySession("ses_conflict_ask", "ask")
		const result = patchCommand(
			"ses_conflict_ask",
			encodeWirePayload({ patch: { rev: 1, nodeId: "decision-root", field: "notes", value: "agent note" } }),
		)
		expect(result.errorCode).toBe("dirty_field")
		expect(result.rev).toBe(1)
		const poll = pollCommand("ses_conflict_ask", encodeWirePayload({ rev: 0 }))
		expect(poll.events.some((frame) => frame.kind === "event")).toBe(false)
		expect(poll.conflicts).toEqual([
			{
				nodeId: "decision-root",
				field: "notes",
				humanValue: "human note",
				agentValue: "agent note",
				policy: "ask",
			},
		])
	})
})
