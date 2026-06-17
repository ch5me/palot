/**
 * F2 — install→catalog bridge tests
 *
 * Verifies that `discoverInstalledManifests` correctly:
 *   - yields manifests for enabled, non-quarantined code-extension records
 *   - excludes removed, disabled, and quarantined records
 *   - excludes theme-only records (null pluginManifestJson)
 *   - quarantines a single bad manifest without blocking others
 *   - propagates DB errors fail-loud (never silent fallback)
 *
 * And that the catalog integration (`refreshPluginCatalogAsync`) surfaces
 * installed extensions with their tool/command projections and
 * requiredCapabilities in the host catalog.
 */

import { afterEach, describe, expect, it } from "bun:test"

import {
	discoverInstalledManifests,
	type InstalledExtensionRow,
	type InstalledManifestStoreApi,
} from "./discover-installed-manifests"
import {
	_resetPluginAuthorityForTests,
	_setInstalledManifestStoreForTests,
	refreshPluginCatalogAsync,
} from "./authority"

// ---------------------------------------------------------------------------
// Test manifest fixtures
// ---------------------------------------------------------------------------

/** A minimal valid Firefly code-extension manifest JSON (no tools for brevity). */
const codeExtManifestJson = JSON.stringify({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "bobsoft.linter",
	displayName: "Bobsoft Linter",
	version: "0.1.0",
	trust: "signed-third-party",
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		widgets: [],
		commands: [],
		themes: [],
		tools: [
			{
				id: "plugin.bobsoft.linter.read-config",
				title: "Read linter config",
				description: "Read the linter configuration for the current project.",
				scope: "session",
				requires: ["bobsoft:read"],
				args: {
					type: "object",
					properties: {},
				},
			},
		],
	},
	capabilities: ["bobsoft:read"],
	tags: [],
})

