import { describe, expect, test } from "bun:test"
import {
	assertValidBrowserLaneId,
	createEmptyBrowserLaneHealth,
	getBrowserLaneSurfaceKind,
	getBrowserLaneSurfaceUrl,
	getBrowserLaneStoragePaths,
	getBrowserLaneStreamPath,
	inflateBrowserLane,
	migrateBrowserLaneRecord,
	summarizeBrowserLaneHealth,
} from "./browser-lanes"

describe("browser lane ids", () => {
	test("builds stable same-origin stream path", () => {
		expect(getBrowserLaneStreamPath("default")).toBe("/browser/default/")
	})

	test("rejects invalid ids", () => {
		expect(() => assertValidBrowserLaneId("bad id")).toThrow(/Invalid browser lane id/)
		expect(() => assertValidBrowserLaneId("with/slash")).toThrow(/Invalid browser lane id/)
	})
})

describe("browser lane storage paths", () => {
	test("derives stable profile metadata", () => {
		const paths = getBrowserLaneStoragePaths("default")
		expect(paths.profileDir.endsWith("/browser-profiles/default")).toBeTrue()
		expect(paths.recordFile.endsWith("/browser-lanes/lanes.json")).toBeTrue()
	})
})

describe("browser lane health summary", () => {
	test("keeps stream and cdp separate", () => {
		const health = createEmptyBrowserLaneHealth("starting")
		health.stream.state = "ready"
		health.stream.url = "http://127.0.0.1:3901"
		health.cdp.state = "pending"
		health.message = "Starting"
		expect(summarizeBrowserLaneHealth(health)).toBe("Stream ready, CDP still starting")
	})

	test("inflates record without overloading cdp and stream fields", () => {
		const lane = inflateBrowserLane({
			id: "default",
			label: "Default",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			targetUrl: null,
			streamBackendUrl: "http://127.0.0.1:3901",
			cdpEndpoint: null,
			profilePath: "/tmp/profile",
			host: "127.0.0.1",
			createdAt: 1,
			updatedAt: 2,
		})
		expect(lane.streamPath).toBe("/browser/default/")
		expect(lane.cdpEndpoint).toBeNull()
		expect(lane.streamBackendUrl).toBe("http://127.0.0.1:3901")
		expect(lane.surfaceKind).toBe("selkies-stream")
	})

	test("migrates legacy remote lane without cdp into direct iframe", () => {
		const lane = inflateBrowserLane(
			migrateBrowserLaneRecord({
				id: "remote",
				label: "Remote",
				mode: "remote",
				runtime: "remote-attached",
				streamBackendUrl: "https://example.com/app",
				cdpEndpoint: null,
				createdAt: 1,
				updatedAt: 2,
			}),
		)
		expect(lane.surfaceKind).toBe("direct-iframe")
		expect(lane.targetUrl).toBe("https://example.com/app")
	})

	test("infers legacy surface kind without explicit field", () => {
		expect(getBrowserLaneSurfaceKind({ runtime: "remote-attached", cdpEndpoint: null })).toBe(
			"direct-iframe",
		)
	})

	test("summarizes direct iframe readiness", () => {
		const health = createEmptyBrowserLaneHealth("running")
		health.stream.state = "ready"
		health.cdp.state = "not-applicable"
		expect(summarizeBrowserLaneHealth(health)).toBe("Direct iframe ready")
	})

	test("rejects mismatched surface urls", () => {
		expect(() =>
			inflateBrowserLane({
				id: "bad-direct",
				label: "Bad Direct",
				surfaceKind: "direct-iframe",
				runtimeOwnership: "attached",
				deploymentLocation: "remote",
				targetUrl: "https://example.com/app",
				streamBackendUrl: "https://example.com/stream",
				cdpEndpoint: null,
				profilePath: null,
				host: "example.com",
				createdAt: 1,
				updatedAt: 2,
			}),
		).toThrow(/direct-iframe lanes must not set streamBackendUrl/)

		expect(() =>
			inflateBrowserLane({
				id: "bad-stream",
				label: "Bad Stream",
				surfaceKind: "selkies-stream",
				runtimeOwnership: "attached",
				deploymentLocation: "remote",
				targetUrl: "https://example.com/app",
				streamBackendUrl: "https://example.com/stream",
				cdpEndpoint: "https://example.com/cdp",
				profilePath: null,
				host: "example.com",
				createdAt: 1,
				updatedAt: 2,
			}),
		).toThrow(/selkies-stream lanes must not set targetUrl/)
	})

	test("returns surface url by surface kind", () => {
		expect(
			getBrowserLaneSurfaceUrl({
				surfaceKind: "direct-iframe",
				targetUrl: "https://example.com/app",
				streamBackendUrl: "https://example.com/stream",
			}),
		).toBe("https://example.com/app")
		expect(
			getBrowserLaneSurfaceUrl({
				surfaceKind: "selkies-stream",
				targetUrl: "https://example.com/app",
				streamBackendUrl: "https://example.com/stream",
			}),
		).toBe("https://example.com/stream")
	})
})
