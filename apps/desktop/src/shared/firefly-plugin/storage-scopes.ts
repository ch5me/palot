/**
 * Firefly Plugin System V2 — Storage and state scopes
 *
 * Defines the four scopes (session, project, app, global-profile) from the
 * V2 plan and encodes the host-owned vs plugin-owned boundary for
 * durable storage. The helpers here are pure: they do not read or write
 * the filesystem, and they never let plugin worker memory become a
 * source of truth.
 *
 * Host-owned durable storage paths (resolved by the runtime layer; the
 * shape is what the pipeline consults):
 *   - session scope: per-session key-value store keyed by session id
 *   - project scope: per-project key-value store keyed by project id
 *   - app scope: host-wide key-value store (e.g. preferences, grants)
 *   - global-profile: optional future cross-project profile scope
 *
 * Plugin-owned transient storage is restricted to worker memory. The
 * host treats plugin memory as cache; the only durable source of truth
 * is the host's typed stores.
 */

import { z } from "zod"

/**
 * Locked scope vocabulary. Matches the V2 plan's "Scope taxonomy" section.
 * Each scope owns its own durability, lifetime, and operator visibility.
 */
export const STORAGE_SCOPES = ["session", "project", "app", "global-profile"] as const
export type StorageScope = (typeof STORAGE_SCOPES)[number]

export const storageScopeSchema = z.enum(STORAGE_SCOPES)

/**
 * Default quota per scope, expressed as a soft cap on the number of
 * distinct keys a single plugin may write. The host enforces these as
 * warnings rather than hard blocks; hard blocks live in the capability
 * broker.
 */
export const SCOPE_DEFAULT_QUOTAS: Readonly<Record<StorageScope, number>> = {
	session: 256,
	project: 512,
	app: 64,
	"global-profile": 16,
}

/**
 * Owner classification. Durable storage is split between what the host
 * owns (typed stores, persisted across restarts) and what the plugin
 * owns (worker memory, lost on teardown).
 */
export const storageOwnerSchema = z.enum(["host", "plugin"])
export type StorageOwner = z.infer<typeof storageOwnerSchema>

/**
 * Persistence semantics. `durable` survives restarts; `transient` is
 * wiped on worker teardown; `restored` is durable AND the host
 * automatically rehydrates it on the next activation.
 */
export const persistenceModeSchema = z.enum(["durable", "transient", "restored"])
export type PersistenceMode = z.infer<typeof persistenceModeSchema>

/**
 * Lifecycle behavior. Each scope declares what happens to its stored
 * values when a plugin is disabled, uninstalled, or hot-reloaded.
 */
export const lifecycleBehaviorSchema = z.enum([
	"preserve",
	"archive",
	"purge",
])
export type LifecycleBehavior = z.infer<typeof lifecycleBehaviorSchema>

/**
 * The locked contract for one storage scope.
 */
export const storageScopeContractSchema = z
	.object({
		scope: storageScopeSchema,
		owner: storageOwnerSchema,
		persistence: persistenceModeSchema,
		disableBehavior: lifecycleBehaviorSchema,
		uninstallBehavior: lifecycleBehaviorSchema,
		hotReloadBehavior: lifecycleBehaviorSchema,
		defaultQuota: z.number().int().positive(),
	})
	.strict()
export type StorageScopeContract = z.infer<typeof storageScopeContractSchema>

/**
 * The full storage contract table. Append-only — never mutate prior
 * rows. Downstream code may add new scopes by appending a new entry
 * rather than editing this object.
 */
export const STORAGE_SCOPE_CONTRACTS = {
	session: {
		scope: "session" as const,
		owner: "host" as const,
		persistence: "restored" as const,
		disableBehavior: "purge" as const,
		uninstallBehavior: "purge" as const,
		hotReloadBehavior: "preserve" as const,
		defaultQuota: SCOPE_DEFAULT_QUOTAS.session,
	},
	project: {
		scope: "project" as const,
		owner: "host" as const,
		persistence: "durable" as const,
		disableBehavior: "archive" as const,
		uninstallBehavior: "purge" as const,
		hotReloadBehavior: "preserve" as const,
		defaultQuota: SCOPE_DEFAULT_QUOTAS.project,
	},
	app: {
		scope: "app" as const,
		owner: "host" as const,
		persistence: "durable" as const,
		disableBehavior: "archive" as const,
		uninstallBehavior: "purge" as const,
		hotReloadBehavior: "preserve" as const,
		defaultQuota: SCOPE_DEFAULT_QUOTAS.app,
	},
	"global-profile": {
		scope: "global-profile" as const,
		owner: "host" as const,
		persistence: "durable" as const,
		disableBehavior: "preserve" as const,
		uninstallBehavior: "archive" as const,
		hotReloadBehavior: "preserve" as const,
		defaultQuota: SCOPE_DEFAULT_QUOTAS["global-profile"],
	},
} as const satisfies Readonly<Record<StorageScope, StorageScopeContract>>

