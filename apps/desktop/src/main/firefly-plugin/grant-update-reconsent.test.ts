/**
 * C5 — Grant versioning + re-consent on update + revoke on uninstall/disable.
 *
 * Spec (from §3 Stream C, C5):
 *   - Install v1 consenting net:http → install v2 redeclaring net:http
 *     → grant is NOT auto-inherited without re-consent.
 *   - Uninstall revokes all rows.
 *   - Re-install re-consents (fresh rows).
 */

import { describe, expect, it } from "bun:test"

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"

import * as schema from "../automation/schema"
import { buildGrantId, createGrantStore, type CapabilityGrantRecord } from "./grant-store"
import {
	computeInstallConsentPlan,
	computeUpdateConsentPlan,
	consentPlanToGrantRecords,
	updateRequiresConsent,
} from "./install-consent"

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function freshStore() {
	const client = createClient({ url: ":memory:" })
	const db = drizzle({ client, schema })
	await migrate(db, { migrationsFolder: "./drizzle" })
	return createGrantStore({ db })
}

/** Simulate installing a plugin version with explicit consent for some caps. */
async function simulateInstall(opts: {
	store: Awaited<ReturnType<typeof freshStore>>
	pluginId: string
	pluginVersion: string
	capabilities: readonly string[]
	consentedCapabilities?: readonly string[]
	trust?: "signed-third-party" | "built-in"
}): Promise<CapabilityGrantRecord[]> {
	const plan = computeInstallConsentPlan({
		capabilities: opts.capabilities,
		trust: opts.trust ?? "signed-third-party",
	})
	const records = consentPlanToGrantRecords({
		plan,
		pluginId: opts.pluginId,
		pluginVersion: opts.pluginVersion,
		scope: "app",
		scopeId: null,
		consentedCapabilities: opts.consentedCapabilities,
	})
	await opts.store.upsertMany(records)
	return records
}

// ---------------------------------------------------------------------------
// C5: Version-keyed grant IDs
// ---------------------------------------------------------------------------

describe("buildGrantId — C5 version binding", () => {
	it("includes version in the id so v1 and v2 grants are distinct keys", () => {
		const v1 = buildGrantId({
			pluginId: "bobsoft.linter",
			pluginVersion: "1.0.0",
			scope: "app",
			scopeId: null,
			capability: "net:http",
		})
		const v2 = buildGrantId({
			pluginId: "bobsoft.linter",
			pluginVersion: "2.0.0",
			scope: "app",
			scopeId: null,
			capability: "net:http",
		})
		const vStar = buildGrantId({
			pluginId: "bobsoft.linter",
			scope: "app",
			scopeId: null,
			capability: "net:http",
		})

		expect(v1).not.toBe(v2)
		expect(v1).not.toBe(vStar)
		// v* (no version) encodes "*"
		expect(vStar).toContain(":v:*:")
		// v1 encodes "1.0.0"
		expect(v1).toContain(":v:1.0.0:")
		// v2 encodes "2.0.0"
		expect(v2).toContain(":v:2.0.0:")
	})

	it("default (no pluginVersion) produces version-agnostic '*' id", () => {
		const id = buildGrantId({
			pluginId: "p.x",
			scope: "session",
			scopeId: "s1",
			capability: "fs:read",
		})
		expect(id).toBe("p.x:v:*:session:s1:fs:read")
	})
})

// ---------------------------------------------------------------------------
// C5: v1 grants are NOT auto-inherited by v2
// ---------------------------------------------------------------------------

describe("grant versioning — v1 grant does not satisfy v2 resolution", () => {
	it("v1 net:http grant is NOT visible when resolving for v2", async () => {
		const store = await freshStore()
		const pluginId = "bobsoft.linter"

		// Install v1, consenting net:http (medium risk → user-granted)
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})

		// Resolve for v1: should see net:http
		const v1Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "1.0.0",
		})
		expect(v1Tokens).toContain("net:http")

		// Resolve for v2 (no v2 grants written yet): should NOT see net:http
		const v2Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "2.0.0",
		})
		expect(v2Tokens).not.toContain("net:http")
	})

	it("v2 grants are NOT visible when resolving for v1", async () => {
		const store = await freshStore()
		const pluginId = "p.versioned"

		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "2.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})

		const v1Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "1.0.0",
		})
		expect(v1Tokens).not.toContain("net:http")
	})

	it("version-agnostic ('*') grants are visible to all version resolution calls", async () => {
		const store = await freshStore()
		const pluginId = "p.legacy"

		// Write a version-agnostic grant (no pluginVersion → "*")
		await store.upsert({
			pluginId,
			scope: "app",
			scopeId: null,
			capability: "fs:read",
			grantState: "granted",
			grantedBy: "user",
			reason: "legacy grant",
			expiresAt: null,
		})

		// Should appear for any version request (backward compat)
		const v1 = await store.resolveGrantedTokens({ pluginId, scope: "app", pluginVersion: "1.0.0" })
		const v2 = await store.resolveGrantedTokens({ pluginId, scope: "app", pluginVersion: "2.0.0" })
		const noVersion = await store.resolveGrantedTokens({ pluginId, scope: "app" })

		expect(v1).toContain("fs:read")
		expect(v2).toContain("fs:read")
		expect(noVersion).toContain("fs:read")
	})
})

