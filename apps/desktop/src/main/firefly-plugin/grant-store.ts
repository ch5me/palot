/**
 * Firefly Plugin System V2 — capability grant store (P3d, design §7.1)
 *
 * Durable per-scope capability grants back the per-call broker decisions. The
 * store is the SINGLE SOURCE OF TRUTH for explicitly-granted tokens: a token
 * with no `granted` row is not granted (deny-by-default). Built-in policy
 * grants are layered on top by the dispatch resolver, not stored here.
 *
 * `scope` uses the dispatch vocabulary (session | project | app); the design
 * doc's "workspace" maps to "project". An `app`-scoped grant applies in every
 * narrower scope; a session/project grant applies only within its own scope id.
 *
 * C5 — Version-keyed grants:
 *   Grant IDs now embed the plugin version (or `"*"` for version-agnostic rows,
 *   preserving backward compatibility). A v2 update does NOT silently inherit
 *   v1 grants because the primary-key composite changes. On update, call
 *   `revokeAll` / `revokeAllForVersion` so the new consent flow writes fresh
 *   version-scoped rows.
 *
 *   The `resolveGrantedTokens` signature is UNCHANGED for existing callers
 *   (C2/F3/dispatch). Pass `pluginVersion` to filter to a specific version's
 *   rows; omitting it returns all matching-scope grants regardless of version
 *   (the single-version case that was the only case before C5).
 */

import { and, eq, like } from "drizzle-orm"

import { ensureDb } from "../automation/database"
import { extensionCapabilityGrants } from "../automation/schema"
import { defaultGrantResolver, setGrantResolver, type GrantResolver } from "./dispatch"

type GrantDb = Awaited<ReturnType<typeof ensureDb>>

// ---------------------------------------------------------------------------
// Host grant-store singleton — one DB-backed GrantStore shared by the boot
// resolver and the install path. Mirrors the getPluginStorageService pattern.
// ---------------------------------------------------------------------------

let hostGrantStorePromise: Promise<GrantStore> | null = null

/**
 * Lazily construct and cache the single DB-backed GrantStore for the host
 * process. Every caller (boot resolver, install path) shares this one instance
 * so grants written at install time are immediately visible to dispatch.
 *
 * Mirrors `getPluginStorageService()` in host-authority.ts.
 */
export function getHostGrantStore(): Promise<GrantStore> {
	if (!hostGrantStorePromise) {
		hostGrantStorePromise = ensureDb().then((db) => createGrantStore({ db }))
	}
	return hostGrantStorePromise
}

export type GrantScope = "session" | "project" | "app"
export type GrantState = "granted" | "denied" | "prompt-required"
export type GrantedBy = "builtin-policy" | "user" | "admin-policy"

export interface CapabilityGrantRecord {
	readonly pluginId: string
	/**
	 * Semver string of the plugin version this grant is bound to, or `"*"` for
	 * version-agnostic rows written before C5 landed (backward compat).
	 *
	 * C5: omit or pass `"*"` for version-agnostic; pass the exact version string
	 * to bind the grant so a later update does NOT auto-inherit it.
	 */
	readonly pluginVersion?: string
	readonly scope: GrantScope
	readonly scopeId: string | null
	readonly capability: string
	readonly grantState: GrantState
	readonly grantedBy: GrantedBy
	readonly reason: string
	readonly expiresAt: number | null
}

/**
 * Deterministic primary key.
 *
 * Format (C5): `${pluginId}:v:${pluginVersion ?? "*"}:${scope}:${scopeId ?? "*"}:${capability}`
 *
 * The `v:` segment makes the version portion unambiguous in the composite key.
 * `pluginVersion` defaults to `"*"` (version-agnostic) for backward compatibility
 * — existing rows written without a version continue to be resolved.
 */
export function buildGrantId(input: {
	pluginId: string
	pluginVersion?: string
	scope: GrantScope
	scopeId: string | null
	capability: string
}): string {
	const v = input.pluginVersion ?? "*"
	return `${input.pluginId}:v:${v}:${input.scope}:${input.scopeId ?? "*"}:${input.capability}`
}

