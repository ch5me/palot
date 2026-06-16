/**
 * Renderer DevMux client — transport-agnostic access to the host DevMux
 * service, used by the DevMux Toolbar widget.
 *
 * - Electron: invoke the plugin command over the firefly-plugin IPC
 *   (capability-brokered dispatch → main `devmux/service.ts`).
 * - Web build (no `window.elf`): POST to the Hono server's `/api/devmux/*`
 *   route, which adapts the same `@chriscode/devmux` library.
 *
 * Both transports return identical shapes; this module is the single place
 * that knows which one to use.
 */

import { invokePluginCommand } from "../hooks/use-firefly-plugins"
import { ELF_SERVER_BASE_URL, isElectron } from "./backend"

const PLUGIN_ID = "firefly.built-in.devmux-toolbar"

export interface DevmuxServiceSummary {
	name: string
	description: string | null
	command: string
	port: number | null
	dashboard: boolean
	dependsOn: string[]
}

export interface DevmuxServiceRuntime {
	name: string
	healthy: boolean
	managedByDevmux: boolean
	port: number | null
	url: string | null
}

interface DevmuxProjectServices {
	project: string
	configRoot: string
	services: DevmuxServiceSummary[]
}

export interface DevmuxEnsureResult {
	service: string
	startedByUs: boolean
	url: string | null
}

const COMMAND_ENDPOINT: Record<string, string> = {
	"devmux-list": "list",
	"devmux-status": "status",
	"devmux-launch": "ensure",
}

async function call<T>(commandId: string, args: Record<string, unknown>): Promise<T> {
	if (isElectron) {
		const res = await invokePluginCommand({ pluginId: PLUGIN_ID, commandId, args })
		if (res.status !== "completed") {
			throw new Error(res.errorMessage ?? `${commandId} failed`)
		}
		return res.data as T
	}
	const endpoint = COMMAND_ENDPOINT[commandId]
	const response = await fetch(`${ELF_SERVER_BASE_URL}/api/devmux/${endpoint}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(args),
	})
	const json = await response.json().catch(() => null)
	if (!response.ok) {
		const message =
			json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
				? (json as { error: string }).error
				: `${commandId} failed (${response.status})`
		throw new Error(message)
	}
	return json as T
}

export async function listServices(projectDir: string): Promise<DevmuxServiceSummary[]> {
	const data = await call<DevmuxProjectServices>("devmux-list", { projectDir })
	return data.services
}

export async function statusAll(projectDir: string): Promise<DevmuxServiceRuntime[]> {
	const data = await call<{ services: DevmuxServiceRuntime[] }>("devmux-status", { projectDir })
	return data.services
}

export async function ensureService(projectDir: string, service: string): Promise<DevmuxEnsureResult> {
	return call<DevmuxEnsureResult>("devmux-launch", { projectDir, service })
}
