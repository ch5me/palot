import fs from "node:fs"
import path from "node:path"
import type { AppSettings } from "../preload/api"
import { createLogger } from "./logger"
import { PALOT_PLUGIN_ENTRY_RELATIVE_PATH } from "./palot-plugin-entry"
import { getSettings, updateSettings } from "./settings-store"

const log = createLogger("mcp-connections-config")
const OPENCODE_CONFIG_CANDIDATES = ["opencode.jsonc", "opencode.json"] as const

function resolvePalotPluginUrl(): string {
	return `file://${path.resolve(process.cwd(), PALOT_PLUGIN_ENTRY_RELATIVE_PATH)}`
}

function resolveManagedConfigPaths(settings: AppSettings): string[] {
	const configuredPaths = settings.connections?.managedConfigPaths?.filter(Boolean) ?? []
	if (configuredPaths.length > 0) return configuredPaths
	const configuredPath = settings.connections?.managedConfigPath
	if (configuredPath) return [configuredPath]
	const baseDir = path.join(process.env.HOME ?? "", ".config", "opencode")
	return OPENCODE_CONFIG_CANDIDATES.map((name) => path.join(baseDir, name))
}

function readManagedConfig(configPath: string): Record<string, unknown> {
	if (!fs.existsSync(configPath)) return {}
	const raw = fs.readFileSync(configPath, "utf-8")
	const parsed = JSON.parse(raw)
	if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
	return {}
}

function writeManagedConfig(configPath: string, config: Record<string, unknown>): void {
	const dir = path.dirname(configPath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	const tmpPath = `${configPath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(config, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, configPath)
}

function findExistingConfigPath(paths: string[]): string | null {
	for (const configPath of paths) {
		if (fs.existsSync(configPath)) return configPath
	}
	return null
}

function uniqueStrings(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)))
}

function ensurePluginEntry(configPath: string): void {
	const pluginUrl = resolvePalotPluginUrl()
	const current = readManagedConfig(configPath)
	const plugin = Array.isArray(current.plugin)
		? uniqueStrings(
			current.plugin.filter((entry): entry is string => typeof entry === "string").concat(pluginUrl),
		)
		: [pluginUrl]
	const next = { ...current, plugin }
	writeManagedConfig(configPath, next)
	log.info("Ensured Palot bridge plugin entry", { configPath, pluginUrl })
}

export function ensurePalotPluginConfig(): AppSettings {
	const settings = getSettings()
	const candidatePaths = resolveManagedConfigPaths(settings)
	const targetPath = findExistingConfigPath(candidatePaths) ?? candidatePaths[0] ?? path.join(process.env.HOME ?? "", ".config", "opencode", "opencode.jsonc")
	ensurePluginEntry(targetPath)
	return updateSettings({
		connections: {
			managedConfigPath: targetPath,
			managedConfigPaths: uniqueStrings([targetPath, ...candidatePaths]),
		},
	})
}

export function upsertMcpConnectionConfig(input: {
	name: string
	config: Record<string, unknown>
}): AppSettings {
	const settings = getSettings()
	const candidatePaths = resolveManagedConfigPaths(settings)
	const configPath = findExistingConfigPath(candidatePaths) ?? candidatePaths[0] ?? path.join(process.env.HOME ?? "", ".config", "opencode", "opencode.jsonc")
	const current = readManagedConfig(configPath)
	const mcp = ((current.mcp as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
	mcp[input.name] = input.config
	const next = { ...current, mcp }
	writeManagedConfig(configPath, next)
	log.info("Upserted MCP config entry", { name: input.name, configPath })
	return updateSettings({
		connections: {
			managedConfigPath: configPath,
			managedConfigPaths: uniqueStrings([configPath, ...candidatePaths]),
		},
	})
}

export function removeMcpConnectionConfig(name: string): AppSettings {
	const settings = getSettings()
	const candidatePaths = resolveManagedConfigPaths(settings)
	const configPath = findExistingConfigPath(candidatePaths) ?? candidatePaths[0] ?? path.join(process.env.HOME ?? "", ".config", "opencode", "opencode.jsonc")
	const current = readManagedConfig(configPath)
	const mcp = { ...(((current.mcp as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>) }
	delete mcp[name]
	const next = Object.keys(mcp).length > 0 ? { ...current, mcp } : { ...current, mcp: {} }
	writeManagedConfig(configPath, next)
	log.info("Removed MCP config entry", { name, configPath })
	return updateSettings({
		connections: {
			managedConfigPath: configPath,
			managedConfigPaths: uniqueStrings([configPath, ...candidatePaths]),
		},
	})
}
