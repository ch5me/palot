import { BrowserWindow, ipcMain } from "electron"

import { pluginDescribeArgsShape } from "../../shared/firefly-plugin/index"
import { z } from "zod"

const describeArgsSchema = z.object(pluginDescribeArgsShape)
const stateArgsSchema = describeArgsSchema

import { createLogger } from "../logger"
import {
	describePlugin,
	getPluginCapabilities,
	getPluginCatalog,
	listPluginCommands,
	listPluginEntries,
	listPluginPanels,
	listPluginProjectionSummaries,
	listPluginThemes,
	listPluginWidgets,
	refreshPluginCatalog,
	releasePluginQuarantine,
	reportPluginPanelCrash,
	setPluginEnabled,
} from "./authority"
import {
	invokePluginCommand,
	listKnownCommands,
} from "./dispatch"
import { projectBridgeToolDefinitions } from "../../shared/firefly-plugin/bridge-projection"

const log = createLogger("firefly-plugin-ipc")

export const FIREFLY_PLUGIN_IPC_CHANNELS = {
	list: "firefly-plugin:list",
	describe: "firefly-plugin:describe",
	state: "firefly-plugin:state",
	tools: "firefly-plugin:tools",
	panels: "firefly-plugin:panels",
	widgets: "firefly-plugin:widgets",
	commands: "firefly-plugin:commands",
	themes: "firefly-plugin:themes",
	refresh: "firefly-plugin:refresh",
	invoke: "firefly-plugin:invoke",
	setEnabled: "firefly-plugin:set-enabled",
	panelCrash: "firefly-plugin:panel-crash",
	releaseQuarantine: "firefly-plugin:release-quarantine",
} as const

interface FireflyPluginListResult {
	appVersion: string
	plugins: ReturnType<typeof listPluginEntries>
	summaries: ReturnType<typeof listPluginProjectionSummaries>
	knownCommands: string[]
}

interface FireflyPluginToolsResult {
	appVersion: string
	tools: {
		pluginId: string
		id: string
		title: string
		description: string
		scope: "session" | "project" | "app"
		requires: string[]
		timeoutMs: number
		preview: boolean
	}[]
}

interface FireflyPluginFamilyResult<T> {
	appVersion: string
	items: T[]
}

export function registerFireflyPluginIpc(): void {
	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.list, () => {
		const catalog = getPluginCatalog()
		const result: FireflyPluginListResult = {
			appVersion: catalog.appVersion,
			plugins: listPluginEntries(),
			summaries: listPluginProjectionSummaries(),
			knownCommands: listKnownCommands(),
		}
		return result
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.describe, (_event, rawArgs: unknown) => {
		const args = describeArgsSchema.parse(coerceArgs(rawArgs))
		return describePlugin(args.pluginId)
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.state, (_event, rawArgs: unknown) => {
		const args = stateArgsSchema.parse(coerceArgs(rawArgs))
		const caps = getPluginCapabilities(args.pluginId)
		return {
			found: caps.state.trust !== "built-in" || args.pluginId.length > 0,
			pluginId: args.pluginId,
			state: caps.state,
			decision: caps.decision,
		}
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.tools, () => {
		const catalog = getPluginCatalog()
		const tools: FireflyPluginToolsResult["tools"] = []
		for (const descriptor of catalog.descriptors) {
			for (const projected of projectBridgeToolDefinitions(descriptor)) {
				tools.push({
					pluginId: projected.pluginId,
					id: projected.id,
					title: projected.title,
					description: projected.description,
					scope: projected.scope,
					requires: [...projected.requires],
					timeoutMs: projected.timeoutMs,
					preview: projected.preview,
				})
			}
		}
		return { appVersion: catalog.appVersion, tools } satisfies FireflyPluginToolsResult
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.panels, () => {
		const catalog = getPluginCatalog()
		return {
			appVersion: catalog.appVersion,
			items: [...listPluginPanels()],
		} satisfies FireflyPluginFamilyResult<unknown>
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.widgets, () => {
		const catalog = getPluginCatalog()
		return {
			appVersion: catalog.appVersion,
			items: [...listPluginWidgets()],
		} satisfies FireflyPluginFamilyResult<unknown>
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.commands, () => {
		const catalog = getPluginCatalog()
		return {
			appVersion: catalog.appVersion,
			items: [...listPluginCommands()],
		} satisfies FireflyPluginFamilyResult<unknown>
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.themes, () => {
		const catalog = getPluginCatalog()
		return {
			appVersion: catalog.appVersion,
			items: [...listPluginThemes()],
		} satisfies FireflyPluginFamilyResult<unknown>
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.refresh, () => {
		const catalog = refreshPluginCatalog()
		broadcastCatalogChanged()
		return {
			appVersion: catalog.appVersion,
			pluginCount: catalog.descriptors.length,
		}
	})

	const lifecycleArgsSchema = z.object({
		pluginId: z.string().min(1).max(128),
		enabled: z.boolean().optional(),
		message: z.string().max(2000).optional(),
		note: z.string().max(2000).optional(),
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.setEnabled, (_event, rawArgs: unknown) => {
		const args = lifecycleArgsSchema.parse(coerceArgs(rawArgs))
		if (typeof args.enabled !== "boolean") {
			throw new Error("set-enabled requires { pluginId, enabled }")
		}
		const state = setPluginEnabled(args.pluginId, args.enabled)
		broadcastCatalogChanged()
		return { pluginId: args.pluginId, ...state }
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.panelCrash, (_event, rawArgs: unknown) => {
		const args = lifecycleArgsSchema.parse(coerceArgs(rawArgs))
		const state = reportPluginPanelCrash(args.pluginId, args.message ?? "panel render crash")
		broadcastCatalogChanged()
		return { pluginId: args.pluginId, ...state }
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.releaseQuarantine, (_event, rawArgs: unknown) => {
		const args = lifecycleArgsSchema.parse(coerceArgs(rawArgs))
		const state = releasePluginQuarantine(args.pluginId, args.note ?? "operator release")
		broadcastCatalogChanged()
		return { pluginId: args.pluginId, ...state }
	})

	ipcMain.handle(
		FIREFLY_PLUGIN_IPC_CHANNELS.invoke,
		async (
			_event,
			rawArgs: unknown,
		) => {
			const obj = (rawArgs ?? {}) as Record<string, unknown>
			const pluginId = typeof obj.pluginId === "string" ? obj.pluginId : ""
			const commandId = typeof obj.commandId === "string" ? obj.commandId : ""
			const args = (obj.args && typeof obj.args === "object" ? obj.args : {}) as Record<
				string,
				unknown
			>
			return invokePluginCommand({ pluginId, commandId, args })
		},
	)

	log.info("Registered V2 plugin IPC channels", {
		channels: Object.values(FIREFLY_PLUGIN_IPC_CHANNELS),
	})
}

function broadcastCatalogChanged(): void {
	const catalog = getPluginCatalog()
	for (const win of BrowserWindow.getAllWindows()) {
		win.webContents.send("firefly-plugin:changed", {
			appVersion: catalog.appVersion,
			pluginCount: catalog.descriptors.length,
		})
	}
}

function coerceArgs(raw: unknown): unknown {
	if (raw === null || raw === undefined) return {}
	if (typeof raw !== "object") return raw
	return raw
}
