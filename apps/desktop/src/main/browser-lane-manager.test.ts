import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
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

test("browser lane manager seeds default lane", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await import("./browser-lane-manager")
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
		const manager = await import("./browser-lane-manager")
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "remote-default",
			label: "Remote Default",
			streamBackendUrl: "https://remote.example/browser/remote-default/",
			cdpEndpoint: "https://remote.example/cdp/remote-default",
		})
		const lane = await manager.getBrowserLane("remote-default")
		assert.equal(lane?.mode, "remote")
		assert.equal(lane?.streamBackendUrl, "https://remote.example/browser/remote-default/")
	} finally {
		cleanup()
	}
})

test("browser lane manager reports remote lane health without local docker", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await import("./browser-lane-manager")
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createRemoteBrowserLane({
			id: "remote-ready",
			label: "Remote Ready",
			streamBackendUrl: "https://remote.example/browser/remote-ready/",
			cdpEndpoint: "https://remote.example/devtools/browser/remote-ready",
		})
		const ensured = await manager.ensureBrowserLane("remote-ready")
		assert.equal(ensured.health.stream.state, "ready")
		assert.equal(ensured.health.cdp.state, "ready")
		const health = await manager.refreshBrowserLaneHealth("remote-ready")
		assert.equal(health.stream.state, "ready")
		assert.equal(health.cdp.state, "ready")
		assert.equal(health.message, "Remote lane attached and reachable")
	} finally {
		cleanup()
	}
})

test("browser lane manager reset profile is explicit and preserves clean-state message", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await import("./browser-lane-manager")
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createBrowserLane({
			id: "local-reset",
			label: "Local Reset",
			mode: "local",
			runtime: "docker-chromium",
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

test("browser lane manager probes local stream and cdp on refresh", async () => {
	const cleanup = setupTempXdg()
	try {
		const manager = await import("./browser-lane-manager")
		await manager.shutdownBrowserLaneManager()
		await manager.initBrowserLaneManager()
		await manager.createBrowserLane({
			id: "local-probe",
			label: "Local Probe",
			mode: "local",
			runtime: "docker-chromium",
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
