/**
 * Files — first-party Firefly plugin (the third migrated sidebar after notes and review).
 *
 * `firefly.built-in.surface.files` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Files side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `filesSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const filesPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.files",
	displayName: "Files",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"File tree explorer with git decorations and inline file viewer for the active checkout. Broker-gated main/files.ts IPC.",
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
		{ kind: "onPanelOpen", panelId: "files" },
		{ kind: "onCommand", commandId: "open-files" },
		{ kind: "onCommand", commandId: "toggle-files" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.files.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.files.state" },
	],
	contributes: {
		panels: [
			{
				id: "files",
				title: "Files",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "files",
				defaultOn: true,
				commandIds: ["open-files", "toggle-files"],
				persistenceKey: "side-panel.files",
				telemetryNamespace: "firefly.surface.files",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-files",
				title: "Files: Open",
				description: "Open the Files side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-files",
				title: "Files: Toggle Surface",
				description: "Enable or disable the Files surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.files.open",
				title: "Open Files panel",
				description: "Open the Files side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "files", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.files.state",
				title: "Get Files surface state",
				description:
					"Read the Files surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "files", "first-party", "phase-1"],
}

export const FILES_PLUGIN_ID = filesPluginManifest.id
export const FILES_PANEL_PROJECTED_ID = `${filesPluginManifest.id}.files`
export const FILES_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.files.open"
export const FILES_TOOL_STATE_ID = "plugin.firefly.built-in.surface.files.state"
