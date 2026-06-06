import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-resolver-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("resolver returns binding, snapshot, and opaque action target", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		const resolverMod = await import("./palot-resolver")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_resolve",
				browserLaneId: "lane_resolve",
				magicBrowserSessionId: "mb_resolve",
				status: "attached",
			}),
		)
		ipcMod.setBrowserLaneSnapshot({
			laneId: "lane_resolve",
			currentUrl: "https://example.com",
			streamUrl: "http://elf-browser-lane.local/browser/lane_resolve/",
			viewportWidth: 100,
			viewportHeight: 200,
		})
		const result = resolverMod.resolvePalotSessionBinding("ses_resolve")
		assert.equal(result.binding?.browserLaneId, "lane_resolve")
		assert.equal(result.nonSecretSnapshot?.viewerUrl, "http://elf-browser-lane.local/browser/lane_resolve/")
		assert.equal(result.opaqueActionTarget?.bindingId, "binding_ses_resolve")
	} finally {
		cleanup()
	}
})

test("resolver survives repeated calls after state changes", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		const resolverMod = await import("./palot-resolver")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_restart",
				browserLaneId: "lane_one",
				status: "attached",
			}),
		)
		ipcMod.setBrowserLaneSnapshot({ laneId: "lane_one", currentUrl: "https://one.test" })
		assert.equal(resolverMod.resolvePalotSessionBinding("ses_restart").binding?.browserLaneId, "lane_one")
		bindingMod.upsertSessionBinding({
			...bindingMod.getSessionBindingByOpenCodeSession("ses_restart"),
			id: "binding_ses_restart",
			openCodeSessionId: "ses_restart",
			browserLaneId: "lane_two",
			magicBrowserSessionId: null,
			status: "attached",
			createdAt: 1,
			updatedAt: 1,
			releasedAt: null,
		})
		ipcMod.setBrowserLaneSnapshot({ laneId: "lane_two", currentUrl: "https://two.test" })
		assert.equal(resolverMod.resolvePalotSessionBinding("ses_restart").binding?.browserLaneId, "lane_two")
	} finally {
		cleanup()
	}
})
