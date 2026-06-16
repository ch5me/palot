/**
 * Firefly Plugin System V2 — Third-party / AI-authored exemplar
 *
 * A realistic third-party or AI-authored plugin that exercises trust,
 * permissions, UI contribution, OpenCode tool control, isolation,
 * and lifecycle surfaces. The exemplar stays inside V2 guardrails:
 * no arbitrary native dependencies, no runtime vscode shim, no
 * hidden sidecar.
 *
 * The plugin: `acme.acme-notebook`. A user-facing notebook plugin
 * that ships:
 *   - 1 command palette entry (add a notebook cell)
 *   - 1 keyboard shortcut (Cmd+Shift+N)
 *   - 1 session widget (a small note-pad widget in the
 *     `above-chat` zone)
 *   - 1 OpenCode tool (`acme.notebook.addCell`) that mutates
 *     session-scoped storage
 *   - 1 theme contribution (an optional dark/light pair the user
 *     can opt into)
 *
 * The plugin declares itself as `signed-third-party` so the broker
 * applies signed-tier policy: it can request low + medium-risk
 * tokens but every high-risk token requires explicit per-session
 * consent. The exemplar proves the V2 host can load, activate,
 * supervise, hot-reload, and quarantine a third-party plugin
 * without any special-case knowledge of `acme-notebook`.
 */

import { z } from "zod"

import { type PluginManifest } from "./manifest"

const addCellArgsSchema = z
	.object({
		notebook: z.string().min(1).max(120),
		content: z.string().min(1).max(4_000),
		tags: z.array(z.string().min(1).max(40)).max(8).default([]),
	})
	.strict()

export const ACME_NOTEBOOK_PLUGIN_ID = "acme.acme-notebook" as const
export const ACME_NOTEBOOK_VERSION = "0.3.1" as const
export const ACME_NOTEBOOK_TRUST = "signed-third-party" as const

/**
 * The full V2 manifest for the third-party / AI-authored exemplar.
 * The shape is the same as every other V2 plugin; nothing about
 * the descriptor leaks "third-party-ness" to the runtime.
 */
export const acmeNotebookManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: ACME_NOTEBOOK_PLUGIN_ID,
	displayName: "Acme Notebook",
	version: ACME_NOTEBOOK_VERSION,
	publisher: "Acme Software, Inc.",
	description:
		"Notebook plugin that adds a session-scoped notepad, a command palette entry, and a tool to add cells from the agent. Stays inside the V2 guardrails: no native deps, no vscode shim, no hidden sidecar.",
	license: "Apache-2.0",
	homepage: "https://acme.example.com/notebook",
	manifestRevision: 1,
	engines: {
		firefly: ">=0.11.0",
	},
	trust: ACME_NOTEBOOK_TRUST,
	lifecycle: {
		autoEnable: false,
		keepAliveAcrossSessions: true,
		quarantineOnCrashCount: 3,
		restartBackoffMs: 1_500,
	},
	activationEvents: [
		{ kind: "onCommand", commandId: "acme-notebook-open" },
		{ kind: "onWidgetPlace", widgetId: "notepad" },
		{ kind: "onToolCall", toolId: "plugin.acme.acme-notebook.addCell" },
	],
	contributes: {
		panels: [],
		navSidebars: [],
		widgets: [
			{
				id: "notepad",
				title: "Notepad",
				zoneId: "above-chat",
				defaultEnabled: true,
				icon: "notebook",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		commands: [
			{
				id: "acme-notebook-open",
				title: "Open notepad",
				description: "Open the notepad widget in the above-chat zone.",
				category: "Acme",
				keybinding: "Cmd+Shift+N",
				menuPath: ["View", "Notepad"],
				requires: ["host:command.register", "host:widget.register"],
				when: "inSession",
			},
			{
				id: "acme-notebook-clear",
				title: "Clear notepad",
				description: "Clear every cell in the active notepad.",
				category: "Acme",
				requires: ["host:command.register", "host:bridge.session-write"],
				when: "inSession & flag:notepadEnabled",
			},
		],
		themes: [
			{
				id: "acme-notebook-ink",
				label: "Acme Notebook Ink",
				kind: "dark",
				platforms: ["darwin", "linux", "win32"],
				tokens: {
					"--acme-notebook-bg": "#0c0e14",
					"--acme-notebook-fg": "#d9dce3",
					"--acme-notebook-accent": "#7aa2f7",
				},
				darkTokens: {},
				fontFamily: "Acme Mono, ui-monospace, monospace",
				radius: "6px",
				density: "cozy",
			},
		],
		tools: [
			{
				id: "plugin.acme.acme-notebook.addCell",
				title: "Add notepad cell",
				description:
					"Append a new cell to the active session notepad. Reads + writes session-scoped storage; the broker requires host:bridge.session-write for every call.",
				scope: "session",
				requires: ["host:bridge.session-read", "host:bridge.session-write"],
				args: {
					notebook: z.string().min(1).max(120),
					content: z.string().min(1).max(4_000),
					tags: z.array(z.string().min(1).max(40)).max(8).optional(),
				},
				timeoutMs: 5_000,
				uiHints: { refreshProjection: true },
			},
			{
				id: "plugin.acme.acme-notebook.exportMarkdown",
				title: "Export notepad as markdown",
				description: "Read the active notepad and return a markdown blob. Read-only; no session write.",
				scope: "session",
				requires: ["host:bridge.session-read"],
				args: {
					notebook: z.string().min(1).max(120),
				},
				timeoutMs: 5_000,
			},
		],
		components: [],
	},
	capabilities: [
		"host:bridge.session-read",
		"host:bridge.session-write",
		"host:command.register",
		"host:widget.register",
		"host:theme.register",
		"host:tool.register",
	],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "acme-notebook",
		systemContextBlock:
			"<acme-notebook-context>\nThe user has the Acme Notebook plugin installed. Use plugin.acme.acme-notebook.addCell to add notes when the user asks to remember something. Use plugin.acme.acme-notebook.exportMarkdown to read the notepad.\n</acme-notebook-context>",
		requiresSessionBinding: true,
		bindOnActivation: true,
	},
	tags: ["notebook", "third-party", "ai-authored-example"],
}

