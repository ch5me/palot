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
	const argsSchema = z.object(command.args ?? {}).passthrough()
	const result = await handler({
		command: argsSchema as z.ZodTypeAny,
		args: input.args,
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
	log.info("Registered V2 host command handlers", {
		commands: Array.from(handlers.keys()),
	})
}
