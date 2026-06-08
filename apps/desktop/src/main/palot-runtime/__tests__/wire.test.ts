import { expect, test } from "bun:test"

import { patchCommand, pollCommand, renderCommand, sessionEndCommand, sessionOpenCommand, stateCommand } from "../commands"
import { encodeWirePayload } from "../wire"

const SPEC_13_TREE = {
	tree: {
		id: "root",
		component: "dag-sparkline",
		props: {
			nodes: [
				{ id: "plan", label: "Plan" },
				{ id: "wire", label: "Wire" },
			],
			edges: [{ source: "plan", target: "wire" }],
		},
	},
}

const SPEC_13_TOON = [
	'tree: {"id":"root","component":"dag-sparkline","props":{"nodes":[{"id":"plan","label":"Plan"},{"id":"wire","label":"Wire"}],"edges":[{"source":"plan","target":"wire"}]}}',
].join("\n")

test("wire encodes Loom spec section 13 example byte-equal", () => {
	expect(encodeWirePayload(SPEC_13_TREE)).toBe(SPEC_13_TOON)
})

test("spec section 13 walkthrough reproduces render patch poll state", () => {
	const sessionId = "ses_spec13"
	expect(sessionOpenCommand(sessionId, encodeWirePayload({ title: "demo" }))).toEqual({
		rev: 0,
		title: "demo",
	})
	expect(renderCommand(sessionId, SPEC_13_TOON)).toEqual({ rev: 1 })
	expect(
		patchCommand(
			sessionId,
			encodeWirePayload({ patch: { rev: 1, nodeId: "root", field: "props", value: { nodes: [{ id: "plan", label: "Plan" }, { id: "wire", label: "Wire" }, { id: "ship", label: "Ship" }], edges: [{ source: "plan", target: "wire" }, { source: "wire", target: "ship" }] } } }),
		),
	).toEqual({ rev: 2 })
	expect(stateCommand(sessionId, encodeWirePayload({ delta: { nodeId: "root", field: "hovered", value: true } }))).toEqual({ rev: 2 })
	const idle = pollCommand(sessionId, encodeWirePayload({ rev: 2 }))
	expect(idle.events).toHaveLength(0)
	expect(idle.stateDelta).toHaveLength(1)
	const replay = pollCommand(sessionId, encodeWirePayload({ rev: 0 }))
	expect(replay.rev).toBe(2)
	expect(replay.treeSlice).not.toBeNull()
	expect(sessionEndCommand(sessionId)).toEqual({ rev: 2 })
})
