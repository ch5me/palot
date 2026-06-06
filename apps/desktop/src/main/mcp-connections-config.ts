import fs from "node:fs"
import path from "node:path"
import type { AppSettings } from "../preload/api"
import { createLogger } from "./logger"
import { getSettings, updateSettings } from "./settings-store"

const log = createLogger("mcp-connections-config")

function resolveManagedConfigPath(settings: AppSettings): string {
	const configuredPath = settings.connections?.managedConfigPath
	if (configuredPath) return configuredPath
	return path.join(process.env.HOME ?? "", ".config", "opencode", "opencode.json")
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

export function upsertMcpConnectionConfig(input: {
	name: string
	config: Record<string, unknown>
}): AppSettings {
	const settings = getSettings()
	const configPath = resolveManagedConfigPath(settings)
	const current = readManagedConfig(configPath)
	const mcp = ((current.mcp as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
	mcp[input.name] = input.config
	const next = { ...current, mcp }
	writeManagedConfig(configPath, next)
	log.info("Upserted MCP config entry", { name: input.name, configPath })
	return updateSettings({ connections: { managedConfigPath: configPath } })
}

export function removeMcpConnectionConfig(name: string): AppSettings {
	const settings = getSettings()
	const configPath = resolveManagedConfigPath(settings)
	const current = readManagedConfig(configPath)
	const mcp = { ...(((current.mcp as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>) }
	delete mcp[name]
	const next = Object.keys(mcp).length > 0 ? { ...current, mcp } : { ...current, mcp: {} }
	writeManagedConfig(configPath, next)
	log.info("Removed MCP config entry", { name, configPath })
	return updateSettings({ connections: { managedConfigPath: configPath } })
}
