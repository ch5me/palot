import { describe, expect, it } from "bun:test"

import { createCloudProjectionCache, ProjectionCacheNotHydratedError } from "./cloud-projection-cache"
import type { CatalogProjectionSnapshot } from "../../shared/firefly-plugin/host-authority-types"

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function makeSnapshot(revision: number, overrides: Partial<CatalogProjectionSnapshot> = {}): CatalogProjectionSnapshot {
	return {
		revision,
		fetchedAt: `2026-06-16T0${revision}:00:00Z`,
		catalog: {
			appVersion: "1.0.0",
			plugins: [],
			summaries: [],
			knownCommands: [],
		},
		tools: { appVersion: "1.0.0", tools: [] },
		panels: { appVersion: "1.0.0", items: [] },
		navSidebars: { appVersion: "1.0.0", items: [] },
		widgets: { appVersion: "1.0.0", items: [] },
		commands: { appVersion: "1.0.0", items: [] },
		themes: { appVersion: "1.0.0", items: [] },
		describeByPluginId: {},
		stateByPluginId: {},
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// Un-hydrated state — every sync read must throw the named error
// ---------------------------------------------------------------------------

describe("CloudProjectionCache — unhydrated", () => {
	const syncReads: Array<[string, (c: ReturnType<typeof createCloudProjectionCache>) => unknown]> = [
		["catalog", (c) => c.catalog()],
		["describe", (c) => c.describe("p.x")],
		["state", (c) => c.state("p.x")],
		["listTools", (c) => c.listTools()],
		["listPanels", (c) => c.listPanels()],
		["listNavSidebars", (c) => c.listNavSidebars()],
		["listWidgets", (c) => c.listWidgets()],
		["listCommands", (c) => c.listCommands()],
		["listThemes", (c) => c.listThemes()],
	]

	for (const [name, read] of syncReads) {
		it(`${name}() throws ProjectionCacheNotHydratedError before hydration`, () => {
			const cache = createCloudProjectionCache()
			expect(cache.hydrated).toBe(false)
			expect(cache.revision).toBe(0)
			expect(() => read(cache)).toThrow(ProjectionCacheNotHydratedError)
		})

		it(`${name}() error names the missing method`, () => {
			const cache = createCloudProjectionCache()
			try {
				read(cache)
				throw new Error("expected throw")
			} catch (e) {
				expect(e).toBeInstanceOf(ProjectionCacheNotHydratedError)
				expect((e as ProjectionCacheNotHydratedError).method).toBe(name)
			}
		})
	}
})

// ---------------------------------------------------------------------------
// Post-hydration — reads must return the cached slices
// ---------------------------------------------------------------------------

describe("CloudProjectionCache — hydrated", () => {
	it("hydrate() sets hydrated=true and revision", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(5))
		expect(cache.hydrated).toBe(true)
		expect(cache.revision).toBe(5)
	})

	it("catalog() returns the catalog slice from the snapshot", () => {
		const cache = createCloudProjectionCache()
		const snap = makeSnapshot(1, {
			catalog: {
				appVersion: "2.0.0",
				plugins: [
					{
						pluginId: "p.x",
						displayName: "Plugin X",
						version: "1.0.0",
						trust: "built-in",
						status: "active",
						manifestRevision: 1,
						appVersion: "2.0.0",
						requiredCapabilities: [],
						defaultGrantedCapabilities: [],
					},
				],
				summaries: [],
				knownCommands: [],
			},
		})
		cache.hydrate(snap)
		const result = cache.catalog()
		expect(result.appVersion).toBe("2.0.0")
		expect(result.plugins).toHaveLength(1)
		expect(result.plugins[0]?.pluginId).toBe("p.x")
	})

	it("listTools() returns the tools slice", () => {
		const cache = createCloudProjectionCache()
		const snap = makeSnapshot(2, {
			tools: {
				appVersion: "1.0.0",
				tools: [
					{
						pluginId: "p.x",
						id: "t.x",
						title: "My Tool",
						description: "desc",
						scope: "session",
						requires: [],
						timeoutMs: 5000,
						preview: false,
					},
				],
			},
		})
		cache.hydrate(snap)
		const result = cache.listTools()
		expect(result.tools).toHaveLength(1)
		expect(result.tools[0]?.id).toBe("t.x")
	})

	it("describe() returns the describe entry keyed by pluginId", () => {
		const describeResult = {
			entry: { pluginId: "p.x" },
			projection: null,
			decision: {
				pluginId: "p.x",
				token: "fs:read",
				granted: true,
				reason: "auto",
				reasonCode: "auto_grant",
				risk: "low" as const,
				knownToHost: true,
				grantedTokens: ["fs:read"],
			},
		}
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(1, { describeByPluginId: { "p.x": describeResult } }))
		expect(cache.describe("p.x")).toEqual(describeResult)
	})

	it("describe() returns a not-found shape for unknown pluginId", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(1))
		const result = cache.describe("unknown.plugin")
		expect(result.entry).toBeNull()
		expect(result.decision.knownToHost).toBe(false)
	})

	it("state() returns the state entry keyed by pluginId", () => {
		const stateResult = {
			found: true,
			pluginId: "p.x",
			state: {
				trust: "signed-third-party" as const,
				sessionScope: "session" as const,
				grantedTokens: ["fs:read"] as readonly string[],
			},
			decision: {
				pluginId: "p.x",
				token: "fs:read",
				granted: true,
				reason: "user",
				reasonCode: "user_grant",
				risk: "low" as const,
				knownToHost: true,
				grantedTokens: ["fs:read"] as readonly string[],
			},
		}
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(1, { stateByPluginId: { "p.x": stateResult } }))
		expect(cache.state("p.x")).toEqual(stateResult)
	})

	it("state() returns a not-found shape for unknown pluginId", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(1))
		const result = cache.state("unknown.plugin")
		expect(result.found).toBe(false)
	})

	it("listPanels/listNavSidebars/listWidgets/listCommands/listThemes return their slices", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(
			makeSnapshot(1, {
				panels: { appVersion: "1.0.0", items: ["panel-a"] },
				navSidebars: { appVersion: "1.0.0", items: ["sidebar-a"] },
				widgets: { appVersion: "1.0.0", items: ["widget-a"] },
				commands: { appVersion: "1.0.0", items: ["cmd-a"] },
				themes: { appVersion: "1.0.0", items: ["theme-a"] },
			}),
		)
		expect(cache.listPanels().items).toEqual(["panel-a"])
		expect(cache.listNavSidebars().items).toEqual(["sidebar-a"])
		expect(cache.listWidgets().items).toEqual(["widget-a"])
		expect(cache.listCommands().items).toEqual(["cmd-a"])
		expect(cache.listThemes().items).toEqual(["theme-a"])
	})
})

