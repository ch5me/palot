/**
 * Tests for F3 — `registerInstalledExtensionWorker` (live post-boot
 * worker registration + spawn gate).
 *
 * Covered:
 *   1. A signed-third-party + verified installation → registers AND activates
 *      (worker goes spawn → activate → activated → active).
 *   2. An installation with signatureState !== "verified" → registers but is
 *      NEVER activated (spawn gate enforced).
 *   3. A node-worker install whose worker.mjs is missing → throws loud.
 *   4. Calling before bootPluginWorkerSupervisor → throws loud.
 *
 * The tests use real worker_threads fixtures (inline worker scripts) so the
 * full activate → activated handshake actually executes, proving the live
 * path end-to-end without a GUI.
 */

import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import * as nodePath from "node:path"

import { _resetPluginAuthorityForTests } from "./authority"
import {
	_resetSupervisorBootForTests,
	bootPluginWorkerSupervisor,
	disposePluginWorkerSupervisor,
	registerInstalledExtensionWorker,
	type InstalledExtensionForRegistration,
	type RegisterInstalledExtensionWorkerDeps,
} from "./supervisor-boot"
import { _resetWorkerInvokeRouterForTests } from "./worker-invoke-router"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * A minimal valid worker script that:
 *   1. Posts `ready` (transport-up).
 *   2. Listens for `activate` and replies with `activated` (lifecycle trigger).
 *   3. Sends a heartbeat every 50 ms to keep the hang-scanner happy.
 */
const VALID_WORKER_SCRIPT = [
	'import { parentPort } from "node:worker_threads"',
	'if (!parentPort) throw new Error("no parentPort")',
	'parentPort.postMessage({ type: "ready" })',
	'parentPort.on("message", (msg) => {',
	'  if (msg && msg.type === "activate") {',
	'    parentPort.postMessage({ type: "activated", pluginId: msg.pluginId, registeredCommands: [], registeredTools: [] })',
	'  }',
	'})',
	'setInterval(() => parentPort.postMessage({ type: "heartbeat" }), 50)',
].join("\n")

