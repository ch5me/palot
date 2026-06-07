import { describe, expect, test } from "bun:test"
import pluginModule, {
	buildProductContextBlock,
	createBridgeClient,
	createPalotPlugin,
	createTypedError,
} from "../../src/main/palot-plugin/plugin.js"

const boundResolver = (sessionID) => ({
	binding: {
		id: `binding_${sessionID}`,
		openCodeSessionId: sessionID,
		browserLaneId: "lane_1",
		magicBrowserSessionId: "mb_1",
		status: "attached",
		createdAt: 1,
		updatedAt: 1,
		releasedAt: null,
	},
	nonSecretSnapshot: {
		sessionId: sessionID,
		activeLaneId: "lane_1",
		magicBrowserSessionId: "mb_1",
		viewerUrl: "http://elf-browser-lane.local/browser/lane_1/",
		binding: {
			id: `binding_${sessionID}`,
			openCodeSessionId: sessionID,
			browserLaneId: "lane_1",
			magicBrowserSessionId: "mb_1",
			status: "attached",
			createdAt: 1,
			updatedAt: 1,
			releasedAt: null,
		},
		health: null,
		lastActions: [],
		viewport: {
			currentUrl: "https://example.com",
			streamUrl: null,
			viewportWidth: null,
			viewportHeight: null,
		},
	},
	uiState: {
		sidePanel: {
			open: true,
			activeTab: "browser",
			availableTabs: ["browser", "review"],
		},
	},
	opaqueActionTarget: {
		bindingId: `binding_${sessionID}`,
		laneId: "lane_1",
		magicBrowserSessionId: "mb_1",
	},
	connections: [
		{
			name: "notion",
			displayName: "Notion",
			status: "connected",
			metadata: {
				whyRecommended: "Search workspace docs and notes.",
				readToolHint: "Search docs first.",
			},
		},
	],
})

