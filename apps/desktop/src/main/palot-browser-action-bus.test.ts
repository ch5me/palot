import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-bus-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

function createMoveEvent(sequence = 0) {
	return {
		id: `evt:${sequence}`,
		sessionId: "ses_bus",
		laneId: "lane_bus",
		source: "tool_request",
		sequence,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: sequence,
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "move",
	} as const
}

test("publish assigns monotonic sequence and preserves order", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-browser-ipc")
		const first = await mod.publishBrowserAction({ event: createMoveEvent(0) })
		const second = await mod.publishBrowserAction({ event: createMoveEvent(0) })
		assert.equal(first.sequence, 1)
		assert.equal(second.sequence, 2)
		const events = mod.getBrowserActionEvents("ses_bus")
		assert.equal(events[0]?.sequence, 1)
		assert.equal(events[1]?.sequence, 2)
	} finally {
		cleanup()
	}
})

test("duplicate sequence collision returns existing event", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-browser-ipc")
		const first = await mod.publishBrowserAction({ event: createMoveEvent(5) })
		const duplicate = await mod.publishBrowserAction({ event: { ...first } })
		assert.equal(duplicate.sequence, first.sequence)
	} finally {
		cleanup()
	}
})

test("human takeover paused rejects toolRequest with human_in_control", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-browser-ipc")
		await mod.publishBrowserAction({
			event: {
				...createMoveEvent(0),
				kind: "humanTakeoverPaused",
				source: "human_takeover",
				reason: "manual",
			},
		})
		const rejected = await mod.publishBrowserAction({
			event: {
				...createMoveEvent(0),
				kind: "toolRequest",
				toolName: "palot_browser_click",
				argsSummary: null,
			},
		})
		assert.equal(rejected.errorCode, "human_in_control")
		assert.equal(rejected.status, "failed")
	} finally {
		cleanup()
	}
})
