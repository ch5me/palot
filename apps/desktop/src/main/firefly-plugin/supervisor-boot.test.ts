import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import * as path from "node:path"

import { _resetPluginAuthorityForTests, getPluginLifecycleStore } from "./authority"
import {
	_resetSupervisorBootForTests,
	bootPluginWorkerSupervisor,
	discoverPluginWorkerEntries,
	disposePluginWorkerSupervisor,
	getBootedPluginWorkerSupervisor,
} from "./supervisor-boot"

const NOTES_PLUGIN_ID = "firefly.built-in.surface.notes"

afterEach(async () => {
	await disposePluginWorkerSupervisor()
	_resetSupervisorBootForTests()
	_resetPluginAuthorityForTests()
})

describe("discoverPluginWorkerEntries", () => {
	test("finds id-keyed (packaged) and short-dir (dev) worker entries deterministically", () => {
		const present = new Set([
			"/packaged/firefly.built-in.surface.notes/worker.mjs",
			"/dev/review/worker.js",
		])
		const entries = discoverPluginWorkerEntries({
			pluginIds: [NOTES_PLUGIN_ID, "firefly.built-in.surface.review", "acme.acme-notebook"],
			roots: ["/packaged", "/dev"],
			existsSync: (p) => present.has(p),
		})
		expect(entries).toEqual([
			{
				pluginId: NOTES_PLUGIN_ID,
				entryPath: "/packaged/firefly.built-in.surface.notes/worker.mjs",
			},
			{
				pluginId: "firefly.built-in.surface.review",
				entryPath: "/dev/review/worker.js",
			},
		])
	})

	test("id-keyed directory wins over short-dir; .mjs wins over .js", () => {
		const present = new Set([
			"/root/firefly.built-in.surface.notes/worker.mjs",
			"/root/firefly.built-in.surface.notes/worker.js",
			"/root/notes/worker.mjs",
		])
		const entries = discoverPluginWorkerEntries({
			pluginIds: [NOTES_PLUGIN_ID],
			roots: ["/root"],
			existsSync: (p) => present.has(p),
		})
		expect(entries).toEqual([
			{ pluginId: NOTES_PLUGIN_ID, entryPath: "/root/firefly.built-in.surface.notes/worker.mjs" },
		])
	})

	test("plugins without a worker entry are simply absent (panel-only is not an error)", () => {
		const entries = discoverPluginWorkerEntries({
			pluginIds: [NOTES_PLUGIN_ID],
			roots: ["/nowhere"],
			existsSync: () => false,
		})
		expect(entries).toEqual([])
	})
})

describe("bootPluginWorkerSupervisor", () => {
	test("boots with zero workers when no catalog plugin ships a worker entry", async () => {
		const result = bootPluginWorkerSupervisor({ roots: [] })
		expect(result.supervised).toEqual([])
		expect(result.supervisor.listSummaries()).toEqual([])
		expect(getBootedPluginWorkerSupervisor()).toBe(result.supervisor)
	})

	test("is idempotent: second call returns the live instance", () => {
		const first = bootPluginWorkerSupervisor({ roots: [] })
		const second = bootPluginWorkerSupervisor({ roots: [] })
		expect(second).toBe(first)
	})

	test("activates a real worker_thread for a catalog plugin that ships a worker entry", async () => {
		const root = mkdtempSync(path.join(tmpdir(), "elf-supervisor-boot-"))
		try {
			// Give the REAL notes catalog plugin a worker entry on a scanned root.
			const pluginDir = path.join(root, NOTES_PLUGIN_ID)
			mkdirSync(pluginDir, { recursive: true })
			writeFileSync(
				path.join(pluginDir, "worker.mjs"),
				[
					'import { parentPort } from "node:worker_threads"',
					'parentPort.postMessage({ type: "ready" })',
					'parentPort.on("message", (msg) => {',
					'  if (msg && msg.type === "activate") {',
					'    parentPort.postMessage({ type: "activated", pluginId: msg.pluginId, registeredCommands: [], registeredTools: [] })',
					'  }',
					'})',
					'setInterval(() => parentPort.postMessage({ type: "heartbeat" }), 10)',
				].join("\n"),
			)

			const result = bootPluginWorkerSupervisor({ roots: [root] })
			expect(result.supervised).toEqual([
				{ pluginId: NOTES_PLUGIN_ID, entryPath: path.join(pluginDir, "worker.mjs") },
			])

			// The fixture posts ready (transport-up), then handles `activate` and posts
			// `activated` → the locked reducer reaches `active`.
			await waitFor(() => {
				const summary = result.supervisor.getSummary(NOTES_PLUGIN_ID)
				return summary?.state === "active"
			})
			const summary = result.supervisor.getSummary(NOTES_PLUGIN_ID)
			expect(summary?.state).toBe("active")
			expect(summary?.acceptingCalls).toBe(true)
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(root, { recursive: true, force: true })
		}
	})

	test("registers but does NOT activate a plugin disabled in the lifecycle store", () => {
		const root = mkdtempSync(path.join(tmpdir(), "elf-supervisor-boot-disabled-"))
		try {
			const pluginDir = path.join(root, NOTES_PLUGIN_ID)
			mkdirSync(pluginDir, { recursive: true })
			writeFileSync(path.join(pluginDir, "worker.mjs"), "// never spawned\n")
			getPluginLifecycleStore().setEnabled(NOTES_PLUGIN_ID, false)

			let spawned = 0
			const result = bootPluginWorkerSupervisor({
				roots: [root],
				spawnWorker: () => {
					spawned += 1
					throw new Error("must not spawn a disabled plugin")
				},
			})
			expect(result.supervised.length).toBe(1)
			expect(spawned).toBe(0)
			const summary = result.supervisor.getSummary(NOTES_PLUGIN_ID)
			expect(summary?.state).not.toBe("active")
		} finally {
			rmSync(root, { recursive: true, force: true })
		}
	})
})

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
	const startedAt = Date.now()
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("waitFor timed out")
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}
