/**
 * Firefly Plugin System V2 — Palot Bridge (first-party exemplar) V2 manifest
 *
 * The current `palot-bridge.js` plugin is the closest thing the desktop
 * app already has to a first-party V2 plugin: it now keeps only
 * the side-panel bridge tools after browser/discovery tool cutover, plus
 * an OpenCode system-context block and managed-server-only bridge
 * transport. This file is the V2 manifest that captures the same surface
 * in a way the V2 host can project uniformly.
 *
 * It is intentionally read-only data — the runtime is still
 * `apps/desktop/src/main/palot-plugin/plugin.js` until the V2 plugin
 * host (planned in a later task) takes over activation. Re-deriving the
 * descriptor from this manifest produces the same projections the V2
 * host would compute for the current plugin once it is registered.
 */

import { z } from "zod"

import type { ComponentContribution, PluginManifest } from "./manifest"

const FIREFLY_SURFACE_IDS = [
	"review",
	"browser",
	"notes",
	"pulse",
	"artifacts",
	"memory",
	"files",
	"terminal",
	"editor",
	"plugins",
	"bridges",
	"crm",
	"studio",
	"voice",
	"oracle",
	"claude",
	"ch5pm",
	"pdf-review",
] as const

export const palotSidePanelTabSchema = z.enum(FIREFLY_SURFACE_IDS)

const dagSparklinePropsSchema = z.object({
	nodes: z.array(
		z
			.object({
				id: z.string().min(1),
				label: z.string().optional(),
				tone: z.string().optional(),
			})
			.passthrough(),
	),
	edges: z.array(
		z
			.object({
				source: z.string().min(1),
				target: z.string().min(1),
				tone: z.string().optional(),
				animated: z.boolean().optional(),
			})
			.passthrough(),
	),
	dir: z.enum(["LR", "TB"]).optional(),
	animate: z.enum(["none", "reveal", "flow"]).optional(),
	height: z.number().finite().optional(),
	showLabels: z.boolean().optional(),
	className: z.string().optional(),
})

const decisionCardPropsSchema = z.object({
	title: z.string().min(1),
	options: z.array(
		z.object({
			id: z.string().min(1),
			label: z.string().min(1),
		}),
	),
	selected: z.string().nullable(),
	notes: z.string().optional(),
})

const statusThinkingCardPropsSchema = z.object({
	title: z.string().min(1),
	status: z.enum(["thinking", "running", "done", "blocked"]),
	detail: z.string().optional(),
	steps: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string().min(1),
				state: z.enum(["queued", "running", "done", "blocked"]).optional(),
			}),
		)
		.min(1)
		.max(8),
})

const palotBridgeComponents: ComponentContribution[] = [
	{
		id: "dag-sparkline",
		apiVersion: 1,
		category: "diagram",
		props: dagSparklinePropsSchema,
		events: {},
		state: {},
		supports_append: true,
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "stable",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "chat-inline-right", "side-panel"],
		sourcePackage: "@ch5me/dag-sparkline",
		storybookPath: "packages/web/dag-sparkline/src/DagSpark.stories.tsx",
		docsPath: "docs/genui-artifact-architecture.md",
		example: {
			component: "dag-sparkline",
			props: {
				nodes: [
					{ id: "plan", label: "Plan" },
					{ id: "build", label: "Build" },
					{ id: "ship", label: "Ship" },
				],
				edges: [
					{ source: "plan", target: "build" },
					{ source: "build", target: "ship" },
				],
			},
		},
		capabilityGates: [],
		hostVocabulary: {
			slots: ["chart"],
			zones: ["loom-tree", "genui-fence"],
		},
		conflictPolicy: "ask",
	},
	{
		id: "decision_card",
		apiVersion: 1,
		category: "decision",
		props: decisionCardPropsSchema,
		events: {
			submit: z.object({ optionId: z.string().min(1) }),
		},
		state: {
			notes: z.string(),
			selected: z.string().nullable(),
		},
		supports_append: false,
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "stable",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "chat-inline-right"],
		docsPath: "docs/genui-artifact-architecture.md",
		example: {
			component: "decision_card",
			props: {
				title: "Pick launch path",
				options: [
					{ id: "opt_a", label: "Private beta" },
					{ id: "opt_b", label: "Public launch" },
				],
				selected: null,
				notes: "",
			},
		},
		capabilityGates: [],
		hostVocabulary: {
			slots: ["notes", "actions"],
			zones: ["loom-tree", "genui-fence", "artifact-widget"],
		},
		conflictPolicy: "ask",
	},
	{
		id: "status_thinking_card",
		apiVersion: 1,
		category: "custom",
		props: statusThinkingCardPropsSchema,
		events: {},
		state: {},
		supports_append: false,
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "beta",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "above-chat", "chat-inline-right"],
		sourcePackage: "@ch5me/remotion-experiences",
		storybookPath: "packages/web/remotion-experiences/src/spikes/StatusThinkingCard.stories.tsx",
		docsPath: "docs/genui-artifact-architecture.md",
		example: {
			component: "status_thinking_card",
			props: {
				title: "Surface registry pass",
				status: "running",
				detail: "Scanning Storybook candidates and wiring safe entries.",
				steps: [
					{ id: "scan", label: "Inventory Storybook stories", state: "done" },
					{ id: "registry", label: "Register schema-safe components", state: "running" },
					{ id: "proof", label: "Run discovery smoke tests", state: "queued" },
				],
			},
		},
		capabilityGates: [],
		hostVocabulary: {
			slots: ["status"],
			zones: ["genui-fence", "artifact-widget"],
		},
		conflictPolicy: "agent-wins",
	},
]

