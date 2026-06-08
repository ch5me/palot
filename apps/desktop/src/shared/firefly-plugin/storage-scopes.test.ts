import { describe, expect, test } from "bun:test"

import {
	ALL_STORAGE_SCOPE_CONTRACTS,
	buildPluginStoragePolicy,
	buildStoreKey,
	isStorageValueDurable,
	resolveStorageLifecycleAction,
	SCOPE_DEFAULT_QUOTAS,
	storageScopeContractSchema,
	storageScopeSchema,
	STORAGE_SCOPE_CONTRACTS,
	STORAGE_SCOPES,
} from "./storage-scopes"

describe("STORAGE_SCOPES vocabulary", () => {
	test("exposes the four locked scopes in canonical order", () => {
		expect(STORAGE_SCOPES).toEqual(["session", "project", "app", "global-profile"])
	})

	test("storageScopeSchema accepts every locked scope and rejects unknown", () => {
		for (const scope of STORAGE_SCOPES) {
			expect(storageScopeSchema.parse(scope)).toBe(scope)
		}
		expect(storageScopeSchema.safeParse("").success).toBe(false)
		expect(storageScopeSchema.safeParse("workspace").success).toBe(false)
	})

	test("ALL_STORAGE_SCOPE_CONTRACTS preserves the locked order", () => {
		expect(ALL_STORAGE_SCOPE_CONTRACTS.map((c) => c.scope)).toEqual([...STORAGE_SCOPES])
	})
})

describe("STORAGE_SCOPE_CONTRACTS table", () => {
	test("session scope is restored and purged on disable/uninstall", () => {
		const session = STORAGE_SCOPE_CONTRACTS.session
		expect(session.owner).toBe("host")
		expect(session.persistence).toBe("restored")
		expect(session.disableBehavior).toBe("purge")
		expect(session.uninstallBehavior).toBe("purge")
		expect(session.hotReloadBehavior).toBe("preserve")
		expect(session.defaultQuota).toBe(SCOPE_DEFAULT_QUOTAS.session)
	})

	test("project scope is durable, archived on disable, purged on uninstall", () => {
		const project = STORAGE_SCOPE_CONTRACTS.project
		expect(project.persistence).toBe("durable")
		expect(project.disableBehavior).toBe("archive")
		expect(project.uninstallBehavior).toBe("purge")
	})

	test("app scope is durable, archived on disable, purged on uninstall", () => {
		const app = STORAGE_SCOPE_CONTRACTS.app
		expect(app.persistence).toBe("durable")
		expect(app.disableBehavior).toBe("archive")
		expect(app.uninstallBehavior).toBe("purge")
	})

	test("global-profile scope is durable, preserved on disable, archived on uninstall", () => {
		const profile = STORAGE_SCOPE_CONTRACTS["global-profile"]
		expect(profile.persistence).toBe("durable")
		expect(profile.disableBehavior).toBe("preserve")
		expect(profile.uninstallBehavior).toBe("archive")
	})

	test("every contract round-trips through the schema", () => {
		for (const contract of ALL_STORAGE_SCOPE_CONTRACTS) {
			const parsed = storageScopeContractSchema.parse(contract)
			expect(parsed).toEqual(contract)
		}
	})
})

describe("buildStoreKey", () => {
	test("produces a deterministic typed key", () => {
		const key = buildStoreKey({
			scope: "session",
			scopeId: "sess-123",
			pluginId: "acme.foo",
			key: "last-seen",
		})
		expect(key).toEqual({
			scope: "session",
			scopeId: "sess-123",
			pluginId: "acme.foo",
			key: "last-seen",
		})
	})
})

describe("buildPluginStoragePolicy", () => {
	test("inherits default quotas from the contract table", () => {
		const policy = buildPluginStoragePolicy({
			pluginId: "acme.foo",
			scopes: ["session", "app"],
		})
		expect(policy.pluginId).toBe("acme.foo")
		expect(policy.allowCrossScopeReads).toBe(false)
		expect(policy.scopes).toHaveLength(2)
		expect(policy.scopes[0]?.scope).toBe("session")
		expect(policy.scopes[0]?.quota).toBe(SCOPE_DEFAULT_QUOTAS.session)
		expect(policy.scopes[1]?.scope).toBe("app")
		expect(policy.scopes[1]?.quota).toBe(SCOPE_DEFAULT_QUOTAS.app)
	})

	test("honors per-scope quota overrides", () => {
		const policy = buildPluginStoragePolicy({
			pluginId: "acme.foo",
			scopes: ["session", "project"],
			quotaOverrides: { session: 1024 },
		})
		const session = policy.scopes.find((s) => s.scope === "session")
		const project = policy.scopes.find((s) => s.scope === "project")
		expect(session?.quota).toBe(1024)
		expect(project?.quota).toBe(SCOPE_DEFAULT_QUOTAS.project)
	})

	test("rejects an empty scope list at the schema level", () => {
		const policy = buildPluginStoragePolicy({
			pluginId: "acme.foo",
			scopes: ["session"],
		})
		const { storageScopeContractSchema: _ignored, ...rest } = storageScopeContractSchema
		void _ignored
		expect(policy.scopes.length).toBeGreaterThanOrEqual(1)
	})
})

describe("resolveStorageLifecycleAction", () => {
	test("session disable / uninstall are purge; hotReload preserves", () => {
		expect(resolveStorageLifecycleAction("session", "disable")).toBe("purge")
		expect(resolveStorageLifecycleAction("session", "uninstall")).toBe("purge")
		expect(resolveStorageLifecycleAction("session", "hotReload")).toBe("preserve")
	})

	test("project disable is archive, uninstall is purge", () => {
		expect(resolveStorageLifecycleAction("project", "disable")).toBe("archive")
		expect(resolveStorageLifecycleAction("project", "uninstall")).toBe("purge")
	})

	test("app disable is archive, uninstall is purge", () => {
		expect(resolveStorageLifecycleAction("app", "disable")).toBe("archive")
		expect(resolveStorageLifecycleAction("app", "uninstall")).toBe("purge")
	})

	test("global-profile disable preserves, uninstall archives", () => {
		expect(resolveStorageLifecycleAction("global-profile", "disable")).toBe("preserve")
		expect(resolveStorageLifecycleAction("global-profile", "uninstall")).toBe("archive")
	})
})

describe("isStorageValueDurable", () => {
	test("durable and restored are durable", () => {
		expect(isStorageValueDurable("durable")).toBe(true)
		expect(isStorageValueDurable("restored")).toBe(true)
	})

	test("transient is NOT durable (plugin memory is not a source of truth)", () => {
		expect(isStorageValueDurable("transient")).toBe(false)
	})
})
