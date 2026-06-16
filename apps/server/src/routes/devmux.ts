/**
 * DevMux route — the web-build transport for the DevMux Toolbar plugin.
 *
 * In the Electron build the renderer reaches DevMux over the firefly-plugin IPC
 * (capability-brokered dispatch → `apps/desktop/src/main/devmux/service.ts`).
 * The web build has no `window.elf`, so the renderer hits these endpoints.
 *
 * Both transports are thin adapters over the SAME shared library
 * (`@chriscode/devmux`, the real host logic) and emit the SAME JSON shapes the
 * renderer's `services/devmux.ts` types. Keep this file's mapping in step with
 * the desktop service. `@chriscode/devmux` is a root workspace dependency
 * (resolved via hoisting); it is ESM-only and shells out to `tmux`, so it is
 * lazy-imported.
 *
 * Note: the capability broker gates only the Electron IPC path today. The
 * DevMux Toolbar is a baseline-granted built-in, so brokering it is a no-op;
 * when untrusted plugins or higher-risk tokens land, add a server-side check.
 */

import type { ServiceDefinition, ServiceStatus } from "@chriscode/devmux"
import { Hono } from "hono"

const app = new Hono()

async function loadDevmux() {
	return await import("@chriscode/devmux")
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null
}

function servicePort(def: ServiceDefinition): number | null {
	if (typeof def.port === "number") return def.port
	if (def.health && def.health.type === "port" && typeof def.health.port === "number") {
		return def.health.port
	}
	return null
}

function serviceDescription(def: ServiceDefinition): string | null {
	if (def && typeof def === "object" && "description" in def) {
		const value = (def as { description?: unknown }).description
		return typeof value === "string" ? value : null
	}
	return null
}

function statusUrl(status: ServiceStatus): string | null {
	if (status.proxyUrl) return status.proxyUrl
	const port = status.resolvedPort ?? status.port
	return typeof port === "number" ? `http://localhost:${port}` : null
}

function errorStatus(message: string): 404 | 400 {
	return message.startsWith("no devmux config") ? 404 : 400
}

function loadProjectConfig(devmux: Awaited<ReturnType<typeof loadDevmux>>, projectDir: string) {
	try {
		return devmux.loadConfig(projectDir)
	} catch (cause) {
		throw new Error(
			`no devmux config for ${projectDir}: ${cause instanceof Error ? cause.message : String(cause)}`,
		)
	}
}

const routes = app
	.post("/list", async (c) => {
		const projectDir = readString((await c.req.json().catch(() => ({})))?.projectDir)
		if (!projectDir) return c.json({ error: "projectDir is required" }, 400)
		try {
			const devmux = await loadDevmux()
			const config = loadProjectConfig(devmux, projectDir)
			return c.json(
				{
					project: config.project,
					configRoot: config.configRoot,
					services: Object.entries(config.services).map(([name, def]) => ({
						name,
						description: serviceDescription(def),
						command: def.command,
						port: servicePort(def),
						dashboard: def.dashboard ?? false,
						dependsOn: def.dependsOn ?? [],
					})),
				},
				200,
			)
		} catch (err) {
			const message = err instanceof Error ? err.message : "devmux list failed"
			return c.json({ error: message }, errorStatus(message))
		}
	})
	.post("/status", async (c) => {
		const projectDir = readString((await c.req.json().catch(() => ({})))?.projectDir)
		if (!projectDir) return c.json({ error: "projectDir is required" }, 400)
		try {
			const devmux = await loadDevmux()
			const config = loadProjectConfig(devmux, projectDir)
			const statuses = await devmux.getAllStatus(config)
			return c.json(
				{
					services: statuses.map((status) => ({
						name: status.name,
						healthy: status.healthy,
						managedByDevmux: status.managedByDevmux,
						port: status.resolvedPort ?? status.port ?? null,
						url: statusUrl(status),
					})),
				},
				200,
			)
		} catch (err) {
			const message = err instanceof Error ? err.message : "devmux status failed"
			return c.json({ error: message }, errorStatus(message))
		}
	})
	.post("/ensure", async (c) => {
		const body = await c.req.json().catch(() => ({}))
		const projectDir = readString(body?.projectDir)
		const service = readString(body?.service)
		if (!projectDir) return c.json({ error: "projectDir is required" }, 400)
		if (!service) return c.json({ error: "service is required" }, 400)
		try {
			const devmux = await loadDevmux()
			const config = loadProjectConfig(devmux, projectDir)
			if (!config.services[service]) {
				return c.json({ error: `unknown devmux service "${service}"` }, 400)
			}
			const result = await devmux.ensureService(config, service, { timeout: 180 })
			const status = await devmux.getStatus(config, service)
			return c.json(
				{ service: result.serviceName, startedByUs: result.startedByUs, url: statusUrl(status) },
				200,
			)
		} catch (err) {
			const message = err instanceof Error ? err.message : "devmux ensure failed"
			return c.json({ error: message }, errorStatus(message))
		}
	})

export default routes
