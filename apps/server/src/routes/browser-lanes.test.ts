import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import browserLaneRoutes, {
	injectBrowserLanePageShim,
	resolveBrowserLaneProxyTarget,
} from "./browser-lanes"

function setupTempRegistry() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-server-browser-lanes-"))
	const configHome = path.join(root, "config")
	const registryDir = path.join(configHome, "elf", "browser-lanes")
	mkdirSync(registryDir, { recursive: true })
	process.env.XDG_CONFIG_HOME = configHome
	writeFileSync(
		path.join(registryDir, "lanes.json"),
		JSON.stringify({
			version: 1,
			lanes: [
				{
					id: "default",
					label: "Default",
					surfaceKind: "selkies-stream",
					runtimeOwnership: "managed-local",
					deploymentLocation: "local",
					targetUrl: null,
					streamBackendUrl: "http://127.0.0.1:58406/",
					cdpEndpoint: null,
					profilePath: null,
					host: "127.0.0.1",
					createdAt: 1,
					updatedAt: 1,
				},
			],
		}),
		"utf-8",
	)
	return () => rmSync(root, { recursive: true, force: true })
}

function getRegistryFilePath(): string {
	return path.join(process.env.XDG_CONFIG_HOME!, "elf", "browser-lanes", "lanes.json")
}

function writeRegistry(payload: unknown): void {
	mkdirSync(path.dirname(getRegistryFilePath()), { recursive: true })
	writeFileSync(getRegistryFilePath(), JSON.stringify(payload, null, "\t"), "utf-8")
}

function readRegistry(): {
	version: number
	lanes: Array<Record<string, unknown>>
} {
	return JSON.parse(readFileSync(getRegistryFilePath(), "utf-8"))
}

describe("resolveBrowserLaneProxyTarget", () => {
	test("maps browser websocket path to the lane websocket endpoint", async () => {
		const cleanup = setupTempRegistry()
		try {
			await expect(
				resolveBrowserLaneProxyTarget(
					"http://127.0.0.1:30206/browser/default/websockets?token=abc",
					"ws:",
				),
			).resolves.toBe("ws://127.0.0.1:58406/websockets?token=abc")
		} finally {
			cleanup()
		}
	})

	test("preserves upstream base paths for attached lanes", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "prefixed",
						label: "Prefixed",
						surfaceKind: "selkies-stream",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: null,
						streamBackendUrl: "https://example.com/browser/lane-123/",
						cdpEndpoint: null,
						profilePath: null,
						host: "example.com",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})
			await expect(
				resolveBrowserLaneProxyTarget(
					"http://127.0.0.1:30206/browser/prefixed/assets/app.js?token=abc",
					"http:",
				),
			).resolves.toBe("http://example.com/browser/lane-123/assets/app.js?token=abc")
		} finally {
			cleanup()
		}
	})

	test("migrates legacy direct iframe-ish lane rows", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({
				version: 1,
				lanes: [
					{
						id: "legacy-iframe",
						label: "Legacy Iframe",
						mode: "remote",
						runtime: "remote-attached",
						streamBackendUrl: "https://example.com/app",
						cdpEndpoint: null,
						createdAt: 10,
						updatedAt: 20,
					},
				],
			})
			await expect(
				resolveBrowserLaneProxyTarget("http://127.0.0.1:30206/browser/legacy-iframe", "http:"),
			).resolves.toBe("http://example.com/app")
		} finally {
			cleanup()
		}
	})
})

