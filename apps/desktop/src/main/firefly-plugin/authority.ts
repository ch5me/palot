/**
 * Firefly Plugin System V2 — Plugin authority singleton
 *
 * The catalog authority is the only place that owns the live
 * `PluginCatalog` for the running app. IPC handlers and renderer
 * hooks call into this module instead of re-reading manifests so
 * the host never has a split view of the V2 plugin universe.
 */

import type {
	PluginCatalog,
	PluginCatalogEntry,
	PluginCatalogStateOverride,
	PluginProjectionSummary,
} from "./catalog"
import { buildPluginCatalog, findDescriptor, getCapabilityState, summarizeProjection } from "./catalog"
import { decideCapability, type CapabilityDecision } from "./capability-broker"
import { defaultPluginRoots, discoverDiskManifests } from "./disk-manifests"
import {
	createFileLifecycleStateIo,
	createPluginLifecycleStateStore,
	type PluginLifecycleStateStore,
	type PluginRuntimeStateSnapshot,
} from "./lifecycle-state"

let cached: PluginCatalog | null = null
let lifecycleStore: PluginLifecycleStateStore | null = null

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
export function resolvePluginRoots(): string[] {
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

/**
 * Resolve the durable lifecycle store. Production persists to
 * `<userData>/firefly-plugins.json`; outside Electron (bun tests) an
 * in-memory io keeps tests hermetic.
 */
export function getPluginLifecycleStore(): PluginLifecycleStateStore {
	if (lifecycleStore) return lifecycleStore
	let io: { read(): string | null; write(content: string): void }
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const electron = require("electron") as typeof import("electron")
		const userData = electron.app.getPath("userData")
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { join } = require("node:path") as typeof import("node:path")
		io = createFileLifecycleStateIo(join(userData, "firefly-plugins.json"))
	} catch {
		let memory: string | null = null
		io = {
			read: () => memory,
			write: (content) => {
				memory = content
			},
		}
	}
	lifecycleStore = createPluginLifecycleStateStore({ io })
	lifecycleStore.subscribe(() => {
		// Lifecycle changes invalidate the projected catalog; consumers
		// re-read through getPluginCatalog and see the new overlay.
		cached = null
	})
	return lifecycleStore
}

function lifecycleOverrides(): Record<string, PluginCatalogStateOverride> {
	const store = getPluginLifecycleStore()
	const overrides: Record<string, PluginCatalogStateOverride> = {}
	for (const [pluginId, state] of Object.entries(store.listOverridden())) {
		overrides[pluginId] = {
			pluginDisabled: !state.enabled,
			pluginQuarantined: state.quarantined,
			quarantineDetail: state.quarantineDetail,
		}
	}
	return overrides
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
		stateOverrides: lifecycleOverrides(),
	})
}

/** Operator/host action: enable or disable a plugin at runtime. */
export function setPluginEnabled(pluginId: string, enabled: boolean): PluginRuntimeStateSnapshot {
	const result = getPluginLifecycleStore().setEnabled(pluginId, enabled)
	cached = null
	return result
}

/**
 * Renderer error-boundary report: one panel render crash. Repeated
 * crashes within the window quarantine the plugin (plan §2.1 — UI
 * crashes count toward the same quarantine counter as worker crashes).
 */
export function reportPluginPanelCrash(
	pluginId: string,
	message: string,
): PluginRuntimeStateSnapshot {
	const catalog = getPluginCatalog()
	const descriptor = findDescriptor(catalog, pluginId)
	const result = getPluginLifecycleStore().reportUiCrash(pluginId, message, {
		threshold: descriptor?.derived.quarantineOnCrashCount,
	})
	cached = null
	return result
}

/** Operator action: release a quarantined plugin back to service. */
export function releasePluginQuarantine(pluginId: string, note: string): PluginRuntimeStateSnapshot {
	const result = getPluginLifecycleStore().releaseQuarantine(pluginId, note)
	cached = null
	return result
}

/** Test hook: reset module singletons. */
export function _resetPluginAuthorityForTests(): void {
	cached = null
	lifecycleStore = null
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
