import { z } from "zod"

import { decideCapabilityAll } from "./capability-broker"
import { describePlugin, getPluginCatalog } from "./authority"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/dispatch")

export interface PluginInvokeInput {
	pluginId: string
	commandId: string
	args: Record<string, unknown>
	sessionId?: string | null
}

export interface PluginInvokeContext {
	grantedTokens: string[]
	sessionScope: "session" | "project" | "app"
}

export type HostCommandResult =
	| { data: unknown }
	| { error: { code: string; message: string } }

export type HostCommandHandler = (input: {
	command: z.ZodTypeAny
	args: unknown
	sessionId: string | null
}) => Promise<HostCommandResult>

const handlers = new Map<string, HostCommandHandler>()

export function registerHostCommand(
	pluginId: string,
	commandId: string,
	handler: HostCommandHandler,
): void {
	handlers.set(`${pluginId}::${commandId}`, handler)
}

export function unregisterHostCommand(pluginId: string, commandId: string): void {
	handlers.delete(`${pluginId}::${commandId}`)
}

export function listKnownCommands(): string[] {
	return Array.from(handlers.keys())
}

export function _resetHostCommandsForTests(): void {
	handlers.clear()
}

function findManifestCommand(pluginId: string, commandId: string) {
	const catalog = getPluginCatalog()
	const descriptor = catalog.descriptors.find((d) => d.normalizedId === pluginId)
	if (!descriptor) return null
	return descriptor.commands.find((c) => c.id === commandId) ?? null
}

function trustFromCatalog(pluginId: string): "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party" {
	const described = describePlugin(pluginId)
	return described.decision.granted ? "built-in" : "signed-third-party"
}

function ok<T>(data: T): HostCommandResult {
	return { data }
}

function err(code: string, message: string): HostCommandResult {
	return { error: { code, message } }
}

export interface ToolDispatchEnvelope {
	status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
	pluginId: string
	commandId: string
	errorCode?: string
	errorMessage?: string
	data?: unknown
}

export async function invokePluginCommand(
	input: PluginInvokeInput,
	context: PluginInvokeContext = {
		grantedTokens: [
			"host:command.register",
			"host:tool.register",
			"host:panel.register",
			"host:widget.register",
			"host:theme.register",
			"host:ui.read",
			"host:bridge.session-read",
			"host:bridge.ui-state-read",
			"host:bridge.ui-state-write",
			"host:theme.preview",
		],
		sessionScope: "session",
	},
): Promise<ToolDispatchEnvelope> {
	const command = findManifestCommand(input.pluginId, input.commandId)
	if (!command) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "plugin_unavailable",
			errorMessage: "Unknown command",
		}
	}
	const trust = trustFromCatalog(input.pluginId)
	const broker = decideCapabilityAll({
		pluginId: input.pluginId,
		trust,
		tokens: command.requires,
		sessionScope: context.sessionScope,
		grantedTokens: context.grantedTokens,
	})
	if (!broker.granted) {
		return {
			status: "denied",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "permission_denied",
			errorMessage: broker.failures[0]?.reason ?? "capability denied",
		}
	}
	const handler = handlers.get(`${input.pluginId}::${input.commandId}`)
	if (!handler) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "plugin_unavailable",
			errorMessage: "No host handler registered",
		}
	}
	const argsSchema = z.object((command as { args?: Record<string, z.ZodTypeAny> }).args ?? {}).passthrough()
	const result = await handler({
		command: argsSchema as z.ZodTypeAny,
		args: input.args as Record<string, unknown> | undefined,
		sessionId: input.sessionId ?? null,
	})
	if ("error" in result) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: result.error.code,
			errorMessage: result.error.message,
		}
	}
	return {
		status: "completed",
		pluginId: input.pluginId,
		commandId: input.commandId,
		data: result.data,
	}
}

// ---------------------------------------------------------------------------
// Tool dispatch (paired OpenCode/agent tools from `contributes.tools`)
// ---------------------------------------------------------------------------

export type HostToolHandler = (input: {
	args: Record<string, unknown>
	sessionId: string | null
}) => Promise<HostCommandResult>

const toolHandlers = new Map<string, HostToolHandler>()

export function registerHostTool(pluginId: string, toolId: string, handler: HostToolHandler): void {
	toolHandlers.set(`${pluginId}::${toolId}`, handler)
}

