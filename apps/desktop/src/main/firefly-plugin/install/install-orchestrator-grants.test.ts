import { describe, expect, it } from "bun:test"

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"

import * as schema from "../../automation/schema"
import { createGrantStore } from "../grant-store"
import { persistInstallGrants } from "./install-orchestrator"

async function freshGrantStore() {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return createGrantStore({ db, now: () => 1000 })
}

describe("persistInstallGrants (install-time consent, P3d)", () => {
	it("no capabilities → no grants persisted (theme installs)", async () => {
		const grantStore = await freshGrantStore()
		const records = await persistInstallGrants({
			grantStore,
			pluginId: "zhuangtongfa.material-theme",
			capabilities: [],
			trust: "unsigned-third-party",
		})
		expect(records).toEqual([])
		expect(await grantStore.listForPlugin("zhuangtongfa.material-theme")).toEqual([])
	})

	it("third-party: auto-grants low-risk, records medium/high as prompt-required", async () => {
		const grantStore = await freshGrantStore()
		// net:https-only=low (auto), net:http=medium, fs:write=high (both consent)
		await persistInstallGrants({
			grantStore,
			pluginId: "acme.codeext",
			capabilities: ["net:https-only", "net:http", "fs:write"],
			trust: "signed-third-party",
		})
		// Only the low-risk capability is actually granted (deny-by-default for the rest).
		expect((await grantStore.resolveGrantedTokens({ pluginId: "acme.codeext", scope: "app" })).sort()).toEqual([
			"net:https-only",
		])
		const all = await grantStore.listForPlugin("acme.codeext")
		const byCap = Object.fromEntries(all.map((r) => [r.capability, r.grantState]))
		expect(byCap).toEqual({
			"net:https-only": "granted",
			"net:http": "prompt-required",
			"fs:write": "prompt-required",
		})
	})

	it("honors user-consented capabilities at install (granted/user)", async () => {
		const grantStore = await freshGrantStore()
		await persistInstallGrants({
			grantStore,
			pluginId: "acme.codeext2",
			capabilities: ["fs:write"],
			trust: "signed-third-party",
			consentedCapabilities: ["fs:write"],
		})
		expect(await grantStore.resolveGrantedTokens({ pluginId: "acme.codeext2", scope: "app" })).toEqual(["fs:write"])
	})
})