/**
 * All scope contracts in locked precedence order. The host iterates
 * this list when it needs to walk every scope for a given plugin.
 */
export const ALL_STORAGE_SCOPE_CONTRACTS: readonly StorageScopeContract[] = [
	STORAGE_SCOPE_CONTRACTS.session,
	STORAGE_SCOPE_CONTRACTS.project,
	STORAGE_SCOPE_CONTRACTS.app,
	STORAGE_SCOPE_CONTRACTS["global-profile"],
]

/**
 * Keying shape for the host stores. Each scope has its own
 * keying rule; the runtime layer is responsible for resolving the
 * per-scope identifier (session id, project id, app install id, profile
 * id) before constructing a `StoreKey`.
 */
export const storeKeySchema = z
	.object({
		scope: storageScopeSchema,
		scopeId: z.string().min(1).max(160),
		pluginId: z.string().min(1).max(160),
		key: z.string().min(1).max(160),
	})
	.strict()
export type StoreKey = z.infer<typeof storeKeySchema>

/**
 * Build a `StoreKey` with a static shape. Pure & deterministic.
 */
export function buildStoreKey(input: {
	scope: StorageScope
	scopeId: string
	pluginId: string
	key: string
}): StoreKey {
	return {
		scope: input.scope,
		scopeId: input.scopeId,
		pluginId: input.pluginId,
		key: input.key,
	}
}

/**
 * A typed value entry. Plugins can opt into value-shape validation by
 * providing a Zod schema at write time. The host validates and rejects
 * invalid writes; the audit log records the rejection.
 */
export const storageValueEntrySchema = z
	.object({
		key: storeKeySchema,
		value: z.unknown(),
		persistedAt: z.number().int().nonnegative(),
		owner: storageOwnerSchema,
	})
	.strict()
export type StorageValueEntry = z.infer<typeof storageValueEntrySchema>

/**
 * The host's durable storage policy for a single plugin. The runtime
 * builds one of these from `STORAGE_SCOPE_CONTRACTS` and the plugin's
 * declared write intent, then enforces it on every store call.
 */
export const pluginStoragePolicySchema = z
	.object({
		pluginId: z.string().min(1).max(160),
		scopes: z
			.array(
				z
					.object({
						scope: storageScopeSchema,
						contract: storageScopeContractSchema,
						quota: z.number().int().positive(),
					})
					.strict(),
			)
			.min(1),
		allowCrossScopeReads: z.boolean().default(false),
	})
	.strict()
export type PluginStoragePolicy = z.infer<typeof pluginStoragePolicySchema>

/**
 * Build a `PluginStoragePolicy` from a plugin id and the set of scopes
 * the plugin declares it needs. The default quota is inherited from
 * `STORAGE_SCOPE_CONTRACTS`; callers may override per plugin.
 */
export function buildPluginStoragePolicy(input: {
	pluginId: string
	scopes: readonly StorageScope[]
	quotaOverrides?: Partial<Record<StorageScope, number>>
	allowCrossScopeReads?: boolean
}): PluginStoragePolicy {
	return {
		pluginId: input.pluginId,
		scopes: input.scopes.map((scope) => {
			const contract = STORAGE_SCOPE_CONTRACTS[scope]
			return {
				scope,
				contract,
				quota: input.quotaOverrides?.[scope] ?? contract.defaultQuota,
			}
		}),
		allowCrossScopeReads: input.allowCrossScopeReads ?? false,
	}
}

/**
 * Determine the lifecycle behavior a storage key should follow when a
 * given event happens to the owning plugin. Returns the locked
 * contract row verbatim so callers do not re-derive the answer.
 */
export function resolveStorageLifecycleAction(
	scope: StorageScope,
	event: "disable" | "uninstall" | "hotReload",
): LifecycleBehavior {
	const contract = STORAGE_SCOPE_CONTRACTS[scope]
	switch (event) {
		case "disable":
			return contract.disableBehavior
		case "uninstall":
			return contract.uninstallBehavior
		case "hotReload":
			return contract.hotReloadBehavior
	}
}

/**
 * Decide whether the host should consider a stored value durable
 * truth. Returns `true` only for `durable` or `restored` persistence
 * modes. `transient` is explicitly excluded so plugin worker memory
 * never becomes a source of truth.
 */
export function isStorageValueDurable(persistence: PersistenceMode): boolean {
	return persistence === "durable" || persistence === "restored"
}
