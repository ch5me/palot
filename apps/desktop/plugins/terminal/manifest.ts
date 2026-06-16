/**
 * Terminal — first-party Firefly plugin (migrated sidebar surface).
 *
 * `firefly.built-in.surface.terminal` per the locked first-party
 * migration matrix. This TypeScript manifest is the same Zod artifact
 * the catalog validates for every plugin; built-ins keep TS manifests.
 *
 * The Terminal side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `terminalSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const terminalPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.terminal",
	displayName: "Terminal",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Live PTY lane for the session project directory. Spawns a tmux-backed shell, keeps it reattachable across tab switches, and surfaces an attach command for external terminal clients.",
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
		{ kind: "onPanelOpen", panelId: "terminal" },
		{ kind: "onCommand", commandId: "open-terminal" },
		{ kind: "onCommand", commandId: "toggle-terminal" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.terminal.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.terminal.state" },
	],
	contributes: {
		panels: [
			{
				id: "terminal",
				title: "Terminal",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "terminal-square",
				defaultOn: true,
				commandIds: ["open-terminal", "toggle-terminal"],
				persistenceKey: "side-panel.terminal",
				telemetryNamespace: "firefly.surface.terminal",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-terminal",
				title: "Terminal: Open",
				description: "Open the Terminal side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-terminal",
				title: "Terminal: Toggle Surface",
				description: "Enable or disable the Terminal surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.terminal.open",
				title: "Open Terminal panel",
				description: "Open the Terminal side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "terminal", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.terminal.state",
				title: "Get Terminal surface state",
				description:
					"Read the Terminal surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "terminal", "pty", "first-party", "phase-1"],
}

export const TERMINAL_PLUGIN_ID = terminalPluginManifest.id
export const TERMINAL_PANEL_PROJECTED_ID = `${terminalPluginManifest.id}.terminal`
export const TERMINAL_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.terminal.open"
export const TERMINAL_TOOL_STATE_ID = "plugin.firefly.built-in.surface.terminal.state"
