/**
 * CH5PM Dashboard — first-party Firefly plugin (migrated sidebar surface).
 *
 * `firefly.built-in.surface.ch5pm` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The CH5PM Dashboard side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `ch5pmSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * CH5PM is default-off (operator cockpit surface gated until daemon proof, per plan §4).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const ch5pmPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.surface.ch5pm",
	displayName: "CH5PM Dashboard",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Operator cockpit for the CH5 project-management daemon: live SSE snapshot of active tickets, worker slots, pressure metrics, and session signals.",
	license: "MIT",
	manifestRevision: 1,
	engines: {},
	trust: "built-in",
	lifecycle: {
		autoEnable: false,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 3,
	},
	activationEvents: [
		{ kind: "onPanelOpen", panelId: "ch5pm" },
		{ kind: "onCommand", commandId: "open-ch5pm" },
		{ kind: "onCommand", commandId: "toggle-ch5pm" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.ch5pm.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.ch5pm.state" },
	],
	contributes: {
		panels: [
			{
				id: "ch5pm",
				title: "CH5PM Dashboard",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "monitor-play",
				defaultOn: false,
				commandIds: ["open-ch5pm", "toggle-ch5pm"],
				persistenceKey: "side-panel.ch5pm",
				telemetryNamespace: "firefly.surface.ch5pm",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-ch5pm",
				title: "CH5PM Dashboard: Open",
				description: "Open the CH5PM Dashboard side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-ch5pm",
				title: "CH5PM Dashboard: Toggle Surface",
				description: "Enable or disable the CH5PM Dashboard surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.ch5pm.open",
				title: "Open CH5PM Dashboard panel",
				description: "Open the CH5PM Dashboard side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "ch5pm", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.ch5pm.state",
				title: "Get CH5PM Dashboard surface state",
				description:
					"Read the CH5PM Dashboard surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "ch5pm", "first-party", "phase-1"],
}

export const CH5PM_PLUGIN_ID = ch5pmPluginManifest.id
export const CH5PM_PANEL_PROJECTED_ID = `${ch5pmPluginManifest.id}.ch5pm`
export const CH5PM_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.ch5pm.open"
export const CH5PM_TOOL_STATE_ID = "plugin.firefly.built-in.surface.ch5pm.state"
