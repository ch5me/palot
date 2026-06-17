/**
 * Oracle Roster — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.oracle` per the locked first-party
 * migration matrix. This manifest replaces the former
 * `FIREFLY_SURFACE_REGISTRY` row (id: "oracle") and the
 * `oracleSurfaceEnabledAtom` feature flag.
 *
 * persistenceKey and telemetryNamespace byte-match the deleted V1 row
 * for stable identity across the cutover.
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const oraclePluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.oracle",
	displayName: "Oracle Roster",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Live tmux oracle sessions and attachable panes — polling roster, create/rename/delete forms, hidden-set persistence.",
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
		{ kind: "onPanelOpen", panelId: "oracle" },
		{ kind: "onCommand", commandId: "open-oracle" },
		{ kind: "onCommand", commandId: "toggle-oracle" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.oracle.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.oracle.state" },
	],
	contributes: {
		panels: [
			{
				id: "oracle",
				title: "Oracle Roster",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "wand-sparkles",
				defaultOn: true,
				commandIds: ["open-oracle", "toggle-oracle"],
				persistenceKey: "side-panel.oracle",
				telemetryNamespace: "firefly.surface.oracle",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-oracle",
				title: "Oracle Roster: Open",
				description: "Open the Oracle Roster side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-oracle",
				title: "Oracle Roster: Toggle Surface",
				description: "Enable or disable the Oracle Roster surface.",
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
				id: "plugin.firefly.built-in.surface.oracle.open",
				title: "Open Oracle Roster panel",
				description: "Open the Oracle Roster side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "oracle", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.oracle.state",
				title: "Get Oracle Roster surface state",
				description:
					"Read the Oracle Roster surface state: whether the tab is available, open, and active for the focused session.",
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
	],
	tags: ["surface", "oracle", "first-party", "phase-1"],
}

export const ORACLE_PLUGIN_ID = oraclePluginManifest.id
export const ORACLE_PANEL_PROJECTED_ID = `${oraclePluginManifest.id}.oracle`
export const ORACLE_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.oracle.open"
export const ORACLE_TOOL_STATE_ID = "plugin.firefly.built-in.surface.oracle.state"
