/**
 * Bridges — first-party Firefly plugin (migrated sidebar).
 *
 * `firefly.built-in.surface.bridges` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Bridges side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `bridgesSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const bridgesPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.bridges",
	displayName: "Bridges",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Integration hub: live connector probes, runtime status, and recent activity across all bridge channels.",
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
		{ kind: "onPanelOpen", panelId: "bridges" },
		{ kind: "onCommand", commandId: "open-bridges" },
		{ kind: "onCommand", commandId: "toggle-bridges" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.bridges.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.bridges.state" },
	],
	contributes: {
		panels: [
			{
				id: "bridges",
				title: "Bridges",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "share-2",
				defaultOn: true,
				commandIds: ["open-bridges", "toggle-bridges"],
				persistenceKey: "side-panel.bridges",
				telemetryNamespace: "firefly.surface.bridges",
				availability: { requires: ["host:bridge.session-read"] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-bridges",
				title: "Bridges: Open",
				description: "Open the Bridges side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-bridges",
				title: "Bridges: Toggle Surface",
				description: "Enable or disable the Bridges surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.bridges.open",
				title: "Open Bridges panel",
				description: "Open the Bridges side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "bridges", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.bridges.state",
				title: "Get Bridges surface state",
				description:
					"Read the Bridges surface state: whether the tab is available, open, and active for the focused session.",
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
		"host:bridge.session-read",
		"host:bridge.ui-state-read",
		"host:bridge.ui-state-write",
	],
	tags: ["surface", "bridges", "first-party", "phase-1"],
}

export const BRIDGES_PLUGIN_ID = bridgesPluginManifest.id
export const BRIDGES_PANEL_PROJECTED_ID = `${bridgesPluginManifest.id}.bridges`
export const BRIDGES_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.bridges.open"
export const BRIDGES_TOOL_STATE_ID = "plugin.firefly.built-in.surface.bridges.state"