describe("browser lane route bootstrap", () => {
	test("recreates default registry on empty lane array", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({ version: 1, lanes: [] })
			const res = await browserLaneRoutes.request("/")
			expect(res.status).toBe(200)
			const body = (await res.json()) as Array<Record<string, unknown>>
			expect(body).toHaveLength(1)
			expect(body[0]?.id).toBe("default")

			const persisted = readRegistry()
			expect(persisted.version).toBe(2)
			expect(persisted.lanes).toHaveLength(1)
			expect(persisted.lanes[0]?.surfaceKind).toBe("selkies-stream")
		} finally {
			cleanup()
		}
	})

	test("rewrites legacy rows to canonical persisted shape on read", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({
				version: 1,
				lanes: [
					{
						id: "legacy-remote",
						label: "Legacy Remote",
						mode: "remote",
						runtime: "remote-attached",
						streamBackendUrl: "https://example.com/app",
						cdpEndpoint: null,
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})
			const res = await browserLaneRoutes.request("/")
			expect(res.status).toBe(200)
			const body = (await res.json()) as Array<Record<string, unknown>>
			expect(body[0]?.surfaceKind).toBe("direct-iframe")
			expect(body[0]?.targetUrl).toBe("https://example.com/app")
			expect(body[0]?.streamBackendUrl).toBeNull()

			const persisted = readRegistry()
			expect(persisted.version).toBe(2)
			expect(persisted.lanes[0]?.runtimeOwnership).toBe("attached")
			expect(persisted.lanes[0]?.targetUrl).toBe("https://example.com/app")
		} finally {
			cleanup()
		}
	})

	test("attached lane health never falls through to managed profile states", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "attached-stream",
						label: "Attached Stream",
						surfaceKind: "selkies-stream",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: null,
						streamBackendUrl: "http://127.0.0.1:1/",
						cdpEndpoint: null,
						profilePath: "/tmp/ignored-profile",
						host: "example.com",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})
			const res = await browserLaneRoutes.request("/attached-stream/health")
			expect(res.status).toBe(200)
			const body = (await res.json()) as Record<string, unknown>
			expect(body.status).toBe("error")
			expect(body.message).toBe("Attached lane unreachable or not configured")
		} finally {
			cleanup()
		}
	})

	test("route health mirrors direct iframe semantics", async () => {
		const cleanup = setupTempRegistry()
		try {
			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "direct-target",
						label: "Direct Target",
						surfaceKind: "direct-iframe",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: "http://127.0.0.1:1/",
						streamBackendUrl: null,
						cdpEndpoint: "http://127.0.0.1:9222",
						profilePath: null,
						host: "127.0.0.1",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})
			const res = await browserLaneRoutes.request("/direct-target/health")
			expect(res.status).toBe(200)
			const body = (await res.json()) as Record<string, unknown>
			expect(body.status).toBe("error")
			expect(body.message).toBe("Direct iframe unreachable or not configured")
			expect((body.cdp as Record<string, unknown>).state).toBe("not-applicable")
		} finally {
			cleanup()
		}
	})

	test("managed-local lane health degrades when stream is ready but cdp is unavailable", async () => {
		const cleanup = setupTempRegistry()
		const originalFetch = globalThis.fetch
		try {
			globalThis.fetch = Object.assign(
				async (input: RequestInfo | URL, _init?: RequestInit) => {
					const url =
						typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
					if (url === "http://127.0.0.1:3901/") {
						return new Response(null, { status: 200 })
					}
					if (url === "http://127.0.0.1:9222/json/version") {
						throw new Error("cdp down")
					}
					return new Response(null, { status: 404 })
				},
				{ preconnect: fetch.preconnect.bind(fetch) },
			) as unknown as typeof fetch

			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "managed-stream",
						label: "Managed Stream",
						surfaceKind: "selkies-stream",
						runtimeOwnership: "managed-local",
						deploymentLocation: "local",
						targetUrl: null,
						streamBackendUrl: "http://127.0.0.1:3901/",
						cdpEndpoint: "http://127.0.0.1:9222",
						profilePath: "/tmp/profile",
						host: "127.0.0.1",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})

			const res = await browserLaneRoutes.request("/managed-stream/health")
			expect(res.status).toBe(200)
			const body = (await res.json()) as Record<string, unknown>
			expect(body.status).toBe("degraded")
			expect(body.message).toBe("Stream route ready, CDP probe pending")
			expect((body.stream as Record<string, unknown>).state).toBe("ready")
			expect((body.cdp as Record<string, unknown>).state).toBe("failed")
		} finally {
			globalThis.fetch = originalFetch
			cleanup()
		}
	})
})

