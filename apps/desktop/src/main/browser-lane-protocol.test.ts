import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { getBrowserLaneDesktopUrl } from "./browser-lane-protocol"

interface HeaderRewriteResult {
	requestHeaders: Record<string, string>
}

function setupTempRegistry() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-protocol-"))
	const configHome = path.join(root, "config")
	const registryDir = path.join(configHome, "elf", "browser-lanes")
	mkdirSync(registryDir, { recursive: true })
	process.env.XDG_CONFIG_HOME = configHome
	return {
		root,
		registryFile: path.join(registryDir, "lanes.json"),
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

test("browser lane desktop url uses same local origin path", () => {
	assert.equal(getBrowserLaneDesktopUrl("default"), "http://elf-browser-lane.local/browser/default/")
})

test("browser lane desktop url uses loopback backend when ready", () => {
	assert.equal(
		getBrowserLaneDesktopUrl("default", null, "http://127.0.0.1:58406"),
		"http://127.0.0.1:58406/",
	)
})

test("browser lane desktop url uses target url for direct iframe", () => {
	assert.equal(
		getBrowserLaneDesktopUrl(
			"default",
			"https://example.com/app",
			null,
			"direct-iframe",
		),
		"https://example.com/app",
	)
})

test("protocol only injects local auth headers for managed streamed lanes", async () => {
	const { registryFile, cleanup } = setupTempRegistry()
	try {
		const { registerBrowserLaneProtocol } = await import(
			`./browser-lane-protocol?test=${Date.now()}-${Math.random()}`
		)
		writeFileSync(
			registryFile,
			JSON.stringify({
				version: 2,
				lanes: [
					{
						id: "managed",
						surfaceKind: "selkies-stream",
						runtimeOwnership: "managed-local",
						streamBackendUrl: "http://127.0.0.1:3901",
						targetUrl: null,
					},
					{
						id: "direct",
						surfaceKind: "direct-iframe",
						runtimeOwnership: "attached",
						streamBackendUrl: null,
						targetUrl: "https://example.com/app",
					},
				],
			}),
			"utf-8",
		)

		let beforeSendHeaders:
			| ((details: { url: string; requestHeaders: Record<string, string> }, callback: (result: HeaderRewriteResult) => void) => void)
			| null = null
		let handledHttp: ((request: Request) => Promise<Response>) | null = null
		const session = {
			webRequest: {
				onBeforeSendHeaders: (
					_filter: unknown,
					handler: typeof beforeSendHeaders,
				) => {
					beforeSendHeaders = handler
				},
			},
			protocol: {
				isProtocolHandled: () => false,
				handle: (_protocol: string, handler: typeof handledHttp) => {
					handledHttp = handler
				},
			},
		} as unknown as import("electron").Session

		const fetchImpl = Object.assign(
			async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
			if (url === "http://127.0.0.1:30206/browser") {
				return new Response(
					JSON.stringify([
						{ id: "managed", targetUrl: null, streamBackendUrl: "http://127.0.0.1:3901", surfaceKind: "selkies-stream" },
						{ id: "direct", targetUrl: "https://example.com/app", streamBackendUrl: null, surfaceKind: "direct-iframe" },
					]),
				)
			}
			return new Response(JSON.stringify({ authorization: new Headers(init?.headers).get("authorization") }))
			},
			{ preconnect: fetch.preconnect.bind(fetch) },
		) as typeof fetch

		await registerBrowserLaneProtocol(session, fetchImpl)

		assert.ok(beforeSendHeaders)
		assert.ok(handledHttp)

		let managedHeaders: Record<string, string> | null = null
		beforeSendHeaders?.(
			{ url: "http://127.0.0.1:3901/page", requestHeaders: {} },
			(result: HeaderRewriteResult) => {
				managedHeaders = result.requestHeaders
			},
		)
		assert.equal(managedHeaders?.Authorization?.startsWith("Basic "), true)

		let directHeaders: Record<string, string> | null = null
		beforeSendHeaders?.(
			{ url: "https://example.com/app", requestHeaders: {} },
			(result: HeaderRewriteResult) => {
				directHeaders = result.requestHeaders
			},
		)
		assert.equal(directHeaders?.Authorization, undefined)

		assert.ok(handledHttp)
		const response = await handledHttp(new Request("http://elf-browser-lane.local/browser/direct"))
		assert.ok(response)
		const body = await response.text()
		assert.equal(body.includes("Basic "), false)
	} finally {
		cleanup()
	}
})
