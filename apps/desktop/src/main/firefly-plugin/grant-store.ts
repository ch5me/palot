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
 */

import { and, eq } from "drizzle-orm"

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
	readonly scope: GrantScope
	readonly scopeId: string | null
	readonly capability: string
	readonly grantState: GrantState
	readonly grantedBy: GrantedBy
	readonly reason: string
	readonly expiresAt: number | null
}

/** Deterministic primary key. `scopeId` null collapses to `*` (any scope). */
export function buildGrantId(input: {
	pluginId: string
	scope: GrantScope
	scopeId: string | null
	capability: string
}): string {
	return `${input.pluginId}:${input.scope}:${input.scopeId ?? "*"}:${input.capability}`
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
	 */
	resolveGrantedTokens(input: { pluginId: string; scope: GrantScope; scopeId?: string | null; nowMs?: number }): Promise<string[]>
	/** Remove one grant row. */
	revoke(input: { pluginId: string; scope: GrantScope; scopeId: string | null; capability: string }): Promise<void>
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
		return {
			pluginId: row.pluginId,
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
	}
}
