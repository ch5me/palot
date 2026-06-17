import { describe, expect, test } from "bun:test"
import pluginModule, {
	createBridgeClient,
	createPalotPlugin,
} from "../../src/main/palot-plugin/plugin.js"

const survivingStaticTools = [
	"open_side_panel",
	"palot_components_describe",
	"palot_components_list",
	"palot_patch",
	"palot_poll",
	"palot_render",
	"palot_session_end",
	"palot_session_open",
	"palot_state",
	"ui_state",
]

const removedLegacyTools = [
	"browser_click",
	"browser_navigate",
	"browser_open",
	"browser_scroll",
	"browser_status",
	"browser_tabs",
	"browser_type",
	"call_tool",
	"describe_tool",
	"search_tools",
	"tools_status",
]

describe("palot bridge plugin", () => {
	test("exports plugin module shape", () => {
		expect(pluginModule.id).toBe("palot-bridge")
		expect(typeof pluginModule.server).toBe("function")
	})

	test("injects host-composed surface context from the bridge", async () => {
		const plugin = createPalotPlugin(
			{},
			{
				bridgeRequest: async (payload) => {
					if (payload.action === "list-plugin-tools") return { tools: [] }
					if (payload.action === "list-context-fragments") {
						return {
							context: [
								"<surface-context>",
								"product_control_tools: palot_components_list,palot_components_describe,palot_session_open,palot_session_end,palot_render,palot_patch,palot_poll,palot_state,open_side_panel,ui_state",
								"</surface-context>",
							].join("\n"),
						}
					}
					return null
				},
			},
		)
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_bound" }, output)
		expect(output.system).toHaveLength(1)
		expect(output.system[0]).toContain("<surface-context>")
		expect(output.system[0]).toContain("product_control_tools: palot_components_list")
		for (const removed of removedLegacyTools) {
			expect(output.system[0]).not.toContain(removed)
		}
	})

	test("does not inject when bridge context is empty", async () => {
		const plugin = createPalotPlugin(
			{},
			{
				bridgeRequest: async (payload) => {
					if (payload.action === "list-plugin-tools") return { tools: [] }
					if (payload.action === "list-context-fragments") return { context: "" }
					return null
				},
			},
		)
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_unbound" }, output)
		expect(output.system).toHaveLength(0)
	})

	test("tool registration keeps only surviving static bridge tools", async () => {
		const plugin = createPalotPlugin()
		const hooks = await plugin()
		const names = Object.keys(hooks.tool).sort()
		expect(names).toEqual(survivingStaticTools)
		for (const removed of removedLegacyTools) {
			expect(names).not.toContain(removed)
		}
	})

	test("side panel tools expose current ui state and open valid tabs", async () => {
		const plugin = createPalotPlugin({
			getUiState: async () => ({
				sidePanel: { open: false, activeTab: null, availableTabs: ["browser", "review"] },
				documentPanel: { open: false, activeTab: null, availableTabs: [] },
			}),
			openSidePanel: async (tab) => ({
				sidePanel: { open: true, activeTab: tab, availableTabs: ["browser", "review"] },
				documentPanel: { open: false, activeTab: null, availableTabs: [] },
			}),
		})
		const hooks = await plugin()
		const uiState = JSON.parse(await hooks.tool.ui_state.execute({}, { sessionID: "ses_bound" }))
		expect(uiState.sidePanel.open).toBe(false)
		const opened = JSON.parse(
			await hooks.tool.open_side_panel.execute({ tab: "browser" }, { sessionID: "ses_bound" }),
		)
		expect(opened.sidePanel.activeTab).toBe("browser")
	})

	test("side panel schema rejects malformed tabs", async () => {
		const plugin = createPalotPlugin()
		const hooks = await plugin()
		expect(hooks.tool.open_side_panel.execute({ tab: "nope" }, { sessionID: "ses_bound" })).rejects.toThrow()
	})

	test("bridge client calls standalone Palot bridge transport", async () => {
		const calls = []
		const bridgeRequest = createBridgeClient({
			fetchImpl: async (url, init) => {
				calls.push({ url, init })
				return new Response(
					JSON.stringify({
						ok: true,
						result: {
							sidePanel: { open: true, activeTab: "browser", availableTabs: ["browser", "review"] },
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				)
			},
			env: {
				PALOT_BRIDGE_URL: "http://127.0.0.1:4010/palot-bridge",
				PALOT_BRIDGE_TOKEN: "bridge-token",
			},
		})
		expect(typeof bridgeRequest).toBe("function")
		const result = await bridgeRequest({ action: "get-ui-state" })
		expect(result.sidePanel.activeTab).toBe("browser")
		expect(calls).toHaveLength(1)
		expect(calls[0].url).toBe("http://127.0.0.1:4010/palot-bridge")
		expect(calls[0].init.headers["x-palot-bridge-key"]).toBe("bridge-token")
	})

	test("plugin falls back to bridge transport for surviving UI tools", async () => {
		const bridgeCalls = []
		const plugin = createPalotPlugin(
			{},
			{
				bridgeRequest: async (payload) => {
					bridgeCalls.push(payload)
					if (payload.action === "list-plugin-tools") return { tools: [] }
					if (payload.action === "get-ui-state") {
						return {
							sidePanel: { open: false, activeTab: null, availableTabs: ["browser", "review"] },
							documentPanel: { open: false, activeTab: null, availableTabs: [] },
						}
					}
					if (payload.action === "open-side-panel") {
						return {
							sidePanel: { open: true, activeTab: payload.tab, availableTabs: ["browser", "review"] },
							documentPanel: { open: false, activeTab: null, availableTabs: [] },
						}
					}
					return null
				},
			},
		)
		const hooks = await plugin()
		const uiState = JSON.parse(await hooks.tool.ui_state.execute({}, { sessionID: "ses_bound" }))
		const opened = JSON.parse(
			await hooks.tool.open_side_panel.execute({ tab: "review" }, { sessionID: "ses_bound" }),
		)
		expect(uiState.sidePanel.availableTabs).toContain("browser")
		expect(opened.sidePanel.activeTab).toBe("review")
		expect(bridgeCalls.map((entry) => entry.action)).toEqual([
			"list-plugin-tools",
			"get-ui-state",
			"open-side-panel",
		])
	})
})
