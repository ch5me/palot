/**
 * Notes — first-party Firefly plugin (the FIRST migrated sidebar).
 *
 * `firefly.built-in.surface.notes` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Notes side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `notesSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const notesPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.surface.notes",
	displayName: "Notes",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Session-scoped operator notes: capture follow-ups and cut lines while working a session, autosaved per session, injectable into the chat composer.",
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
		{ kind: "onPanelOpen", panelId: "notes" },
		{ kind: "onCommand", commandId: "open-notes" },
		{ kind: "onCommand", commandId: "toggle-notes" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.notes.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.notes.state" },
	],
	contributes: {
		panels: [
			{
				id: "notes",
				title: "Notes",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "book-text",
				defaultOn: true,
				commandIds: ["open-notes", "toggle-notes"],
				persistenceKey: "side-panel.notes",
				telemetryNamespace: "firefly.surface.notes",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-notes",
				title: "Notes: Open",
				description: "Open the Notes side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-notes",
				title: "Notes: Toggle Surface",
				description: "Enable or disable the Notes surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.notes.open",
				title: "Open Notes panel",
				description: "Open the Notes side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "notes", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.notes.state",
				title: "Get Notes surface state",
				description:
					"Read the Notes surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "notes", "first-party", "phase-1"],
}

export const NOTES_PLUGIN_ID = notesPluginManifest.id
export const NOTES_PANEL_PROJECTED_ID = `${notesPluginManifest.id}.notes`
export const NOTES_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.notes.open"
export const NOTES_TOOL_STATE_ID = "plugin.firefly.built-in.surface.notes.state"