/**
 * The Zod schemas for the exemplar's tool args. The runtime uses
 * these to validate caller input at the bridge boundary; the
 * exemplar is a contract for what a V2 third-party plugin can ship
 * without violating any guardrail.
 */
export const acmeNotebookAddCellArgs = addCellArgsSchema
export type AcmeNotebookAddCellArgs = z.infer<typeof addCellArgsSchema>

/**
 * The third-party exemplar satisfies every V2 guardrail. The
 * matrix below is greppable from the operator UI; the runtime
 * consults it when an admin reviews a third-party plugin.
 */
export interface ThirdPartyExemplarGuardrail {
	readonly guardrail: string
	readonly exemplarBehavior: string
}

export const ACME_NOTEBOOK_GUARDRAILS: readonly ThirdPartyExemplarGuardrail[] = [
	{
		guardrail: "no plugin code in main process",
		exemplarBehavior:
			"Every tool handler runs in the plugin worker. The host never imports acme-notebook code directly.",
	},
	{
		guardrail: "no direct plugin DOM mutation",
		exemplarBehavior:
			"The notepad widget renders through the host's reconciler; the plugin only contributes data + a render factory.",
	},
	{
		guardrail: "no runtime vscode shim / no hidden sidecar",
		exemplarBehavior:
			"acme-notebook does not import vscode, electron, or any host-internal module. Everything goes through the V2 bridge.",
	},
	{
		guardrail: "no arbitrary native dependencies for AI-authored plugins",
		exemplarBehavior:
			"acme-notebook has zero native deps; the manifest declares only V2 host capabilities and uses Zod for arg validation.",
	},
	{
		guardrail: "no agent tool path that bypasses plugin capabilities, session scope, or Zod validation",
		exemplarBehavior:
			"plugin.acme.acme-notebook.addCell requires host:bridge.session-read + host:bridge.session-write, is scope:session, and validates its args with z.object(strict).",
	},
]

/**
 * Build a `PluginDescriptor` from the exemplar manifest. Pure; the
 * runtime can call this at any time without side effects.
 */
export function deriveAcmeNotebookDescriptor(appVersion: string) {
	const { derivePluginDescriptor } = require("./descriptor")
	return derivePluginDescriptor(acmeNotebookManifest, { appVersion })
}