// ---------------------------------------------------------------------------
// C5: Install → update → re-consent flow
// ---------------------------------------------------------------------------

describe("install v1 → install v2 → grant not auto-inherited", () => {
	it("after installing v1 with consent, v2 resolveGrantedTokens (version-scoped) returns empty", async () => {
		const store = await freshStore()
		const pluginId = "bobsoft.linter"

		// v1 install: user consents net:http
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})

		// v2 is now being installed. Before re-consent, revoke old version grants.
		await store.revokeAllForVersion(pluginId, "1.0.0")

		// v2 install: no consentedCapabilities yet (re-consent not done)
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "2.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: [], // no consent yet
		})

		// net:http should be prompt-required (not granted) for v2
		const v2Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "2.0.0",
		})
		expect(v2Tokens).not.toContain("net:http")

		// v1 grants are gone too (we revoked them)
		const v1Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "1.0.0",
		})
		expect(v1Tokens).not.toContain("net:http")
	})

	it("after re-consent on v2, net:http is granted for v2 only", async () => {
		const store = await freshStore()
		const pluginId = "bobsoft.linter"

		// v1 install with consent
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})

		// Update: revoke v1, install v2 with fresh consent
		await store.revokeAllForVersion(pluginId, "1.0.0")
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "2.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"], // user re-consented
		})

		const v2Tokens = await store.resolveGrantedTokens({
			pluginId,
			scope: "app",
			pluginVersion: "2.0.0",
		})
		expect(v2Tokens).toContain("net:http")

		// v1 rows are gone
		const allRows = await store.listForPlugin(pluginId)
		const v1Rows = allRows.filter((r) => r.pluginVersion === "1.0.0")
		expect(v1Rows.length).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// C5: Uninstall revokes all rows
// ---------------------------------------------------------------------------

describe("uninstall — revokeAll removes all grant rows", () => {
	it("revokeAll removes rows for all versions", async () => {
		const store = await freshStore()
		const pluginId = "bobsoft.linter"

		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http", "fs:read"],
			consentedCapabilities: ["net:http"],
		})
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "2.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})

		const beforeRevoke = await store.listForPlugin(pluginId)
		expect(beforeRevoke.length).toBeGreaterThan(0)

		await store.revokeAll(pluginId)

		const afterRevoke = await store.listForPlugin(pluginId)
		expect(afterRevoke.length).toBe(0)
	})

	it("revokeAll does not affect other plugins", async () => {
		const store = await freshStore()

		await simulateInstall({
			store,
			pluginId: "plugin.a",
			pluginVersion: "1.0.0",
			capabilities: ["fs:read"],
		})
		await simulateInstall({
			store,
			pluginId: "plugin.b",
			pluginVersion: "1.0.0",
			capabilities: ["fs:read"],
		})

		await store.revokeAll("plugin.a")

		expect(await store.listForPlugin("plugin.a")).toHaveLength(0)
		expect(await store.listForPlugin("plugin.b")).not.toHaveLength(0)
	})

	it("re-install after revokeAll requires fresh consent", async () => {
		const store = await freshStore()
		const pluginId = "bobsoft.linter"

		// Install + consent
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: ["net:http"],
		})
		expect(await store.resolveGrantedTokens({ pluginId, scope: "app", pluginVersion: "1.0.0" })).toContain("net:http")

		// Uninstall
		await store.revokeAll(pluginId)
		expect(await store.listForPlugin(pluginId)).toHaveLength(0)

		// Re-install same version, no consent yet
		await simulateInstall({
			store,
			pluginId,
			pluginVersion: "1.0.0",
			capabilities: ["net:http"],
			consentedCapabilities: [],
		})

		// net:http should be prompt-required again (not granted)
		const tokens = await store.resolveGrantedTokens({ pluginId, scope: "app", pluginVersion: "1.0.0" })
		expect(tokens).not.toContain("net:http")
	})
})

// ---------------------------------------------------------------------------
// C5: revokeAllForVersion — version-scoped revoke
// ---------------------------------------------------------------------------

