/**
 * Studio / Office — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.studio` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Studio side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `studioSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const studioPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.studio",
	displayName: "Studio / Office",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"PDF and office-document preview lane: search workspace docs, view PDFs inline, and convert Word/spreadsheet/slide files via LibreOffice.",
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
		{ kind: "onPanelOpen", panelId: "studio" },
		{ kind: "onCommand", commandId: "open-studio" },
		{ kind: "onCommand", commandId: "toggle-studio" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.studio.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.studio.state" },
	],
	contributes: {
		panels: [
			{
				id: "studio",
				title: "Studio / Office",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "monitor-play",
				defaultOn: true,
				commandIds: ["open-studio", "toggle-studio"],
				persistenceKey: "side-panel.studio",
				telemetryNamespace: "firefly.surface.studio",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-studio",
				title: "Studio / Office: Open",
				description: "Open the Studio / Office side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-studio",
				title: "Studio / Office: Toggle Surface",
				description: "Enable or disable the Studio / Office surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.studio.open",
				title: "Open Studio / Office panel",
				description: "Open the Studio / Office side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "studio", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.studio.state",
				title: "Get Studio / Office surface state",
				description:
					"Read the Studio / Office surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "studio", "office", "first-party", "phase-3"],
}

export const STUDIO_PLUGIN_ID = studioPluginManifest.id
export const STUDIO_PANEL_PROJECTED_ID = `${studioPluginManifest.id}.studio`
export const STUDIO_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.studio.open"
export const STUDIO_TOOL_STATE_ID = "plugin.firefly.built-in.surface.studio.state"
