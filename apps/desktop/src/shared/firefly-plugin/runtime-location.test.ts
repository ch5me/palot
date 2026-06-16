import { describe, expect, it } from "bun:test"

import {
	HOST_KINDS,
	inferDefaultHostKind,
	resolveRuntimeLocation,
	type BuildSurface,
	type HostKind,
} from "./runtime-location"

describe("resolveRuntimeLocation — the §2.3 matrix", () => {
	const electron: BuildSurface = "electron"
	const web: BuildSurface = "web"
	const bothSurfaces: BuildSurface[] = ["electron", "web"]

	it("data-only → none on both builds", () => {
		for (const build of bothSurfaces) {
			const r = resolveRuntimeLocation({ hostKind: "data-only", build, webStrategy: "unsupported", surfaces: bothSurfaces })
			expect(r).toEqual({ supported: true, location: "none" })
		}
	})

	it("iframe-view → iframe on both builds", () => {
		for (const build of bothSurfaces) {
			const r = resolveRuntimeLocation({ hostKind: "iframe-view", build, webStrategy: "unsupported", surfaces: bothSurfaces })
			expect(r).toEqual({ supported: true, location: "iframe" })
		}
	})

	it("web-worker → browser-worker on both builds", () => {
		for (const build of bothSurfaces) {
			const r = resolveRuntimeLocation({ hostKind: "web-worker", build, webStrategy: "unsupported", surfaces: bothSurfaces })
			expect(r).toEqual({ supported: true, location: "browser-worker" })
		}
	})

	it("builtin-main → electron-main on electron, cloud-host on web", () => {
		expect(resolveRuntimeLocation({ hostKind: "builtin-main", build: electron, webStrategy: "unsupported", surfaces: bothSurfaces })).toEqual({
			supported: true,
			location: "electron-main",
		})
		expect(resolveRuntimeLocation({ hostKind: "builtin-main", build: web, webStrategy: "unsupported", surfaces: bothSurfaces })).toEqual({
			supported: true,
			location: "cloud-host",
		})
	})

	it("node-worker → electron-utility on electron", () => {
		expect(resolveRuntimeLocation({ hostKind: "node-worker", build: electron, webStrategy: "unsupported", surfaces: bothSurfaces })).toEqual({
			supported: true,
			location: "electron-utility",
		})
	})

	it("node-worker on web is unsupported unless webStrategy=cloud-host (no silent fallback)", () => {
		const unsupported = resolveRuntimeLocation({ hostKind: "node-worker", build: web, webStrategy: "unsupported", surfaces: bothSurfaces })
		expect(unsupported.supported).toBe(false)
		if (!unsupported.supported) {
			expect(unsupported.reasonCode).toBe("node_worker_unsupported_on_web")
		}

		const cloud = resolveRuntimeLocation({ hostKind: "node-worker", build: web, webStrategy: "cloud-host", surfaces: bothSurfaces })
		expect(cloud).toEqual({ supported: true, location: "cloud-host" })
	})

	it("a build the version does not declare support for is unsupported with a named reason", () => {
		const r = resolveRuntimeLocation({ hostKind: "web-worker", build: web, webStrategy: "unsupported", surfaces: ["electron"] })
		expect(r.supported).toBe(false)
		if (!r.supported) {
			expect(r.reasonCode).toBe("surface_unsupported")
		}
	})

	it("resolves a location for every host kind on electron with full surfaces (no gaps)", () => {
		for (const hostKind of HOST_KINDS) {
			const r = resolveRuntimeLocation({ hostKind, build: electron, webStrategy: "cloud-host", surfaces: bothSurfaces })
			expect(r.supported).toBe(true)
		}
	})
})

describe("inferDefaultHostKind — back-compat default for pre-runtime manifests", () => {
	it("pure data pack (no code, no UI) → data-only", () => {
		expect(inferDefaultHostKind({ codeContributions: 0, uiContributions: 0, dataContributions: 5 })).toBe<HostKind>("data-only")
	})

	it("anything with code → builtin-main", () => {
		expect(inferDefaultHostKind({ codeContributions: 2, uiContributions: 0, dataContributions: 0 })).toBe<HostKind>("builtin-main")
	})

	it("anything with UI → builtin-main", () => {
		expect(inferDefaultHostKind({ codeContributions: 0, uiContributions: 3, dataContributions: 0 })).toBe<HostKind>("builtin-main")
	})

	it("empty manifest (nothing at all) → data-only", () => {
		expect(inferDefaultHostKind({ codeContributions: 0, uiContributions: 0, dataContributions: 0 })).toBe<HostKind>("data-only")
	})
})