describe("revokeAllForVersion — only affects the specified version", () => {
	it("revokeAllForVersion leaves other versions intact", async () => {
		const store = await freshStore()
		const pluginId = "p.multi"

		await simulateInstall({ store, pluginId, pluginVersion: "1.0.0", capabilities: ["fs:read"] })
		await simulateInstall({ store, pluginId, pluginVersion: "2.0.0", capabilities: ["fs:read"] })

		await store.revokeAllForVersion(pluginId, "1.0.0")

		const remaining = await store.listForPlugin(pluginId)
		expect(remaining.every((r) => r.pluginVersion !== "1.0.0")).toBe(true)
		expect(remaining.some((r) => r.pluginVersion === "2.0.0")).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// C5: computeUpdateConsentPlan
// ---------------------------------------------------------------------------

describe("computeUpdateConsentPlan — re-consent detection", () => {
	it("new medium+ capability triggers re-consent", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: ["fs:read"],
			newCapabilities: ["fs:read", "net:http"], // net:http is medium
			trust: "signed-third-party",
		})
		expect(plan.newNeedsConsent.map((i) => i.capability)).toContain("net:http")
		expect(plan.carryForward.map((i) => i.capability)).toContain("fs:read")
		expect(plan.removed).toHaveLength(0)
	})

	it("new low-risk capability carries forward without re-consent", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: ["net:http"],
			newCapabilities: ["net:http", "fs:read"], // fs:read is low-risk
			trust: "signed-third-party",
		})
		expect(plan.newNeedsConsent.map((i) => i.capability)).not.toContain("fs:read")
		expect(plan.carryForward.map((i) => i.capability)).toContain("fs:read")
	})

	it("capability removed in new version appears in removed list", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: ["net:http", "fs:read"],
			newCapabilities: ["fs:read"],
			trust: "signed-third-party",
		})
		expect(plan.removed.map((i) => i.capability)).toContain("net:http")
	})

	it("unchanged medium+ capability carries forward", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: ["net:http"],
			newCapabilities: ["net:http"],
			trust: "signed-third-party",
		})
		expect(plan.newNeedsConsent).toHaveLength(0)
		expect(plan.escalatedNeedsConsent).toHaveLength(0)
		expect(plan.carryForward.map((i) => i.capability)).toContain("net:http")
	})

	it("built-in trust: all caps carry forward (auto-grant)", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: [],
			newCapabilities: ["net:http", "shell:exec", "fs:write"],
			trust: "built-in",
		})
		expect(plan.newNeedsConsent).toHaveLength(0)
		expect(plan.escalatedNeedsConsent).toHaveLength(0)
		expect(plan.carryForward.length).toBe(3)
	})

	it("unknown capability triggers re-consent (treated as critical)", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: [],
			newCapabilities: ["unknown:capability:xyz"],
			trust: "signed-third-party",
		})
		expect(plan.newNeedsConsent.map((i) => i.capability)).toContain("unknown:capability:xyz")
	})

	it("updateRequiresConsent is true when new medium+ cap declared", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: [],
			newCapabilities: ["net:http"],
			trust: "signed-third-party",
		})
		expect(updateRequiresConsent(plan)).toBe(true)
	})

	it("updateRequiresConsent is false when only low-risk caps added", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: [],
			newCapabilities: ["fs:read"],
			trust: "signed-third-party",
		})
		expect(updateRequiresConsent(plan)).toBe(false)
	})

	it("empty capability delta: no re-consent needed, no removed, no carry-forward", () => {
		const plan = computeUpdateConsentPlan({
			prevCapabilities: [],
			newCapabilities: [],
			trust: "signed-third-party",
		})
		expect(updateRequiresConsent(plan)).toBe(false)
		expect(plan.removed).toHaveLength(0)
		expect(plan.carryForward).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// C5: consentPlanToGrantRecords passes pluginVersion through
// ---------------------------------------------------------------------------

describe("consentPlanToGrantRecords — pluginVersion propagated to records", () => {
	it("records carry the pluginVersion when provided", () => {
		const plan = computeInstallConsentPlan({
			capabilities: ["fs:read", "net:http"],
			trust: "signed-third-party",
		})
		const records = consentPlanToGrantRecords({
			plan,
			pluginId: "bobsoft.linter",
			pluginVersion: "1.2.3",
			scope: "app",
			scopeId: null,
			consentedCapabilities: ["net:http"],
		})
		for (const r of records) {
			expect(r.pluginVersion).toBe("1.2.3")
		}
	})

	it("records carry no pluginVersion when omitted (backward compat)", () => {
		const plan = computeInstallConsentPlan({
			capabilities: ["fs:read"],
			trust: "signed-third-party",
		})
		const records = consentPlanToGrantRecords({
			plan,
			pluginId: "bobsoft.linter",
			scope: "app",
			scopeId: null,
		})
		for (const r of records) {
			expect(r.pluginVersion).toBeUndefined()
		}
	})
})
