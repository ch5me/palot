/**
 * Firefly Plugin System V2 — HostAuthority implementations
 *
 * Provides two concrete implementations of `HostAuthority` (§2.4 of the design doc):
 *
 *   - `ElectronHostAuthority`: wraps the existing authority.ts / dispatch.ts
 *     free-function singletons. No logic moves here — all behavior is delegated.
 *   - `CloudHostAuthority`: stub for the future web build. Every method throws a
 *     named error so the absence of an implementation is immediately visible.
 *
 * Both classes implement the shared `HostAuthority` interface from
 * `../../shared/firefly-plugin/host-authority-types`.
 *
 * IPC handlers in `ipc.ts` construct one `ElectronHostAuthority` instance and
 * route all handler calls through it, keeping the interface as the seam between
 * the host and the rest of the system.
 */

import type {
	HostAuthority,
	HostPluginDescribeResult,
	HostPluginFamilyResult,
	HostPluginListResult,
	HostPluginPanelCrashResult,
	HostPluginRefreshResult,
	HostPluginReleaseQuarantineResult,
	HostPluginSetEnabledResult,
	HostPluginStateResult,
	HostPluginToolsResult,
	HostToolDispatchEnvelope,
	MarketplaceSearchOptions,
	MarketplaceSearchResult,
	MarketplaceInstallInput,
	MarketplaceInstallResult,
	MarketplaceInstalledEntry,
	MarketplaceInstalledTheme,
} from "../../shared/firefly-plugin/host-authority-types"
import { createCloudProjectionCache, type CloudProjectionCache } from "./cloud-projection-cache"
import { createOpenVsxClient } from "./registry/open-vsx-client"
import { installExtension, uninstallExtension, applyInstalledTheme } from "./install/install-orchestrator"
import { listInstalledExtensions } from "./install/extension-store"

import {
	describePlugin,
	getPluginCapabilities,
	getPluginCatalog,
	listPluginCommands,
	listPluginEntries,
	listPluginNavSidebars,
	listPluginPanels,
	listPluginProjectionSummaries,
	listPluginThemes,
	listPluginWidgets,
	refreshPluginCatalog,
	releasePluginQuarantine,
	reportPluginPanelCrash,
	setPluginEnabled,
} from "./authority"
import { invokePluginCommand, invokePluginTool, listKnownCommands } from "./dispatch"
import { projectBridgeToolDefinitions } from "../../shared/firefly-plugin/bridge-projection"
import { broadcastCatalogChanged } from "./catalog-broadcast"
import { applyEnabledToSupervisor } from "./supervisor-apply"
import { getBootedPluginWorkerSupervisor } from "./supervisor-boot"
import { createPluginStorageService, type IPluginStorageService } from "./plugin-storage-service"
import {
	createCloudHostRpcClient,
	resolveCloudHostConfig,
	CloudHostNotConfiguredError,
	type CloudHostRpcClient,
} from "./cloud-host-rpc-client"
import { ensureDb } from "../automation/database"
import { getHostGrantStore } from "./grant-store"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin-host-authority")

// ---------------------------------------------------------------------------
// Plugin storage service (P3e) — host-owned durable KV + secrets, one instance.
//
// Reachable from the host; the worker storage-request RPC channel
// (extension-host-protocol.ts) and an IPC surface are the remaining last-mile,
// gated on a live node-worker plugin (none ship in P3).
// ---------------------------------------------------------------------------

let storageServicePromise: Promise<IPluginStorageService> | null = null

export function getPluginStorageService(): Promise<IPluginStorageService> {
	if (!storageServicePromise) {
		storageServicePromise = ensureDb().then((db) => createPluginStorageService({ db }))
	}
	return storageServicePromise
}

// ---------------------------------------------------------------------------
// ElectronHostAuthority — delegates to existing authority.ts/dispatch.ts
// ---------------------------------------------------------------------------

export class ElectronHostAuthority implements HostAuthority {
	catalog(): HostPluginListResult {
		const cat = getPluginCatalog()
		return {
			appVersion: cat.appVersion,
			plugins: listPluginEntries().map((entry) => ({
				pluginId: entry.pluginId,
				displayName: entry.displayName,
				version: entry.version,
				trust: entry.trust,
				status: entry.status,
				manifestRevision: entry.manifestRevision,
				appVersion: entry.appVersion,
				requiredCapabilities: [...entry.requiredCapabilities],
				defaultGrantedCapabilities: [...entry.defaultGrantedCapabilities],
				statusDetail: entry.statusDetail,
				source: entry.source,
			})),
			summaries: listPluginProjectionSummaries().map((s) => ({
				pluginId: s.pluginId,
				panelCount: s.panelCount,
				widgetCount: s.widgetCount,
				commandCount: s.commandCount,
				themeCount: s.themeCount,
				toolCount: s.toolCount,
				componentCount: s.componentCount,
			})),
			knownCommands: listKnownCommands(),
		}
	}

