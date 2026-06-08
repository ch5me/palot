/**
 * Firefly Plugin System V2 — Palot Bridge (first-party exemplar) V2 manifest
 *
 * The current `palot-bridge.js` plugin is the closest thing the desktop
 * app already has to a first-party V2 plugin: it ships 13 tools, an
 * OpenCode system-context block, and a managed-server-only bridge
 * transport. This file is the V2 manifest that captures the same surface
 * in a way the V2 host can project uniformly.
 *
 * It is intentionally read-only data — the runtime is still
 * `apps/desktop/src/main/palot-plugin/plugin.js` until the V2 plugin
 * host (planned in a later task) takes over activation. Re-deriving the
 * descriptor from this manifest produces the same projections the V2
 * host would compute for the current plugin once it is registered.
 */

import { z } from "zod"

import { FIREFLY_SURFACE_IDS } from "../../renderer/firefly-surface-registry"
import type { PluginManifest } from "./manifest"

export const palotSidePanelTabSchema = z.enum(FIREFLY_SURFACE_IDS)

const browserActionArgsShape = {
	selector: z.string().optional(),
	text: z.string().optional(),
	role: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	button: z.enum(["left", "middle", "right"]).optional(),
	clickCount: z.number().int().positive().optional(),
	tabId: z.string().optional(),
	deltaX: z.number().optional(),
	deltaY: z.number().optional(),
	direction: z.enum(["up", "down"]).optional(),
	amount: z.number().optional(),
	submit: z.boolean().optional(),
	url: z.string().url().optional(),
	action: z.enum(["list", "open", "close", "activate"]).optional(),
} satisfies z.ZodRawShape

export const palotBridgeManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.palot-bridge",
	displayName: "Palot Bridge",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"First-party bridge between OpenCode and the Firefly desktop surface. Browser lane control, side panel tab control, and connected-app discovery. Managed-server only in V2 initial scope.",
	license: "MIT",
	manifestRevision: 1,
	engines: {
		desktop: "0.11.0",
	},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 5,
		restartBackoffMs: 2_000,
	},
	activationEvents: [
		{ kind: "onStartup" },
		{ kind: "onSessionAttach" },
	],
	contributes: {
		panels: [],
		widgets: [],
		commands: [
			{
				id: "palot-open-side-panel",
				title: "Open side panel tab",
				description: "Open a Palot side panel tab in the desktop UI.",
				category: "Surface",
				requires: ["host:bridge.ui-state-write", "host:command.register"],
			},
			{
				id: "palot-refresh-ui-state",
				title: "Refresh Palot UI state",
				description: "Re-derive the side panel snapshot for the active session.",
				category: "Surface",
				requires: ["host:bridge.ui-state-read", "host:command.register"],
			},
		],
		themes: [],
		tools: [
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_status",
				title: "Get browser status",
				description: "Get Palot browser status (binding, lane, health, last actions) for the current OpenCode session.",
				scope: "session",
				requires: ["host:bridge.session-read", "host:tool.register"],
				args: {},
				timeoutMs: 10_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_open",
				title: "Open browser lane URL",
				description: "Open a browser lane URL in the active Palot binding.",
				scope: "session",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: { url: z.string().url() },
				timeoutMs: 30_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_navigate",
				title: "Navigate browser lane",
				description: "Navigate the active browser lane to a new URL.",
				scope: "session",
				requires: ["host:browser.lane-control", "host:tool.register"],
				args: { url: z.string().url() },
				timeoutMs: 30_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_tabs",
				title: "Manage browser tabs",
				description: "List, open, close, or activate tabs in the active browser lane.",
				scope: "session",
				requires: ["host:browser.tab-control", "host:tool.register"],
				args: browserActionArgsShape,
				timeoutMs: 15_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_click",
				title: "Click in browser lane",
				description: "Click an element in the active browser lane.",
				scope: "session",
				requires: ["host:browser.action-dispatch", "host:tool.register"],
				args: browserActionArgsShape,
				timeoutMs: 15_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_type",
				title: "Type into browser lane",
				description: "Type text into an element in the active browser lane.",
				scope: "session",
				requires: ["host:browser.action-dispatch", "host:tool.register"],
				args: browserActionArgsShape,
				timeoutMs: 15_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.browser_scroll",
				title: "Scroll browser lane",
				description: "Scroll the active browser lane viewport.",
				scope: "session",
				requires: ["host:browser.action-dispatch", "host:tool.register"],
				args: browserActionArgsShape,
				timeoutMs: 10_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.open_side_panel",
				title: "Open side panel tab",
				description: "Open a Palot side panel tab in the desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: { tab: palotSidePanelTabSchema },
				timeoutMs: 5_000,
				uiHints: { refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.ui_state",
				title: "Get Palot UI state",
				description: "Get the current Palot UI state (side panel snapshot).",
				scope: "session",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.search_tools",
				title: "Search connected-app tools",
				description: "Search connected-app capabilities without hydrating every schema.",
				scope: "session",
				requires: ["host:tool.register"],
				args: { query: z.string().optional() },
				timeoutMs: 10_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.describe_tool",
				title: "Describe a connected-app tool",
				description: "Describe one connected-app capability on demand.",
				scope: "session",
				requires: ["host:tool.register"],
				args: {
					serverId: z.string().optional(),
					toolName: z.string().optional(),
				},
				timeoutMs: 10_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.call_tool",
				title: "Call a connected-app tool",
				description: "Execute one selected connected-app capability through the compact runtime path.",
				scope: "session",
				requires: ["host:tool.register"],
				args: {
					query: z.string().min(1),
					serverId: z.string().optional(),
					toolName: z.string().optional(),
					state: z.string().optional(),
				},
				timeoutMs: 30_000,
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.tools_status",
				title: "Connected-app readiness",
				description: "Report connected-app readiness without loading every schema.",
				scope: "session",
				requires: ["host:tool.register"],
				args: { serverId: z.string().optional() },
				timeoutMs: 5_000,
			},
		],
	},
	capabilities: [
		"host:bridge.session-read",
		"host:bridge.ui-state-read",
		"host:bridge.ui-state-write",
		"host:browser.lane-control",
		"host:browser.tab-control",
		"host:browser.action-dispatch",
		"host:command.register",
		"host:tool.register",
		"host:panel.register",
	],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "palot-bridge-context",
		requiresSessionBinding: true,
		bindOnActivation: true,
	},
	tags: ["bridge", "browser", "side-panel", "first-party"],
}

export const PALOT_BRIDGE_PLUGIN_ID = palotBridgeManifest.id
export const PALOT_BRIDGE_TOOL_IDS = palotBridgeManifest.contributes.tools.map((t) => t.id)
export const PALOT_BRIDGE_SIDE_PANEL_TABS = palotSidePanelTabSchema.options
