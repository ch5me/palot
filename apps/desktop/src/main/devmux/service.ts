/**
 * Host-side DevMux service — the single seam between the Firefly plugin
 * runtime and the Node-only `@chriscode/devmux` library.
 *
 * This is the `vscode.tasks`-style host capability that the DevMux Toolbar
 * plugin (`firefly.built-in.devmux-toolbar`) consumes through the
 * `host:devmux.*` capability tokens. No plugin code runs here; the plugin
 * declares the capability and the host owns the implementation, exactly the
 * way `host:browser.*` and `host:theme.*` are host-owned.
 *
 * Why everything is lazy-imported:
 *   - `@chriscode/devmux` is ESM-only, shells out to `tmux`, and pulls in
 *     `execa`/`ps-list`/`fkill`. We never want it in the boot graph or in the
 *     bun test module graph (`dispatch.test.ts` imports the dispatcher).
 *   - Electron `shell` is only available in the main process at runtime.
 * Keeping both behind dynamic `import()` lets this module be statically
 * imported anywhere without dragging tmux/electron into the importing graph.
 *
 * Failure policy (CH5 fail-fast): every function throws a typed Error naming
 * the missing precondition (no config, unknown service, tmux missing). The
 * dispatch layer converts the throw into a typed error envelope; nothing here
 * silently falls back.
 */

import type { ResolvedConfig, ServiceDefinition, ServiceStatus } from "@chriscode/devmux"

import { createLogger } from "../logger"

const log = createLogger("devmux/service")

/** Static, config-declared shape of one service (no live state). */
export interface DevmuxServiceSummary {
	readonly name: string
	readonly description: string | null
	readonly command: string
	/** Base port from `port` or `health.port`, when the service has one. */
	readonly port: number | null
	readonly dashboard: boolean
	readonly dependsOn: readonly string[]
}

/** Live runtime state of one service. */
export interface DevmuxServiceRuntime {
	readonly name: string
	/** Health check passes (port/http reachable). */
	readonly healthy: boolean
	/** A devmux-owned tmux session exists for this service. */
	readonly managedByDevmux: boolean
	readonly port: number | null
	/** Browser-openable URL, or null when the service exposes no port. */
	readonly url: string | null
}

export interface DevmuxProjectServices {
	readonly project: string
	readonly configRoot: string
	readonly services: readonly DevmuxServiceSummary[]
}

export interface DevmuxEnsureResult {
	readonly service: string
	readonly startedByUs: boolean
	readonly url: string | null
}

type DevmuxModule = typeof import("@chriscode/devmux")

/**
 * Lazy ESM import of the devmux library. Throws a typed error if the package
 * cannot be loaded so the caller surfaces a real cause instead of a crash.
 */
async function loadDevmux(): Promise<DevmuxModule> {
	try {
		return await import("@chriscode/devmux")
	} catch (cause) {
		throw new Error(
			`@chriscode/devmux failed to load: ${cause instanceof Error ? cause.message : String(cause)}`,
		)
	}
}

/**
 * Resolve a ResolvedConfig for a project directory. `loadConfig` walks UP
 * from the given dir to find `devmux.config.json` (or the other supported
 * config filenames), throwing if none is found. We rethrow with a stable
 * `no devmux config` message the dispatcher maps to a typed code.
 */
function loadProjectConfig(devmux: DevmuxModule, projectDir: string): ResolvedConfig {
	try {
		return devmux.loadConfig(projectDir)
	} catch (cause) {
		throw new Error(
			`no devmux config for ${projectDir}: ${cause instanceof Error ? cause.message : String(cause)}`,
		)
	}
}

/** Base port for a service, preferring the explicit `port` override. */
function servicePort(def: ServiceDefinition): number | null {
	if (typeof def.port === "number") return def.port
	if (def.health && def.health.type === "port" && typeof def.health.port === "number") {
		return def.health.port
	}
	return null
}

/** `description` is not in the published ServiceDefinition type but devmux
 * configs carry it; read it defensively without `as any`. */
function serviceDescription(def: ServiceDefinition): string | null {
	if (def && typeof def === "object" && "description" in def) {
		const value = (def as { description?: unknown }).description
		return typeof value === "string" ? value : null
	}
	return null
}

/** Derive a browser-openable URL from a live status. */
function statusUrl(status: ServiceStatus): string | null {
	if (status.proxyUrl) return status.proxyUrl
	const port = status.resolvedPort ?? status.port
	return typeof port === "number" ? `http://localhost:${port}` : null
}

/** List the services declared in a project's devmux config. */
export async function listServices(projectDir: string): Promise<DevmuxProjectServices> {
	const devmux = await loadDevmux()
	const config = loadProjectConfig(devmux, projectDir)
	const services: DevmuxServiceSummary[] = Object.entries(config.services).map(([name, def]) => ({
		name,
		description: serviceDescription(def),
		command: def.command,
		port: servicePort(def),
		dashboard: def.dashboard ?? false,
		dependsOn: def.dependsOn ?? [],
	}))
	return { project: config.project, configRoot: config.configRoot, services }
}

/** Live health + URL for every service in a project. */
export async function statusAll(projectDir: string): Promise<readonly DevmuxServiceRuntime[]> {
	const devmux = await loadDevmux()
	const config = loadProjectConfig(devmux, projectDir)
	const statuses = await devmux.getAllStatus(config)
	return statuses.map((status) => ({
		name: status.name,
		healthy: status.healthy,
		managedByDevmux: status.managedByDevmux,
		port: status.resolvedPort ?? status.port ?? null,
		url: statusUrl(status),
	}))
}

/**
 * Idempotently ensure a single service is running and healthy (devmux
 * `ensure`: health-check first, start in tmux if down, poll until healthy or
 * timeout). Returns the resolved URL so the caller can open it.
 */
export async function ensureService(
	projectDir: string,
	service: string,
	timeoutSeconds = 120,
): Promise<DevmuxEnsureResult> {
	const devmux = await loadDevmux()
	const config = loadProjectConfig(devmux, projectDir)
	if (!config.services[service]) {
		throw new Error(`unknown devmux service "${service}" in ${config.project}`)
	}
	log.info("Ensuring devmux service", { project: config.project, service })
	const result = await devmux.ensureService(config, service, { timeout: timeoutSeconds })
	const status = await devmux.getStatus(config, service)
	return { service: result.serviceName, startedByUs: result.startedByUs, url: statusUrl(status) }
}

/** Open a vetted http(s) URL in the user's system browser. */
export async function openExternalUrl(rawUrl: string): Promise<void> {
	let parsed: URL
	try {
		parsed = new URL(rawUrl)
	} catch {
		throw new Error(`invalid url: ${rawUrl}`)
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`refusing to open non-http(s) url: ${parsed.protocol}`)
	}
	const { shell } = await import("electron")
	await shell.openExternal(parsed.toString())
}
