/**
 * Firefly Plugin System V2 — Plugin authority singleton
 *
 * The catalog authority is the only place that owns the live
 * `PluginCatalog` for the running app. IPC handlers and renderer
 * hooks call into this module instead of re-reading manifests so
 * the host never has a split view of the V2 plugin universe.
 */

import type { PluginCatalog, PluginCatalogEntry, PluginProjectionSummary } from "./catalog"
import { buildPluginCatalog, findDescriptor, getCapabilityState, summarizeProjection } from "./catalog"
import { decideCapability, type CapabilityDecision } from "./capability-broker"
import { defaultPluginRoots, discoverDiskManifests } from "./disk-manifests"

let cached: PluginCatalog | null = null

function resolveAppVersion(): string {
	try {
		const electron = globalThis as { electron?: { app?: { getVersion?: () => string } } }
		return electron.electron?.app?.getVersion?.() ?? "0.11.0"
	} catch {
		return "0.11.0"
	}
}

/**
 * Resolve the on-disk plugin roots for the running process. Outside
 * Electron (bun test runner) there are no roots — the catalog is the
 * in-source built-in set only, which keeps tests hermetic.
 */
function resolvePluginRoots(): string[] {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const electron = require("electron") as typeof import("electron")
		if (!electron?.app) return []
		return defaultPluginRoots({
			isPackaged: electron.app.isPackaged,
			resourcesPath: process.resourcesPath ?? null,
			appRoot: electron.app.getAppPath(),
		})
	} catch {
		return []
	}
}

function buildCatalogWithDiskPlugins(): PluginCatalog {
	const discovery = discoverDiskManifests(resolvePluginRoots())
	return buildPluginCatalog({
		appVersion: resolveAppVersion(),
		diskManifests: discovery.manifests,
		diskFailures: discovery.failures.map((failure) => ({
			manifestPath: failure.manifestPath,
			pluginId: failure.pluginId,
			issues: failure.issues.map((issue) => ({ path: [...issue.path], message: issue.message })),
		})),
	})
}

const log = {
	debug: () => undefined,
	info: (...args: unknown[]) => {
		// Re-attach to the host logger lazily so the authority module
		// still loads in the bun test runner.
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const { createLogger } = require("../logger") as typeof import("../logger")
			createLogger("firefly-plugin-authority").info(...args)
		} catch {
			// ignore
		}
	},
	warn: () => undefined,
	error: () => undefined,
} satisfies {
	debug: (...args: unknown[]) => void
	info: (...args: unknown[]) => void
	warn: (...args: unknown[]) => void
	error: (...args: unknown[]) => void
}

export { decideCapability, type CapabilityDecision }

export function getPluginCatalog(): PluginCatalog {
	if (cached) return cached
	cached = buildCatalogWithDiskPlugins()
	return cached
}

export function refreshPluginCatalog(): PluginCatalog {
	cached = buildCatalogWithDiskPlugins()
	log.info("Refreshed V2 plugin catalog", {
		pluginCount: cached.descriptors.length,
	})
	return cached
}

export function listPluginEntries(): readonly PluginCatalogEntry[] {
	return getPluginCatalog().entries
}

export function listPluginProjectionSummaries(): readonly PluginProjectionSummary[] {
	return summarizeProjection(getPluginCatalog())
}

export function describePlugin(pluginId: string): {
	entry: PluginCatalogEntry | null
	projection: PluginProjectionSummary | null
	decision: CapabilityDecision
} {
	const catalog = getPluginCatalog()
	const entry = catalog.entries.find((e) => e.pluginId === pluginId) ?? null
	const projection =
		summarizeProjection(catalog).find((p) => p.pluginId === pluginId) ?? null
	const descriptor = findDescriptor(catalog, pluginId)
	const trust = descriptor?.trust ?? entry?.trust ?? "built-in"
	const decision = decideCapability({
		pluginId,
		trust,
		token: "host:tool.register",
		sessionScope: "session",
		grantedTokens: [],
	})
	return { entry, projection, decision }
}

export function getPluginCapabilities(pluginId: string): {
	state: ReturnType<typeof getCapabilityState>
	decision: CapabilityDecision
} {
	const catalog = getPluginCatalog()
	const state = getCapabilityState(catalog, pluginId)
	const descriptor = findDescriptor(catalog, pluginId)
	const trust = descriptor?.trust ?? "built-in"
	const decision = decideCapability({
		pluginId,
		trust,
		token: "host:tool.register",
		sessionScope: "session",
		grantedTokens: [...state.grantedTokens],
	})
	return { state, decision }
}

export function listPluginPanels() {
	return getPluginCatalog().projections.panels
}

export function listPluginWidgets() {
	return getPluginCatalog().projections.widgets
}

export function listPluginCommands() {
	return getPluginCatalog().projections.commands
}

export function listPluginThemes() {
	return getPluginCatalog().projections.themes
}
