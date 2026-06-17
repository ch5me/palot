/**
 * Pulse — first-party Firefly plugin (migrated sidebar surface).
 *
 * `firefly.built-in.surface.pulse` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Pulse side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `pulseSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * Pulse is default-off (low-traffic observability surface, per plan §4).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const pulsePluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.pulse",
	displayName: "Pulse",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Compact session heartbeat: work time, cost, token usage, model distribution, cache efficiency, tool calls, and automation status at a glance.",
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
		{ kind: "onPanelOpen", panelId: "pulse" },
		{ kind: "onCommand", commandId: "open-pulse" },
		{ kind: "onCommand", commandId: "toggle-pulse" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.pulse.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.pulse.state" },
	],
	contributes: {
		panels: [
			{
				id: "pulse",
				title: "Pulse",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "activity",
				defaultOn: false,
				commandIds: ["open-pulse", "toggle-pulse"],
				persistenceKey: "side-panel.pulse",
				telemetryNamespace: "firefly.surface.pulse",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-pulse",
				title: "Pulse: Open",
				description: "Open the Pulse side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-pulse",
				title: "Pulse: Toggle Surface",
				description: "Enable or disable the Pulse surface.",
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
				id: "plugin.firefly.built-in.surface.pulse.open",
				title: "Open Pulse panel",
				description: "Open the Pulse side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "pulse", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.pulse.state",
				title: "Get Pulse surface state",
				description:
					"Read the Pulse surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "pulse", "first-party", "phase-1"],
}

export const PULSE_PLUGIN_ID = pulsePluginManifest.id
export const PULSE_PANEL_PROJECTED_ID = `${pulsePluginManifest.id}.pulse`
export const PULSE_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.pulse.open"
export const PULSE_TOOL_STATE_ID = "plugin.firefly.built-in.surface.pulse.state"
