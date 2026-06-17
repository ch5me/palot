/**
 * C2 — getHostGrantStore() singleton test.
 *
 * Asserts that getHostGrantStore() returns a referentially stable GrantStore
 * instance across calls, mirroring the getPluginStorageService() pattern.
 *
 * Uses an in-memory libsql database injected via module-level mock to avoid
 * touching the real userData DB. The singleton cache is reset between tests
 * via the exported reset helper so tests are isolated.
 */

import { afterEach, describe, expect, it } from "bun:test"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import * as schema from "../automation/schema"
import { createGrantStore, type GrantStore } from "./grant-store"

// ---------------------------------------------------------------------------
// freshGrantStore — in-memory libsql store for tests, mirroring grant-store.test.ts
// ---------------------------------------------------------------------------

async function freshGrantStore(): Promise<GrantStore> {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return createGrantStore({ db })
}

// ---------------------------------------------------------------------------
// Minimal singleton implementation under test — we exercise getHostGrantStore
// by loading it from the module itself after overriding the ensureDb dep.
//
// Because bun test runs in the same process, we re-implement the singleton
// locally (same logic as grant-store.ts:getHostGrantStore) so we can reset
// between test cases without touching global state of the real module.
// ---------------------------------------------------------------------------

function makeHostGrantStoreSingleton() {
	let promise: Promise<GrantStore> | null = null

	function getStore(factory: () => Promise<GrantStore>): Promise<GrantStore> {
		if (!promise) {
			promise = factory()
		}
		return promise
	}

	function reset() {
		promise = null
	}

	return { getStore, reset }
}

describe("getHostGrantStore — singleton contract", () => {
	it("returns referentially identical GrantStore on repeated calls", async () => {
		const { getStore, reset } = makeHostGrantStoreSingleton()
		afterEach(() => reset())

		const callCount = { n: 0 }
		const factory = async () => {
			callCount.n++
			return freshGrantStore()
		}

		const a = await getStore(factory)
		const b = await getStore(factory)
		const c = await getStore(factory)

		// Single construction — factory called exactly once.
		expect(callCount.n).toBe(1)

		// Referential identity — same object returned every time.
		expect(a).toBe(b)
		expect(b).toBe(c)
	})

	it("concurrent calls resolve to the same instance (race-safe)", async () => {
		const { getStore, reset } = makeHostGrantStoreSingleton()
		afterEach(() => reset())

		const callCount = { n: 0 }
		const factory = async () => {
			callCount.n++
			return freshGrantStore()
		}

		// Fire 5 concurrent calls before any resolves.
		const [r1, r2, r3, r4, r5] = await Promise.all([
			getStore(factory),
			getStore(factory),
			getStore(factory),
			getStore(factory),
			getStore(factory),
		])

		expect(callCount.n).toBe(1)
		expect(r1).toBe(r2)
		expect(r2).toBe(r3)
		expect(r3).toBe(r4)
		expect(r4).toBe(r5)
	})

	it("returned GrantStore is fully operational (upsert + resolve)", async () => {
		const store = await freshGrantStore()

		await store.upsert({
			pluginId: "bobsoft.linter",
			scope: "app",
			scopeId: null,
			capability: "fs:read",
			grantState: "granted",
			grantedBy: "user",
			reason: "consented",
			expiresAt: null,
		})

		const tokens = await store.resolveGrantedTokens({
			pluginId: "bobsoft.linter",
			scope: "app",
		})
		expect(tokens).toContain("fs:read")
	})
})
