import { describe, expect, test } from "bun:test"
import {
	buildBrowserPanelSurfaceUrl,
	buildNavigableUrl,
	getBrowserPanelNavigationStrategy,
	getBoundBrowserLaneId,
	pushBrowserHistory,
	resolveBrowserPanelLaneId,
} from "./browser"

describe("buildNavigableUrl", () => {
	test("passes through http(s) URLs unchanged", () => {
		expect(buildNavigableUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1")
		expect(buildNavigableUrl("http://example.com")).toBe("http://example.com")
	})

	test("passes through file:// and about: URLs", () => {
		expect(buildNavigableUrl("file:///Users/me/index.html")).toBe("file:///Users/me/index.html")
		expect(buildNavigableUrl("about:blank")).toBe("about:blank")
	})

	test("prefixes bare hostnames with https://", () => {
		expect(buildNavigableUrl("example.com")).toBe("https://example.com")
		expect(buildNavigableUrl("docs.opencode.ai/cli")).toBe("https://docs.opencode.ai/cli")
	})

	test("rejects empty / whitespace / embedded spaces", () => {
		expect(buildNavigableUrl("")).toBeNull()
		expect(buildNavigableUrl("   ")).toBeNull()
		expect(buildNavigableUrl("foo bar.com")).toBeNull()
	})

	test("rejects URLs that don't look like hostnames", () => {
		expect(buildNavigableUrl("/relative/path")).toBeNull()
		expect(buildNavigableUrl(":no-leading-host")).toBeNull()
	})
})

describe("pushBrowserHistory", () => {
	test("drops empty and about:blank entries", () => {
		expect(pushBrowserHistory([], "")).toEqual([])
		expect(pushBrowserHistory([], "about:blank")).toEqual([])
	})

	test("deduplicates consecutive entries", () => {
		const history = ["https://a.com"]
		expect(pushBrowserHistory(history, "https://a.com")).toEqual(history)
	})

	test("moves a re-visited URL to the front", () => {
		const history = ["https://b.com", "https://a.com"]
		expect(pushBrowserHistory(history, "https://a.com")).toEqual(["https://a.com", "https://b.com"])
	})

	test("caps history at MAX_HISTORY", () => {
		const seeded = Array.from({ length: 10 }, (_, i) => `https://host${i}.com`)
		const next = pushBrowserHistory(seeded, "https://newest.com")
		expect(next).toHaveLength(8)
		expect(next[0]).toBe("https://newest.com")
	})
})

describe("buildBrowserPanelSurfaceUrl", () => {
	const lane = {
		streamPath: "/browser/default/",
		desktopStreamUrl: "http://elf-browser-lane.local/browser/default/",
	}

	test("uses desktop protocol URL inside Electron", () => {
		expect(buildBrowserPanelSurfaceUrl(lane, { isElectron: true })).toBe(
			"http://elf-browser-lane.local/browser/default/",
		)
	})

	test("uses HTTP backend URL in browser mode", () => {
		expect(
			buildBrowserPanelSurfaceUrl(lane, {
				isElectron: false,
				backendBaseUrl: "http://127.0.0.1:30206",
			}),
		).toBe("http://127.0.0.1:30206/browser/default/")
	})

	test("uses direct iframe target for direct-iframe lanes", () => {
		expect(
			buildBrowserPanelSurfaceUrl({
				streamPath: "/browser/direct/",
				desktopStreamUrl: "http://127.0.0.1:8077",
				surfaceKind: "direct-iframe",
			}),
		).toBe("http://127.0.0.1:8077")
	})
})

describe("browser panel navigation strategy", () => {
	test("bypasses cdp for direct iframe surfaces", () => {
		expect(getBrowserPanelNavigationStrategy("direct-iframe")).toBe("direct-url")
	})

	test("uses cdp for streamed surfaces", () => {
		expect(getBrowserPanelNavigationStrategy("selkies-stream")).toBe("cdp")
	})
})

describe("browser panel lane binding", () => {
	test("prefers bound lane over global fallback", () => {
		expect(resolveBrowserPanelLaneId("lane_bound", "lane_global")).toBe("lane_bound")
	})

	test("falls back to global lane when no binding exists", () => {
		expect(resolveBrowserPanelLaneId(null, "lane_global")).toBe("lane_global")
	})

	test("ignores released bindings", () => {
		expect(
			getBoundBrowserLaneId({
				id: "binding-1",
				openCodeSessionId: "ses_1",
				browserLaneId: "lane_bound",
				magicBrowserSessionId: null,
				status: "released",
				createdAt: 1,
				updatedAt: 2,
				releasedAt: 3,
			}),
		).toBeNull()
	})
})
