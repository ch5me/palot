import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-lanes-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

function getRegistryFilePath(): string {
	return path.join(process.env.XDG_CONFIG_HOME!, "elf", "browser-lanes", "lanes.json")
}

function writeRegistryFixture(payload: unknown): void {
	const registryFile = getRegistryFilePath()
	mkdirSync(path.dirname(registryFile), { recursive: true })
	writeFileSync(registryFile, JSON.stringify(payload, null, "\t"), "utf-8")
}

function readRegistryFixture(): unknown {
	return JSON.parse(readFileSync(getRegistryFilePath(), "utf-8"))
}

async function loadManager() {
	return await import(`./browser-lane-manager?test=${Date.now()}-${Math.random()}`)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | null = null
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
			}),
		])
	} finally {
		if (timeout) clearTimeout(timeout)
	}
}

test("browser lane manager seeds default lane", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		const lanes = await manager.listBrowserLanes()
		assert.equal(lanes.length, 1)
		assert.equal(lanes[0]?.id, "default")
	} finally {
		cleanup()
	}
})

test("browser lane manager persists created remote lane", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "remote-default",
			label: "Remote Default",
			surfaceKind: "selkies-stream",
			streamBackendUrl: "https://remote.example/browser/remote-default/",
			cdpEndpoint: "https://remote.example/cdp/remote-default",
		})
		const lane = await manager.getBrowserLane("remote-default")
		assert.equal(lane?.runtimeOwnership, "attached")
		assert.equal(lane?.streamBackendUrl, "https://remote.example/browser/remote-default/")
	} finally {
		cleanup()
	}
})

test("browser lane manager reports remote lane health without local docker", async () => {
	const cleanup = setupTempXdg()
	const originalFetch = globalThis.fetch
	try {
		globalThis.fetch = Object.assign(async () => new Response(null, { status: 200 }), originalFetch)
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "remote-ready",
			label: "Remote Ready",
			surfaceKind: "selkies-stream",
			streamBackendUrl: "https://remote.example/browser/remote-ready/",
			cdpEndpoint: "https://remote.example/devtools/browser/remote-ready",
		})
		const ensured = await manager.ensureBrowserLane("remote-ready")
		assert.equal(ensured.health.stream.state, "ready")
		assert.equal(ensured.health.cdp.state, "ready")
		const health = await manager.refreshBrowserLaneHealth("remote-ready")
		assert.equal(health.stream.state, "ready")
		assert.equal(health.cdp.state, "ready")
		assert.equal(health.message, "Attached stream and CDP ready")
	} finally {
		globalThis.fetch = originalFetch
		cleanup()
	}
})

test("browser lane manager persists direct iframe attached lane", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "direct-app",
			label: "Direct App",
			surfaceKind: "direct-iframe",
			targetUrl: "https://example.com/app",
			cdpEndpoint: null,
		})
		const lane = await manager.getBrowserLane("direct-app")
		assert.equal(lane?.runtimeOwnership, "attached")
		assert.equal(lane?.surfaceKind, "direct-iframe")
		assert.equal(lane?.targetUrl, "https://example.com/app")
		assert.equal(lane?.streamBackendUrl, null)
	} finally {
		cleanup()
	}
})

test("browser lane manager migrates legacy registry rows to canonical shape", async () => {
	const cleanup = setupTempXdg()
	try {
		writeRegistryFixture({
			version: 1,
			lanes: [
				{
					id: "legacy-remote",
					label: "Legacy Remote",
					mode: "remote",
					runtime: "remote-attached",
					streamBackendUrl: "https://example.com/app",
					cdpEndpoint: null,
					createdAt: 10,
					updatedAt: 20,
				},
			],
		})
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		const lane = await manager.getBrowserLane("legacy-remote")
		assert.equal(lane?.surfaceKind, "direct-iframe")
		assert.equal(lane?.runtimeOwnership, "attached")
		assert.equal(lane?.deploymentLocation, "unknown")
		assert.equal(lane?.targetUrl, "https://example.com/app")
		assert.equal(lane?.streamBackendUrl, null)

		const persisted = readRegistryFixture() as {
			version: number
			lanes: Array<Record<string, unknown>>
		}
		assert.equal(persisted.version, 2)
		assert.equal(persisted.lanes[0]?.targetUrl, "https://example.com/app")
		assert.equal(persisted.lanes[0]?.streamBackendUrl, null)
		assert.equal(persisted.lanes[0]?.runtimeOwnership, "attached")
	} finally {
		cleanup()
	}
})

test("browser lane manager recovers from malformed registry payload", async () => {
	const cleanup = setupTempXdg()
	try {
		writeRegistryFixture({ version: 1, lanes: [] })
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		const lanes = await manager.listBrowserLanes()
		assert.equal(lanes.length, 1)
		assert.equal(lanes[0]?.id, "default")

		const persisted = readRegistryFixture() as {
			version: number
			lanes: Array<Record<string, unknown>>
		}
		assert.equal(persisted.version, 2)
		assert.equal(persisted.lanes[0]?.surfaceKind, "selkies-stream")
		assert.equal(persisted.lanes[0]?.runtimeOwnership, "managed-local")
	} finally {
		cleanup()
	}
})

