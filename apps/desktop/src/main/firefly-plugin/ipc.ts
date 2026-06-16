import { ipcMain } from "electron"

import { pluginDescribeArgsShape } from "../../shared/firefly-plugin/index"
import { z } from "zod"

const describeArgsSchema = z.object(pluginDescribeArgsShape)
const stateArgsSchema = describeArgsSchema

import { createLogger } from "../logger"
import { ElectronHostAuthority } from "./host-authority"

const log = createLogger("firefly-plugin-ipc")

// Marketplace IPC channel names (additive — do not rename existing channels)
export const FIREFLY_MARKETPLACE_IPC_CHANNELS = {
	gallerySearch: "firefly-marketplace:gallery-search",
	install: "firefly-marketplace:install",
	listInstalled: "firefly-marketplace:list-installed",
	uninstall: "firefly-marketplace:uninstall",
	applyTheme: "firefly-marketplace:apply-theme",
} as const

export const FIREFLY_PLUGIN_IPC_CHANNELS = {
	list: "firefly-plugin:list",
	describe: "firefly-plugin:describe",
	state: "firefly-plugin:state",
	tools: "firefly-plugin:tools",
	panels: "firefly-plugin:panels",
	navSidebars: "firefly-plugin:nav-sidebars",
	widgets: "firefly-plugin:widgets",
	commands: "firefly-plugin:commands",
	themes: "firefly-plugin:themes",
	refresh: "firefly-plugin:refresh",
	invoke: "firefly-plugin:invoke",
	invokeTool: "firefly-plugin:invoke-tool",
	setEnabled: "firefly-plugin:set-enabled",
	panelCrash: "firefly-plugin:panel-crash",
	releaseQuarantine: "firefly-plugin:release-quarantine",
} as const

/** Shared capability-list validator used by both union members of installArgsSchema. */
const consentedCapabilitiesSchema = z
	.array(z.string().min(1).max(200))
	.max(200)
	.optional()

/**
 * Exported so unit tests can exercise the schema in isolation without spinning
 * up Electron IPC handlers.  See: ipc-install-args.test.ts
 */
export const installArgsSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("open-vsx"),
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		version: z.string().max(80).optional(),
		consentedCapabilities: consentedCapabilitiesSchema,
	}),
	z.object({
		kind: z.literal("local-vsix"),
		vsixPath: z.string().min(1).max(500),
		expectedSha256: z.string().length(64).optional(),
		consentedCapabilities: consentedCapabilitiesSchema,
	}),
	z.object({
		kind: z.literal("firefly"),
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		version: z.string().max(80).optional(),
		consentedCapabilities: consentedCapabilitiesSchema,
	}),
])

export type InstallArgs = z.infer<typeof installArgsSchema>

export function registerFireflyPluginIpc(): void {
	const authority = new ElectronHostAuthority()

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.list, () => {
		return authority.catalog()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.describe, (_event, rawArgs: unknown) => {
		const args = describeArgsSchema.parse(coerceArgs(rawArgs))
		return authority.describe(args.pluginId)
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.state, (_event, rawArgs: unknown) => {
		const args = stateArgsSchema.parse(coerceArgs(rawArgs))
		return authority.state(args.pluginId)
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.tools, () => {
		return authority.listTools()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.panels, () => {
		return authority.listPanels()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.navSidebars, () => {
		return authority.listNavSidebars()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.widgets, () => {
		return authority.listWidgets()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.commands, () => {
		return authority.listCommands()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.themes, () => {
		return authority.listThemes()
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.refresh, () => {
		return authority.refresh()
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
		return authority.setEnabled(args.pluginId, args.enabled)
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.panelCrash, (_event, rawArgs: unknown) => {
		const args = lifecycleArgsSchema.parse(coerceArgs(rawArgs))
		return authority.reportPanelCrash(args.pluginId, args.message ?? "panel render crash")
	})

	ipcMain.handle(FIREFLY_PLUGIN_IPC_CHANNELS.releaseQuarantine, (_event, rawArgs: unknown) => {
		const args = lifecycleArgsSchema.parse(coerceArgs(rawArgs))
		return authority.releaseQuarantine(args.pluginId, args.note ?? "operator release")
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
			return authority.invoke(pluginId, commandId, args)
		},
	)

	ipcMain.handle(
		FIREFLY_PLUGIN_IPC_CHANNELS.invokeTool,
		async (
			_event,
			rawArgs: unknown,
		) => {
			const obj = (rawArgs ?? {}) as Record<string, unknown>
			const pluginId = typeof obj.pluginId === "string" ? obj.pluginId : ""
			const toolId = typeof obj.toolId === "string" ? obj.toolId : ""
			const args = (obj.args && typeof obj.args === "object" ? obj.args : {}) as Record<
				string,
				unknown
			>
			const sessionId = typeof obj.sessionId === "string" ? obj.sessionId : null
			return authority.invokeTool(pluginId, toolId, args, sessionId)
		},
	)

	log.info("Registered V2 plugin IPC channels", {
		channels: Object.values(FIREFLY_PLUGIN_IPC_CHANNELS),
	})

	// -------------------------------------------------------------------------
	// Marketplace channels (additive)
	// -------------------------------------------------------------------------

	const gallerySearchArgsSchema = z.object({
		query: z.string().max(200).optional(),
		category: z.string().max(100).optional(),
		size: z.number().int().positive().max(100).optional(),
		offset: z.number().int().nonnegative().optional(),
	})

	const installationIdSchema = z.object({
		installationId: z.string().min(1).max(200),
	})

	const applyThemeArgsSchema = z.object({
		installationId: z.string().min(1).max(200),
		themeId: z.string().min(1).max(200),
	})

	ipcMain.handle(FIREFLY_MARKETPLACE_IPC_CHANNELS.gallerySearch, async (_event, rawArgs: unknown) => {
		const args = gallerySearchArgsSchema.parse(coerceArgs(rawArgs))
		return authority.gallerySearch(args)
	})

	ipcMain.handle(FIREFLY_MARKETPLACE_IPC_CHANNELS.install, async (_event, rawArgs: unknown) => {
		const args = installArgsSchema.parse(coerceArgs(rawArgs))
		return authority.installExtension(args)
	})

	ipcMain.handle(FIREFLY_MARKETPLACE_IPC_CHANNELS.listInstalled, async () => {
		return authority.listInstalledExtensions()
	})

	ipcMain.handle(FIREFLY_MARKETPLACE_IPC_CHANNELS.uninstall, async (_event, rawArgs: unknown) => {
		const args = installationIdSchema.parse(coerceArgs(rawArgs))
		return authority.uninstallExtension(args.installationId)
	})

	ipcMain.handle(FIREFLY_MARKETPLACE_IPC_CHANNELS.applyTheme, async (_event, rawArgs: unknown) => {
		const args = applyThemeArgsSchema.parse(coerceArgs(rawArgs))
		return authority.applyTheme(args.installationId, args.themeId)
	})

	log.info("Registered marketplace IPC channels", {
		channels: Object.values(FIREFLY_MARKETPLACE_IPC_CHANNELS),
	})
}

function coerceArgs(raw: unknown): unknown {
	if (raw === null || raw === undefined) return {}
	if (typeof raw !== "object") return raw
	return raw
}
