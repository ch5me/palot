/**
 * Artifacts — first-party Firefly plugin (migrated sidebar).
 *
 * `firefly.built-in.surface.artifacts` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The Artifacts side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `artifactsSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const artifactsPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.artifacts",
	displayName: "Artifacts",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Session-scoped GenUI artifacts panel: browse, pin, and manage generative UI artifacts captured during a session.",
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
		{ kind: "onPanelOpen", panelId: "artifacts" },
		{ kind: "onCommand", commandId: "open-artifacts" },
		{ kind: "onCommand", commandId: "toggle-artifacts" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.artifacts.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.artifacts.state" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.artifacts.show-doc" },
	],
	contributes: {
		panels: [
			{
				id: "artifacts",
				title: "Artifacts",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "boxes",
				defaultOn: true,
				commandIds: ["open-artifacts", "toggle-artifacts"],
				persistenceKey: "side-panel.artifacts",
				telemetryNamespace: "firefly.surface.artifacts",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-artifacts",
				title: "Artifacts: Open",
				description: "Open the Artifacts side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-artifacts",
				title: "Artifacts: Toggle Surface",
				description: "Enable or disable the Artifacts surface.",
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
				id: "plugin.firefly.built-in.surface.artifacts.open",
				title: "Open Artifacts panel",
				description: "Open the Artifacts side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "artifacts", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.artifacts.state",
				title: "Get Artifacts surface state",
				description:
					"Read the Artifacts surface state: whether the tab is available, open, and active for the focused session.",
				scope: "session",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {
					sessionId: z.string().optional(),
				},
				timeoutMs: 5_000,
			},
			{
				id: "plugin.firefly.built-in.surface.artifacts.show-doc",
				title: "Show document in Artifacts panel",
				description:
					"Open the Artifacts side-panel tab and display a document (markdown or HTML) as a new artifact. " +
					"Use this to show reports, summaries, or any rich content the agent wants the user to read.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {
					title: z.string().min(1).max(256),
					markdown: z.string(),
					format: z.enum(["markdown", "html"]).optional(),
				},
				timeoutMs: 10_000,
				uiHints: { openPanel: "artifacts", refreshProjection: true },
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
	tags: ["surface", "artifacts", "first-party", "phase-1"],
}

export const ARTIFACTS_PLUGIN_ID = artifactsPluginManifest.id
export const ARTIFACTS_PANEL_PROJECTED_ID = `${artifactsPluginManifest.id}.artifacts`
export const ARTIFACTS_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.artifacts.open"
export const ARTIFACTS_TOOL_STATE_ID = "plugin.firefly.built-in.surface.artifacts.state"
export const ARTIFACTS_TOOL_SHOW_DOC_ID = "plugin.firefly.built-in.surface.artifacts.show-doc"
