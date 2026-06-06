import { describe, expect, test } from "bun:test"
import pluginModule, {
	buildPalotContextBlock,
	createPalotPlugin,
	createTypedError,
} from "./palot-bridge.js"

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
		viewerUrl: "http://elf-browser-lane.local/browser/lane_1/",
		viewport: { currentUrl: "https://example.com" },
	},
})

describe("palot bridge plugin", () => {
	test("exports plugin module shape", () => {
		expect(pluginModule.id).toBe("palot-bridge")
		expect(typeof pluginModule.server).toBe("function")
	})

	test("injects compact context block when binding exists", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_bound" }, output)
		expect(output.system).toHaveLength(1)
		expect(output.system[0]).toContain("session_id: ses_bound")
		expect(output.system[0]).toContain("viewer_url_hint: http://elf-browser-lane.local/browser/lane_1/")
		expect(output.system[0]).not.toContain("authToken")
	})

	test("does not inject when binding missing", async () => {
		const plugin = createPalotPlugin({ resolve: () => null })
		const hooks = await plugin()
		const output = { system: [] }
		await hooks["experimental.chat.system.transform"]({ sessionID: "ses_unbound" }, output)
		expect(output.system).toHaveLength(0)
	})

	test("context block builder returns null when snapshot missing", () => {
		expect(buildPalotContextBlock({ binding: null, nonSecretSnapshot: null })).toBeNull()
	})

	test("tool registration exposes strict named browser tools", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		expect(Object.keys(hooks.tool).sort()).toEqual([
			"palot_browser_click",
			"palot_browser_navigate",
			"palot_browser_open",
			"palot_browser_scroll",
			"palot_browser_status",
			"palot_browser_tabs",
			"palot_browser_type",
		])
	})

	test("tool returns queued JSON when session is bound", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const result = await hooks.tool.palot_browser_navigate.execute(
			{ url: "https://example.com" },
			{ sessionID: "ses_bound" },
		)
		expect(result.status).toBe("queued")
		expect(result.toolName).toBe("palot_browser_navigate")
	})

	test("tool returns typed unbound error", async () => {
		const plugin = createPalotPlugin({ resolve: () => null })
		const hooks = await plugin()
		const result = await hooks.tool.palot_browser_click.execute(
			{ selector: "button" },
			{ sessionID: "ses_missing" },
		)
		expect(result).toEqual(
			createTypedError({
				toolName: "palot_browser_click",
				code: "unbound_session",
				message: "No browser binding for this OpenCode session",
			}),
		)
	})

	test("tool returns typed geometry and takeover errors", async () => {
		const plugin = createPalotPlugin({ resolve: boundResolver })
		const hooks = await plugin()
		const geometry = await hooks.tool.palot_browser_click.execute(
			{ selector: "__geometry_low_confidence__" },
			{ sessionID: "ses_bound" },
		)
		const takeover = await hooks.tool.palot_browser_click.execute(
			{ selector: "__human_in_control__" },
			{ sessionID: "ses_bound" },
		)
		expect(geometry.errorCode).toBe("geometry_low_confidence")
		expect(takeover.errorCode).toBe("human_in_control")
	})
})
