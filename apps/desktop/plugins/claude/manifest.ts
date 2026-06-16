/**
 * Claude Code — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.claude` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Claude Code side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `claudeSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const claudePluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.claude",
	displayName: "Claude Code",
	version: "0.1.0",
	publisher: "Firefly",
	description:
		"Migration + compatibility lane for teams coming from Claude Code into Elf. Detects installed Claude Code config (MCP servers, agents, commands, rules, skills) and supports one-time import.",
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
		{ kind: "onPanelOpen", panelId: "claude" },
		{ kind: "onCommand", commandId: "open-claude" },
		{ kind: "onCommand", commandId: "toggle-claude" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.claude.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.claude.state" },
	],
	contributes: {
		panels: [
			{
				id: "claude",
				title: "Claude Code",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "rectangle-ellipsis",
				defaultOn: true,
				commandIds: ["open-claude", "toggle-claude"],
				persistenceKey: "side-panel.claude",
				telemetryNamespace: "firefly.surface.claude",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-claude",
				title: "Claude Code: Open",
				description: "Open the Claude Code side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-claude",
				title: "Claude Code: Toggle Surface",
				description: "Enable or disable the Claude Code surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.claude.open",
				title: "Open Claude Code panel",
				description: "Open the Claude Code side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "claude", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.claude.state",
				title: "Get Claude Code surface state",
				description:
					"Read the Claude Code surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "claude", "first-party", "phase-3"],
}

export const CLAUDE_PLUGIN_ID = claudePluginManifest.id
export const CLAUDE_PANEL_PROJECTED_ID = `${claudePluginManifest.id}.claude`
export const CLAUDE_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.claude.open"
export const CLAUDE_TOOL_STATE_ID = "plugin.firefly.built-in.surface.claude.state"