test("browser lane manager start does not wait on its own ensure lock", async () => {
	const cleanup = setupTempXdg()
	const originalPath = process.env.PATH
	process.env.PATH = path.join(process.env.XDG_DATA_HOME!, "missing-bin")
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createBrowserLane({
			id: "local-no-docker",
			label: "Local No Docker",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
		})
		await assert.rejects(
			() => withTimeout(manager.startBrowserLane("local-no-docker"), 1000),
			/Docker not installed/,
		)
	} finally {
		process.env.PATH = originalPath
		cleanup()
	}
})

test("browser lane manager reset profile is explicit and preserves clean-state message", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createBrowserLane({
			id: "local-reset",
			label: "Local Reset",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			profilePath: path.join(process.env.XDG_DATA_HOME!, "elf", "browser-profiles", "local-reset"),
		})
		const lane = await manager.getBrowserLane("local-reset")
		assert.ok(lane?.profilePath)
		const fs = await import("node:fs")
		fs.mkdirSync(lane.profilePath, { recursive: true })
		fs.writeFileSync(path.join(lane.profilePath, "marker.txt"), "persisted", "utf-8")
		const stopped = await manager.stopBrowserLane("local-reset")
		assert.equal(stopped.health.status, "profile-locked")
		const reset = await manager.resetBrowserLaneProfile("local-reset")
		assert.equal(reset.health.status, "profile-locked")
		assert.match(reset.health.message, /Profile reset at/)
		assert.equal(fs.existsSync(path.join(lane.profilePath, "marker.txt")), false)
	} finally {
		cleanup()
	}
})

test("browser lane manager rejects attached lane profile reset", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "attached-no-reset",
			label: "Attached No Reset",
			surfaceKind: "selkies-stream",
			streamBackendUrl: "https://example.com/stream",
			cdpEndpoint: null,
			profilePath: "/tmp/ignored-profile",
		})
		await assert.rejects(
			() => manager.resetBrowserLaneProfile("attached-no-reset"),
			/only available for managed-local lanes/,
		)
	} finally {
		cleanup()
	}
})

test("browser lane manager rejects attached lane stop", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "attached-stop",
			label: "Attached Stop",
			surfaceKind: "selkies-stream",
			streamBackendUrl: "https://example.com/stream",
			cdpEndpoint: null,
			profilePath: "/tmp/ignored-profile",
		})
		await assert.rejects(
			() => manager.stopBrowserLane("attached-stop"),
			/stop is only available for managed-local lanes/,
		)
	} finally {
		cleanup()
	}
})

test("browser lane manager rejects attached lane start and restart", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "attached-run",
			label: "Attached Run",
			surfaceKind: "selkies-stream",
			streamBackendUrl: "https://example.com/stream",
			cdpEndpoint: null,
		})
		await assert.rejects(
			() => manager.startBrowserLane("attached-run"),
			/start is only available for managed-local lanes/,
		)
		await assert.rejects(
			() => manager.restartBrowserLane("attached-run"),
			/restart is only available for managed-local lanes/,
		)
	} finally {
		cleanup()
	}
})

test("browser lane manager probes local stream and cdp on refresh", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createBrowserLane({
			id: "local-probe",
			label: "Local Probe",
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			targetUrl: null,
			streamBackendUrl: "http://127.0.0.1:1/",
			cdpEndpoint: "http://127.0.0.1:1",
			profilePath: path.join(process.env.XDG_DATA_HOME!, "elf", "browser-profiles", "local-probe"),
		})
		const fs = await import("node:fs")
		fs.mkdirSync(path.join(process.env.XDG_DATA_HOME!, "elf", "browser-profiles", "local-probe"), {
			recursive: true,
		})
		const health = await manager.refreshBrowserLaneHealth("local-probe")
		assert.equal(health.status, "profile-locked")
		assert.equal(health.message, "Profile exists but runtime has not started yet")
		assert.equal(health.stream.state, "failed")
		assert.equal(health.cdp.state, "failed")
	} finally {
		cleanup()
	}
})

test("browser lane manager probes attached direct iframe lanes without local auth", async () => {
	const cleanup = setupTempXdg()
	const originalFetch = globalThis.fetch
	try {
		const seenAuth: Array<string | null> = []
		globalThis.fetch = Object.assign(
			async (_input: RequestInfo | URL, init?: RequestInit) => {
				seenAuth.push(new Headers(init?.headers).get("authorization"))
				return new Response(null, { status: 200 })
			},
			originalFetch,
		) as typeof fetch
		const manager = await loadManager()
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "attached-direct-probe",
			label: "Attached Direct Probe",
			surfaceKind: "direct-iframe",
			targetUrl: "https://example.com/app",
			cdpEndpoint: null,
		})
		const health = await manager.refreshBrowserLaneHealth("attached-direct-probe")
		assert.equal(health.status, "running")
		assert.equal(health.message, "Direct iframe ready")
		assert.deepEqual(seenAuth, [null])
	} finally {
		globalThis.fetch = originalFetch
		cleanup()
	}
})