export const palotBridgeManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.palot-bridge",
	displayName: "Palot Bridge",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"First-party bridge between OpenCode and the Firefly desktop surface. Side panel tab control and UI state. Managed-server only in V2 initial scope.",
	license: "MIT",
	manifestRevision: 1,
	engines: {
		firefly: ">=0.11.0",
	},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 5,
		restartBackoffMs: 2_000,
	},
	activationEvents: [
		{ kind: "onStartup" },
		{ kind: "onSessionAttach" },
	],
	contributes: {
		panels: [],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "palot-open-side-panel",
				title: "Open side panel tab",
				description: "Open a Palot side panel tab in the desktop UI.",
				category: "Surface",
				requires: ["host:bridge.ui-state-write", "host:command.register"],
			},
			{
				id: "palot-refresh-ui-state",
				title: "Refresh Palot UI state",
				description: "Re-derive the side panel snapshot for the active session.",
				category: "Surface",
				requires: ["host:bridge.ui-state-read", "host:command.register"],
			},
		],
		themes: [],
		tools: [
			{
				id: "plugin.firefly.built-in.palot-bridge.open_side_panel",
				title: "Open side panel tab",
				description: "Open a Palot side panel tab in the desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: { tab: palotSidePanelTabSchema },
				timeoutMs: 5_000,
				uiHints: { refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.palot-bridge.ui_state",
				title: "Get Palot UI state",
				description: "Get the current Palot UI state (side panel snapshot).",
				scope: "session",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
			},
		],
		components: palotBridgeComponents,
		snippets: [],
		languages: [],
		grammars: [],
		iconThemes: [],
	},
	capabilities: [
		"host:bridge.session-read",
		"host:bridge.ui-state-read",
		"host:bridge.ui-state-write",
		"host:browser.lane-control",
		"host:browser.tab-control",
		"host:browser.action-dispatch",
		"host:command.register",
		"host:tool.register",
		"host:panel.register",
	],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "palot-bridge-context",
		requiresSessionBinding: true,
		bindOnActivation: true,
	},
	tags: ["bridge", "browser", "side-panel", "first-party"],
}

export const PALOT_BRIDGE_DECISION_CARD_COMPONENT = {
	component: "decision_card",
	props: {
		title: "string",
		options: [{ id: "string", label: "string" }],
		selected: "string | null",
		notes: "string",
	},
	events: { submit: { optionId: "string" } },
	state: { notes: "string" },
	conflictPolicy: "ask",
} as const

export const PALOT_BRIDGE_COMPONENT_IDS = palotBridgeComponents.map((component) => component.id)
export const PALOT_BRIDGE_PLUGIN_ID = palotBridgeManifest.id
export const PALOT_BRIDGE_TOOL_IDS = palotBridgeManifest.contributes.tools.map((t) => t.id)
export const PALOT_BRIDGE_SIDE_PANEL_TABS = palotSidePanelTabSchema.options