	describe(pluginId: string): HostPluginDescribeResult {
		return describePlugin(pluginId)
	}

	state(pluginId: string): HostPluginStateResult {
		const caps = getPluginCapabilities(pluginId)
		return {
			found: caps.state.trust !== "built-in" || pluginId.length > 0,
			pluginId,
			state: caps.state,
			decision: caps.decision,
		}
	}

	listTools(): HostPluginToolsResult {
		const cat = getPluginCatalog()
		const tools: HostPluginToolsResult["tools"] = []
		for (const descriptor of cat.descriptors) {
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
		return { appVersion: cat.appVersion, tools }
	}

	listPanels(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginPanels()] }
	}

	listNavSidebars(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginNavSidebars()] }
	}

	listWidgets(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginWidgets()] }
	}

	listCommands(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginCommands()] }
	}

	listThemes(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginThemes()] }
	}

	refresh(): HostPluginRefreshResult {
		const cat = refreshPluginCatalog()
		broadcastCatalogChanged()
		return { appVersion: cat.appVersion, pluginCount: cat.descriptors.length }
	}

	async invoke(
		pluginId: string,
		commandId: string,
		args: Record<string, unknown>,
	): Promise<HostToolDispatchEnvelope> {
		return invokePluginCommand({ pluginId, commandId, args })
	}

	async invokeTool(
		pluginId: string,
		toolId: string,
		args: Record<string, unknown>,
		sessionId: string | null,
	): Promise<HostToolDispatchEnvelope> {
		return invokePluginTool({ pluginId, toolId, args, sessionId })
	}

	setEnabled(pluginId: string, enabled: boolean): HostPluginSetEnabledResult {
		const state = setPluginEnabled(pluginId, enabled)
		const supervised = applyEnabledToSupervisor(
			getBootedPluginWorkerSupervisor(),
			pluginId,
			enabled,
		)
		broadcastCatalogChanged(`set-enabled:${enabled ? "enable" : "disable"}`)
		log.info("Plugin set-enabled applied", {
			pluginId,
			enabled,
			supervised: supervised.supervised,
			workerState: supervised.summary?.state ?? null,
		})
		return { pluginId, ...state }
	}

	reportPanelCrash(pluginId: string, message: string): HostPluginPanelCrashResult {
		const state = reportPluginPanelCrash(pluginId, message)
		broadcastCatalogChanged()
		return { pluginId, ...state }
	}

	releaseQuarantine(pluginId: string, note: string): HostPluginReleaseQuarantineResult {
		const state = releasePluginQuarantine(pluginId, note)
		broadcastCatalogChanged()
		return { pluginId, ...state }
	}

	// -------------------------------------------------------------------------
	// Marketplace methods (§7, §8) — additive
	// -------------------------------------------------------------------------

	async gallerySearch(options: MarketplaceSearchOptions): Promise<MarketplaceSearchResult> {
		const client = createOpenVsxClient()
		const result = await client.search({
			query: options.query,
			category: options.category ?? "Themes",
			size: options.size ?? 18,
			offset: options.offset ?? 0,
			sortBy: "downloadCount",
			sortOrder: "desc",
		})
		return {
			offset: result.offset,
			totalSize: result.totalSize,
			extensions: result.extensions.map((e) => ({
				namespace: e.namespace,
				name: e.name,
				displayName: e.displayName,
				description: e.description,
				version: e.version,
				iconUrl: e.iconUrl,
				downloadCount: e.downloadCount,
			})),
		}
	}

	async installExtension(input: MarketplaceInstallInput): Promise<MarketplaceInstallResult> {
		let installInput: Parameters<typeof installExtension>[0]
		if (input.kind === "open-vsx") {
			if (!input.namespace || !input.name) {
				throw new Error("open-vsx install requires namespace and name")
			}
			installInput = {
				kind: "open-vsx",
				namespace: input.namespace,
				name: input.name,
				version: input.version,
			}
		} else {
			if (!input.vsixPath) {
				throw new Error("local-vsix install requires vsixPath")
			}
			installInput = {
				kind: "local-vsix",
				vsixPath: input.vsixPath,
				expectedSha256: input.expectedSha256,
			}
		}

		const grantStore = await getHostGrantStore()
		// consentedCapabilities threads the pre-install consent result into
		// persistInstallGrants so approved capabilities land as granted/user
		// rows. C3 wires the orchestrator-side gating; C2 only passes it through.
		// The options type is widened with the upcoming C3 addition of
		// consentedCapabilities to InstallExtensionOptions.
		const installOptions: Parameters<typeof installExtension>[1] & {
			consentedCapabilities?: readonly string[]
		} = {
			grantStore,
			consentedCapabilities: input.consentedCapabilities,
		}
		const result = await installExtension(installInput, installOptions)
		return {
			packageId: result.package.id,
			installationId: result.installation.id,
			externalId: result.package.externalId,
			displayName: result.package.displayName,
			version: result.package.version,
			themes: result.themes.map((t) => ({ id: t.id, label: t.label, kind: t.kind })),
			alreadyInstalled: result.alreadyInstalled,
		}
	}

	async listInstalledExtensions(): Promise<{ extensions: MarketplaceInstalledEntry[] }> {
		const installed = await listInstalledExtensions()
		return {
			extensions: installed.map(({ package: pkg, installation }) => {
				const themes: MarketplaceInstalledTheme[] =
					pkg.themesJson ? (JSON.parse(pkg.themesJson) as MarketplaceInstalledTheme[]) : []
				return {
					packageId: pkg.id,
					installationId: installation.id,
					externalId: pkg.externalId,
					displayName: pkg.displayName,
					version: pkg.version,
					registrySource: pkg.registrySource,
					lifecycleState: installation.lifecycleState,
					appliedThemeId: installation.appliedThemeId,
					themes,
				}
			}),
		}
	}

	async uninstallExtension(installationId: string): Promise<{ ok: true }> {
		await uninstallExtension(installationId)
		return { ok: true }
	}

	async applyTheme(
		installationId: string,
		themeId: string,
	): Promise<{ ok: true; appTokens?: Record<string, string>; kind?: "light" | "dark" | "high-contrast" }> {
		await applyInstalledTheme(installationId, themeId)

		// Resolve appTokens for this themeId so the renderer can inject CSS vars immediately.
		const { getInstallationById, getExtensionPackage } = await import("./install/extension-store")
		const installation = await getInstallationById(installationId)
		if (installation) {
			const pkg = await getExtensionPackage(installation.packageId)
			if (pkg?.themesJson) {
				const themes = JSON.parse(pkg.themesJson) as MarketplaceInstalledTheme[]
				const matched = themes.find((t) => t.id === themeId)
				if (matched?.appTokens) {
					return { ok: true, appTokens: matched.appTokens, kind: matched.kind }
				}
			}
		}

		return { ok: true }
	}
}

