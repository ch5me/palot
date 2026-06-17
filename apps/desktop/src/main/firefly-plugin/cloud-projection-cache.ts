/**
 * Firefly Plugin System V2 — Web projection cache (D-P1)
 *
 * The web build's `CloudHostAuthority` serves synchronous projection reads
 * (catalog / describe / state / list*) from this local cache, which is hydrated
 * from a `CatalogProjectionSnapshot` fetched via the firefly-cloud RPC channel.
 *
 * Design invariants (CH5 fail-fast, §7):
 *  - Every sync read throws `ProjectionCacheNotHydratedError` until the cache is
 *    hydrated — NEVER a fabricated empty projection that would silently hide the
 *    missing precondition.
 *  - `hydrate(snapshot)` ignores a snapshot whose `revision` is ≤ the current
 *    revision, preventing stale regression when push updates arrive out-of-order.
 *  - After hydration subsequent calls to `hydrate` with a higher revision replace
 *    the cached data atomically.
 */

import type {
	CatalogProjectionSnapshot,
	HostPluginDescribeResult,
	HostPluginFamilyResult,
	HostPluginListResult,
	HostPluginStateResult,
	HostPluginToolsResult,
} from "../../shared/firefly-plugin/host-authority-types"

// ---------------------------------------------------------------------------
// Error — thrown by every sync read until the cache is hydrated
// ---------------------------------------------------------------------------

/**
 * Thrown when a sync projection read is attempted before the cache has been
 * hydrated with a `CatalogProjectionSnapshot` from firefly-cloud.
 *
 * Named precondition (CH5 #9): the error message describes exactly what is
 * missing so the caller can diagnose the gap without guessing.
 */
export class ProjectionCacheNotHydratedError extends Error {
	readonly method: string
	constructor(method: string) {
		super(
			`CloudProjectionCache: cannot serve "${method}" — the projection cache has not been hydrated yet. ` +
				`Ensure firefly-cloud is reachable and fetchProjectionSnapshot() has completed successfully.`,
		)
		this.name = "ProjectionCacheNotHydratedError"
		this.method = method
	}
}

// ---------------------------------------------------------------------------
// CloudProjectionCache
// ---------------------------------------------------------------------------

/**
 * Local cache of catalog projection data hydrated from a
 * `CatalogProjectionSnapshot` delivered by firefly-cloud.
 *
 * Typical lifecycle:
 *  1. `CloudHostAuthority` constructs a `CloudProjectionCache`.
 *  2. On construction (or first read) it kicks `rpc.fetchProjectionSnapshot()`
 *     and calls `cache.hydrate(snapshot)` on success.
 *  3. `rpc.subscribeProjection(cache.hydrate)` wires push-on-change so the cache
 *     stays up to date without polling.
 *  4. Sync reads are served from the cache; async writes go directly to the RPC.
 */
export interface CloudProjectionCache {
	/** Whether the cache has been hydrated with at least one valid snapshot. */
	readonly hydrated: boolean
	/** The revision of the last successfully applied snapshot (0 until hydrated). */
	readonly revision: number

	/**
	 * Hydrate (or refresh) the cache from a new snapshot.
	 *
	 * A snapshot whose `revision` is ≤ the current `revision` is silently
	 * discarded — this prevents stale regression from out-of-order push updates.
	 */
	hydrate(snapshot: CatalogProjectionSnapshot): void

	// ---- sync projection reads (throw until hydrated) ----------------------

	catalog(): HostPluginListResult
	describe(pluginId: string): HostPluginDescribeResult
	state(pluginId: string): HostPluginStateResult
	listTools(): HostPluginToolsResult
	listPanels(): HostPluginFamilyResult
	listNavSidebars(): HostPluginFamilyResult
	listWidgets(): HostPluginFamilyResult
	listCommands(): HostPluginFamilyResult
	listThemes(): HostPluginFamilyResult
}

/**
 * Create a new, initially un-hydrated `CloudProjectionCache`.
 *
 * The cache holds a reference to the most recently applied
 * `CatalogProjectionSnapshot`; reads are served directly from that snapshot so
 * they are allocation-free after hydration.
 */
export function createCloudProjectionCache(): CloudProjectionCache {
	let snapshot: CatalogProjectionSnapshot | null = null

	/** Throws if the cache has not been hydrated yet. */
	function requireHydrated(method: string): CatalogProjectionSnapshot {
		if (snapshot === null) {
			throw new ProjectionCacheNotHydratedError(method)
		}
		return snapshot
	}

	const cache: CloudProjectionCache = {
		get hydrated(): boolean {
			return snapshot !== null
		},
		get revision(): number {
			return snapshot?.revision ?? 0
		},

		hydrate(incoming: CatalogProjectionSnapshot): void {
			// Discard stale / equal-revision snapshots — no regression.
			if (snapshot !== null && incoming.revision <= snapshot.revision) {
				return
			}
			snapshot = incoming
		},

		catalog(): HostPluginListResult {
			return requireHydrated("catalog").catalog
		},

		describe(pluginId: string): HostPluginDescribeResult {
			const snap = requireHydrated("describe")
			const result = snap.describeByPluginId[pluginId]
			if (result === undefined) {
				// Plugin not known to the server projection — return the typed
				// "not found" shape matching what ElectronHostAuthority returns.
				return { entry: null, projection: null, decision: { pluginId, token: "", granted: false, reason: "unknown", reasonCode: "unknown", risk: "low", knownToHost: false, grantedTokens: [] } }
			}
			return result
		},

		state(pluginId: string): HostPluginStateResult {
			const snap = requireHydrated("state")
			const result = snap.stateByPluginId[pluginId]
			if (result === undefined) {
				return { found: false, pluginId, state: { trust: "unsigned-third-party", sessionScope: "session", grantedTokens: [] }, decision: { pluginId, token: "", granted: false, reason: "unknown", reasonCode: "unknown", risk: "low", knownToHost: false, grantedTokens: [] } }
			}
			return result
		},

		listTools(): HostPluginToolsResult {
			return requireHydrated("listTools").tools
		},

		listPanels(): HostPluginFamilyResult {
			return requireHydrated("listPanels").panels
		},

		listNavSidebars(): HostPluginFamilyResult {
			return requireHydrated("listNavSidebars").navSidebars
		},

		listWidgets(): HostPluginFamilyResult {
			return requireHydrated("listWidgets").widgets
		},

		listCommands(): HostPluginFamilyResult {
			return requireHydrated("listCommands").commands
		},

		listThemes(): HostPluginFamilyResult {
			return requireHydrated("listThemes").themes
		},
	}

	return cache
}
