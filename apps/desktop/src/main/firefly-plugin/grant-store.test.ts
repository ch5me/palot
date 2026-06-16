import { describe, expect, it } from "bun:test"

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"

import * as schema from "../automation/schema"
import { createDbGrantResolver, createGrantStore, type CapabilityGrantRecord } from "./grant-store"

async function freshStore(now = 1000) {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return createGrantStore({ db, now: () => now })
}

function grant(over: Partial<CapabilityGrantRecord> & { pluginId: string; capability: string }): CapabilityGrantRecord {
	return {
		scope: "app",
		scopeId: null,
		grantState: "granted",
		grantedBy: "user",
		reason: "",
		expiresAt: null,
		...over,
	}
}

describe("grant-store", () => {
	it("resolves only granted, non-expired tokens (deny-by-default)", async () => {
		const store = await freshStore(1000)
		await store.upsertMany([
			grant({ pluginId: "p.a", capability: "net:http", grantState: "granted" }),
			grant({ pluginId: "p.a", capability: "fs:write", grantState: "denied" }),
			grant({ pluginId: "p.a", capability: "shell:exec", grantState: "prompt-required" }),
			grant({ pluginId: "p.a", capability: "clipboard:read", grantState: "granted", expiresAt: 500 }),
		])
		const tokens = await store.resolveGrantedTokens({ pluginId: "p.a", scope: "session" })
		expect(tokens.sort()).toEqual(["net:http"])
	})

	it("app-scoped grant applies in narrower scopes; project grant does not leak to session", async () => {
		const store = await freshStore()
		await store.upsertMany([
			grant({ pluginId: "p.b", capability: "net:http", scope: "app" }),
			grant({ pluginId: "p.b", capability: "fs:read", scope: "project", scopeId: "proj1" }),
		])
		const session = await store.resolveGrantedTokens({ pluginId: "p.b", scope: "session" })
		expect(session).toEqual(["net:http"])
		const project = await store.resolveGrantedTokens({ pluginId: "p.b", scope: "project" })
		expect(project.sort()).toEqual(["fs:read", "net:http"])
	})

	it("upsert is idempotent on the derived id and revoke removes", async () => {
		const store = await freshStore()
		await store.upsert(grant({ pluginId: "p.c", capability: "net:http", grantState: "prompt-required" }))
		await store.upsert(grant({ pluginId: "p.c", capability: "net:http", grantState: "granted" }))
		expect((await store.listForPlugin("p.c")).length).toBe(1)
		expect(await store.resolveGrantedTokens({ pluginId: "p.c", scope: "app" })).toEqual(["net:http"])
		await store.revoke({ pluginId: "p.c", scope: "app", scopeId: null, capability: "net:http" })
		expect(await store.resolveGrantedTokens({ pluginId: "p.c", scope: "app" })).toEqual([])
	})

	it("db resolver: built-in gets policy baseline; third-party gets only persisted grants", async () => {
		const store = await freshStore()
		await store.upsert(grant({ pluginId: "third.party", capability: "net:http", grantState: "granted" }))
		const resolver = createDbGrantResolver(store)

		const builtin = await resolver({
			pluginId: "firefly.x",
			trust: "built-in",
			declaredCapabilities: ["fs:read"],
			sessionScope: "session",
		})
		expect(builtin).toContain("host:command.register") // baseline
		expect(builtin).toContain("fs:read") // declared non-critical

		const third = await resolver({
			pluginId: "third.party",
			trust: "signed-third-party",
			declaredCapabilities: ["net:http", "fs:write"],
			sessionScope: "session",
		})
		expect(third).toEqual(["net:http"]) // only the persisted grant, deny-by-default otherwise
	})
})
