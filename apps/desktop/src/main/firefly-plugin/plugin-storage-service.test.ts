/**
 * Tests for plugin-storage-service.ts (P3e)
 *
 * Uses a real in-memory libsql db with migrations run against ./drizzle so
 * the table structure matches production exactly.
 */

import { describe, it, expect, beforeEach } from "bun:test"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import * as schema from "../automation/schema"
import { SCOPE_DEFAULT_QUOTAS } from "../../shared/firefly-plugin/storage-scopes"
import { createPluginStorageService, PluginStorageError } from "./plugin-storage-service"
import type { IPluginStorageService } from "./plugin-storage-service"

// ---------------------------------------------------------------------------
// Fake crypto: base64 encode/decode so tests don't need Electron safeStorage.
// ---------------------------------------------------------------------------
const encryptSecret = (plaintext: string): string =>
	Buffer.from(plaintext).toString("base64")

const decryptSecret = (b64: string): string =>
	Buffer.from(b64, "base64").toString("utf8")

// ---------------------------------------------------------------------------
// In-memory db setup
// ---------------------------------------------------------------------------

async function makeDb() {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return db
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("PluginStorageService", () => {
	let service: IPluginStorageService

	beforeEach(async () => {
		const db = await makeDb()
		service = createPluginStorageService({ db, encryptSecret, decryptSecret })
	})

	// -----------------------------------------------------------------------
	// Normal KV: set/get round-trip
	// -----------------------------------------------------------------------
	it("set/get round-trip for an object value in scope 'project'", async () => {
		const input = {
			pluginId: "test.plugin",
			scope: "project" as const,
			scopeId: "proj-1",
			key: "myKey",
		}
		const value = { count: 42, label: "hello" }

		await service.set({ ...input, value })
		const result = await service.get(input)
		expect(result).toEqual(value)
	})

	// -----------------------------------------------------------------------
	// get of missing key → undefined
	// -----------------------------------------------------------------------
	it("get of a missing key returns undefined", async () => {
		const result = await service.get({
			pluginId: "test.plugin",
			scope: "project" as const,
			scopeId: "proj-1",
			key: "nonexistent",
		})
		expect(result).toBeUndefined()
	})

	// -----------------------------------------------------------------------
	// list returns set keys, excluding secrets
	// -----------------------------------------------------------------------
	it("list returns keys that were set and excludes secrets", async () => {
		const base = { pluginId: "p", scope: "session" as const, scopeId: "s1" }

		await service.set({ ...base, key: "a", value: 1 })
		await service.set({ ...base, key: "b", value: 2 })
		// Set a secret — should NOT appear in list.
		await service.setSecret({ pluginId: "p", key: "secretKey", value: "shhh" })

		const keys = await service.list(base)
		expect(keys.sort()).toEqual(["a", "b"])
	})

	// -----------------------------------------------------------------------
	// delete removes the key
	// -----------------------------------------------------------------------
	it("delete removes the entry", async () => {
		const input = {
			pluginId: "del.plugin",
			scope: "app" as const,
			scopeId: "app",
			key: "toDelete",
		}
		await service.set({ ...input, value: "bye" })
		expect(await service.get(input)).toBe("bye")

		await service.delete(input)
		expect(await service.get(input)).toBeUndefined()

		const keys = await service.list({ pluginId: input.pluginId, scope: input.scope, scopeId: input.scopeId })
		expect(keys).not.toContain("toDelete")
	})

	// -----------------------------------------------------------------------
	// Quota — over limit on new key throws; update does not
	// -----------------------------------------------------------------------
	it("quota: setting SCOPE_DEFAULT_QUOTAS.app+1 distinct NEW keys in 'app' scope throws quota_exceeded", async () => {
		const quota = SCOPE_DEFAULT_QUOTAS.app
		const base = { pluginId: "quota.plugin", scope: "app" as const, scopeId: "app" }

		// Fill up exactly to quota.
		for (let i = 0; i < quota; i++) {
			await service.set({ ...base, key: `key-${i}`, value: i })
		}

		// One more NEW key should throw.
		let caughtErr: unknown
		try {
			await service.set({ ...base, key: "key-over-quota", value: "boom" })
		} catch (e) {
			caughtErr = e
		}
		expect(caughtErr).toBeInstanceOf(PluginStorageError)
		expect((caughtErr as PluginStorageError).code).toBe("quota_exceeded")
	})

	it("quota: updating an existing key does not throw even when at quota", async () => {
		const quota = SCOPE_DEFAULT_QUOTAS.app
		const base = { pluginId: "quota2.plugin", scope: "app" as const, scopeId: "app" }

		for (let i = 0; i < quota; i++) {
			await service.set({ ...base, key: `key-${i}`, value: i })
		}

		// Update an existing key — must not throw.
		await expect(
			service.set({ ...base, key: "key-0", value: "updated" }),
		).resolves.toBeUndefined()
	})

	// -----------------------------------------------------------------------
	// Secret: set/get/delete round-trip
	// -----------------------------------------------------------------------
	it("setSecret/getSecret/deleteSecret round-trip", async () => {
		const input = { pluginId: "secret.plugin", key: "apiKey" }

		await service.setSecret({ ...input, value: "super-secret-value" })
		expect(await service.getSecret(input)).toBe("super-secret-value")

		await service.deleteSecret(input)
		expect(await service.getSecret(input)).toBeUndefined()
	})

	it("getSecret for missing key returns undefined", async () => {
		const result = await service.getSecret({ pluginId: "no.plugin", key: "missing" })
		expect(result).toBeUndefined()
	})

	// -----------------------------------------------------------------------
	// Secret-unavailable path: encryptSecret throws → setSecret rejects with
	// PluginStorageError code "secret_unavailable"
	// -----------------------------------------------------------------------
	it("setSecret rejects with secret_unavailable when encryptSecret throws", async () => {
		const db = await makeDb()
		const unavailableService = createPluginStorageService({
			db,
			encryptSecret: () => {
				throw new PluginStorageError(
					"secret_unavailable",
					"secret storage unavailable: safeStorage encryption is not available on this platform",
				)
			},
			decryptSecret,
		})

		let caughtErr: unknown
		try {
			await unavailableService.setSecret({ pluginId: "p", key: "k", value: "v" })
		} catch (e) {
			caughtErr = e
		}
		expect(caughtErr).toBeInstanceOf(PluginStorageError)
		expect((caughtErr as PluginStorageError).code).toBe("secret_unavailable")
	})
})
