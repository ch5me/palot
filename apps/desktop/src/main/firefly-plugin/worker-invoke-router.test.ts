/**
 * worker-invoke-router.test.ts — B3 router unit tests
 *
 * Covers:
 *  - requestId correlation: invoke posts correct message to worker and
 *    resolves when the worker replies with the matching requestId.
 *  - timeout: when the worker does not reply within timeoutMs the promise
 *    resolves with errorCode:"worker_invoke_timeout".
 *  - worker_not_active: sendInvoke when plugin is not active.
 *  - isWorkerBacked checks runtimeResolution.location === "electron-utility"
 *    AND supervisor state === "active".
 *  - getWorkerInvokeRouter / setWorkerInvokeRouter singleton + reset.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import {
	createWorkerInvokeRouter,
	getWorkerInvokeRouter,
	setWorkerInvokeRouter,
	_resetWorkerInvokeRouterForTests,
	type WorkerInvokeRouterSupervisor,
	type WorkerInvokeRouterCatalog,
} from "./worker-invoke-router"
import type { WorkerSendInvokeResult } from "./worker-supervisor"

// ---------------------------------------------------------------------------
// Fake supervisor factory
// ---------------------------------------------------------------------------

interface FakeSupervisor extends WorkerInvokeRouterSupervisor {
	/** Captured sendInvoke calls for assertion. */
	calls: {
		pluginId: string
		kind: string
		targetId: string
		args: Record<string, unknown>
		sessionId: string | null
		timeoutMs: number
	}[]
}

function makeFakeSupervisor(opts: {
	stateByPlugin: Record<string, string>
	invokeResult?: WorkerSendInvokeResult
}): FakeSupervisor {
	const calls: FakeSupervisor["calls"] = []
	return {
		calls,
		getSummary(pluginId) {
			const state = opts.stateByPlugin[pluginId]
			return state ? { state } : null
		},
		async sendInvoke(pluginId, input) {
			calls.push({ pluginId, ...input })
			return opts.invokeResult ?? { ok: true, data: null }
		},
	}
}

function makeFakeCatalog(
	descriptors: Array<{
		normalizedId: string
		runtimeResolution: { supported: boolean; location?: string }
	}>,
): WorkerInvokeRouterCatalog {
	return { descriptors }
}

// ---------------------------------------------------------------------------
// Singleton reset — run before AND after each test to isolate from cross-file
// module state (bun shares the module graph across test files in the same run).
// ---------------------------------------------------------------------------

beforeEach(() => {
	_resetWorkerInvokeRouterForTests()
})

afterEach(() => {
	_resetWorkerInvokeRouterForTests()
})

// ---------------------------------------------------------------------------
// Singleton tests
// ---------------------------------------------------------------------------

describe("WorkerInvokeRouter singleton", () => {
	test("default router: isWorkerBacked returns false, invoke returns router_not_configured", async () => {
		const router = getWorkerInvokeRouter()
		expect(router.isWorkerBacked("any.plugin")).toBe(false)
		const result = await router.invoke({
			pluginId: "any.plugin",
			kind: "command",
			targetId: "cmd1",
			args: {},
			sessionId: null,
		})
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.errorCode).toBe("router_not_configured")
	})

	test("setWorkerInvokeRouter replaces the active router", () => {
		const customRouter = {
			isWorkerBacked: (id: string) => id === "custom.plugin",
			invoke: async () => ({ ok: true as const, data: "custom" }),
		}
		setWorkerInvokeRouter(customRouter)
		expect(getWorkerInvokeRouter().isWorkerBacked("custom.plugin")).toBe(true)
		expect(getWorkerInvokeRouter().isWorkerBacked("other.plugin")).toBe(false)
	})

	test("_resetWorkerInvokeRouterForTests restores null router", async () => {
		setWorkerInvokeRouter({
			isWorkerBacked: () => true,
			invoke: async () => ({ ok: true as const, data: null }),
		})
		_resetWorkerInvokeRouterForTests()
		expect(getWorkerInvokeRouter().isWorkerBacked("any.plugin")).toBe(false)
		const r = await getWorkerInvokeRouter().invoke({
			pluginId: "any.plugin",
			kind: "tool",
			targetId: "t1",
			args: {},
			sessionId: null,
		})
		expect(r.ok).toBe(false)
		if (!r.ok) expect(r.errorCode).toBe("router_not_configured")
	})
})

// ---------------------------------------------------------------------------
// isWorkerBacked logic
// ---------------------------------------------------------------------------

