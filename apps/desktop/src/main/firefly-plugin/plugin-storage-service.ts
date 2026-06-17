/**
 * Firefly Plugin System V2 — Plugin Storage Service (P3e)
 *
 * Host-owned durable key-value and secret storage for plugins. The host is
 * the sole source of truth; plugin worker memory is cache only.
 *
 * Backed by the `plugin_storage_entries` Drizzle/libsql table.
 *
 * Architecture:
 *   - Injected-dependency design: accepts `db` as a constructor param so
 *     tests can pass an in-memory db without touching the real file.
 *   - Normal KV: JSON-encoded value; upsert on composite id.
 *   - Secrets: Electron `safeStorage` (lazy-required so importing this module
 *     never needs Electron in tests); stored with scope="app", scopeId="app",
 *     isSecret=true. ZERO plaintext fallback — fail loud if safeStorage is
 *     unavailable (CH5 "fail fast, no silent fallback" policy).
 *   - Quota: max distinct keys per (pluginId, scope, scopeId) from
 *     SCOPE_DEFAULT_QUOTAS; enforced only on NEW key creation.
 */

import { and, count, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "../automation/schema"
import { pluginStorageEntries } from "../automation/schema"
import { type StorageScope, SCOPE_DEFAULT_QUOTAS } from "../../shared/firefly-plugin/storage-scopes"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Db = ReturnType<typeof drizzle<typeof schema>>

export interface IPluginStorageService {
	get(input: {
		pluginId: string
		scope: StorageScope
		scopeId: string
		key: string
	}): Promise<unknown | undefined>

	set(input: {
		pluginId: string
		scope: StorageScope
		scopeId: string
		key: string
		value: unknown
	}): Promise<void>

	delete(input: {
		pluginId: string
		scope: StorageScope
		scopeId: string
		key: string
	}): Promise<void>

	/** Returns the list of non-secret keys for the given (pluginId, scope, scopeId). */
	list(input: {
		pluginId: string
		scope: StorageScope
		scopeId: string
	}): Promise<string[]>

	getSecret(input: { pluginId: string; key: string }): Promise<string | undefined>

	setSecret(input: { pluginId: string; key: string; value: string }): Promise<void>

	deleteSecret(input: { pluginId: string; key: string }): Promise<void>
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class PluginStorageError extends Error {
	readonly code: string

	constructor(code: string, message: string) {
		super(message)
		this.name = "PluginStorageError"
		this.code = code
	}
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface PluginStorageServiceDeps {
	db: Db
	/** Override encryption (default: Electron safeStorage). Test injection. */
	encryptSecret?: (plaintext: string) => string
	/** Override decryption (default: Electron safeStorage). Test injection. */
	decryptSecret?: (ciphertextB64: string) => string
	/** Override current timestamp for updatedAt. */
	now?: () => number
}

// ---------------------------------------------------------------------------
// Default secret handlers — lazy-require electron so the module is
// importable in non-Electron contexts (tests, build-time analysis).
// ---------------------------------------------------------------------------

function defaultEncryptSecret(plaintext: string): string {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { safeStorage } = require("electron") as typeof import("electron")
	if (!safeStorage.isEncryptionAvailable()) {
		throw new PluginStorageError(
			"secret_unavailable",
			"secret storage unavailable: safeStorage encryption is not available on this platform",
		)
	}
	return safeStorage.encryptString(plaintext).toString("base64")
}

function defaultDecryptSecret(ciphertextB64: string): string {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { safeStorage } = require("electron") as typeof import("electron")
	if (!safeStorage.isEncryptionAvailable()) {
		throw new PluginStorageError(
			"secret_unavailable",
			"secret storage unavailable: safeStorage encryption is not available on this platform",
		)
	}
	return safeStorage.decryptString(Buffer.from(ciphertextB64, "base64"))
}

// ---------------------------------------------------------------------------
// Row id helpers
// ---------------------------------------------------------------------------

function makeId(pluginId: string, scope: string, scopeId: string, key: string): string {
	return `${pluginId}:${scope}:${scopeId}:${key}`
}

const SECRET_SCOPE = "app" satisfies StorageScope
const SECRET_SCOPE_ID = "app"

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createPluginStorageService(deps: PluginStorageServiceDeps): IPluginStorageService {
	const { db } = deps
	const encryptSecret = deps.encryptSecret ?? defaultEncryptSecret
	const decryptSecret = deps.decryptSecret ?? defaultDecryptSecret
	const now = deps.now ?? (() => Date.now())

	return {
		// -----------------------------------------------------------------------
		// get
		// -----------------------------------------------------------------------
		async get({ pluginId, scope, scopeId, key }) {
			const id = makeId(pluginId, scope, scopeId, key)
			const rows = await db
				.select()
				.from(pluginStorageEntries)
				.where(and(eq(pluginStorageEntries.id, id), eq(pluginStorageEntries.isSecret, false)))
				.limit(1)
			const row = rows[0]
			if (!row) return undefined
			return JSON.parse(row.value) as unknown
		},

		// -----------------------------------------------------------------------
		// set
		// -----------------------------------------------------------------------
		async set({ pluginId, scope, scopeId, key, value }) {
			const id = makeId(pluginId, scope, scopeId, key)

			// Quota check: only applies to NEW keys (not updates of existing ones).
			const existing = await db
				.select({ id: pluginStorageEntries.id })
				.from(pluginStorageEntries)
				.where(and(eq(pluginStorageEntries.id, id), eq(pluginStorageEntries.isSecret, false)))
				.limit(1)

			if (existing.length === 0) {
				// New key — check quota.
				const result = await db
					.select({ n: count() })
					.from(pluginStorageEntries)
					.where(
						and(
							eq(pluginStorageEntries.pluginId, pluginId),
							eq(pluginStorageEntries.scope, scope),
							eq(pluginStorageEntries.scopeId, scopeId),
							eq(pluginStorageEntries.isSecret, false),
						),
					)
				const currentCount = result[0]?.n ?? 0
				const quota = SCOPE_DEFAULT_QUOTAS[scope]
				if (currentCount >= quota) {
					throw new PluginStorageError(
						"quota_exceeded",
						`Plugin "${pluginId}" has reached the key quota (${quota}) for scope "${scope}"`,
					)
				}
			}

			await db
				.insert(pluginStorageEntries)
				.values({
					id,
					pluginId,
					scope,
					scopeId,
					key,
					value: JSON.stringify(value),
					isSecret: false,
					updatedAt: now(),
				})
				.onConflictDoUpdate({
					target: pluginStorageEntries.id,
					set: {
						value: JSON.stringify(value),
						updatedAt: now(),
					},
				})
		},

		// -----------------------------------------------------------------------
		// delete
		// -----------------------------------------------------------------------
		async delete({ pluginId, scope, scopeId, key }) {
			const id = makeId(pluginId, scope, scopeId, key)
			await db
				.delete(pluginStorageEntries)
				.where(and(eq(pluginStorageEntries.id, id), eq(pluginStorageEntries.isSecret, false)))
		},

		// -----------------------------------------------------------------------
		// list — returns non-secret keys for (pluginId, scope, scopeId)
		// -----------------------------------------------------------------------
		async list({ pluginId, scope, scopeId }) {
			const rows = await db
				.select({ key: pluginStorageEntries.key })
				.from(pluginStorageEntries)
				.where(
					and(
						eq(pluginStorageEntries.pluginId, pluginId),
						eq(pluginStorageEntries.scope, scope),
						eq(pluginStorageEntries.scopeId, scopeId),
						eq(pluginStorageEntries.isSecret, false),
					),
				)
			return rows.map((r) => r.key)
		},

		// -----------------------------------------------------------------------
		// getSecret
		// -----------------------------------------------------------------------
		async getSecret({ pluginId, key }) {
			const id = makeId(pluginId, SECRET_SCOPE, SECRET_SCOPE_ID, key)
			const rows = await db
				.select()
				.from(pluginStorageEntries)
				.where(and(eq(pluginStorageEntries.id, id), eq(pluginStorageEntries.isSecret, true)))
				.limit(1)
			const row = rows[0]
			if (!row) return undefined
			return decryptSecret(row.value)
		},

		// -----------------------------------------------------------------------
		// setSecret
		// -----------------------------------------------------------------------
		async setSecret({ pluginId, key, value }) {
			const id = makeId(pluginId, SECRET_SCOPE, SECRET_SCOPE_ID, key)
			const encrypted = encryptSecret(value)
			await db
				.insert(pluginStorageEntries)
				.values({
					id,
					pluginId,
					scope: SECRET_SCOPE,
					scopeId: SECRET_SCOPE_ID,
					key,
					value: encrypted,
					isSecret: true,
					updatedAt: now(),
				})
				.onConflictDoUpdate({
					target: pluginStorageEntries.id,
					set: {
						value: encrypted,
						updatedAt: now(),
					},
				})
		},

		// -----------------------------------------------------------------------
		// deleteSecret
		// -----------------------------------------------------------------------
		async deleteSecret({ pluginId, key }) {
			const id = makeId(pluginId, SECRET_SCOPE, SECRET_SCOPE_ID, key)
			await db
				.delete(pluginStorageEntries)
				.where(and(eq(pluginStorageEntries.id, id), eq(pluginStorageEntries.isSecret, true)))
		},
	}
}
