import { expect, test } from "bun:test"

import { decode as decodeToon, encode as encodeToon } from "../../palot-runtime/toon"
import { buildLoomSessionOpenHandler, buildLoomRenderHandler, buildLoomPatchHandler, buildLoomPollHandler } from "../plugin.js"

test("palot_session_open returns session id, surface url, rev 0", async () => {
	const result = await buildLoomSessionOpenHandler()({ title: "demo" }, { sessionID: "ses_demo" })
	expect(decodeToon(result)).toMatchObject({ session_id: "ses_demo", rev: 0 })
})

test("palot render and patch advance revisions", async () => {
	const sessionID = `ses_demo_render_${Date.now()}_${Math.random().toString(16).slice(2)}`
	const render = await buildLoomRenderHandler()(
		{
			tree: encodeToon({ root: { id: "root", component: "dag-sparkline", props: { nodes: [{ id: "plan", label: "Plan" }], edges: [] } } }),
		},
		{ sessionID },
	)
	expect(decodeToon(render)).toEqual({ rev: 1 })
	const patch = await buildLoomPatchHandler()(
		{
			patch: encodeToon({ rev: 1, node_id: "root", field: "props", value: { nodes: [{ id: "plan", label: "Plan" }, { id: "ship", label: "Ship" }], edges: [] } }),
		},
		{ sessionID },
	)
	expect(decodeToon(patch)).toEqual({ rev: 2 })
})

test("palot_poll help returns axi metadata and empty count", async () => {
	const result = await buildLoomPollHandler()({ help: true, rev: 0 }, { sessionID: "ses_demo_poll" })
	expect(decodeToon(result)).toMatchObject({ rev: 0, count: 0 })
})