export function unregisterHostTool(pluginId: string, toolId: string): void {
	toolHandlers.delete(`${pluginId}::${toolId}`)
}

export function listKnownTools(): string[] {
	return Array.from(toolHandlers.keys())
}

export function _resetHostToolsForTests(): void {
	toolHandlers.clear()
}

export interface PluginToolInvokeInput {
	pluginId: string
	toolId: string
	args: Record<string, unknown>
	sessionId?: string | null
}

/**
 * Invoke a plugin tool through the catalog: manifest lookup → broker
 * capability check → Zod args validation → registered host handler.
 * Same envelope family as command dispatch; every failure is typed.
 */
export async function invokePluginTool(
	input: PluginToolInvokeInput,
	context: PluginInvokeContext = {
		grantedTokens: [
			"host:command.register",
			"host:tool.register",
			"host:panel.register",
			"host:widget.register",
			"host:theme.register",
			"host:ui.read",
			"host:bridge.session-read",
			"host:bridge.ui-state-read",
			"host:bridge.ui-state-write",
		],
		sessionScope: "session",
	},
): Promise<ToolDispatchEnvelope> {
	const catalog = getPluginCatalog()
	const descriptor = catalog.descriptors.find((d) => d.normalizedId === input.pluginId)
	const tool = descriptor?.tools.find((t) => t.id === input.toolId)
	if (!descriptor || !tool) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "plugin_unavailable",
			errorMessage: "Unknown tool",
		}
	}
	const state = catalog.capabilityStates[input.pluginId]
	if (state?.pluginDisabled || state?.pluginQuarantined) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: state.pluginQuarantined ? "plugin_quarantined" : "plugin_disabled",
			errorMessage: state.pluginQuarantined
				? "Plugin is quarantined by the host"
				: "Plugin is disabled by the host",
		}
	}
	const broker = decideCapabilityAll({
		pluginId: input.pluginId,
		trust: descriptor.trust,
		tokens: tool.requires,
		sessionScope: context.sessionScope,
		grantedTokens: context.grantedTokens,
	})
	if (!broker.granted) {
		return {
			status: "denied",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "permission_denied",
			errorMessage: broker.failures[0]?.reason ?? "capability denied",
		}
	}
	const argsSchema = z.object(tool.args as Record<string, z.ZodTypeAny>)
	const parsedArgs = argsSchema.safeParse(input.args ?? {})
	if (!parsedArgs.success) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "validation_error",
			errorMessage: parsedArgs.error.issues
				.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
				.join("; "),
		}
	}
	const handler = toolHandlers.get(`${input.pluginId}::${input.toolId}`)
	if (!handler) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "plugin_unavailable",
			errorMessage: "No host tool handler registered",
		}
	}
	const result = await handler({
		args: parsedArgs.data as Record<string, unknown>,
		sessionId: input.sessionId ?? null,
	})
	if ("error" in result) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: result.error.code,
			errorMessage: result.error.message,
		}
	}
	return {
		status: "completed",
		pluginId: input.pluginId,
		commandId: input.toolId,
		data: result.data,
	}
}

async function invokePalotOpenSidePanel(input: {
	command: z.ZodTypeAny
	args: unknown
	sessionId: string | null
}) {
	const parsed = input.command.parse(input.args ?? {})
	const tab = (parsed as { tab?: string }).tab
	if (!tab) return err("validation_error", "missing tab")
	return ok({ opened: true, tab, source: "v2-plugin-dispatch" })
}

async function invokePalotRefreshUiState() {
	return ok({ refreshedAt: Date.now(), source: "v2-plugin-dispatch" })
}

async function invokePalotUiState() {
	return ok({ sidePanel: { open: true, activeTab: "review" }, source: "v2-plugin-dispatch" })
}

async function invokeAcmeNotebookOpen() {
	return ok({
		notebookId: "acme-default",
		opened: true,
		note: "Acme Notebook opens its notepad in the above-chat zone via the V2 runtime path",
	})
}

async function invokeAcmeNotebookClear() {
	return ok({ cleared: true, clearedAt: Date.now() })
}

// ---------------------------------------------------------------------------
// Notes plugin host handlers (firefly.built-in.surface.notes)
// ---------------------------------------------------------------------------

export interface SidePanelStateSnapshot {
	readonly open: boolean
	readonly activeTab: string | null
	readonly availableTabs: readonly string[]
}

