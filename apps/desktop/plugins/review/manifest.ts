/**
 * Review (Changes) — first-party Firefly plugin (second migrated sidebar).
 *
 * `firefly.built-in.surface.review` per the locked first-party
 * migration matrix. The Review side-panel tab, its palette commands,
 * and its paired OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `reviewSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * persistenceKey + telemetryNamespace byte-match the old registry row
 * to preserve stable identity across the cutover.
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const reviewPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.review",
	displayName: "Changes",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Session-scoped file diff review: view, collapse, and annotate file changes while working a session.",
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
		{ kind: "onPanelOpen", panelId: "review" },
		{ kind: "onCommand", commandId: "open-review" },
		{ kind: "onCommand", commandId: "toggle-review" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.review.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.review.state" },
	],
	contributes: {
		panels: [
			{
				id: "review",
				title: "Changes",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "file-diff",
				defaultOn: true,
				commandIds: ["open-review", "toggle-review"],
				persistenceKey: "side-panel.review",
				telemetryNamespace: "firefly.surface.review",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-review",
				title: "Changes: Open",
				description: "Open the Changes side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-review",
				title: "Changes: Toggle Surface",
				description: "Enable or disable the Changes surface.",
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
				id: "plugin.firefly.built-in.surface.review.open",
				title: "Open Changes panel",
				description: "Open the Changes (file diff review) side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "review", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.review.state",
				title: "Get Changes surface state",
				description:
					"Read the Changes surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "review", "changes", "diff", "first-party", "phase-1"],
}

export const REVIEW_PLUGIN_ID = reviewPluginManifest.id
export const REVIEW_PANEL_PROJECTED_ID = `${reviewPluginManifest.id}.review`
export const REVIEW_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.review.open"
export const REVIEW_TOOL_STATE_ID = "plugin.firefly.built-in.surface.review.state"
