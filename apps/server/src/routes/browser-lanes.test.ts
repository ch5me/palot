import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { injectBrowserLanePageShim, resolveBrowserLaneProxyTarget } from "./browser-lanes"

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
					streamBackendUrl: "http://127.0.0.1:58406/",
				},
			],
		}),
		"utf-8",
	)
	return () => rmSync(root, { recursive: true, force: true })
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

	test("returns null for non-browser websocket paths", async () => {
		await expect(
			resolveBrowserLaneProxyTarget("http://127.0.0.1:30206/api/servers", "ws:"),
		).resolves.toBeNull()
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

	test("does not inject twice", () => {
		const html = injectBrowserLanePageShim("<html><head></head><body></body></html>")
		expect(injectBrowserLanePageShim(html)).toBe(html)
	})
})