export interface NotesHostDeps {
	openSidePanel: (tab: "notes") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

async function defaultOpenSidePanel(tab: "notes"): Promise<void> {
	const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
	await broadcastOpenSidePanel(tab)
}

function defaultGetSidePanelState(): SidePanelStateSnapshot {
	// Lazy import keeps the bun test runner free of the bridge server
	// module graph unless a handler actually runs.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { getUiStateSnapshot } = require("../palot-browser-ipc") as typeof import("../palot-browser-ipc")
	const snapshot = getUiStateSnapshot()
	return {
		open: snapshot.sidePanel.open,
		activeTab: snapshot.sidePanel.activeTab,
		availableTabs: snapshot.sidePanel.availableTabs,
	}
}

const NOTES_PLUGIN_ID = "firefly.built-in.surface.notes"

export function registerNotesHostHandlers(deps?: Partial<NotesHostDeps>): void {
	const openSidePanel = deps?.openSidePanel ?? defaultOpenSidePanel
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(NOTES_PLUGIN_ID, "plugin.firefly.built-in.surface.notes.open", async () => {
		await openSidePanel("notes")
		return ok({ opened: true, tab: "notes", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(NOTES_PLUGIN_ID, "plugin.firefly.built-in.surface.notes.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "notes",
			available: sidePanel.availableTabs.includes("notes"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "notes",
		})
	})

	registerHostCommand(NOTES_PLUGIN_ID, "open-notes", async () => {
		await openSidePanel("notes")
		return ok({ opened: true, tab: "notes" })
	})

	registerHostCommand(NOTES_PLUGIN_ID, "toggle-notes", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[NOTES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(NOTES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: NOTES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Review surface host handlers (firefly.built-in.surface.review)
// ---------------------------------------------------------------------------

export interface ReviewHostDeps {
	openSidePanel: (tab: "review") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const REVIEW_PLUGIN_ID = "firefly.built-in.surface.review"

export function registerReviewHostHandlers(deps?: Partial<ReviewHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "review") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.review.open", async () => {
		await openSidePanel("review")
		return ok({ opened: true, tab: "review", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.review.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "review",
			available: sidePanel.availableTabs.includes("review"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "review",
		})
	})

	registerHostCommand(REVIEW_PLUGIN_ID, "open-review", async () => {
		await openSidePanel("review")
		return ok({ opened: true, tab: "review" })
	})

	registerHostCommand(REVIEW_PLUGIN_ID, "toggle-review", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[REVIEW_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(REVIEW_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: REVIEW_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Files surface host handlers (firefly.built-in.surface.files)
// ---------------------------------------------------------------------------

export interface FilesHostDeps {
	openSidePanel: (tab: "files") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const FILES_PLUGIN_ID = "firefly.built-in.surface.files"

export function registerFilesHostHandlers(deps?: Partial<FilesHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "files") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(FILES_PLUGIN_ID, "plugin.firefly.built-in.surface.files.open", async () => {
		await openSidePanel("files")
		return ok({ opened: true, tab: "files", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(FILES_PLUGIN_ID, "plugin.firefly.built-in.surface.files.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "files",
			available: sidePanel.availableTabs.includes("files"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "files",
		})
	})

	registerHostCommand(FILES_PLUGIN_ID, "open-files", async () => {
		await openSidePanel("files")
		return ok({ opened: true, tab: "files" })
	})

	registerHostCommand(FILES_PLUGIN_ID, "toggle-files", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[FILES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(FILES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: FILES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Artifacts surface host handlers (firefly.built-in.surface.artifacts)
// ---------------------------------------------------------------------------

export interface ArtifactsHostDeps {
	openSidePanel: (tab: "artifacts") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const ARTIFACTS_PLUGIN_ID = "firefly.built-in.surface.artifacts"

export function registerArtifactsHostHandlers(deps?: Partial<ArtifactsHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "artifacts") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(ARTIFACTS_PLUGIN_ID, "plugin.firefly.built-in.surface.artifacts.open", async () => {
		await openSidePanel("artifacts")
		return ok({ opened: true, tab: "artifacts", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(ARTIFACTS_PLUGIN_ID, "plugin.firefly.built-in.surface.artifacts.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "artifacts",
			available: sidePanel.availableTabs.includes("artifacts"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "artifacts",
		})
	})

	registerHostCommand(ARTIFACTS_PLUGIN_ID, "open-artifacts", async () => {
		await openSidePanel("artifacts")
		return ok({ opened: true, tab: "artifacts" })
	})

	registerHostCommand(ARTIFACTS_PLUGIN_ID, "toggle-artifacts", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[ARTIFACTS_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(ARTIFACTS_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: ARTIFACTS_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Bridges surface host handlers (firefly.built-in.surface.bridges)
// ---------------------------------------------------------------------------

export interface BridgesHostDeps {
	openSidePanel: (tab: "bridges") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const BRIDGES_PLUGIN_ID = "firefly.built-in.surface.bridges"

export function registerBridgesHostHandlers(deps?: Partial<BridgesHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "bridges") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(BRIDGES_PLUGIN_ID, "plugin.firefly.built-in.surface.bridges.open", async () => {
		await openSidePanel("bridges")
		return ok({ opened: true, tab: "bridges", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(BRIDGES_PLUGIN_ID, "plugin.firefly.built-in.surface.bridges.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "bridges",
			available: sidePanel.availableTabs.includes("bridges"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "bridges",
		})
	})

	registerHostCommand(BRIDGES_PLUGIN_ID, "open-bridges", async () => {
		await openSidePanel("bridges")
		return ok({ opened: true, tab: "bridges" })
	})

	registerHostCommand(BRIDGES_PLUGIN_ID, "toggle-bridges", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[BRIDGES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(BRIDGES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: BRIDGES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Pulse surface host handlers (firefly.built-in.surface.pulse)
// ---------------------------------------------------------------------------

export interface PulseHostDeps {
	openSidePanel: (tab: "pulse") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const PULSE_PLUGIN_ID = "firefly.built-in.surface.pulse"

export function registerPulseHostHandlers(deps?: Partial<PulseHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "pulse") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(PULSE_PLUGIN_ID, "plugin.firefly.built-in.surface.pulse.open", async () => {
		await openSidePanel("pulse")
		return ok({ opened: true, tab: "pulse", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(PULSE_PLUGIN_ID, "plugin.firefly.built-in.surface.pulse.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "pulse",
			available: sidePanel.availableTabs.includes("pulse"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "pulse",
		})
	})

	registerHostCommand(PULSE_PLUGIN_ID, "open-pulse", async () => {
		await openSidePanel("pulse")
		return ok({ opened: true, tab: "pulse" })
	})

	registerHostCommand(PULSE_PLUGIN_ID, "toggle-pulse", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[PULSE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(PULSE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: PULSE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Memory surface host handlers (firefly.built-in.surface.memory)
// ---------------------------------------------------------------------------

export interface MemoryHostDeps {
	openSidePanel: (tab: "memory") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const MEMORY_PLUGIN_ID = "firefly.built-in.surface.memory"

export function registerMemoryHostHandlers(deps?: Partial<MemoryHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "memory") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(MEMORY_PLUGIN_ID, "plugin.firefly.built-in.surface.memory.open", async () => {
		await openSidePanel("memory")
		return ok({ opened: true, tab: "memory", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(MEMORY_PLUGIN_ID, "plugin.firefly.built-in.surface.memory.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "memory",
			available: sidePanel.availableTabs.includes("memory"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "memory",
		})
	})

	registerHostCommand(MEMORY_PLUGIN_ID, "open-memory", async () => {
		await openSidePanel("memory")
		return ok({ opened: true, tab: "memory" })
	})

	registerHostCommand(MEMORY_PLUGIN_ID, "toggle-memory", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[MEMORY_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(MEMORY_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: MEMORY_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Editor surface host handlers (firefly.built-in.surface.editor)
// ---------------------------------------------------------------------------

export interface EditorHostDeps {
	openSidePanel: (tab: "editor") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const EDITOR_PLUGIN_ID = "firefly.built-in.surface.editor"

export function registerEditorHostHandlers(deps?: Partial<EditorHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "editor") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(EDITOR_PLUGIN_ID, "plugin.firefly.built-in.surface.editor.open", async () => {
		await openSidePanel("editor")
		return ok({ opened: true, tab: "editor", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(EDITOR_PLUGIN_ID, "plugin.firefly.built-in.surface.editor.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "editor",
			available: sidePanel.availableTabs.includes("editor"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "editor",
		})
	})

	registerHostCommand(EDITOR_PLUGIN_ID, "open-editor", async () => {
		await openSidePanel("editor")
		return ok({ opened: true, tab: "editor" })
	})

	registerHostCommand(EDITOR_PLUGIN_ID, "toggle-editor", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[EDITOR_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(EDITOR_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: EDITOR_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Terminal surface host handlers (firefly.built-in.surface.terminal)
// ---------------------------------------------------------------------------

export interface TerminalHostDeps {
	openSidePanel: (tab: "terminal") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const TERMINAL_PLUGIN_ID = "firefly.built-in.surface.terminal"

export function registerTerminalHostHandlers(deps?: Partial<TerminalHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "terminal") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(TERMINAL_PLUGIN_ID, "plugin.firefly.built-in.surface.terminal.open", async () => {
		await openSidePanel("terminal")
		return ok({ opened: true, tab: "terminal", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(TERMINAL_PLUGIN_ID, "plugin.firefly.built-in.surface.terminal.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "terminal",
			available: sidePanel.availableTabs.includes("terminal"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "terminal",
		})
	})

	registerHostCommand(TERMINAL_PLUGIN_ID, "open-terminal", async () => {
		await openSidePanel("terminal")
		return ok({ opened: true, tab: "terminal" })
	})

	registerHostCommand(TERMINAL_PLUGIN_ID, "toggle-terminal", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[TERMINAL_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(TERMINAL_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: TERMINAL_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Claude Code surface host handlers (firefly.built-in.surface.claude)
// ---------------------------------------------------------------------------

export interface ClaudeHostDeps {
	openSidePanel: (tab: "claude") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const CLAUDE_PLUGIN_ID = "firefly.built-in.surface.claude"

export function registerClaudeHostHandlers(deps?: Partial<ClaudeHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "claude") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(CLAUDE_PLUGIN_ID, "plugin.firefly.built-in.surface.claude.open", async () => {
		await openSidePanel("claude")
		return ok({ opened: true, tab: "claude", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(CLAUDE_PLUGIN_ID, "plugin.firefly.built-in.surface.claude.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "claude",
			available: sidePanel.availableTabs.includes("claude"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "claude",
		})
	})

	registerHostCommand(CLAUDE_PLUGIN_ID, "open-claude", async () => {
		await openSidePanel("claude")
		return ok({ opened: true, tab: "claude" })
	})

	registerHostCommand(CLAUDE_PLUGIN_ID, "toggle-claude", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[CLAUDE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(CLAUDE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: CLAUDE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Oracle Roster surface host handlers (firefly.built-in.surface.oracle)
// ---------------------------------------------------------------------------

export interface OracleHostDeps {
	openSidePanel: (tab: "oracle") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const ORACLE_PLUGIN_ID = "firefly.built-in.surface.oracle"

export function registerOracleHostHandlers(deps?: Partial<OracleHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "oracle") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(ORACLE_PLUGIN_ID, "plugin.firefly.built-in.surface.oracle.open", async () => {
		await openSidePanel("oracle")
		return ok({ opened: true, tab: "oracle", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(ORACLE_PLUGIN_ID, "plugin.firefly.built-in.surface.oracle.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "oracle",
			available: sidePanel.availableTabs.includes("oracle"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "oracle",
		})
	})

	registerHostCommand(ORACLE_PLUGIN_ID, "open-oracle", async () => {
		await openSidePanel("oracle")
		return ok({ opened: true, tab: "oracle" })
	})

	registerHostCommand(ORACLE_PLUGIN_ID, "toggle-oracle", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[ORACLE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(ORACLE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: ORACLE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Voice surface host handlers (firefly.built-in.surface.voice)
// ---------------------------------------------------------------------------

export interface VoiceHostDeps {
	openSidePanel: (tab: "voice") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const VOICE_PLUGIN_ID = "firefly.built-in.surface.voice"

export function registerVoiceHostHandlers(deps?: Partial<VoiceHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "voice") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(VOICE_PLUGIN_ID, "plugin.firefly.built-in.surface.voice.open", async () => {
		await openSidePanel("voice")
		return ok({ opened: true, tab: "voice", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(VOICE_PLUGIN_ID, "plugin.firefly.built-in.surface.voice.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "voice",
			available: sidePanel.availableTabs.includes("voice"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "voice",
		})
	})

	registerHostCommand(VOICE_PLUGIN_ID, "open-voice", async () => {
		await openSidePanel("voice")
		return ok({ opened: true, tab: "voice" })
	})

	registerHostCommand(VOICE_PLUGIN_ID, "toggle-voice", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[VOICE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(VOICE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: VOICE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// DevMux Toolbar host handlers (firefly.built-in.devmux-toolbar)
//
// The Node-only work lives in `main/devmux/service.ts` and is reached here
// behind the `host:devmux.*` capability tokens. Both UI commands and agent
// tools route to the same service functions; the service is dynamic-imported
// so its tmux deps never enter the bun test graph that imports this
// dispatcher. (Opening a service URL externally is a pure client action —
// the renderer uses `backend.openExternalUrl`, not a host command.)
// ---------------------------------------------------------------------------

const DEVMUX_TOOLBAR_PLUGIN_ID = "firefly.built-in.devmux-toolbar"

function readStringArg(args: unknown, key: string): string | null {
	if (args && typeof args === "object" && key in args) {
		const value = (args as Record<string, unknown>)[key]
		if (typeof value === "string" && value.length > 0) return value
	}
	return null
}

function devmuxError(cause: unknown): HostCommandResult {
	const message = cause instanceof Error ? cause.message : String(cause)
	const code = message.startsWith("no devmux config") ? "devmux_no_config" : "devmux_failed"
	return err(code, message)
}

async function devmuxList(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	if (!projectDir) return err("validation_error", "missing projectDir")
	try {
		const service = await import("../devmux/service")
		return ok(await service.listServices(projectDir))
	} catch (cause) {
		return devmuxError(cause)
	}
}

async function devmuxStatus(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	if (!projectDir) return err("validation_error", "missing projectDir")
	try {
		const service = await import("../devmux/service")
		return ok({ services: await service.statusAll(projectDir) })
	} catch (cause) {
		return devmuxError(cause)
	}
}

async function devmuxLaunch(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	const serviceName = readStringArg(args, "service")
	if (!projectDir) return err("validation_error", "missing projectDir")
	if (!serviceName) return err("validation_error", "missing service")
	try {
		const service = await import("../devmux/service")
		return ok(await service.ensureService(projectDir, serviceName))
	} catch (cause) {
		return devmuxError(cause)
	}
}

export function registerDevmuxHostHandlers(): void {
	// UI commands (renderer-invoked via firefly-plugin:invoke).
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-list", ({ args }) => devmuxList(args))
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-status", ({ args }) => devmuxStatus(args))
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-launch", ({ args }) => devmuxLaunch(args))

	// Agent tools (OpenCode-invoked via firefly-plugin:invoke-tool).
	registerHostTool(DEVMUX_TOOLBAR_PLUGIN_ID, "plugin.firefly.built-in.devmux-toolbar.list", ({ args }) =>
		devmuxList(args),
	)
	registerHostTool(
		DEVMUX_TOOLBAR_PLUGIN_ID,
		"plugin.firefly.built-in.devmux-toolbar.status",
		({ args }) => devmuxStatus(args),
	)
	registerHostTool(
		DEVMUX_TOOLBAR_PLUGIN_ID,
		"plugin.firefly.built-in.devmux-toolbar.ensure",
		({ args }) => devmuxLaunch(args),
	)
}

export function registerBuiltInHostCommands(): void {
	registerHostCommand(
		"firefly.built-in.palot-bridge",
		"palot-open-side-panel",
		invokePalotOpenSidePanel,
	)
	registerHostCommand(
		"firefly.built-in.palot-bridge",
		"palot-refresh-ui-state",
		invokePalotRefreshUiState,
	)
	registerHostCommand("firefly.built-in.palot-bridge", "palot-ui-state", invokePalotUiState)
	registerHostCommand("acme.acme-notebook", "acme-notebook-open", invokeAcmeNotebookOpen)
	registerHostCommand("acme.acme-notebook", "acme-notebook-clear", invokeAcmeNotebookClear)
	registerNotesHostHandlers()
	registerReviewHostHandlers()
	registerFilesHostHandlers()
	registerArtifactsHostHandlers()
	registerBridgesHostHandlers()
	registerPulseHostHandlers()
	registerMemoryHostHandlers()
	registerEditorHostHandlers()
	registerTerminalHostHandlers()
	registerClaudeHostHandlers()
	registerOracleHostHandlers()
	registerVoiceHostHandlers()
	registerDevmuxHostHandlers()
	log.info("Registered V2 host command handlers", {
		commands: Array.from(handlers.keys()),
		tools: Array.from(toolHandlers.keys()),
	})
}
