import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-human-takeover-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

function createToolRequest(sessionId: string) {
	return {
		id: `${sessionId}:toolRequest`,
		sessionId,
		laneId: null,
		source: "tool_request",
		sequence: 0,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: 1,
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "toolRequest",
		toolName: "palot_browser_click",
		argsSummary: null,
	} as const
}

test("pause and resume toggle takeover state and preserve ordering", async () => {
	const cleanup = setupTempXdg()
	try {
		const bus = await import("./palot-browser-ipc")
		const takeover = await import("./palot-human-takeover")
		await takeover.pauseForHumanTakeover("ses_takeover", "manual")
		assert.equal(bus.isHumanTakeoverPaused(), true)
		const rejected = await bus.publishBrowserAction({ event: createToolRequest("ses_takeover") })
		assert.equal(rejected.errorCode, "human_in_control")
		await takeover.resumeFromHumanTakeover("ses_takeover", "done")
		assert.equal(bus.isHumanTakeoverPaused(), false)
		const events = bus.getBrowserActionEvents("ses_takeover")
		assert.equal(events[0]?.kind, "humanTakeoverPaused")
		assert.equal(events.at(-1)?.kind, "humanTakeoverResumed")
	} finally {
		cleanup()
	}
})