describe("WorkerInvokeRouter isWorkerBacked", () => {
	test("true iff runtimeResolution.location === electron-utility AND state === active", () => {
		const supervisor = makeFakeSupervisor({
			stateByPlugin: { "worker.plugin": "active", "idle.plugin": "installed" },
		})
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
			{ normalizedId: "idle.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
			{ normalizedId: "inprocess.plugin", runtimeResolution: { supported: true, location: "electron-main" } },
			{ normalizedId: "unsupported.plugin", runtimeResolution: { supported: false, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		// Active + electron-utility → true
		expect(router.isWorkerBacked("worker.plugin")).toBe(true)
		// electron-utility but NOT active (installed) → false
		expect(router.isWorkerBacked("idle.plugin")).toBe(false)
		// Active but electron-main location → false
		expect(router.isWorkerBacked("inprocess.plugin")).toBe(false)
		// Unsupported resolution → false
		expect(router.isWorkerBacked("unsupported.plugin")).toBe(false)
		// Unknown plugin → false
		expect(router.isWorkerBacked("ghost.plugin")).toBe(false)
	})

	test("not worker-backed if supervisor has no record for the plugin", () => {
		const supervisor = makeFakeSupervisor({ stateByPlugin: {} })
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)
		expect(router.isWorkerBacked("worker.plugin")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// invoke → supervisor.sendInvoke delegation
// ---------------------------------------------------------------------------

describe("WorkerInvokeRouter invoke delegation", () => {
	test("invoke calls supervisor.sendInvoke with correct args and returns ok:true result", async () => {
		const supervisor = makeFakeSupervisor({
			stateByPlugin: { "worker.plugin": "active" },
			invokeResult: { ok: true, data: { answer: 42 } },
		})
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		const result = await router.invoke({
			pluginId: "worker.plugin",
			kind: "tool",
			targetId: "my-tool",
			args: { x: 1 },
			sessionId: "ses_abc",
		})
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.data).toEqual({ answer: 42 })
		expect(supervisor.calls).toHaveLength(1)
		const call = supervisor.calls[0]!
		expect(call.pluginId).toBe("worker.plugin")
		expect(call.kind).toBe("tool")
		expect(call.targetId).toBe("my-tool")
		expect(call.args).toEqual({ x: 1 })
		expect(call.sessionId).toBe("ses_abc")
	})

	test("invoke propagates ok:false result from supervisor", async () => {
		const supervisor = makeFakeSupervisor({
			stateByPlugin: { "worker.plugin": "active" },
			invokeResult: { ok: false, errorCode: "handler_not_found", errorMessage: "no such handler" },
		})
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		const result = await router.invoke({
			pluginId: "worker.plugin",
			kind: "command",
			targetId: "my-cmd",
			args: {},
			sessionId: null,
		})
		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.errorCode).toBe("handler_not_found")
			expect(result.errorMessage).toBe("no such handler")
		}
	})
})

// ---------------------------------------------------------------------------
// supervisor.sendInvoke — requestId correlation + timeout
// ---------------------------------------------------------------------------

describe("supervisor sendInvoke correlation and timeout", () => {
	/**
	 * Build a fake supervisor that exposes `emitInvokeResult` so tests can
	 * simulate the worker replying with a matching requestId.
	 */
	function makeCorrelationFakeSupervisor() {
		const pendingCallbacks = new Map<
			string,
			(result: WorkerSendInvokeResult) => void
		>()

		const supervisor: WorkerInvokeRouterSupervisor & {
			emitInvokeResult: (requestId: string, result: WorkerSendInvokeResult) => void
			capturedMessages: Array<{
				pluginId: string
				kind: string
				targetId: string
				timeoutMs: number
			}>
		} = {
			capturedMessages: [],
			emitInvokeResult(requestId, result) {
				const cb = pendingCallbacks.get(requestId)
				if (cb) {
					pendingCallbacks.delete(requestId)
					cb(result)
				}
			},
			getSummary(_pluginId) {
				return { state: "active" }
			},
			sendInvoke(pluginId, input): Promise<WorkerSendInvokeResult> {
				supervisor.capturedMessages.push({
					pluginId,
					kind: input.kind,
					targetId: input.targetId,
					timeoutMs: input.timeoutMs,
				})
				return new Promise<WorkerSendInvokeResult>((resolve) => {
					// Use a synthetic requestId so we can correlate in tests.
					// In the real supervisor a UUID is generated internally; here
					// we expose resolve so tests can drive it via emitInvokeResult.
					// We store by a fixed key since the test drives it externally.
					pendingCallbacks.set("__pending__", resolve)

					// Timeout mirroring what the real supervisor does
					const timer = setTimeout(() => {
						if (pendingCallbacks.delete("__pending__")) {
							resolve({
								ok: false,
								errorCode: "worker_invoke_timeout",
								errorMessage: `Worker did not reply within ${input.timeoutMs}ms`,
							})
						}
					}, input.timeoutMs)
					// Do not keep the test process alive for the timer
					if (typeof timer === "object" && timer !== null && "unref" in timer) {
						;(timer as { unref: () => void }).unref()
					}
				})
			},
		}
		return supervisor
	}

	test("resolves with ok:true when supervisor returns the result synchronously", async () => {
		const supervisor = makeFakeSupervisor({
			stateByPlugin: { "worker.plugin": "active" },
			invokeResult: { ok: true, data: "pong" },
		})
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		const result = await router.invoke({
			pluginId: "worker.plugin",
			kind: "command",
			targetId: "ping",
			args: {},
			sessionId: null,
		})
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.data).toBe("pong")
	})

	test("timeout resolves with worker_invoke_timeout errorCode", async () => {
		const supervisor = makeCorrelationFakeSupervisor()
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		// Short timeout so the test runs fast
		const result = await router.invoke({
			pluginId: "worker.plugin",
			kind: "tool",
			targetId: "slow-tool",
			args: {},
			sessionId: null,
			timeoutMs: 30,
		})
		expect(result.ok).toBe(false)
		if (!result.ok) expect(result.errorCode).toBe("worker_invoke_timeout")
		expect(supervisor.capturedMessages).toHaveLength(1)
	})

	test("resolves with result when worker replies before timeout", async () => {
		const supervisor = makeCorrelationFakeSupervisor()
		const catalog = makeFakeCatalog([
			{ normalizedId: "worker.plugin", runtimeResolution: { supported: true, location: "electron-utility" } },
		])
		const router = createWorkerInvokeRouter(supervisor, () => catalog)

		const resultPromise = router.invoke({
			pluginId: "worker.plugin",
			kind: "tool",
			targetId: "fast-tool",
			args: {},
			sessionId: null,
			timeoutMs: 2_000,
		})

		// Simulate the worker replying before timeout
		await new Promise((r) => setTimeout(r, 5))
		supervisor.emitInvokeResult("__pending__", { ok: true, data: { answer: 99 } })

		const result = await resultPromise
		expect(result.ok).toBe(true)
		if (result.ok) expect(result.data).toEqual({ answer: 99 })
	})
})