// ---------------------------------------------------------------------------
// CloudHostAuthority — stub for the web build (Phase 3+)
// ---------------------------------------------------------------------------

/**
 * firefly-cloud-backed host authority for the web build (§2.4, Phase 3).
 *
 * The web build has no local Electron main process; mutating / RPC operations
 * resolve remotely over HTTP/WS against firefly-cloud (`CloudHostRpcClient`).
 *
 * CROSS-REPO: the firefly-cloud server that answers these RPCs lives in the
 * `firefly-cloud` repo and cannot land here. Until it exists and
 * `FIREFLY_CLOUD_URL` is set, every async method fails fast with
 * `CloudHostNotConfiguredError` (named precondition, no silent fallback).
 *
 * Synchronous projection reads (catalog / describe / list*) cannot be fulfilled
 * by a remote call; in the web build they are served from a projection cache
 * hydrated from firefly-cloud. That cache is not built yet, so they fail fast
 * with a typed error naming the missing precondition — never a silent empty
 * projection that would hide the gap.
 */
export class CloudHostAuthority implements HostAuthority {
	private readonly rpc: CloudHostRpcClient
	private readonly cache: CloudProjectionCache
	/** Promise for the in-flight initial hydration (kicked on construction). */
	private readonly initialHydration: Promise<void>

	constructor(rpc?: CloudHostRpcClient, cache?: CloudProjectionCache) {
		this.rpc = rpc ?? createCloudHostRpcClient({ config: resolveCloudHostConfig() })
		this.cache = cache ?? createCloudProjectionCache()
		// Kick the initial projection fetch + subscribe for push-on-change.
		// Failures are logged but do not prevent construction — reads will throw
		// ProjectionCacheNotHydratedError until the fetch completes, which is the
		// correct fail-fast behaviour (no silent empty projection).
		this.initialHydration = this.kickHydration()
	}

