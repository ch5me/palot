import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { FIREFLY_SURFACE_LANE_BY_ID } from "../shared/firefly-surface-ids"

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

function assertDocumentOpenResult(result: unknown, expectedTab: "studio" | "pdf-review") {
	assert.deepEqual(result, {
		status: "completed",
		toolName: "open_side_panel",
		sidePanel: {
			open: false,
			activeTab: null,
			availableTabs: ["browser", "review"],
		},
		documentPanel: {
			open: true,
			activeTab: expectedTab,
			availableTabs: ["studio", "pdf-review"],
		},
	})
	assert.equal(FIREFLY_SURFACE_LANE_BY_ID[expectedTab], "document")
}

test("real plugin over real bridge server proves managed runtime contract end-to-end", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		const pluginSource = await import("./palot-plugin-entry.js")
		await ipcMod.resetPalotBrowserIpcStateForTests()

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
			sidePanel: {
				open: false,
				activeTab: null,
				availableTabs: ["browser", "review"],
			},
			documentPanel: {
				open: false,
				activeTab: null,
				availableTabs: ["studio", "pdf-review"],
			},
		})
		const sent: Array<{ channel: string; payload: unknown }> = []
		ipcMod.registerPalotBrowserWindows(() => [
			{
				webContents: {
					send(channel: string, payload: unknown) {
						sent.push({ channel, payload })
					},
				},
			},
		])

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

		const openedStudio = JSON.parse(await tools.open_side_panel.execute({ tab: "studio" }))
		assertDocumentOpenResult(openedStudio, "studio")
		const uiStateAfterStudio = JSON.parse(await tools.ui_state.execute({}))
		assert.deepEqual(uiStateAfterStudio.sidePanel.availableTabs, ["browser", "review"])
		assert.equal(uiStateAfterStudio.sidePanel.activeTab, null)
		assert.deepEqual(uiStateAfterStudio.documentPanel.availableTabs, ["studio", "pdf-review"])
		assert.equal(uiStateAfterStudio.documentPanel.activeTab, "studio")

		const openedPdfReview = JSON.parse(await tools.open_side_panel.execute({ tab: "pdf-review" }))
		assertDocumentOpenResult(openedPdfReview, "pdf-review")
		const uiState = JSON.parse(await tools.ui_state.execute({}))
		assert.equal(uiState.sidePanel.activeTab, null)
		assert.deepEqual(uiState.sidePanel.availableTabs, ["browser", "review"])
		assert.equal(uiState.documentPanel.activeTab, "pdf-review")
		assert.deepEqual(uiState.documentPanel.availableTabs, ["studio", "pdf-review"])
		const openSidePanelEvents = sent.filter((event) => event.channel === "palot:open-side-panel")
		assert.equal(openSidePanelEvents.length, 2)
		assert.deepEqual(openSidePanelEvents.map((event) => event.payload), [
			{ tab: "studio" },
			{ tab: "pdf-review" },
		])

		const events = ipcMod.getBrowserActionEvents("ses_managed")
		assert.ok(events.some((event) => event.kind === "toolRequest" && event.toolName === "browser_status"))
		assert.ok(events.some((event) => event.kind === "toolResult" && event.toolName === "browser_status"))
	} finally {
		cleanup()
	}
})

test("catalog tools project dynamically into the real plugin and dispatch through invokePluginTool", async () => {
	const cleanup = setupTempXdg()
	try {
		const ipcMod = await import("./palot-browser-ipc")
		const dispatchMod = await import("./firefly-plugin/dispatch")
		const pluginSource = await import("./palot-plugin-entry.js")
		await ipcMod.resetPalotBrowserIpcStateForTests()

		// Host side: notes handlers registered exactly like main/index.ts does.
		dispatchMod.registerBuiltInHostCommands()
		ipcMod.registerPalotBrowserWindows(() => [])
		ipcMod.setUiStateSnapshot({
			sidePanel: { open: false, activeTab: null, availableTabs: ["notes", "review"] },
			documentPanel: { open: false, activeTab: null, availableTabs: [] },
		})

		const bridge = await ipcMod.ensurePalotBridgeServer()
		const bridgeRequest = await pluginSource.createBridgeClient({
			env: {
				PALOT_BRIDGE_URL: `http://${bridge.host}:${bridge.port}${bridge.path}`,
				PALOT_BRIDGE_TOKEN: bridge.token,
			},
		})
		assert.ok(bridgeRequest)

		// Instantiate the REAL plugin over the REAL bridge: catalog tools
		// must appear next to the static palot tools.
		const server = await pluginSource.createPalotPlugin({}, { bridgeRequest })
		const hooks = await (server as () => Promise<Record<string, unknown>>)()
		const tools = hooks.tool as Record<string, PluginToolHandler>

		// Static tools still present (no regression from the merge).
		assert.ok(tools.browser_status)
		assert.ok(tools.open_side_panel)

		// Slice-1 criterion: the notes catalog tools are REAL OpenCode tools.
		assert.ok(tools["plugin.firefly.built-in.surface.notes.open"])
		assert.ok(tools["plugin.firefly.built-in.surface.notes.state"])

		const opened = JSON.parse(
			await tools["plugin.firefly.built-in.surface.notes.open"].execute(
				{},
				{ sessionID: "ses_catalog" },
			),
		)
		assert.equal(opened.status, "completed")
		assert.equal(opened.pluginId, "firefly.built-in.surface.notes")
		assert.equal(opened.data.opened, true)
		assert.equal(opened.data.tab, "notes")

		const state = JSON.parse(
			await tools["plugin.firefly.built-in.surface.notes.state"].execute(
				{ sessionId: "ses_catalog" },
				{ sessionID: "ses_catalog" },
			),
		)
		assert.equal(state.status, "completed")
		assert.equal(state.data.tab, "notes")
		assert.equal(state.data.available, true)

		// Disabled plugins drop out of the projection on the next plugin init…
		const authority = await import("./firefly-plugin/authority")
		authority.setPluginEnabled("firefly.built-in.surface.notes", false)
		const hooksAfterDisable = await (server as () => Promise<Record<string, unknown>>)()
		const toolsAfterDisable = hooksAfterDisable.tool as Record<string, PluginToolHandler>
		assert.equal(toolsAfterDisable["plugin.firefly.built-in.surface.notes.open"], undefined)

		// …and an ALREADY-projected tool is refused at invoke time by the host.
		const disabledEnvelope = JSON.parse(
			await tools["plugin.firefly.built-in.surface.notes.open"].execute(
				{},
				{ sessionID: "ses_catalog" },
			),
		)
		assert.equal(disabledEnvelope.status, "unavailable")
		assert.equal(disabledEnvelope.errorCode, "plugin_disabled")

		authority.setPluginEnabled("firefly.built-in.surface.notes", true)
	} finally {
		cleanup()
	}
})
