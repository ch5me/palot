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
	readonly logicalPanelRoute?: {
		logicalPanelId: string
		action: string
		preferredZoneId: string
	} | null
}

export interface NotesHostDeps {
	openNotesPanel: () => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

async function defaultOpenNotesPanel(): Promise<void> {
	const { openLogicalPanelRoute } = await import("../palot-browser-ipc")
	await openLogicalPanelRoute({
		logicalPanelId: "notes",
		preferredZoneId: "side-panel",
		action: "reveal-preferred-zone",
		focusAuthorityOwner: "compatibility-adapter",
		legacySidePanelTabId: "notes",
		allowCreate: true,
		requestedBy: "notes-host-handler",
	})
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
		logicalPanelRoute: snapshot.logicalPanelRoute
			? {
				logicalPanelId: snapshot.logicalPanelRoute.logicalPanelId,
				action: snapshot.logicalPanelRoute.action,
				preferredZoneId: snapshot.logicalPanelRoute.preferredZoneId,
			  }
			: null,
	}
}

const NOTES_PLUGIN_ID = "firefly.built-in.surface.notes"

export function registerNotesHostHandlers(deps?: Partial<NotesHostDeps>): void {
	const openNotesPanel = deps?.openNotesPanel ?? defaultOpenNotesPanel
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(NOTES_PLUGIN_ID, "plugin.firefly.built-in.surface.notes.open", async () => {
		await openNotesPanel()
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
		await openNotesPanel()
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
	log.info("Registered V2 host command handlers", {
		commands: Array.from(handlers.keys()),
		tools: Array.from(toolHandlers.keys()),
	})
}