	private async kickHydration(): Promise<void> {
		try {
			const snapshot = await this.rpc.fetchProjectionSnapshot()
			this.cache.hydrate(snapshot)
		} catch (err) {
			// Fail fast: log the error but do not suppress it. The cache remains
			// un-hydrated and sync reads will throw ProjectionCacheNotHydratedError
			// until a subsequent hydration succeeds (push or manual refresh).
			log.warn("CloudHostAuthority: initial projection fetch failed", err instanceof Error ? err.message : err)
		}
		// Wire push-on-change subscription (stub until D-C5 lands; see D-P2).
		// The try/catch above covers the initial fetch; subscription errors from
		// an unconfigured host surface as CloudHostNotConfiguredError on subscribe().
		try {
			this.rpc.subscribeProjection((snapshot) => {
				this.cache.hydrate(snapshot)
			})
		} catch (err) {
			log.warn("CloudHostAuthority: projection push subscription failed", err instanceof Error ? err.message : err)
		}
	}

	/**
	 * Exposed for tests that need to await the initial hydration before asserting.
	 * Not part of the `HostAuthority` interface — internal use only.
	 */
	async awaitInitialHydration(): Promise<void> {
		return this.initialHydration
	}

	// ---- sync projection reads — delegate to cache -------------------------

	catalog(): HostPluginListResult {
		return this.cache.catalog()
	}

	describe(pluginId: string): HostPluginDescribeResult {
		return this.cache.describe(pluginId)
	}

	state(pluginId: string): HostPluginStateResult {
		return this.cache.state(pluginId)
	}

	listTools(): HostPluginToolsResult {
		return this.cache.listTools()
	}

	listPanels(): HostPluginFamilyResult {
		return this.cache.listPanels()
	}

	listNavSidebars(): HostPluginFamilyResult {
		return this.cache.listNavSidebars()
	}

	listWidgets(): HostPluginFamilyResult {
		return this.cache.listWidgets()
	}

	listCommands(): HostPluginFamilyResult {
		return this.cache.listCommands()
	}

	listThemes(): HostPluginFamilyResult {
		return this.cache.listThemes()
	}

	refresh(): HostPluginRefreshResult {
		// refresh() is a write that triggers a catalog rebuild on the server;
		// in the web build we cannot issue a sync rebuild, so fail fast naming
		// the gap (lifecycle writes are remote+async, the sync interface cannot
		// express a remote round-trip).
		throw new CloudHostNotConfiguredError(
			"a synchronous refresh() in the web build (refresh is a server-side operation — issue a remote refresh via RPC and await the pushed snapshot)",
		)
	}

	// ---- async write/dispatch — delegate to RPC ----------------------------

	async invoke(
		pluginId: string,
		commandId: string,
		args: Record<string, unknown>,
	): Promise<HostToolDispatchEnvelope> {
		return this.rpc.call<HostToolDispatchEnvelope>("invoke", { pluginId, commandId, args })
	}

	async invokeTool(
		pluginId: string,
		toolId: string,
		args: Record<string, unknown>,
		sessionId: string | null,
	): Promise<HostToolDispatchEnvelope> {
		return this.rpc.call<HostToolDispatchEnvelope>("invokeTool", { pluginId, toolId, args, sessionId })
	}

	setEnabled(_pluginId: string, _enabled: boolean): HostPluginSetEnabledResult {
		// Lifecycle writes are remote+async in the web build; the sync interface
		// shape cannot express a remote round-trip, so fail fast naming the gap.
		throw new CloudHostNotConfiguredError(
			"a synchronous setEnabled() in the web build (lifecycle writes are remote+async)",
		)
	}

	reportPanelCrash(_pluginId: string, _message: string): HostPluginPanelCrashResult {
		throw new CloudHostNotConfiguredError(
			"a synchronous reportPanelCrash() in the web build (lifecycle writes are remote+async)",
		)
	}

	releaseQuarantine(_pluginId: string, _note: string): HostPluginReleaseQuarantineResult {
		throw new CloudHostNotConfiguredError(
			"a synchronous releaseQuarantine() in the web build (lifecycle writes are remote+async)",
		)
	}

	async gallerySearch(options: MarketplaceSearchOptions): Promise<MarketplaceSearchResult> {
		return this.rpc.call<MarketplaceSearchResult>("gallerySearch", { options })
	}

	async installExtension(input: MarketplaceInstallInput): Promise<MarketplaceInstallResult> {
		return this.rpc.call<MarketplaceInstallResult>("installExtension", { input })
	}

	async listInstalledExtensions(): Promise<{ extensions: MarketplaceInstalledEntry[] }> {
		return this.rpc.call<{ extensions: MarketplaceInstalledEntry[] }>("listInstalledExtensions", {})
	}

	async uninstallExtension(installationId: string): Promise<{ ok: true }> {
		return this.rpc.call<{ ok: true }>("uninstallExtension", { installationId })
	}

	async applyTheme(
		installationId: string,
		themeId: string,
	): Promise<{ ok: true; appTokens?: Record<string, string>; kind?: "light" | "dark" | "high-contrast" }> {
		return this.rpc.call("applyTheme", { installationId, themeId })
	}
}
