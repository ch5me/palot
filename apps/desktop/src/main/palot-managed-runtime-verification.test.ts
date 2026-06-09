import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-palot-managed-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

interface PluginToolHandler {
	execute: (args?: unknown, context?: unknown) => Promise<string>
}

test("real plugin over real bridge server proves managed runtime contract end-to-end", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		const pluginSource = await import("./palot-plugin-entry.js")

		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_managed",
				browserLaneId: "lane_managed",
				status: "attached",
			}),
		)
		ipcMod.setBrowserLaneSnapshot({
			laneId: "lane_managed",
			currentUrl: "https://example.com/current",
			streamUrl: "http://elf-browser-lane.local/browser/lane_managed/",
			viewportWidth: 1440,
			viewportHeight: 900,
			health: {
				status: "running",
				stream: {
					url: "http://elf-browser-lane.local/browser/lane_managed/",
					checkedAt: 1,
					state: "ready",
					error: null,
				},
				cdp: {
					url: "http://127.0.0.1:9222",
					checkedAt: 1,
					state: "ready",
					error: null,
				},
				message: "ok",
			},
		})
		ipcMod.setUiStateSnapshot({
			sidePanel: { open: false, activeTab: null, availableTabs: ["browser", "review"] },
		})
		ipcMod.registerPalotBrowserWindows(() => [])

		const bridge = await ipcMod.ensurePalotBridgeServer()
		const bridgeRequest = await pluginSource.createBridgeClient({
			env: {
				PALOT_BRIDGE_URL: `http://${bridge.host}:${bridge.port}${bridge.path}`,
				PALOT_BRIDGE_TOKEN: bridge.token,
			},
		})
		assert.ok(bridgeRequest)

		// Instantiate the REAL plugin exactly as a standalone OpenCode process would:
		// no injected callbacks, bridge transport only.
		const server = await pluginSource.createPalotPlugin({}, { bridgeRequest })
		const hooks = await (server as () => Promise<Record<string, unknown>>)()

		const system = { system: [] as string[] }
		await (hooks["experimental.chat.system.transform"] as (
			payload: { sessionID: string },
			output: { system: string[] },
		) => Promise<void>)({ sessionID: "ses_managed" }, system)
		assert.equal(system.system.length, 1)
		assert.ok(system.system[0].includes("<elf-context>"))
		assert.ok(system.system[0].includes("session_id: ses_managed"))
		assert.ok(system.system[0].includes("browser_lane_id: lane_managed"))

		const tools = hooks.tool as Record<string, PluginToolHandler>
		const browserStatus = JSON.parse(
			await tools.browser_status.execute({}, { sessionID: "ses_managed" }),
		)
		assert.equal(browserStatus.status, "queued")
		const browserStatusSummary = JSON.parse(browserStatus.resultSummary)
		assert.equal(browserStatusSummary.currentUrl, "https://example.com/current")
		assert.equal(
			browserStatusSummary.viewerUrl,
			"http://elf-browser-lane.local/browser/lane_managed/",
		)

		const opened = JSON.parse(await tools.open_side_panel.execute({ tab: "browser" }))
		assert.equal(opened.sidePanel.activeTab, "browser")
		const uiState = JSON.parse(await tools.ui_state.execute({}))
		assert.equal(uiState.sidePanel.activeTab, "browser")

		const events = ipcMod.getBrowserActionEvents("ses_managed")
		assert.ok(events.some((event) => event.kind === "toolRequest" && event.toolName === "browser_status"))
		assert.ok(events.some((event) => event.kind === "toolResult" && event.toolName === "browser_status"))
	} finally {
		cleanup()
	}
})
