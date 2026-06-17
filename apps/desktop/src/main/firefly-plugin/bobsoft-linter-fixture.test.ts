/**
 * B4/E1 — bobsoft.linter fixture test.
 *
 * Verifies:
 *   1. build-plugins.ts bundles the fixture → out/plugins/bobsoft.linter/worker.mjs exists
 *   2. worker.mjs is valid ESM (has `export` or is a self-executing module; bundled
 *      entry is esm-format per build-plugins config).
 *   3. The extension module (loaded directly, no worker_threads) activates via
 *      runExtensionWorker + fake port → posts `activated` with the expected ids.
 *   4. A subsequent `invoke-command` for "bobsoft-linter-greet" returns ok:true data.
 *
 * No worker_threads spawned here — we drive the runtime + extension directly with a
 * fake port, exactly like extension-worker-runtime.test.ts does (B2 test pattern).
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { describe, it, expect, beforeAll } from "bun:test"
import { runExtensionWorker, type WorkerRuntimePort } from "./extension-worker-runtime"

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..", "..", "..")
const WORKER_MJS = path.join(REPO_ROOT, "apps", "desktop", "out", "plugins", "bobsoft.linter", "worker.mjs")
const BUILD_SCRIPT = path.join(REPO_ROOT, "scripts", "build-plugins.ts")

// ---------------------------------------------------------------------------
// Build helper — runs build-plugins.ts via bun subprocess
// ---------------------------------------------------------------------------

async function buildPlugins(): Promise<{ success: boolean; output: string }> {
	const proc = Bun.spawn(["bun", BUILD_SCRIPT], {
		cwd: REPO_ROOT,
		stdout: "pipe",
		stderr: "pipe",
	})
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	])
	return {
		success: exitCode === 0,
		output: [stdout, stderr].filter(Boolean).join("\n"),
	}
}

// ---------------------------------------------------------------------------
// Fake port (same pattern as extension-worker-runtime.test.ts)
// ---------------------------------------------------------------------------

interface FakePort extends WorkerRuntimePort {
	sent: unknown[]
	receive(raw: unknown): void
}

function makeFakePort(): FakePort {
	const listeners: Array<(raw: unknown) => void> = []
	const sent: unknown[] = []
	return {
		sent,
		post(message: unknown) {
			sent.push(message)
		},
		onMessage(listener: (raw: unknown) => void) {
			listeners.push(listener)
			return () => {
				const idx = listeners.indexOf(listener)
				if (idx !== -1) listeners.splice(idx, 1)
			}
		},
		receive(raw: unknown) {
			for (const l of [...listeners]) l(raw)
		},
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MsgRecord = Record<string, unknown>

function findMsg(sent: unknown[], type: string): MsgRecord | undefined {
	return sent.find((m) => (m as MsgRecord)["type"] === type) as MsgRecord | undefined
}

function findMsgByRequestId(sent: unknown[], requestId: string): MsgRecord | undefined {
	return sent.find(
		(m) =>
			(m as MsgRecord)["type"] === "invoke-result" &&
			(m as MsgRecord)["requestId"] === requestId,
	) as MsgRecord | undefined
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("bobsoft-linter fixture (B4/E1)", () => {
	beforeAll(async () => {
		const result = await buildPlugins()
		if (!result.success) {
			throw new Error(`build-plugins.ts failed:\n${result.output}`)
		}
	}, 60_000)

	it("worker.mjs exists after build", () => {
		expect(fs.existsSync(WORKER_MJS)).toBe(true)
	})

	it("worker.mjs is non-empty and looks like ESM output", () => {
		const content = fs.readFileSync(WORKER_MJS, "utf8")
		// Bun bundles with esm format; the output is a plain JS module.
		// It should contain at least some content and should not be empty.
		expect(content.length).toBeGreaterThan(100)
		// The Bun ESM bundle for a node worker using parentPort starts with
		// module-level code; no CommonJS `require` wrapper at the top.
		// Verify it doesn't use CommonJS require() as the primary loading form.
		expect(content).not.toMatch(/^"use strict";\s*var __require/m)
	})

	it("extension activate → activated with expected command + tool ids (fake port)", async () => {
		// Import the extension module directly — no worker_threads needed.
		// eslint-disable-next-line @typescript-eslint/consistent-type-imports
		const ext = await import("../../../plugins/bobsoft-linter/extension")
		const mod = ext.default

		const port = makeFakePort()
		// Start the runtime but do not await — it installs the message listener.
		const runtimePromise = runExtensionWorker({ port, importMain: async () => mod })

		// Send activate.
		port.receive({
			type: "activate",
			pluginId: "bobsoft.linter",
			grantedCapabilities: ["net:http"],
			sessionScope: "session",
		})

		// Let the async activate path settle.
		await new Promise<void>((r) => setTimeout(r, 10))

		const activated = findMsg(port.sent, "activated")
		expect(activated).toBeDefined()
		expect(activated).toMatchObject({
			type: "activated",
			pluginId: "bobsoft.linter",
		})

		const cmds = activated!["registeredCommands"] as string[]
		const tools = activated!["registeredTools"] as string[]
		expect(cmds).toContain("bobsoft-linter-greet")
		expect(tools).toContain("plugin.bobsoft.linter.read-config")

		// Suppress the runtime promise (it stays alive until deactivate or process exit).
		void runtimePromise
	})

	it("invoke-command bobsoft-linter-greet returns greeting data (fake port)", async () => {
		const ext = await import("../../../plugins/bobsoft-linter/extension")
		const mod = ext.default

		const port = makeFakePort()
		void runExtensionWorker({ port, importMain: async () => mod })

		// Activate first.
		port.receive({
			type: "activate",
			pluginId: "bobsoft.linter",
			grantedCapabilities: ["net:http"],
			sessionScope: "session",
		})
		await new Promise<void>((r) => setTimeout(r, 10))

		// Invoke the greet command.
		port.receive({
			type: "invoke-command",
			requestId: "req-greet-1",
			commandId: "bobsoft-linter-greet",
			args: {},
		})
		await new Promise<void>((r) => setTimeout(r, 10))

		const result = findMsgByRequestId(port.sent, "req-greet-1")
		expect(result).toBeDefined()
		expect(result).toMatchObject({ type: "invoke-result", requestId: "req-greet-1", ok: true })
		const data = result!["data"] as Record<string, unknown>
		expect(typeof data["message"]).toBe("string")
		expect(data["message"]).toContain("BobSoft")
	})

	it("invoke-tool read-config does storage round-trip (fake port with stub storage)", async () => {
		const ext = await import("../../../plugins/bobsoft-linter/extension")
		const mod = ext.default

		const port = makeFakePort()

		// Intercept outgoing port.post() to auto-reply to storage requests.
		// The runtime sends storage-request OUTWARD via port.post(); the host normally
		// handles it and fires back via port.receive() (incoming). We stub that here.
		const storageStore: Map<string, unknown> = new Map()
		const originalPost = port.post.bind(port)
		port.post = (message: unknown) => {
			// Always record the sent message first.
			originalPost(message)
			if (message === null || typeof message !== "object") return
			const msg = message as MsgRecord
			if (msg["type"] !== "storage-request") return
			const req = msg["request"] as MsgRecord
			const requestId = msg["requestId"] as string
			const op = req["op"] as string
			const key = req["key"] as string
			// Reply synchronously so the pending promise resolves in the next microtask.
			if (op === "get") {
				port.receive({
					type: "storage-response",
					requestId,
					response: { ok: true, value: storageStore.get(key) },
				})
			} else if (op === "set") {
				storageStore.set(key, req["value"])
				port.receive({ type: "storage-response", requestId, response: { ok: true } })
			}
		}

		void runExtensionWorker({ port, importMain: async () => mod })

		port.receive({
			type: "activate",
			pluginId: "bobsoft.linter",
			grantedCapabilities: ["net:http"],
			sessionScope: "session",
		})
		await new Promise<void>((r) => setTimeout(r, 10))

		port.receive({
			type: "invoke-tool",
			requestId: "req-tool-1",
			toolId: "plugin.bobsoft.linter.read-config",
			args: { key: "ruleset" },
		})
		await new Promise<void>((r) => setTimeout(r, 50))

		const result = findMsgByRequestId(port.sent, "req-tool-1")
		expect(result).toBeDefined()
		expect(result).toMatchObject({ type: "invoke-result", requestId: "req-tool-1", ok: true })
		const data = result!["data"] as Record<string, unknown>
		expect(data["ok"]).toBe(true)
		expect(data["key"]).toBe("ruleset")
		expect(typeof data["value"]).toBe("string")
	})
})
