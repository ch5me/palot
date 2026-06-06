import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-snapshot-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("browser snapshot is deterministic and capped", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_snapshot2",
				browserLaneId: "lane_snapshot",
				magicBrowserSessionId: "mb_snapshot",
				status: "attached",
			}),
		)
		ipcMod.setBrowserLaneSnapshot({
			laneId: "lane_snapshot",
			currentUrl: "https://example.com",
			streamUrl: "http://elf-browser-lane.local/browser/lane_snapshot/",
			health: {
				status: "running",
				stream: { url: "http://elf-browser-lane.local/browser/lane_snapshot/", checkedAt: 1, state: "ready", error: null },
				cdp: { url: "http://127.0.0.1:9222", checkedAt: 1, state: "ready", error: null },
				message: "ok",
			},
			viewportWidth: 1280,
			viewportHeight: 720,
		})
		for (let index = 0; index < 12; index++) {
			await ipcMod.publishBrowserAction({
				event: {
					id: `ses_snapshot2:${index}:move`,
					sessionId: "ses_snapshot2",
					laneId: "lane_snapshot",
					source: "tool_request",
					sequence: index,
					requestId: null,
					causationId: null,
					toolCallId: null,
					targetDescription: null,
					viewportCoords: null,
					streamGeometrySnapshot: null,
					timestamp: index,
					durationMs: null,
					status: "queued",
					errorCode: null,
					errorMessage: null,
					kind: "move",
				},
			})
		}
		const snapshot = ipcMod.getBrowserStateSnapshot("ses_snapshot2")
		assert.equal(snapshot.sessionId, "ses_snapshot2")
		assert.equal(snapshot.activeLaneId, "lane_snapshot")
		assert.equal(snapshot.magicBrowserSessionId, "mb_snapshot")
		assert.equal(snapshot.viewerUrl, "http://elf-browser-lane.local/browser/lane_snapshot/")
		assert.equal(snapshot.viewport?.currentUrl, "https://example.com")
		assert.equal(snapshot.lastActions.length, 8)
	} finally {
		cleanup()
	}
})
