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
import {
	createDefaultInstalledManifestStore,
	discoverInstalledManifests,
	type InstalledManifestStoreApi,
} from "./discover-installed-manifests"

let cached: PluginCatalog | null = null
let lifecycleStore: PluginLifecycleStateStore | null = null

/**
 * F2 — injectable installed-manifest store. Defaults to the real DB-backed
 * store; tests override via `_setInstalledManifestStoreForTests`.
 */
let installedManifestStore: InstalledManifestStoreApi | null = null

function getInstalledManifestStore(): InstalledManifestStoreApi {
	if (!installedManifestStore) {
		installedManifestStore = createDefaultInstalledManifestStore()
	}
	return installedManifestStore
}

const log = {
	debug: (..._args: unknown[]) => undefined,
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
	warn: (..._args: unknown[]) => undefined,
	error: (..._args: unknown[]) => undefined,
} satisfies {
	debug: (...args: unknown[]) => void
	info: (...args: unknown[]) => void
	warn: (...args: unknown[]) => void
	error: (...args: unknown[]) => void
}

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

/**
 * Build the catalog from built-ins + disk manifests + (optionally) already-
 * resolved installed manifests. Synchronous: takes pre-fetched installed
 * manifests so async DB I/O is separated from the pure catalog assembly.
 *
 * @param installedManifests - resolved Firefly manifests from the install DB
 *   (empty by default — callers that want installed extensions must fetch them
 *    first via `discoverInstalledManifests`).
 */
function buildCatalogWithDiskPlugins(
	installedManifests: readonly import("../../shared/firefly-plugin/manifest").PluginManifest[] = [],
): PluginCatalog {
	const discovery = discoverDiskManifests(resolvePluginRoots())
	return buildPluginCatalog({
		appVersion: resolveAppVersion(),
		diskManifests: [...discovery.manifests, ...installedManifests],
		diskFailures: discovery.failures.map((failure) => ({
			manifestPath: failure.manifestPath,
			pluginId: failure.pluginId,
			issues: failure.issues.map((issue) => ({ path: [...issue.path], message: issue.message })),
		})),
		stateOverrides: lifecycleOverrides(),
	})
}

/**
 * F2 — async variant that also reads installed code-extensions from the DB.
 * Merges built-ins + disk manifests + installed manifests into one catalog.
 * Failures from the installed-manifest discovery are logged (quarantine-not-
 * throw policy) but never block the rest of the catalog.
 */
async function buildCatalogWithAllPlugins(
	store?: InstalledManifestStoreApi,
): Promise<PluginCatalog> {
	const resolvedStore = store ?? getInstalledManifestStore()
	let installedManifests: readonly import("../../shared/firefly-plugin/manifest").PluginManifest[] = []
	try {
		const discovery = await discoverInstalledManifests(resolvedStore)
		installedManifests = discovery.manifests
		if (discovery.failures.length > 0) {
			log.warn("Some installed manifests failed to parse (quarantined)", {
				count: discovery.failures.length,
				failures: discovery.failures.map((f) => ({
					installationId: f.installationId,
					externalId: f.externalId,
					firstIssue: f.issues[0]?.message ?? "unknown",
				})),
			})
		}
	} catch (err) {
		// DB unavailable at catalog-build time (e.g. migration not yet run).
		// Fail-loud: log and rethrow so the caller is aware. The test runner
		// uses an injected in-memory store, so this only fires in production
		// when the DB is genuinely broken.
		log.error("discoverInstalledManifests failed — installed extensions not in catalog", { err })
		throw err
	}
	return buildCatalogWithDiskPlugins(installedManifests)
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
	installedManifestStore = null
}

/**
 * F2 test hook: override the installed-manifest store with an in-memory stub
 * so tests do not need a real DB. Call `_resetPluginAuthorityForTests` to
 * restore the default after the test.
 */
export function _setInstalledManifestStoreForTests(store: InstalledManifestStoreApi): void {
	installedManifestStore = store
}

export { decideCapability, type CapabilityDecision, type InstalledManifestStoreApi }

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

/**
 * F2 — async refresh that includes installed code-extensions from the DB.
 *
 * Use this after an extension install/uninstall/enable/disable so the catalog
 * immediately reflects the change without an app restart. The sync
 * `refreshPluginCatalog()` and `getPluginCatalog()` will return the updated
 * catalog from `cached` after this call resolves.
 *
 * @param store - injectable store for tests (defaults to the real DB adapter)
 */
export async function refreshPluginCatalogAsync(
	store?: InstalledManifestStoreApi,
): Promise<PluginCatalog> {
	cached = await buildCatalogWithAllPlugins(store)
	log.info("Refreshed V2 plugin catalog (async, includes installed extensions)", {
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

export function listPluginNavSidebars() {
	return getPluginCatalog().projections.navSidebars
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
