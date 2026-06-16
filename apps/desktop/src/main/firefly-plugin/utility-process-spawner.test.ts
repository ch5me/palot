/**
 * Firefly Plugin System V2 — utility-process-spawner unit tests
 *
 * All tests use a fake ForkUtilityProcess so electron is never imported.
 */

import { describe, expect, it } from "bun:test"

import { createUtilityProcessSpawner, type UtilityChildProcess } from "./utility-process-spawner"

// ---------------------------------------------------------------------------
// Fake child process
// ---------------------------------------------------------------------------

interface FakeChild extends UtilityChildProcess {
	postMessageCalls: unknown[]
	killCalls: number
	emit(event: "message", message: unknown): void
	emit(event: "exit", code: number | null): void
	emit(event: "spawn"): void
}

function createFakeChild(): FakeChild {
	const postMessageCalls: unknown[] = []
	let killCalls = 0
	const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

	function on(event: string, listener: (...args: unknown[]) => void): void {
		const existing = listeners.get(event) ?? []
		existing.push(listener)
		listeners.set(event, existing)
	}

	function emit(event: string, ...args: unknown[]): void {
		for (const listener of listeners.get(event) ?? []) {
			listener(...args)
		}
	}

	const child = {
		postMessageCalls,
		get killCalls(): number {
			return killCalls
		},
		postMessage(message: unknown): void {
			postMessageCalls.push(message)
		},
		kill(): boolean {
			killCalls++
			return true
		},
		on,
		emit,
	}

	// Cast: FakeChild's wide `on(string, ...)` satisfies the UtilityChildProcess
	// overloads at runtime — the overload narrowing is type-level only.
	return child as unknown as FakeChild
}

// ---------------------------------------------------------------------------
// Fake fork factory
// ---------------------------------------------------------------------------

interface ForkCall {
	entryPath: string
	args: string[]
	opts: {
		serviceName?: string
		env?: Record<string, string | undefined>
		execArgv?: string[]
	}
}

function createFakeFork(child: FakeChild): {
	forkFn: (
		entryPath: string,
		args: string[],
		opts: { serviceName?: string; env?: Record<string, string | undefined>; execArgv?: string[] },
	) => UtilityChildProcess
	calls: ForkCall[]
} {
	const calls: ForkCall[] = []
	return {
		forkFn(entryPath, args, opts): UtilityChildProcess {
			calls.push({ entryPath, args, opts })
			return child
		},
		calls,
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createUtilityProcessSpawner", () => {
	it("returns a PluginWorkerHandle", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "test.plugin", entryPath: "/path/to/worker.mjs" })
		expect(handle).toBeDefined()
		expect(typeof handle.postMessage).toBe("function")
		expect(typeof handle.terminate).toBe("function")
		expect(typeof handle.onMessage).toBe("function")
		expect(typeof handle.onExit).toBe("function")
		expect(typeof handle.onError).toBe("function")
	})

	it("forwards postMessage to the child", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "test.plugin", entryPath: "/path/worker.mjs" })
		handle.postMessage({ type: "ping" })
		handle.postMessage("hello")
		expect(child.postMessageCalls).toEqual([{ type: "ping" }, "hello"])
	})

	it("calls kill() on terminate()", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "test.plugin", entryPath: "/path/worker.mjs" })
		handle.terminate()
		expect(child.killCalls).toBe(1)
	})

	it("delivers child message events via onMessage", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "test.plugin", entryPath: "/path/worker.mjs" })

		const received: unknown[] = []
		handle.onMessage((m) => received.push(m))

		child.emit("message", { type: "ready" })
		child.emit("message", { type: "heartbeat" })

		expect(received).toEqual([{ type: "ready" }, { type: "heartbeat" }])
	})

	it("delivers exit events via onExit with the exit code", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "test.plugin", entryPath: "/path/worker.mjs" })

		const codes: (number | null)[] = []
		handle.onExit((code) => codes.push(code))

		child.emit("exit", 0)
		child.emit("exit", 1)
		child.emit("exit", null)

		expect(codes).toEqual([0, 1, null])
	})

	it("passes pluginId as argv[0]", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "firefly.built-in.notes", entryPath: "/path/worker.mjs" })

		expect(calls).toHaveLength(1)
		expect(calls[0]!.args).toEqual(["firefly.built-in.notes"])
	})

	it("sets FIREFLY_PLUGIN_ID in the env", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "firefly.built-in.notes", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.env?.["FIREFLY_PLUGIN_ID"]).toBe("firefly.built-in.notes")
	})

	it("includes pluginId in the serviceName", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "firefly.built-in.notes", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.serviceName).toContain("firefly.built-in.notes")
	})

	it("uses serviceNamePrefix in the serviceName", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({
			forkUtilityProcess: forkFn,
			serviceNamePrefix: "custom-prefix",
		})
		spawner({ pluginId: "my.plugin", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.serviceName).toBe("custom-prefix-my.plugin")
	})

	it("defaults serviceName prefix to firefly-plugin", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "my.plugin", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.serviceName).toBe("firefly-plugin-my.plugin")
	})

	it("sets execArgv max-old-space-size when maxOldGenerationSizeMb is provided", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({
			forkUtilityProcess: forkFn,
			maxOldGenerationSizeMb: 256,
		})
		spawner({ pluginId: "my.plugin", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.execArgv).toEqual(["--max-old-space-size=256"])
	})

	it("passes empty execArgv when maxOldGenerationSizeMb is not set", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "my.plugin", entryPath: "/path/worker.mjs" })

		expect(calls[0]!.opts.execArgv).toEqual([])
	})

	it("passes the entryPath to fork", () => {
		const child = createFakeChild()
		const { forkFn, calls } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		spawner({ pluginId: "my.plugin", entryPath: "/some/path/worker.mjs" })

		expect(calls[0]!.entryPath).toBe("/some/path/worker.mjs")
	})

	it("onError does not throw and is a no-op (utilityProcess has no error event)", () => {
		const child = createFakeChild()
		const { forkFn } = createFakeFork(child)
		const spawner = createUtilityProcessSpawner({ forkUtilityProcess: forkFn })
		const handle = spawner({ pluginId: "my.plugin", entryPath: "/path/worker.mjs" })

		// Should not throw — onError is part of the PluginWorkerHandle contract
		// but is a no-op for utilityProcess (failures surface via onExit instead)
		expect(() => {
			handle.onError(() => {
				// intentionally empty
			})
		}).not.toThrow()
	})
})