export interface GrantStore {
	/** Insert or replace a single grant (idempotent on the derived id). */
	upsert(record: CapabilityGrantRecord): Promise<void>
	/** Insert or replace many grants. */
	upsertMany(records: readonly CapabilityGrantRecord[]): Promise<void>
	/** All grant rows for a plugin (any state). */
	listForPlugin(pluginId: string): Promise<CapabilityGrantRecord[]>
	/**
	 * The capability tokens currently GRANTED for a plugin in a scope:
	 * `grantState === "granted"`, not expired, and either the requested scope or
	 * an `app`-scoped grant (which applies everywhere). Deny-by-default — denied
	 * and prompt-required rows never appear here.
	 *
	 * C5: when `pluginVersion` is provided, only rows with a matching version
	 * (or version-agnostic `"*"` rows) are returned. When omitted, all matching-
	 * scope rows are returned regardless of version (the single-version backward-
	 * compat case that C2/F3/dispatch rely on).
	 */
	resolveGrantedTokens(input: {
		pluginId: string
		scope: GrantScope
		scopeId?: string | null
		pluginVersion?: string
		nowMs?: number
	}): Promise<string[]>
	/** Remove one grant row by its composite key. */
	revoke(input: {
		pluginId: string
		pluginVersion?: string
		scope: GrantScope
		scopeId: string | null
		capability: string
	}): Promise<void>
	/**
	 * Revoke ALL grant rows for a plugin (all versions, all scopes, all caps).
	 * Called on uninstall/disable so a later re-install must re-consent.
	 */
	revokeAll(pluginId: string): Promise<void>
	/**
	 * Revoke all grant rows for a specific plugin version.
	 * Called during update to invalidate the old version's grants before writing
	 * fresh rows for the new version.
	 */
	revokeAllForVersion(pluginId: string, pluginVersion: string): Promise<void>
}

/**
 * Build the runtime grant resolver dispatch uses: built-in policy grants
 * (`defaultGrantResolver`) layered with the plugin's persisted user/admin
 * grants for the active scope. Deny-by-default is preserved — only `granted`
 * rows add tokens.
 */
export function createDbGrantResolver(store: GrantStore): GrantResolver {
	return async (input) => {
		const base = defaultGrantResolver(input)
		const persisted = await store.resolveGrantedTokens({ pluginId: input.pluginId, scope: input.sessionScope })
		return [...new Set<string>([...base, ...persisted])]
	}
}

/**
 * Boot wiring: install the DB-backed grant resolver into dispatch. Idempotent
 * to call once at startup. If the DB is unavailable this throws — callers should
 * log and continue, leaving the secure `defaultGrantResolver` (deny-by-default
 * for third-party) in effect rather than masking the failure.
 */
export async function installPluginGrantResolver(deps?: { db?: GrantDb }): Promise<GrantStore> {
	// If a test-injected db is provided, build a fresh store from it (test path).
	// Otherwise resolve via the shared singleton so the boot resolver and the
	// install path share exactly one GrantStore instance.
	const store = deps?.db ? createGrantStore({ db: deps.db }) : await getHostGrantStore()
	setGrantResolver(createDbGrantResolver(store))
	return store
}