// ---------------------------------------------------------------------------
// Revision monotonicity — stale snapshots must be ignored
// ---------------------------------------------------------------------------

describe("CloudProjectionCache — revision monotonicity", () => {
	it("higher revision replaces the cached snapshot", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(3, { catalog: { appVersion: "v3", plugins: [], summaries: [], knownCommands: [] } }))
		cache.hydrate(makeSnapshot(7, { catalog: { appVersion: "v7", plugins: [], summaries: [], knownCommands: [] } }))
		expect(cache.revision).toBe(7)
		expect(cache.catalog().appVersion).toBe("v7")
	})

	it("lower revision is silently ignored (no stale regression)", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(10, { catalog: { appVersion: "v10", plugins: [], summaries: [], knownCommands: [] } }))
		cache.hydrate(makeSnapshot(5, { catalog: { appVersion: "v5-stale", plugins: [], summaries: [], knownCommands: [] } }))
		expect(cache.revision).toBe(10)
		expect(cache.catalog().appVersion).toBe("v10")
	})

	it("equal revision is silently ignored", () => {
		const cache = createCloudProjectionCache()
		cache.hydrate(makeSnapshot(4, { catalog: { appVersion: "v4-first", plugins: [], summaries: [], knownCommands: [] } }))
		cache.hydrate(makeSnapshot(4, { catalog: { appVersion: "v4-second", plugins: [], summaries: [], knownCommands: [] } }))
		expect(cache.revision).toBe(4)
		expect(cache.catalog().appVersion).toBe("v4-first")
	})
})
