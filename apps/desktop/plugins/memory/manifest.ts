/**
 * Memory — first-party Firefly plugin (V2 catalog surface).
 *
 * `firefly.built-in.surface.memory` per the locked first-party
 * migration matrix row. This TypeScript manifest is validated through
 * the same Zod schema the catalog exercises; built-ins keep TS
 * manifests (the manifest is code).
 *
 * The Memory side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `memorySurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * persistenceKey and telemetryNamespace byte-match the old registry
 * row to preserve stable identity across the cutover.
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const memoryPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.memory",
	displayName: "Memory",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Durable memory cues for Palot sessions: pin facts, hybrid local/remote memory, and search across project context.",
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
		{ kind: "onPanelOpen", panelId: "memory" },
		{ kind: "onCommand", commandId: "open-memory" },
		{ kind: "onCommand", commandId: "toggle-memory" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.memory.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.memory.state" },
	],
	contributes: {
		panels: [
			{
				id: "memory",
				title: "Memory",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "database",
				defaultOn: false,
				commandIds: ["open-memory", "toggle-memory"],
				persistenceKey: "side-panel.memory",
				telemetryNamespace: "firefly.surface.memory",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-memory",
				title: "Memory: Open",
				description: "Open the Memory side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-memory",
				title: "Memory: Toggle Surface",
				description: "Enable or disable the Memory surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.memory.open",
				title: "Open Memory panel",
				description: "Open the Memory side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "memory", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.memory.state",
				title: "Get Memory surface state",
				description:
					"Read the Memory surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "memory", "first-party", "phase-1"],
}

export const MEMORY_PLUGIN_ID = memoryPluginManifest.id
export const MEMORY_PANEL_PROJECTED_ID = `${memoryPluginManifest.id}.memory`
export const MEMORY_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.memory.open"
export const MEMORY_TOOL_STATE_ID = "plugin.firefly.built-in.surface.memory.state"