// Fake plugin id for installed-extension tests.
const INSTALLED_PLUGIN_ID = "bobsoft.linter"

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterEach(async () => {
	await disposePluginWorkerSupervisor()
	_resetSupervisorBootForTests()
	_resetPluginAuthorityForTests()
	_resetWorkerInvokeRouterForTests()
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
	const startedAt = Date.now()
	while (!predicate()) {
		if (Date.now() - startedAt > timeoutMs) {
			throw new Error("waitFor timed out")
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
}

/**
 * No-op catalog refresh for tests — avoids the real DB path in
 * `refreshPluginCatalogAsync` (which requires a migration dir + libsql).
 */
const noopRefreshDeps: RegisterInstalledExtensionWorkerDeps = {
	refreshCatalog: async () => undefined,
}

/**
 * Boot the supervisor with zero built-in workers (roots=[]) and return it.
 * Keeps boot isolated from the real catalog disk roots.
 * `resolveActivation: null` skips the DB-backed grant resolver so tests
 * don't need a real libsql DB.
 */
function bootEmpty() {
	return bootPluginWorkerSupervisor({ roots: [], resolveActivation: null })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerInstalledExtensionWorker — spawn gate + live registration", () => {
	test("signed-third-party + verified → registers AND activates (worker reaches active)", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-verified-"))
		try {
			// Write a valid worker.mjs into the tmp dir (simulates unpackedPath).
			writeFileSync(nodePath.join(tmpDir, "worker.mjs"), VALID_WORKER_SCRIPT)

			const { supervisor } = bootEmpty()

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-001",
				unpackedPath: tmpDir,
				trustTier: "signed-third-party",
				signatureState: "verified",
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: true,
			}

			await registerInstalledExtensionWorker(installation, noopRefreshDeps)

			// The worker must reach `active` via the full activate → activated handshake.
			await waitFor(() => supervisor.getSummary(INSTALLED_PLUGIN_ID)?.state === "active")

			const summary = supervisor.getSummary(INSTALLED_PLUGIN_ID)
			expect(summary?.state).toBe("active")
			expect(summary?.acceptingCalls).toBe(true)
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})

	test("signatureState !== 'verified' → registered-but-never-activated (spawn gate)", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-unverified-"))
		try {
			// Write a valid worker.mjs (it exists on disk, but the spawn gate blocks activation).
			writeFileSync(nodePath.join(tmpDir, "worker.mjs"), VALID_WORKER_SCRIPT)

			let spawnCount = 0
			const { supervisor } = bootPluginWorkerSupervisor({
				roots: [],
				resolveActivation: null,
				spawnWorker: (input) => {
					spawnCount += 1
					// Delegate to a real worker_thread if the gate somehow leaks.
					const { Worker } = require("node:worker_threads") as typeof import("node:worker_threads")
					const w = new Worker(input.entryPath, { execArgv: [] })
					return {
						postMessage: (msg: unknown) => w.postMessage(msg),
						terminate: () => w.terminate(),
						onMessage: (cb: (m: unknown) => void) => w.on("message", cb),
						onExit: (cb: (code: number | null) => void) => w.on("exit", cb),
						onError: (cb: (e: Error) => void) => w.on("error", cb),
					}
				},
			})

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-002",
				unpackedPath: tmpDir,
				trustTier: "unsigned-third-party",
				signatureState: "unsigned",
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: true,
			}

			// Should resolve without error (gate logs a warning but doesn't throw).
			await registerInstalledExtensionWorker(installation, noopRefreshDeps)

			// Plugin must be registered (visible to supervisor) …
			const summary = supervisor.getSummary(INSTALLED_PLUGIN_ID)
			expect(summary).not.toBeNull()

			// … but must NEVER have been spawned (no spawn call) …
			expect(spawnCount).toBe(0)

			// … and must NOT be in `active` or `activating` state.
			expect(summary?.state).not.toBe("active")
			expect(summary?.state).not.toBe("activating")
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})

	test("signed-third-party + unverified signatureState → spawn gate blocks activation", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-sig-mismatch-"))
		try {
			writeFileSync(nodePath.join(tmpDir, "worker.mjs"), VALID_WORKER_SCRIPT)

			let spawnCount = 0
			const { supervisor } = bootPluginWorkerSupervisor({
				roots: [],
				resolveActivation: null,
				spawnWorker: () => {
					spawnCount += 1
					throw new Error("must not spawn unverified worker")
				},
			})

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-003",
				unpackedPath: tmpDir,
				trustTier: "signed-third-party",
				signatureState: "unverified", // signature present but failed verification
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: true,
			}

			await registerInstalledExtensionWorker(installation, noopRefreshDeps)

			// Registered but not spawned.
			expect(spawnCount).toBe(0)
			const summary = supervisor.getSummary(INSTALLED_PLUGIN_ID)
			expect(summary).not.toBeNull()
			expect(summary?.state).not.toBe("active")
			expect(summary?.state).not.toBe("activating")
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})

	test("missing worker.mjs → fails loud (throws with informative message)", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-missing-worker-"))
		try {
			// Intentionally do NOT write worker.mjs.
			bootEmpty()

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-004",
				unpackedPath: tmpDir,
				trustTier: "signed-third-party",
				signatureState: "verified",
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: true,
			}

			await expect(registerInstalledExtensionWorker(installation)).rejects.toThrow(
				"worker.mjs not found",
			)
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})

	test("calling before boot → throws loud", async () => {
		// Supervisor not booted yet (afterEach reset ensures this).
		const installation: InstalledExtensionForRegistration = {
			installationId: "inst-005",
			unpackedPath: "/nonexistent",
			trustTier: "signed-third-party",
			signatureState: "verified",
			pluginId: INSTALLED_PLUGIN_ID,
			enabled: true,
		}

		await expect(registerInstalledExtensionWorker(installation)).rejects.toThrow(
			"supervisor not yet booted",
		)
	})

	test("local-dev trustTier → spawn gate passes (allow-unsigned-with-consent dev path)", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-local-dev-"))
		try {
			writeFileSync(nodePath.join(tmpDir, "worker.mjs"), VALID_WORKER_SCRIPT)

			const { supervisor } = bootEmpty()

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-006",
				unpackedPath: tmpDir,
				trustTier: "local-dev",
				signatureState: "unsigned", // dev path: no signature required
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: true,
			}

			await registerInstalledExtensionWorker(installation, noopRefreshDeps)

			// local-dev is the allow-unsigned-with-consent path — should activate.
			await waitFor(() => supervisor.getSummary(INSTALLED_PLUGIN_ID)?.state === "active")

			const summary = supervisor.getSummary(INSTALLED_PLUGIN_ID)
			expect(summary?.state).toBe("active")
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})

	test("enabled=false → registered but not activated regardless of trust", async () => {
		const tmpDir = mkdtempSync(nodePath.join(tmpdir(), "elf-f3-disabled-"))
		try {
			writeFileSync(nodePath.join(tmpDir, "worker.mjs"), VALID_WORKER_SCRIPT)

			let spawnCount = 0
			const { supervisor } = bootPluginWorkerSupervisor({
				roots: [],
				resolveActivation: null,
				spawnWorker: () => {
					spawnCount += 1
					throw new Error("must not spawn a disabled extension")
				},
			})

			const installation: InstalledExtensionForRegistration = {
				installationId: "inst-007",
				unpackedPath: tmpDir,
				trustTier: "signed-third-party",
				signatureState: "verified",
				pluginId: INSTALLED_PLUGIN_ID,
				enabled: false,
			}

			await registerInstalledExtensionWorker(installation, noopRefreshDeps)

			expect(spawnCount).toBe(0)
			const summary = supervisor.getSummary(INSTALLED_PLUGIN_ID)
			expect(summary).not.toBeNull()
			expect(summary?.state).not.toBe("active")
		} finally {
			await disposePluginWorkerSupervisor()
			rmSync(tmpDir, { recursive: true, force: true })
		}
	})
})
