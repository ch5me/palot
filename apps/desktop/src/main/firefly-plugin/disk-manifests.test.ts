import { describe, expect, test } from "bun:test"

import { buildPluginCatalog } from "./catalog"
import {
	defaultPluginRoots,
	discoverDiskManifests,
	type DiskManifestFs,
} from "./disk-manifests"

const validJsonManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "acme.disk-notes",
	displayName: "Disk Notes",
	version: "1.0.0",
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
				id: "plugin.acme.disk-notes.read",
				title: "Read notes",
				description: "Read stored notes.",
				scope: "session",
				requires: [],
				args: {
					type: "object",
					properties: { limit: { type: "integer", minimum: 1 } },
				},
			},
		],
	},
	capabilities: [],
	tags: [],
}

function fakeFs(files: Record<string, string>, dirs: Set<string>): DiskManifestFs {
	return {
		existsSync: (p) => p in files || dirs.has(p),
		readdirSync: (p) => {
			const prefix = `${p}/`
			const names = new Set<string>()
			for (const candidate of [...Object.keys(files), ...dirs]) {
				if (candidate.startsWith(prefix)) {
					names.add(candidate.slice(prefix.length).split("/")[0])
				}
			}
			return [...names]
		},
		statIsDirectory: (p) => dirs.has(p),
		readFileSync: (p) => {
			const content = files[p]
			if (content === undefined) throw new Error(`ENOENT: ${p}`)
			return content
		},
	}
}

describe("discoverDiskManifests", () => {
	test("missing root is a legitimate empty set, not an error", () => {
		const result = discoverDiskManifests(["/nope"], fakeFs({}, new Set()))
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})

	test("loads valid JSON-profile manifests", () => {
		const io = fakeFs(
			{ "/plugins/disk-notes/manifest.json": JSON.stringify(validJsonManifest) },
			new Set(["/plugins", "/plugins/disk-notes"]),
		)
		const result = discoverDiskManifests(["/plugins"], io)
		expect(result.manifests).toHaveLength(1)
		expect(result.manifests[0].id).toBe("acme.disk-notes")
		expect(result.failures).toHaveLength(0)
	})

	test("bad JSON quarantines that entry and keeps the rest", () => {
		const io = fakeFs(
			{
				"/plugins/broken/manifest.json": "{not json",
				"/plugins/good/manifest.json": JSON.stringify(validJsonManifest),
			},
			new Set(["/plugins", "/plugins/broken", "/plugins/good"]),
		)
		const result = discoverDiskManifests(["/plugins"], io)
		expect(result.manifests).toHaveLength(1)
		expect(result.failures).toHaveLength(1)
		expect(result.failures[0].manifestPath).toBe("/plugins/broken/manifest.json")
	})

	test("schema-invalid manifest quarantines with issues", () => {
		const io = fakeFs(
			{
				"/plugins/bad/manifest.json": JSON.stringify({ ...validJsonManifest, id: "BAD ID" }),
			},
			new Set(["/plugins", "/plugins/bad"]),
		)
		const result = discoverDiskManifests(["/plugins"], io)
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(1)
		expect(result.failures[0].pluginId).toBe("BAD ID")
		expect(result.failures[0].issues.length).toBeGreaterThan(0)
	})

	test("directories without manifest.json are skipped silently", () => {
		const io = fakeFs({}, new Set(["/plugins", "/plugins/just-a-dir"]))
		const result = discoverDiskManifests(["/plugins"], io)
		expect(result.manifests).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
	})
})

describe("defaultPluginRoots", () => {
	test("packaged app reads from resources", () => {
		expect(
			defaultPluginRoots({ isPackaged: true, resourcesPath: "/App/Resources", appRoot: "/dev" }),
		).toEqual(["/App/Resources/plugins"])
	})

	test("dev reads from app root", () => {
		expect(defaultPluginRoots({ isPackaged: false, resourcesPath: null, appRoot: "/repo/apps/desktop" })).toEqual([
			"/repo/apps/desktop/plugins",
		])
	})
})

describe("buildPluginCatalog with disk manifests", () => {
	test("disk manifests flow through the same descriptor path as built-ins", () => {
		const parsed = discoverDiskManifests(
			["/plugins"],
			fakeFs(
				{ "/plugins/disk-notes/manifest.json": JSON.stringify(validJsonManifest) },
				new Set(["/plugins", "/plugins/disk-notes"]),
			),
		)
		const catalog = buildPluginCatalog({
			appVersion: "0.11.0",
			diskManifests: parsed.manifests,
		})
		const entry = catalog.entries.find((e) => e.pluginId === "acme.disk-notes")
		expect(entry).toBeDefined()
		expect(entry?.status).toBe("validated")
		expect(entry?.source).toBe("disk")
		expect(catalog.descriptors.some((d) => d.normalizedId === "acme.disk-notes")).toBe(true)
	})

	test("disk failures surface as quarantined entries without blocking the catalog", () => {
		const catalog = buildPluginCatalog({
			appVersion: "0.11.0",
			diskFailures: [
				{
					manifestPath: "/plugins/bad/manifest.json",
					pluginId: "acme.bad-plugin",
					issues: [{ path: ["id"], message: "invalid id" }],
				},
			],
		})
		const entry = catalog.entries.find((e) => e.pluginId === "acme.bad-plugin")
		expect(entry?.status).toBe("quarantined")
		expect(entry?.statusDetail).toContain("invalid id")
		// Built-ins still load.
		expect(catalog.descriptors.length).toBeGreaterThanOrEqual(2)
	})

	test("disk manifest claiming built-in trust is quarantined (trust escalation)", () => {
		const escalating = { ...validJsonManifest, id: "firefly.built-in.fake", trust: "built-in" }
		const parsed = discoverDiskManifests(
			["/plugins"],
			fakeFs(
				{ "/plugins/fake/manifest.json": JSON.stringify(escalating) },
				new Set(["/plugins", "/plugins/fake"]),
			),
		)
		const catalog = buildPluginCatalog({
			appVersion: "0.11.0",
			diskManifests: parsed.manifests,
		})
		const entry = catalog.entries.find((e) => e.pluginId === "firefly.built-in.fake")
		expect(entry?.status).toBe("quarantined")
		expect(catalog.descriptors.some((d) => d.normalizedId === "firefly.built-in.fake")).toBe(false)
	})
})
