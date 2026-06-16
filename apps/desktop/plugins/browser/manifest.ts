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

export const browserPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.surface.browser",
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
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.browser.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.browser.state" },
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
		tools: [
			{
				id: "plugin.firefly.built-in.surface.browser.open",
				title: "Open Browser panel",
				description: "Open the Browser side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "browser", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.browser.state",
				title: "Get Browser surface state",
				description:
					"Read the Browser surface state: whether the tab is available, open, and active for the focused session.",
				scope: "session",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {
					sessionId: z.string().optional(),
				},
				timeoutMs: 5_000,
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
