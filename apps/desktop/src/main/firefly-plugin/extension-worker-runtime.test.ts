/**
 * Unit tests for extension-worker-runtime + sdk/host-bridge.
 *
 * Uses a fully fake port — no worker_threads, no Electron.
 */

import { describe, expect, it } from "bun:test"
import { runExtensionWorker, type WorkerRuntimePort } from "./extension-worker-runtime"
import type { ExtensionModule, ExtensionContext } from "../../shared/firefly-plugin/sdk/index"

// ---------------------------------------------------------------------------
// Fake port helpers
// ---------------------------------------------------------------------------

interface FakePort extends WorkerRuntimePort {
	/** Messages posted TO the host by the worker runtime. */
	sent: unknown[]
	/** Trigger a message FROM the host to the worker runtime. */
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
			for (const l of listeners) l(raw)
		},
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build and start the runtime on `port`, then send the `activate` message
 * and flush the microtask queue so the async activate path runs.
 */
async function activateWorker(
	port: FakePort,
	mod: ExtensionModule,
	opts: { pluginId?: string; grantedCapabilities?: string[]; sessionScope?: string } = {},
): Promise<void> {
	await runExtensionWorker({
		port,
		importMain: async () => mod,
	})
	port.receive({
		type: "activate",
		pluginId: opts.pluginId ?? "test.plugin",
		grantedCapabilities: opts.grantedCapabilities ?? [],
		sessionScope: opts.sessionScope ?? "session",
	})
	// Flush the async activate path.
	await new Promise((r) => setTimeout(r, 0))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extension-worker-runtime", () => {
	it("activate → activated with registered command and tool ids", async () => {
		const port = makeFakePort()
		const mod: ExtensionModule = {
			activate(ctx: ExtensionContext) {
				ctx.registerCommand("c1", async (_args) => "result-c1")
				ctx.registerTool("t1", async (_args) => ({ ok: true }))
			},
		}

		await activateWorker(port, mod)

		const activated = port.sent.find((m) => (m as { type: string }).type === "activated")
		expect(activated).toBeDefined()
		expect(activated).toMatchObject({
			type: "activated",
			pluginId: "test.plugin",
			registeredCommands: ["c1"],
			registeredTools: ["t1"],
		})
	})

	it("invoke-command for a registered command returns invoke-result ok:true", async () => {
		const port = makeFakePort()
		const mod: ExtensionModule = {
			activate(ctx) {
				ctx.registerCommand("c1", async (args) => ({ echo: args["x"] }))
			},
		}

		await activateWorker(port, mod)

		port.receive({ type: "invoke-command", requestId: "req-1", commandId: "c1", args: { x: 42 } })
		await new Promise((r) => setTimeout(r, 0))

		const result = port.sent.find(
			(m) => (m as { type: string; requestId?: string }).type === "invoke-result" &&
				(m as { requestId: string }).requestId === "req-1",
		)
		expect(result).toMatchObject({ type: "invoke-result", requestId: "req-1", ok: true, data: { echo: 42 } })
	})

	it("invoke-command for unknown id returns ok:false errorCode:handler_not_found", async () => {
		const port = makeFakePort()
		const mod: ExtensionModule = {
			activate(ctx) {
				ctx.registerCommand("c1", async () => "value")
			},
		}

		await activateWorker(port, mod)

		port.receive({ type: "invoke-command", requestId: "req-2", commandId: "no-such-command", args: {} })
		await new Promise((r) => setTimeout(r, 0))

		const result = port.sent.find(
			(m) => (m as { type: string; requestId?: string }).type === "invoke-result" &&
				(m as { requestId: string }).requestId === "req-2",
		)
		expect(result).toMatchObject({ type: "invoke-result", requestId: "req-2", ok: false, errorCode: "handler_not_found" })
	})

	it("invoke-tool for a registered tool returns invoke-result ok:true", async () => {
		const port = makeFakePort()
		const mod: ExtensionModule = {
			activate(ctx) {
				ctx.registerTool("t1", async (args) => ({ sum: (args["a"] as number) + (args["b"] as number) }))
			},
		}

		await activateWorker(port, mod)

		port.receive({ type: "invoke-tool", requestId: "req-3", toolId: "t1", args: { a: 3, b: 4 } })
		await new Promise((r) => setTimeout(r, 0))

		const result = port.sent.find(
			(m) => (m as { type: string; requestId?: string }).type === "invoke-result" &&
				(m as { requestId: string }).requestId === "req-3",
		)
		expect(result).toMatchObject({ type: "invoke-result", requestId: "req-3", ok: true, data: { sum: 7 } })
	})

	it("throwing activate → fatal message, no activated posted", async () => {
		const port = makeFakePort()
		const mod: ExtensionModule = {
			activate() {
				throw new Error("boom during activate")
			},
		}

		await activateWorker(port, mod)

		const activated = port.sent.find((m) => (m as { type: string }).type === "activated")
		expect(activated).toBeUndefined()

		const fatal = port.sent.find((m) => (m as { type: string }).type === "fatal")
		expect(fatal).toMatchObject({ type: "fatal", message: "boom during activate" })
	})

	it("storage.get posts storage-request and resolves when fake port replies", async () => {
		const port = makeFakePort()
		let capturedCtx: ExtensionContext | null = null

		const mod: ExtensionModule = {
			activate(ctx) {
				capturedCtx = ctx
				ctx.registerCommand("c1", async () => "ok")
			},
		}

		await activateWorker(port, mod)
		expect(capturedCtx).not.toBeNull()

		// Kick off the storage.get — it will post a storage-request and wait.
		const getPromise = capturedCtx!.storage.get("my-key")

		// Allow the request to be posted.
		await new Promise((r) => setTimeout(r, 0))

		// Find the pending storage-request posted by the runtime.
		const storageReq = port.sent.find(
			(m) => (m as { type: string }).type === "storage-request",
		) as { type: string; requestId: string; request: unknown } | undefined
		expect(storageReq).toBeDefined()
		expect(storageReq!.request).toMatchObject({ op: "get", scope: "app", key: "my-key" })

		// Simulate the host replying with the storage-response.
		port.receive({
			type: "storage-response",
			requestId: storageReq!.requestId,
			response: { ok: true, value: "stored-value" },
		})

		const value = await getPromise
		expect(value).toBe("stored-value")
	})

	it("ctx.grantedCapabilities reflects what was sent in the activate message", async () => {
		const port = makeFakePort()
		let capturedCtx: ExtensionContext | null = null

		const mod: ExtensionModule = {
			activate(ctx) {
				capturedCtx = ctx
			},
		}

		await activateWorker(port, mod, { grantedCapabilities: ["fs:read", "net:http"] })

		expect(capturedCtx!.grantedCapabilities).toEqual(["fs:read", "net:http"])
	})

	it("deactivate calls mod.deactivate", async () => {
		const port = makeFakePort()
		let deactivateCalled = false

		const mod: ExtensionModule = {
			activate(ctx) {
				ctx.registerCommand("c1", async () => "ok")
			},
			async deactivate() {
				deactivateCalled = true
			},
		}

		await activateWorker(port, mod)

		port.receive({ type: "deactivate", pluginId: "test.plugin" })
		await new Promise((r) => setTimeout(r, 0))

		expect(deactivateCalled).toBe(true)
	})
})
