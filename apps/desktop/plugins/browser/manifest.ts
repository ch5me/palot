/**
 * Browser — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.browser` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 *
 * The Browser side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `browserPanelEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * persistenceKey and telemetryNamespace byte-match the deleted V1 row
 * for stable identity:
 *   persistenceKey:     "side-panel.browser"
 *   telemetryNamespace: "firefly.surface.browser"
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

// Shared prefix for all browser tool ids
const BROWSER_TOOL_PREFIX = "plugin.firefly.built-in.surface.browser"

export const browserPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.browser",
	displayName: "Browser",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Inline browser surface: render selkies-stream or direct-iframe browser lanes (local docker-chromium or remote CDP) in the side panel.",
	license: "MIT",
	manifestRevision: 1,
	engines: {},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 3,
	},
	activationEvents: [
		{ kind: "onPanelOpen", panelId: "browser" },
		{ kind: "onCommand", commandId: "open-browser" },
		{ kind: "onCommand", commandId: "toggle-browser" },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.open` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.state` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.navigate` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.click` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.type` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.scroll` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.tabs` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.status` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.read` },
		{ kind: "onToolCall", toolId: `${BROWSER_TOOL_PREFIX}.mode` },
	],
	contributes: {
		panels: [
			{
				id: "browser",
				title: "Browser",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "globe",
				defaultOn: true,
				commandIds: ["open-browser", "toggle-browser"],
				persistenceKey: "side-panel.browser",
				telemetryNamespace: "firefly.surface.browser",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-browser",
				title: "Browser: Open",
				description: "Open the Browser side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-browser",
				title: "Browser: Toggle Surface",
				description: "Enable or disable the Browser surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		snippets: [],
		languages: [],
		grammars: [],
		iconThemes: [],
		tools: [
			{
				id: `${BROWSER_TOOL_PREFIX}.open`,
				title: "Open Browser panel",
				description: "Open the Browser side-panel tab in the Firefly desktop UI.",
				scope: "session",
				panelId: "browser",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "browser", refreshProjection: true },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.state`,
				title: "Get Browser surface state",
				description:
					"Read the Browser surface state: whether the tab is available, open, and active for the focused session.",
				scope: "session",
				panelId: "browser",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {
					sessionId: z.string().optional(),
				},
				timeoutMs: 5_000,
			},
			// ── Action tools ─────────────────────────────────────────────────
			{
				id: `${BROWSER_TOOL_PREFIX}.navigate`,
				title: "web.navigate",
				description: "Navigate the bound browser lane to a URL.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					url: z.string().url().describe("Destination URL"),
				},
				timeoutMs: 15_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.click`,
				title: "web.click",
				description:
					"Click an element in the browser by CSS selector or visible text. Falls back to coordinates.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					selector: z.string().optional().describe("CSS selector"),
					text: z.string().optional().describe("Visible text to click"),
					role: z.string().optional().describe("ARIA role"),
					x: z.number().optional().describe("Viewport X coordinate"),
					y: z.number().optional().describe("Viewport Y coordinate"),
					button: z.enum(["left", "middle", "right"]).optional().default("left"),
					clickCount: z.number().int().positive().optional().default(1),
				},
				timeoutMs: 10_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.type`,
				title: "web.type",
				description: "Type text into the focused or selected element in the browser.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					selector: z.string().optional().describe("CSS selector to focus before typing"),
					text: z.string().describe("Text to type"),
					submit: z.boolean().optional().describe("Press Enter after typing"),
				},
				timeoutMs: 10_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.scroll`,
				title: "web.scroll",
				description: "Scroll the browser viewport up, down, or by pixel delta.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					direction: z.enum(["up", "down"]).optional().describe("Scroll direction shorthand"),
					amount: z.number().optional().describe("Pixel amount for direction shorthand"),
					deltaX: z.number().optional().describe("Horizontal pixel delta"),
					deltaY: z.number().optional().describe("Vertical pixel delta"),
					selector: z.string().optional().describe("CSS selector of element to scroll"),
				},
				timeoutMs: 5_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.tabs`,
				title: "web.tabs",
				description: "List, open, close, or activate browser tabs in the bound lane.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					action: z
						.enum(["list", "open", "close", "activate"])
						.optional()
						.default("list")
						.describe("Tab action to perform"),
					tabId: z.string().optional().describe("Tab id (required for close/activate)"),
					url: z.string().optional().describe("URL for new tab (action=open)"),
				},
				timeoutMs: 10_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.status`,
				title: "web.status",
				description: "Return the current browser lane binding, URL, and connection health.",
				scope: "session",
				panelId: "browser",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.read`,
				title: "web.read",
				description:
					"Read the current page title, URL, and a text summary of the visible content.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					q: z.string().optional().describe("Optional focus query to narrow content extraction"),
				},
				timeoutMs: 15_000,
				uiHints: { openPanel: "browser" },
			},
			{
				id: `${BROWSER_TOOL_PREFIX}.mode`,
				title: "web.mode",
				description:
					"Switch the browser lane mode for this session: 'iframe' (default, navigate-only) or 'streamed' (full DOM control via Magic Browser engine). Fail-fast if streamed mode cannot be provisioned.",
				scope: "session",
				panelId: "browser",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: {
					mode: z
						.enum(["iframe", "streamed"])
						.describe("Target browser mode — 'iframe' for navigate-only, 'streamed' for full DOM access"),
				},
				timeoutMs: 30_000,
				uiHints: { openPanel: "browser" },
			},
		],
	},
	capabilities: [
		"host:panel.register",
		"host:command.register",
		"host:tool.register",
		"host:bridge.ui-state-read",
		"host:bridge.ui-state-write",
		"host:browser.lane-control",
	],
	tags: ["surface", "browser", "first-party", "phase-2"],
}

export const BROWSER_PLUGIN_ID = browserPluginManifest.id
export const BROWSER_PANEL_PROJECTED_ID = `${browserPluginManifest.id}.browser`
export const BROWSER_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.browser.open"
export const BROWSER_TOOL_STATE_ID = "plugin.firefly.built-in.surface.browser.state"
