/**
 * Firefly Plugin System V2 — IPC surface
 *
 * Hosts the new `elf.plugins.*` IPC channels that the preload
 * script and renderer hook consume. The catalog authority itself
 * lives in `./authority.ts`; this file wires it to the existing
 * `ipcMain.handle` convention used throughout `apps/desktop/src/main`.
 *
 * The surface is intentionally narrow in slice 1: introspection only
 * (list/describe/state) plus a typed `plugins.tools` projection for
 * the OpenCode bridge. Tool execution and per-session bind/eval
 * land in slice 2 — they require the bridge transport to be
 * migrated to the V2 host, which is bigger than this commit.
 */

import { BrowserWindow, ipcMain } from "electron"

import {
	pluginListArgsShape,
	pluginDescribeArgsShape,
	pluginStateArgsShape,
	pluginToolsArgsShape,
} from "../../shared/firefly-plugin/index"
import { projectBridgeToolDefinitions } from "../../shared/firefly-plugin/bridge-projection"

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
} from "./authority"

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
} as const

interface FireflyPluginListResult {
	appVersion: string
	plugins: ReturnType<typeof listPluginEntries>
	summaries: ReturnType<typeof listPluginProjectionSummaries>
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
		}
		return result
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.describe, (_event, rawArgs: unknown) => {
		const args = pluginDescribeArgsShape.parse(coerceArgs(rawArgs))
		return describePlugin(args.pluginId)
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.state, (_event, rawArgs: unknown) => {
		const args = pluginStateArgsShape.parse(coerceArgs(rawArgs))
		const caps = getPluginCapabilities(args.pluginId)
		return {
			found: caps.state.trust !== "built-in" || args.pluginId.length > 0,
			pluginId: args.pluginId,
			state: caps.state,
			decision: caps.decision,
		}
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.tools, (_event, rawArgs: unknown) => {
		const args = pluginToolsArgsShape.parse(coerceArgs(rawArgs))
		const catalog = getPluginCatalog()
		const tools: FireflyPluginToolsResult["tools"] = []
		for (const descriptor of catalog.descriptors) {
			if (args.pluginId && descriptor.normalizedId !== args.pluginId) continue
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
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("firefly-plugin:changed", {
				appVersion: catalog.appVersion,
				pluginCount: catalog.descriptors.length,
			})
		}
		return {
			appVersion: catalog.appVersion,
			pluginCount: catalog.descriptors.length,
		}
	})

	log.info("Registered V2 plugin IPC channels", {
		channels: Object.values(FIREFLY_PLUGIN_IPC_CHANNELS),
	})
}

function coerceArgs(raw: unknown): unknown {
	if (raw === null || raw === undefined) return {}
	if (typeof raw !== "object") return raw
	return raw
}