/** A second valid code-extension manifest for multi-record tests. */
const secondExtManifestJson = JSON.stringify({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "vendor.formatter",
	displayName: "Vendor Formatter",
	version: "1.0.0",
	trust: "signed-third-party",
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		widgets: [],
		commands: [{ id: "format-file", title: "Format File", when: "always" }],
		themes: [],
		tools: [],
	},
	capabilities: [],
	tags: [],
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(
	overrides: Partial<InstalledExtensionRow["installation"]> &
		Partial<InstalledExtensionRow["package"]> & {
			id?: string
			packageId?: string
		} = {},
): InstalledExtensionRow {
	const packageId = overrides.packageId ?? "sha-abc123"
	const id = overrides.id ?? `${packageId}-1000`
	return {
		installation: {
			id,
			lifecycleState: overrides.lifecycleState ?? "installed",
		},
		package: {
			id: packageId,
			externalId: overrides.externalId ?? "bobsoft.linter",
			scanState: overrides.scanState ?? "clean",
			pluginManifestJson: overrides.pluginManifestJson !== undefined
				? overrides.pluginManifestJson
				: codeExtManifestJson,
			requiredCapabilitiesJson: overrides.requiredCapabilitiesJson ?? JSON.stringify(["bobsoft:read"]),
		},
	}
}

function makeStore(rows: InstalledExtensionRow[]): InstalledManifestStoreApi {
	return {
		listInstalledExtensions: async () => rows,
	}
}

// ---------------------------------------------------------------------------
// discoverInstalledManifests
// ---------------------------------------------------------------------------

describe("discoverInstalledManifests", () => {
	it("yields manifests for enabled, clean code-extension rows", async () => {
		const store = makeStore([makeRow()])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(1)
		expect(result.manifests[0].id).toBe("bobsoft.linter")
		expect(result.failures).toHaveLength(0)
	})

	it("excludes rows with lifecycleState !== 'installed'", async () => {
		const store = makeStore([
			makeRow({ id: "r1", packageId: "p1", lifecycleState: "removed" }),
			makeRow({ id: "r2", packageId: "p2", lifecycleState: "disabled" }),
		])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})

	it("excludes quarantined packages (scanState === 'quarantined')", async () => {
		const store = makeStore([makeRow({ scanState: "quarantined" })])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})

	it("excludes theme-only packages (null pluginManifestJson)", async () => {
		const store = makeStore([makeRow({ pluginManifestJson: null })])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})

	it("quarantines a single bad JSON record and keeps the rest", async () => {
		const store = makeStore([
			makeRow({ id: "r1", packageId: "p1", pluginManifestJson: "{not valid json" }),
			makeRow({ id: "r2", packageId: "p2", externalId: "vendor.formatter", pluginManifestJson: secondExtManifestJson }),
		])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(1)
		expect(result.manifests[0].id).toBe("vendor.formatter")
		expect(result.failures).toHaveLength(1)
		expect(result.failures[0].packageId).toBe("p1")
		expect(result.failures[0].issues[0].message).toMatch(/not valid JSON/i)
	})

	it("quarantines a schema-invalid manifest and keeps others", async () => {
		const badManifest = JSON.stringify({ apiVersion: "firefly.plugin/v2", id: "BAD ID!!" })
		const store = makeStore([
			makeRow({ id: "r1", packageId: "p1", pluginManifestJson: badManifest }),
			makeRow({ id: "r2", packageId: "p2", externalId: "vendor.formatter", pluginManifestJson: secondExtManifestJson }),
		])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(1)
		expect(result.manifests[0].id).toBe("vendor.formatter")
		expect(result.failures).toHaveLength(1)
	})

	it("propagates DB errors fail-loud (never swallows them)", async () => {
		const brokenStore: InstalledManifestStoreApi = {
			listInstalledExtensions: async () => {
				throw new Error("DB connection lost")
			},
		}
		await expect(discoverInstalledManifests(brokenStore)).rejects.toThrow(/DB connection lost/)
	})

	it("returns empty manifests + failures when store returns empty", async () => {
		const result = await discoverInstalledManifests(makeStore([]))
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})

	it("includes tool projections from the parsed manifest", async () => {
		const result = await discoverInstalledManifests(makeStore([makeRow()]))
		const manifest = result.manifests[0]
		expect(manifest.contributes?.tools).toHaveLength(1)
		expect(manifest.contributes?.tools?.[0]?.id).toBe("plugin.bobsoft.linter.read-config")
	})

	it("accepts a 'pending' scanState (only quarantined is excluded)", async () => {
		const store = makeStore([makeRow({ scanState: "pending" })])
		const result = await discoverInstalledManifests(store)
		expect(result.manifests).toHaveLength(1)
	})
})

// ---------------------------------------------------------------------------
// Catalog integration — refreshPluginCatalogAsync
// ---------------------------------------------------------------------------

describe("catalog integration via refreshPluginCatalogAsync", () => {
	afterEach(() => {
		_resetPluginAuthorityForTests()
	})

	it("installed enabled code-ext appears in the catalog with its tool projection", async () => {
		const store = makeStore([makeRow()])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		const entry = catalog.entries.find((e) => e.pluginId === "bobsoft.linter")
		expect(entry).toBeDefined()
		expect(entry?.trust).toBe("signed-third-party")
		expect(entry?.status).toBe("validated")

		// Tool projections are surfaced in the descriptor (no tools slice on projections)
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === "bobsoft.linter")
		expect(descriptor).toBeDefined()
		expect(descriptor?.tools).toHaveLength(1)
		expect(descriptor?.tools[0]?.id).toBe("plugin.bobsoft.linter.read-config")
	})

	it("installed code-ext requiredCapabilities appear on the catalog entry", async () => {
		const store = makeStore([makeRow()])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		const entry = catalog.entries.find((e) => e.pluginId === "bobsoft.linter")
		expect(entry?.requiredCapabilities).toContain("bobsoft:read")
	})

	it("removed record (lifecycleState=removed) is excluded from catalog", async () => {
		const store = makeStore([makeRow({ lifecycleState: "removed" })])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		const entry = catalog.entries.find((e) => e.pluginId === "bobsoft.linter")
		expect(entry).toBeUndefined()
	})

	it("quarantined package (scanState=quarantined) is excluded from catalog", async () => {
		const store = makeStore([makeRow({ scanState: "quarantined" })])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		const entry = catalog.entries.find((e) => e.pluginId === "bobsoft.linter")
		expect(entry).toBeUndefined()
	})

	it("multiple installed extensions all appear in catalog", async () => {
		const store = makeStore([
			makeRow({ id: "r1", packageId: "p1" }),
			makeRow({ id: "r2", packageId: "p2", externalId: "vendor.formatter", pluginManifestJson: secondExtManifestJson }),
		])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		expect(catalog.entries.find((e) => e.pluginId === "bobsoft.linter")).toBeDefined()
		expect(catalog.entries.find((e) => e.pluginId === "vendor.formatter")).toBeDefined()
	})

	it("bad manifest in DB quarantines that entry but does not block the rest", async () => {
		const store = makeStore([
			makeRow({ id: "r1", packageId: "p1", pluginManifestJson: "{bad json" }),
			makeRow({ id: "r2", packageId: "p2", externalId: "vendor.formatter", pluginManifestJson: secondExtManifestJson }),
		])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		// bad row is excluded (not in catalog)
		expect(catalog.entries.find((e) => e.pluginId === "bobsoft.linter")).toBeUndefined()
		// good row still appears
		expect(catalog.entries.find((e) => e.pluginId === "vendor.formatter")).toBeDefined()
	})

	it("command contributions from installed ext appear in catalog projections", async () => {
		const store = makeStore([
			makeRow({ id: "r2", packageId: "p2", externalId: "vendor.formatter", pluginManifestJson: secondExtManifestJson }),
		])
		_setInstalledManifestStoreForTests(store)

		const catalog = await refreshPluginCatalogAsync(store)

		const commands = catalog.projections.commands.filter((c) => c.pluginId === "vendor.formatter")
		expect(commands).toHaveLength(1)
		expect(commands[0].contributionId).toBe("format-file")
	})
})
