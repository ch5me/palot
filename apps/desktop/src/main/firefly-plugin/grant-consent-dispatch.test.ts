/**
 * C4 — Consent↔dispatch invariant (TEST ONLY, no production edits)
 *
 * Proves the end-to-end invariant: a capability consented at install is present
 * in the resolved grant set and passes the broker; a non-consented declared
 * capability is absent and is broker-denied.
 *
 * Flow under test:
 *   fresh in-memory grant store
 *   → persistInstallGrants for a signed-third-party plugin declaring
 *     ["net:http", "fs:write"] with consentedCapabilities: ["net:http"]
 *   → createDbGrantResolver(store) produces a resolver
 *   → resolveGrantedTokens → net:http present, fs:write absent
 *   → decideCapabilityAll(trust:"signed-third-party")
 *       net:http tokens → granted:true
 *       fs:write tokens → granted:false
 */

import { describe, expect, it } from "bun:test"

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"

import * as schema from "../automation/schema"
import { decideCapabilityAll } from "./capability-broker"
import { createDbGrantResolver, createGrantStore } from "./grant-store"
import { persistInstallGrants } from "./install/install-orchestrator"

async function freshGrantStore() {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return createGrantStore({ db, now: () => 1000 })
}

const PLUGIN_ID = "bobsoft.linter"
const TRUST = "signed-third-party" as const

describe("C4 — consent↔dispatch invariant", () => {
	it("consented capability is granted; non-consented declared capability is denied", async () => {
		// --- Setup: fresh grant store ---
		const store = await freshGrantStore()

		// --- Step 1: persist install grants ---
		// Plugin declares net:http (medium) and fs:write (high).
		// User consented only to net:http.
		await persistInstallGrants({
			grantStore: store,
			pluginId: PLUGIN_ID,
			capabilities: ["net:http", "fs:write"],
			trust: TRUST,
			consentedCapabilities: ["net:http"],
		})

		// --- Step 2: build DB-backed resolver and resolve granted tokens ---
		const resolver = createDbGrantResolver(store)
		const grantedTokens = await resolver({
			pluginId: PLUGIN_ID,
			trust: TRUST,
			declaredCapabilities: ["net:http", "fs:write"],
			sessionScope: "session",
		})

		// net:http was consented → must be in the granted set
		expect(grantedTokens).toContain("net:http")

		// fs:write was declared but NOT consented → must NOT be in the granted set
		expect(grantedTokens).not.toContain("fs:write")

		// --- Step 3: broker decision for net:http (consented, medium risk) ---
		const netHttpBroker = decideCapabilityAll({
			pluginId: PLUGIN_ID,
			trust: TRUST,
			tokens: ["net:http"],
			sessionScope: "session",
			grantedTokens,
		})
		expect(netHttpBroker.granted).toBe(true)
		expect(netHttpBroker.failures).toHaveLength(0)

		// --- Step 4: broker decision for fs:write (declared but not consented, high risk) ---
		const fsWriteBroker = decideCapabilityAll({
			pluginId: PLUGIN_ID,
			trust: TRUST,
			tokens: ["fs:write"],
			sessionScope: "session",
			grantedTokens,
		})
		expect(fsWriteBroker.granted).toBe(false)
		expect(fsWriteBroker.failures.length).toBeGreaterThan(0)
	})

	it("resolved grant rows match expected states in the DB", async () => {
		const store = await freshGrantStore()

		await persistInstallGrants({
			grantStore: store,
			pluginId: PLUGIN_ID,
			capabilities: ["net:http", "fs:write"],
			trust: TRUST,
			consentedCapabilities: ["net:http"],
		})

		const all = await store.listForPlugin(PLUGIN_ID)
		const byCapability = Object.fromEntries(all.map((r) => [r.capability, r.grantState]))

		// net:http consented → granted/user
		expect(byCapability["net:http"]).toBe("granted")
		// fs:write NOT consented → prompt-required
		expect(byCapability["fs:write"]).toBe("prompt-required")
	})

	it("non-consented capability stays denied even when queried through the resolver", async () => {
		const store = await freshGrantStore()

		// Install with NO consented capabilities (both medium+ stay prompt-required)
		await persistInstallGrants({
			grantStore: store,
			pluginId: "acme.linter-no-consent",
			capabilities: ["net:http", "fs:write"],
			trust: TRUST,
			consentedCapabilities: [],
		})

		const resolver = createDbGrantResolver(store)
		const grantedTokens = await resolver({
			pluginId: "acme.linter-no-consent",
			trust: TRUST,
			declaredCapabilities: ["net:http", "fs:write"],
			sessionScope: "app",
		})

		// Neither capability consented → neither granted
		expect(grantedTokens).not.toContain("net:http")
		expect(grantedTokens).not.toContain("fs:write")

		// Broker must deny both
		const broker = decideCapabilityAll({
			pluginId: "acme.linter-no-consent",
			trust: TRUST,
			tokens: ["net:http", "fs:write"],
			sessionScope: "app",
			grantedTokens,
		})
		expect(broker.granted).toBe(false)
	})
})
