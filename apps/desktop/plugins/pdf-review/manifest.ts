/**
 * PDF Review — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.pdf-review` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The PDF Review side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `pdfReviewSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 *
 * persistenceKey and telemetryNamespace MUST byte-match the old registry
 * row for stable identity: "side-panel.pdf-review" and
 * "firefly.surface.pdf-review".
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const pdfReviewPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.pdf-review",
	displayName: "PDF Review",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Grounded chat, selection actions, annotations, and project retrieval for PDF documents. Shared locator contract wires citations, annotations, search hits, artifact references, and data-table cells to the same position shape.",
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
		{ kind: "onPanelOpen", panelId: "pdf-review" },
		{ kind: "onCommand", commandId: "open-pdf-review" },
		{ kind: "onCommand", commandId: "toggle-pdf-review" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.pdf-review.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.pdf-review.state" },
	],
	contributes: {
		panels: [
			{
				id: "pdf-review",
				title: "PDF Review",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "file-text",
				defaultOn: false,
				commandIds: ["open-pdf-review", "toggle-pdf-review"],
				persistenceKey: "side-panel.pdf-review",
				telemetryNamespace: "firefly.surface.pdf-review",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-pdf-review",
				title: "PDF Review: Open",
				description: "Open the PDF Review side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-pdf-review",
				title: "PDF Review: Toggle Surface",
				description: "Enable or disable the PDF Review surface.",
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
				id: "plugin.firefly.built-in.surface.pdf-review.open",
				title: "Open PDF Review panel",
				description: "Open the PDF Review side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "pdf-review", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.pdf-review.state",
				title: "Get PDF Review surface state",
				description:
					"Read the PDF Review surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "pdf-review", "first-party", "phase-1"],
}

export const PDF_REVIEW_PLUGIN_ID = pdfReviewPluginManifest.id
export const PDF_REVIEW_PANEL_PROJECTED_ID = `${pdfReviewPluginManifest.id}.pdf-review`
export const PDF_REVIEW_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.pdf-review.open"
export const PDF_REVIEW_TOOL_STATE_ID = "plugin.firefly.built-in.surface.pdf-review.state"
