import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-dispatcher-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("dispatcher rejects unbound session", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-browser-dispatcher")
		const result = await mod.dispatchBrowserTool({
			sessionId: "ses_unbound",
			toolName: "palot_browser_navigate",
			args: { url: "https://example.com" },
		})
		assert.equal(result.status, "failed")
		assert.equal(result.resultSummary, "unbound_session")
	} finally {
		cleanup()
	}
})

test("dispatcher publishes request and result for bound tabs list action", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const busMod = await import("./palot-browser-ipc")
		const dispatcher = await import("./palot-browser-dispatcher")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_bound",
				browserLaneId: "lane_bound",
				status: "attached",
			}),
		)
		const result = await dispatcher.dispatchBrowserTool({
			sessionId: "ses_bound",
			toolName: "palot_browser_tabs",
			args: { action: "list" },
		})
		assert.equal(result.status, "queued")
		const events = busMod.getBrowserActionEvents("ses_bound")
		assert.ok(events.some((event) => event.kind === "toolRequest"))
		assert.ok(events.some((event) => event.kind === "toolResult"))
	} finally {
		cleanup()
	}
})