describe("palot bridge plugin", () => {
	test("exports plugin module shape", () => {
		expect(pluginModule.id).toBe("palot-bridge")
		expect(typeof pluginModule.server).toBe("function")
	})

	test("injects generic product context block when binding exists", async () => {
		const plugin = createPalotPlugin({
			resolve: boundResolver,
			listConnections: async () => boundResolver("ses_bound").connections,
		})
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_bound" }, output)
		expect(output.system).toHaveLength(1)
		expect(output.system[0]).toContain("<elf-context>")
		expect(output.system[0]).toContain("session_id: ses_bound")
		expect(output.system[0]).toContain("browser_viewer_url: http://elf-browser-lane.local/browser/lane_1/")
		expect(output.system[0]).toContain("side_panel_tab: browser")
		expect(output.system[0]).toContain("connected_apps:")
		expect(output.system[0]).toContain("- Notion (connected)")
		expect(output.system[0]).toContain("connected_app_discovery_tools: search_tools,describe_tool,call_tool,tools_status")
		expect(output.system[0]).toContain("product_control_tools: browser_status,browser_open,browser_navigate,browser_tabs,browser_click,browser_type,browser_scroll,open_side_panel,ui_state")
		expect(output.system[0]).not.toContain("authToken")
	})

	test("does not inject when binding missing", async () => {
		const plugin = createPalotPlugin({ resolve: () => null })
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_unbound" }, output)
		expect(output.system).toHaveLength(0)
	})

	test("context block builder returns null when no product state exists", () => {
		expect(buildProductContextBlock({ binding: null, nonSecretSnapshot: null, connections: [] })).toBeNull()
	})

	test("tool registration exposes strict named browser tools", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		expect(Object.keys(hooks.tool).sort()).toEqual([
			"browser_click",
			"browser_navigate",
			"browser_open",
			"browser_scroll",
			"browser_status",
			"browser_tabs",
			"browser_type",
			"call_tool",
			"describe_tool",
			"open_side_panel",
			"search_tools",
			"tools_status",
			"ui_state",
		])
	})

	test("tool returns queued JSON when session is bound", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const result = await hooks.tool.browser_navigate.execute(
			{ url: "https://example.com" },
			{ sessionID: "ses_bound" },
		)
		const parsed = JSON.parse(result)
		expect(parsed.status).toBe("queued")
		expect(parsed.resultSummary).toContain("https://example.com")
	})

	test("awaits async resolver and dispatch callbacks", async () => {
		const plugin = createPalotPlugin({
			resolve: async (sessionID) => boundResolver(sessionID),
			listConnections: async () => boundResolver("ses_bound").connections,
			dispatch: async ({ sessionId, toolName, args }) => ({
				status: "completed",
				toolName,
				sessionId,
				args,
				resultSummary: "live dispatch",
			}),
			getUiState: async () => ({
				sidePanel: { open: true, activeTab: "browser", availableTabs: ["browser", "review"] },
			}),
			openSidePanel: async (tab) => ({
				sidePanel: { open: true, activeTab: tab, availableTabs: ["browser", "review"] },
			}),
		})
		const hooks = await plugin()
		const system = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_bound" }, system)
		expect(system.system[0]).toContain("session_id: ses_bound")
		const navigate = JSON.parse(
			await hooks.tool.browser_navigate.execute(
				{ url: "https://example.com/live" },
				{ sessionID: "ses_bound" },
			),
		)
		expect(navigate.status).toBe("completed")
		expect(navigate.resultSummary).toBe("live dispatch")
		const uiState = JSON.parse(await hooks.tool.ui_state.execute({}, { sessionID: "ses_bound" }))
		expect(uiState.sidePanel.activeTab).toBe("browser")
		const opened = JSON.parse(
			await hooks.tool.open_side_panel.execute({ tab: "review" }, { sessionID: "ses_bound" }),
		)
		expect(opened.sidePanel.activeTab).toBe("review")
	})

	test("tool returns typed unbound error", async () => {
		const plugin = createPalotPlugin({ resolve: () => null })
		const hooks = await plugin()
		const result = await hooks.tool.browser_click.execute(
			{ selector: "button" },
			{ sessionID: "ses_missing" },
		)
		expect(JSON.parse(result)).toEqual(
			createTypedError({
				toolName: "browser_click",
				code: "unbound_session",
				message: "No browser binding for this OpenCode session",
			}),
		)
	})

	test("tool returns typed geometry and takeover errors", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const geometry = await hooks.tool.browser_click.execute(
			{ selector: "__geometry_low_confidence__" },
			{ sessionID: "ses_bound" },
		)
		const takeover = await hooks.tool.browser_click.execute(
			{ selector: "__human_in_control__" },
			{ sessionID: "ses_bound" },
		)
		expect(JSON.parse(geometry).errorCode).toBe("geometry_low_confidence")
		expect(JSON.parse(takeover).errorCode).toBe("human_in_control")
	})

	test("tool schemas reject malformed browser args", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const navigatePromise = hooks.tool.browser_navigate.execute({}, { sessionID: "ses_bound" })
		const sidePanelPromise = hooks.tool.open_side_panel.execute({ tab: "nope" }, { sessionID: "ses_bound" })
		expect(navigatePromise).rejects.toThrow()
		expect(sidePanelPromise).rejects.toThrow()
	})

	test("side panel tools expose current ui state and open valid tabs", async () => {
		const plugin = createPalotPlugin({
			resolve: boundResolver,
			getUiState: async () => ({
				sidePanel: { open: false, activeTab: null, availableTabs: ["browser", "review"] },
			}),
			openSidePanel: async (tab) => ({
				sidePanel: { open: true, activeTab: tab, availableTabs: ["browser", "review"] },
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

	test("plugin falls back to bridge transport when callbacks absent", async () => {
		const bridgeCalls = []
		const plugin = createPalotPlugin(
			{},
			{
				bridgeRequest: async (payload) => {
					bridgeCalls.push(payload)
					if (payload.action === "resolve-binding") {
						return boundResolver(payload.sessionId)
					}
					if (payload.action === "dispatch-browser-tool") {
						return { status: "completed", resultSummary: "bridge dispatch" }
					}
					if (payload.action === "get-ui-state") {
						return { sidePanel: { open: false, activeTab: null, availableTabs: ["browser", "review"] } }
					}
					if (payload.action === "open-side-panel") {
						return { sidePanel: { open: true, activeTab: payload.tab, availableTabs: ["browser", "review"] } }
					}
					return null
				},
			},
		)
		const hooks = await plugin()
		const navigate = JSON.parse(
			await hooks.tool.browser_navigate.execute(
				{ url: "https://example.com/bridge" },
				{ sessionID: "ses_bound" },
			),
		)
		const uiState = JSON.parse(await hooks.tool.ui_state.execute({}, { sessionID: "ses_bound" }))
		const opened = JSON.parse(
			await hooks.tool.open_side_panel.execute({ tab: "review" }, { sessionID: "ses_bound" }),
		)
		expect(navigate.resultSummary).toBe("bridge dispatch")
		expect(uiState.sidePanel.availableTabs).toContain("browser")
		expect(opened.sidePanel.activeTab).toBe("review")
		expect(bridgeCalls.map((entry) => entry.action)).toEqual([
			"resolve-binding",
			"dispatch-browser-tool",
			"get-ui-state",
			"open-side-panel",
		])
	})
})
