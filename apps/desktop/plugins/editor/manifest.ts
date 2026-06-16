/**
 * Editor — first-party Firefly plugin (V2 catalog surface).
 *
 * `firefly.built-in.surface.editor` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Editor side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `editorSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * persistenceKey and telemetryNamespace byte-match the old registry
 * row to preserve stable identity across the cutover.
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const editorPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.surface.editor",
	displayName: "Editor",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Monaco-backed in-app editor for text files in the active checkout. Search project files, edit with full syntax highlighting, and save with Cmd/Ctrl+S.",
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
		{ kind: "onPanelOpen", panelId: "editor" },
		{ kind: "onCommand", commandId: "open-editor" },
		{ kind: "onCommand", commandId: "toggle-editor" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.editor.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.editor.state" },
	],
	contributes: {
		panels: [
			{
				id: "editor",
				title: "Editor",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "square-pen",
				defaultOn: true,
				commandIds: ["open-editor", "toggle-editor"],
				persistenceKey: "side-panel.editor",
				telemetryNamespace: "firefly.surface.editor",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-editor",
				title: "Editor: Open",
				description: "Open the Editor side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-editor",
				title: "Editor: Toggle Surface",
				description: "Enable or disable the Editor surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.editor.open",
				title: "Open Editor panel",
				description: "Open the Editor side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "editor", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.editor.state",
				title: "Get Editor surface state",
				description:
					"Read the Editor surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "editor", "first-party", "phase-1"],
}

export const EDITOR_PLUGIN_ID = editorPluginManifest.id
export const EDITOR_PANEL_PROJECTED_ID = `${editorPluginManifest.id}.editor`
export const EDITOR_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.editor.open"
export const EDITOR_TOOL_STATE_ID = "plugin.firefly.built-in.surface.editor.state"
