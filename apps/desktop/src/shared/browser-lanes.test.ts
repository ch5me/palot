import { describe, expect, test } from "bun:test"
import {
	assertValidBrowserLaneId,
	createEmptyBrowserLaneHealth,
	getBrowserLaneStoragePaths,
	getBrowserLaneStreamPath,
	inflateBrowserLane,
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
			mode: "local",
			runtime: "docker-chromium",
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
	})
})