export function createGrantStore(deps: { db: GrantDb; now?: () => number }): GrantStore {
	const now = deps.now ?? (() => Date.now())

	function toRow(record: CapabilityGrantRecord) {
		return {
			id: buildGrantId(record),
			pluginId: record.pluginId,
			scope: record.scope,
			scopeId: record.scopeId,
			capability: record.capability,
			grantState: record.grantState,
			grantedBy: record.grantedBy,
			reason: record.reason,
			createdAt: now(),
			expiresAt: record.expiresAt,
		}
	}

	function fromRow(row: typeof extensionCapabilityGrants.$inferSelect): CapabilityGrantRecord {
		// Extract pluginVersion from the id if it follows the C5 format
		// `pluginId:v:version:scope:scopeId:capability`. Legacy rows (pre-C5)
		// have format `pluginId:scope:scopeId:capability` with no `v:` segment.
		const versionFromId = extractVersionFromId(row.id, row.pluginId)
		return {
			pluginId: row.pluginId,
			pluginVersion: versionFromId ?? undefined,
			scope: row.scope as GrantScope,
			scopeId: row.scopeId,
			capability: row.capability,
			grantState: row.grantState as GrantState,
			grantedBy: row.grantedBy as GrantedBy,
			reason: row.reason,
			expiresAt: row.expiresAt,
		}
	}

	async function upsert(record: CapabilityGrantRecord): Promise<void> {
		const row = toRow(record)
		await deps.db
			.insert(extensionCapabilityGrants)
			.values(row)
			.onConflictDoUpdate({
				target: extensionCapabilityGrants.id,
				set: {
					grantState: row.grantState,
					grantedBy: row.grantedBy,
					reason: row.reason,
					expiresAt: row.expiresAt,
					createdAt: row.createdAt,
				},
			})
	}

	return {
		upsert,

		async upsertMany(records) {
			for (const record of records) {
				await upsert(record)
			}
		},

		async listForPlugin(pluginId) {
			const rows = await deps.db
				.select()
				.from(extensionCapabilityGrants)
				.where(eq(extensionCapabilityGrants.pluginId, pluginId))
			return rows.map(fromRow)
		},

		async resolveGrantedTokens(input) {
			const nowMs = input.nowMs ?? now()
			const rows = await deps.db
				.select()
				.from(extensionCapabilityGrants)
				.where(eq(extensionCapabilityGrants.pluginId, input.pluginId))
			const tokens = new Set<string>()
			for (const row of rows) {
				if (row.grantState !== "granted") continue
				if (row.expiresAt !== null && row.expiresAt <= nowMs) continue
				// app-scoped grants apply in every narrower scope; otherwise the
				// scope must match the request.
				if (row.scope !== "app" && row.scope !== input.scope) continue

				// C5 version filter: when pluginVersion is specified, only return
				// grants for that version or version-agnostic ("*") rows.
				if (input.pluginVersion !== undefined) {
					const rowVersion = extractVersionFromId(row.id, row.pluginId)
					if (rowVersion !== null && rowVersion !== "*" && rowVersion !== input.pluginVersion) {
						continue
					}
				}

				tokens.add(row.capability)
			}
			return [...tokens]
		},

		async revoke(input) {
			await deps.db
				.delete(extensionCapabilityGrants)
				.where(
					and(
						eq(extensionCapabilityGrants.id, buildGrantId(input)),
						eq(extensionCapabilityGrants.pluginId, input.pluginId),
					),
				)
		},

		async revokeAll(pluginId) {
			await deps.db
				.delete(extensionCapabilityGrants)
				.where(eq(extensionCapabilityGrants.pluginId, pluginId))
		},

		async revokeAllForVersion(pluginId, pluginVersion) {
			// Use a LIKE prefix to match all rows for this plugin+version combination.
			// C5 id format: `${pluginId}:v:${pluginVersion}:...`
			// The prefix uniquely identifies the version segment because `:v:` is a
			// fixed delimiter (no plugin id or version may contain `:v:`).
			const prefix = `${pluginId}:v:${pluginVersion}:%`
			await deps.db
				.delete(extensionCapabilityGrants)
				.where(
					and(
						eq(extensionCapabilityGrants.pluginId, pluginId),
						like(extensionCapabilityGrants.id, prefix),
					),
				)
		},
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the encoded plugin version from a grant row id.
 *
 * C5 format: `${pluginId}:v:${version}:${scope}:${scopeId}:${capability}`
 * Legacy format (pre-C5): `${pluginId}:${scope}:${scopeId}:${capability}`
 *   (no `v:` segment — identified by the absence of `:v:` after the pluginId).
 *
 * Returns `null` for legacy rows (no version encoded), or the version string
 * (which may be `"*"` for version-agnostic C5 rows).
 */
function extractVersionFromId(id: string, pluginId: string): string | null {
	// C5 ids start with `${pluginId}:v:` — the literal `:v:` sentinel.
	const c5Prefix = `${pluginId}:v:`
	if (!id.startsWith(c5Prefix)) {
		return null // legacy row
	}
	const rest = id.slice(c5Prefix.length)
	// rest = `${version}:${scope}:${scopeId}:${capability}` — version ends at the first `:`
	const colonIdx = rest.indexOf(":")
	if (colonIdx === -1) return null
	return rest.slice(0, colonIdx)
}
