import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

function writePluginFixture() {
	const dir = mkdtempSync(path.join(tmpdir(), "elf-palot-plugin-"))
	const filePath = path.join(dir, "plugin.mjs")
	writeFileSync(
		filePath,
		[
			"export const createPalotPlugin = (_callbacks = {}, { bridgeRequest } = {}) => {",
			"\treturn async () => ({",
			"\t\t'experimental.chat.system.transform': async (input, output) => {",
			"\t\t\tconst resolved = await bridgeRequest({ action: 'resolve-binding', sessionId: input.sessionID })",
			"\t\t\toutput.system.push(`session_id: ${resolved?.binding?.openCodeSessionId ?? 'none'}`)",
			"\t\t},",
			"\t\ttool: {",
			"\t\t\tbrowser_status: {",
			"\t\t\t\texecute: async (_args, context = {}) => JSON.stringify(await bridgeRequest({ action: 'dispatch-browser-tool', sessionId: context.sessionID, toolName: 'browser_status', args: {} })),",
			"\t\t\t},",
			"\t\t\topen_side_panel: {",
			"\t\t\t\texecute: async (args = {}) => JSON.stringify(await bridgeRequest({ action: 'open-side-panel', tab: args.tab ?? 'browser' })),",
			"\t\t\t},",
			"\t\t\tui_state: {",
			"\t\t\t\texecute: async () => JSON.stringify(await bridgeRequest({ action: 'get-ui-state' })),",
			"\t\t\t},",
			"\t\t},",
			"\t})",
			"}",
			"export default { id: 'palot-managed-fixture', server: createPalotPlugin() }",
		].join("\n"),
		"utf-8",
	)
	return { filePath, dir }
}

test.skip("bridge-backed plugin fixture proves managed runtime contract end-to-end", async () => {
	const cleanup = setupTempXdg()
	const pluginFixture = writePluginFixture()
	const originalFetch = globalThis.fetch
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		const shim = await import("./palot-opencode-plugin-shim")
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
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
			assert.equal(url, `http://${bridge.host}:${bridge.port}${bridge.path}`)
			return await originalFetch(url, init)
		}) as typeof fetch

		const bridgeRequest = await pluginSource.createBridgeClient({
			env: {
				PALOT_BRIDGE_URL: `http://${bridge.host}:${bridge.port}${bridge.path}`,
				PALOT_BRIDGE_TOKEN: bridge.token,
			},
		})
		assert.ok(bridgeRequest)

		const loaded = await shim.loadPalotPluginModule(pluginFixture.filePath)
		const hooks = await (loaded.server as () => Promise<Record<string, unknown>>)()
		const system = { system: [] as string[] }
		await (hooks["experimental.chat.system.transform"] as (
			payload: { sessionID: string },
			output: { system: string[] },
		) => Promise<void>)({ sessionID: "ses_managed" }, system)
		assert.deepEqual(system.system, ["session_id: ses_managed"])

		const browserStatus = JSON.parse(
			await (hooks.tool as Record<string, { execute: (args?: unknown, context?: unknown) => Promise<string> }>).browser_status.execute(
				{},
				{ sessionID: "ses_managed" },
			),
		)
		assert.equal(browserStatus.status, "queued")
		const browserStatusSummary = JSON.parse(browserStatus.resultSummary)
		assert.equal(browserStatusSummary.currentUrl, "https://example.com/current")
		assert.equal(browserStatusSummary.viewerUrl, "http://elf-browser-lane.local/browser/lane_managed/")

		const opened = JSON.parse(
			await (hooks.tool as Record<string, { execute: (args?: unknown) => Promise<string> }>).open_side_panel.execute({ tab: "browser" }),
		)
		assert.equal(opened.sidePanel.activeTab, "browser")
		const uiState = JSON.parse(
			await (hooks.tool as Record<string, { execute: () => Promise<string> }>).ui_state.execute(),
		)
		assert.equal(uiState.sidePanel.activeTab, "browser")

		const events = ipcMod.getBrowserActionEvents("ses_managed")
		assert.ok(events.some((event) => event.kind === "toolRequest" && event.toolName === "browser_status"))
		assert.ok(events.some((event) => event.kind === "toolResult" && event.toolName === "browser_status"))
	} finally {
		globalThis.fetch = originalFetch
		rmSync(pluginFixture.dir, { recursive: true, force: true })
		cleanup()
	}
})