describe("injectBrowserLanePageShim", () => {
	test("injects before module scripts", () => {
		const html = '<html><head><script type="module" src="./assets/index.js"></script></head></html>'
		const rewritten = injectBrowserLanePageShim(html)
		expect(rewritten).toContain("data-elf-browser-lane-shim")
		expect(rewritten.indexOf("data-elf-browser-lane-shim")).toBeLessThan(
			rewritten.indexOf('script type="module"'),
		)
	})

	test("includes chrome hiding and clipboard bridge hooks", () => {
		const html = injectBrowserLanePageShim("<html><head></head><body></body></html>")
		expect(html).toContain("Selkies")
		expect(html).toContain("elf-browser-lane-clipboard-copy")
		expect(html).toContain("data-elf-browser-main")
	})

	test("does not inject twice", () => {
		const html = injectBrowserLanePageShim("<html><head></head><body></body></html>")
		expect(injectBrowserLanePageShim(html)).toBe(html)
	})

	test("does not rewrite direct iframe html responses", async () => {
		const cleanup = setupTempRegistry()
		const originalFetch = globalThis.fetch
		try {
			globalThis.fetch = Object.assign(
				async () =>
					new Response("<html><body>direct</body></html>", {
						headers: { "content-type": "text/html" },
					}),
				{ preconnect: fetch.preconnect.bind(fetch) },
			) as unknown as typeof fetch
			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "direct-html",
						label: "Direct Html",
						surfaceKind: "direct-iframe",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: "https://example.com/app",
						streamBackendUrl: null,
						cdpEndpoint: null,
						profilePath: null,
						host: "example.com",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})
			const response = await browserLaneRoutes.request("/direct-html", {
				headers: { accept: "text/html" },
			})
			expect(response.status).toBe(200)
			const body = await response.text()
			expect(body).not.toContain("data-elf-browser-lane-shim")
		} finally {
			globalThis.fetch = originalFetch
			cleanup()
		}
	})

	test("does not inject managed local auth header for direct iframe transport", async () => {
		const cleanup = setupTempRegistry()
		const originalFetch = globalThis.fetch
		try {
			let forwardedAuthorization: string | null = null
			globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
				forwardedAuthorization = new Headers(init?.headers).get("authorization")
				return new Response("<html><body>direct</body></html>", {
					headers: { "content-type": "text/html" },
				})
			}) as typeof fetch

			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "direct-html",
						label: "Direct Html",
						surfaceKind: "direct-iframe",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: "https://example.com/app",
						streamBackendUrl: null,
						cdpEndpoint: null,
						profilePath: null,
						host: "example.com",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})

			const response = await browserLaneRoutes.request("/direct-html", {
				headers: { accept: "text/html" },
			})
			expect(response.status).toBe(200)
			expect(forwardedAuthorization).toBeNull()
		} finally {
			globalThis.fetch = originalFetch
			cleanup()
		}
	})

	test("does not inject managed local auth header for direct iframe health probes", async () => {
		const cleanup = setupTempRegistry()
		const originalFetch = globalThis.fetch
		try {
			let forwardedAuthorization: string | null = null
			globalThis.fetch = Object.assign(
				async (_input: RequestInfo | URL, init?: RequestInit) => {
					forwardedAuthorization = new Headers(init?.headers).get("authorization")
					return new Response(null, { status: 200 })
				},
				{ preconnect: fetch.preconnect.bind(fetch) },
			) as unknown as typeof fetch

			writeRegistry({
				version: 2,
				lanes: [
					{
						id: "direct-health",
						label: "Direct Health",
						surfaceKind: "direct-iframe",
						runtimeOwnership: "attached",
						deploymentLocation: "remote",
						targetUrl: "https://example.com/app",
						streamBackendUrl: null,
						cdpEndpoint: null,
						profilePath: null,
						host: "example.com",
						createdAt: 1,
						updatedAt: 2,
					},
				],
			})

			const response = await browserLaneRoutes.request("/direct-health/health")
			expect(response.status).toBe(200)
			expect(forwardedAuthorization).toBeNull()
		} finally {
			globalThis.fetch = originalFetch
			cleanup()
		}
	})
})
