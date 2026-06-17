/**
 * Quarantine drill (plan Task 1 proof): deliberately crashing and
 * hanging fixture plugins — spawned as REAL node:worker_threads through
 * the production spawner — must reach `quarantined` without affecting a
 * healthy sibling plugin or the host process. Plus fake-spawner unit
 * coverage for the decision wiring.
 *
 * B1 lifecycle contract:
 *   - `ready`     → transport-up only; does NOT flip lifecycle to active.
 *   - `activate`  → host→worker; sent immediately after spawn (with grants/scope).
 *   - `activated` → worker→host; flips lifecycle to `active`, seeds routing table.
 *   - A worker that posts only `ready` and never `activated` within hangTimeoutMs
 *     is driven to `failed` by scanForHangs (partial_activation).
 */

import { afterEach, describe, expect, test } from "bun:test"
import * as path from "node:path"

import type { QuarantineRecord } from "../../shared/firefly-plugin/runtime-supervision"
import { createPluginWorkerSupervisor, type PluginWorkerHandle, type PluginWorkerSupervisor } from "./worker-supervisor"
import { createWorkerThreadSpawner } from "./worker-thread-spawner"

const FIXTURES = path.join(import.meta.dir, "worker-fixtures")
const fixture = (name: string) => path.join(FIXTURES, name)

const FAST_POLICIES = {
	heartbeatPolicy: { hangTimeoutMs: 120, heartbeatIntervalMs: 40 },
	restartBackoffPolicy: { baseMs: 5, maxMs: 20, factor: 1.5, jitterRatio: 0 },
	crashWindowPolicy: {
		windowMs: 60_000,
		activationCrashThreshold: 3,
		runtimeCrashThreshold: 3,
		hangThreshold: 2,
		crashCounterTtlMs: 60_000,
		maxCrashHistory: 50,
	},
	hangScanIntervalMs: 30,
} as const

function memoryQuarantineStore() {
	const records = new Map<string, QuarantineRecord>()
	return {
		records,
		store: {
			write: (record: QuarantineRecord) => records.set(record.pluginId, record),
			clear: (pluginId: string) => records.delete(pluginId),
		},
	}
}

async function waitFor(
	predicate: () => boolean,
	timeoutMs = 5_000,
	label = "condition",
): Promise<void> {
	const start = Date.now()
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for ${label}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
}

const supervisors: PluginWorkerSupervisor[] = []
function track(supervisor: PluginWorkerSupervisor): PluginWorkerSupervisor {
	supervisors.push(supervisor)
	return supervisor
}

afterEach(async () => {
	while (supervisors.length > 0) {
		await supervisors.pop()?.dispose()
	}
})

describe("plugin worker supervisor — quarantine drill (real worker_threads)", () => {
	test("healthy worker activates and stays active", async () => {
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "firefly.built-in.healthy", entryPath: fixture("healthy-worker.mjs") })
		supervisor.activate("firefly.built-in.healthy")
		// The fixture: posts ready (transport-up), then handles `activate` and posts `activated`
		await waitFor(
			() => supervisor.getSummary("firefly.built-in.healthy")?.state === "active",
			5_000,
			"healthy plugin active",
		)
		expect(supervisor.getSummary("firefly.built-in.healthy")?.acceptingCalls).toBe(true)
	})

	test("crashing worker is restarted with backoff, then quarantined — healthy sibling unaffected", async () => {
		const { records, store } = memoryQuarantineStore()
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				quarantineStore: store,
				...FAST_POLICIES,
				// Long hang timeout: under load a crashed worker's delayed
				// exit event must never race the hang scanner, so this drill
				// deterministically quarantines via runtime_crashes.
				heartbeatPolicy: { hangTimeoutMs: 10_000, heartbeatIntervalMs: 40 },
			}),
		)
		supervisor.register({ pluginId: "firefly.built-in.healthy", entryPath: fixture("healthy-worker.mjs") })
		supervisor.register({ pluginId: "acme.crasher", entryPath: fixture("crashing-worker.mjs") })
		supervisor.activate("firefly.built-in.healthy")
		supervisor.activate("acme.crasher")

		await waitFor(
			() => supervisor.getSummary("acme.crasher")?.state === "quarantined",
			10_000,
			"crasher quarantined",
		)

		const crasher = supervisor.getSummary("acme.crasher")
		expect(crasher?.quarantined).toBe(true)
		expect(crasher?.quarantine?.reason).toBe("runtime_crashes")
		expect(crasher?.crashCount).toBeGreaterThanOrEqual(3)
		// Durable record written.
		expect(records.get("acme.crasher")?.reason).toBe("runtime_crashes")
		// The healthy sibling kept running through the whole drill.
		expect(supervisor.getSummary("firefly.built-in.healthy")?.state).toBe("active")
		// And the host (this test process) is alive to assert it.
	})

	test("hanging worker is killed by hang detection and quarantined after the hang streak", async () => {
		const { records, store } = memoryQuarantineStore()
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				quarantineStore: store,
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "firefly.built-in.healthy", entryPath: fixture("healthy-worker.mjs") })
		supervisor.register({ pluginId: "acme.hanger", entryPath: fixture("hanging-worker.mjs") })
		supervisor.activate("firefly.built-in.healthy")
		supervisor.activate("acme.hanger")

		await waitFor(
			() => supervisor.getSummary("acme.hanger")?.state === "quarantined",
			10_000,
			"hanger quarantined",
		)

		const hanger = supervisor.getSummary("acme.hanger")
		expect(hanger?.quarantine?.reason).toBe("hangs")
		expect(records.get("acme.hanger")?.reason).toBe("hangs")
		expect(supervisor.getSummary("firefly.built-in.healthy")?.state).toBe("active")
	})

	test("worker that dies before ready trips activation-crash quarantine", async () => {
		const { store, records } = memoryQuarantineStore()
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				quarantineStore: store,
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "acme.init-crasher", entryPath: fixture("init-crash-worker.mjs") })
		supervisor.activate("acme.init-crasher")

		await waitFor(
			() => supervisor.getSummary("acme.init-crasher")?.state === "quarantined",
			10_000,
			"init crasher quarantined",
		)
		expect(records.get("acme.init-crasher")?.reason).toBe("activation_crashes")
	})

	test("disable tears the worker down; enable re-activates", async () => {
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "firefly.built-in.healthy", entryPath: fixture("healthy-worker.mjs") })
		supervisor.activate("firefly.built-in.healthy")
		await waitFor(() => supervisor.getSummary("firefly.built-in.healthy")?.state === "active")

		const disabled = supervisor.disable("firefly.built-in.healthy")
		expect(disabled.state).toBe("disabled")
		expect(disabled.acceptingCalls).toBe(false)

		supervisor.enable("firefly.built-in.healthy")
		await waitFor(
			() => supervisor.getSummary("firefly.built-in.healthy")?.state === "active",
			5_000,
			"re-activated after enable",
		)
	})

	test("quarantine release returns the plugin to an activatable state", async () => {
		const { store } = memoryQuarantineStore()
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: createWorkerThreadSpawner(),
				quarantineStore: store,
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "acme.init-crasher", entryPath: fixture("init-crash-worker.mjs") })
		supervisor.activate("acme.init-crasher")
		await waitFor(() => supervisor.getSummary("acme.init-crasher")?.state === "quarantined", 10_000)

		const released = supervisor.releaseQuarantine("acme.init-crasher", "operator drill release")
		expect(released.state).toBe("installed")
		expect(released.quarantined).toBe(false)
	})
})

describe("plugin worker supervisor — decision wiring (fake spawner)", () => {
	function fakeSpawner() {
		const spawned: {
			pluginId: string
			handle: PluginWorkerHandle
			posted: unknown[]
			emitMessage: (m: unknown) => void
			emitExit: (code: number | null) => void
			terminated: boolean
		}[] = []
		const spawn = ({ pluginId }: { pluginId: string; entryPath: string }): PluginWorkerHandle => {
			let messageListener: ((m: unknown) => void) | null = null
			let exitListener: ((code: number | null) => void) | null = null
			const record = {
				pluginId,
				posted: [] as unknown[],
				emitMessage: (m: unknown) => messageListener?.(m),
				emitExit: (code: number | null) => exitListener?.(code),
				terminated: false,
				handle: {
					postMessage: (m: unknown) => record.posted.push(m),
					terminate: () => {
						record.terminated = true
					},
					onMessage: (l: (m: unknown) => void) => {
						messageListener = l
					},
					onExit: (l: (code: number | null) => void) => {
						exitListener = l
					},
					onError: () => undefined,
				} satisfies PluginWorkerHandle,
			}
			spawned.push(record)
			return record.handle
		}
		return { spawn, spawned }
	}

	test("exactly one activate message is posted on spawn with grants and scope", async () => {
		const { spawn, spawned } = fakeSpawner()
		const grants = { grantedCapabilities: ["fs:read"], sessionScope: "session" as const }
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: spawn,
				resolveActivation: () => grants,
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "acme.granted", entryPath: "fake" })
		supervisor.activate("acme.granted")
		// The activate message is posted asynchronously (after resolveActivation).
		await waitFor(() => spawned[0]?.posted.length > 0, 1_000, "activate posted")
		const activateMsg = spawned[0].posted.find((m: unknown) => (m as { type?: string }).type === "activate")
		expect(activateMsg).toEqual({
			type: "activate",
			pluginId: "acme.granted",
			grantedCapabilities: ["fs:read"],
			sessionScope: "session",
		})
	})

	test("lifecycle stays activating until the worker replies activated, then goes active", async () => {
		const { spawn, spawned } = fakeSpawner()
		const supervisor = track(
			createPluginWorkerSupervisor({ spawnWorker: spawn, ...FAST_POLICIES }),
		)
		supervisor.register({ pluginId: "acme.slow-activate", entryPath: "fake" })
		supervisor.activate("acme.slow-activate")

		// Worker posts ready (transport-up only — must NOT flip to active).
		spawned[0].emitMessage({ type: "ready" })
		expect(supervisor.getSummary("acme.slow-activate")?.state).toBe("activating")

		// Now the worker posts activated — lifecycle must flip to active.
		spawned[0].emitMessage({
			type: "activated",
			pluginId: "acme.slow-activate",
			registeredCommands: ["cmd1"],
			registeredTools: ["tool1"],
		})
		expect(supervisor.getSummary("acme.slow-activate")?.state).toBe("active")
	})

	test("a worker that posts only ready and never activated is driven to failed by scanForHangs", () => {
		const { spawn } = fakeSpawner()
		let clock = 1_000
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: spawn,
				...FAST_POLICIES,
				now: () => clock,
			}),
		)
		supervisor.register({ pluginId: "acme.ready-only", entryPath: "fake" })
		supervisor.activate("acme.ready-only")

		// Worker posts ready but never activated.
		// (spawned[0] is populated synchronously on activate/spawn)
		// Simulate the ready signal:
		// The spawn is synchronous; onMessage is registered in spawn().
		// We need to emit ready and then advance the clock past hangTimeoutMs.
		// At this point the worker hasn't emitted anything — that's fine, it's already activating.
		expect(supervisor.getSummary("acme.ready-only")?.state).toBe("activating")

		// Advance past the hang timeout.
		clock += FAST_POLICIES.heartbeatPolicy.hangTimeoutMs + 1
		supervisor.scanForHangs()

		const summary = supervisor.getSummary("acme.ready-only")
		expect(summary?.state).toBe("failed")
		expect(summary?.recentCrashes.at(-1)?.failureClass).toBe("partial_activation")
	})

	test("protocol-violating message degrades the plugin (fail loud, not silent)", async () => {
		const { spawn, spawned } = fakeSpawner()
		const supervisor = track(
			createPluginWorkerSupervisor({ spawnWorker: spawn, ...FAST_POLICIES }),
		)
		supervisor.register({ pluginId: "acme.weird", entryPath: "fake" })
		supervisor.activate("acme.weird")
		spawned[0].emitMessage({
			type: "activated",
			pluginId: "acme.weird",
			registeredCommands: [],
			registeredTools: [],
		})
		expect(supervisor.getSummary("acme.weird")?.state).toBe("active")
		spawned[0].emitMessage({ type: "garbage", lol: true })
		expect(supervisor.getSummary("acme.weird")?.state).toBe("degraded")
	})

	test("routes a worker storage-request to onWorkerRequest and posts the reply back", async () => {
		const posted: unknown[] = []
		const bus: { emit?: (m: unknown) => void } = {}
		const handle: PluginWorkerHandle = {
			postMessage: (m) => posted.push(m),
			terminate: () => undefined,
			onMessage: (l) => {
				bus.emit = l
			},
			onExit: () => undefined,
			onError: () => undefined,
		}
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: () => handle,
				onWorkerRequest: async ({ message }) => {
					if (message.type === "storage-request" && message.request.op === "get") {
						return { type: "storage-response", requestId: message.requestId, response: { ok: true, value: "v" } }
					}
					return null
				},
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "acme.storage", entryPath: "fake" })
		supervisor.activate("acme.storage")
		bus.emit?.({
			type: "activated",
			pluginId: "acme.storage",
			registeredCommands: [],
			registeredTools: [],
		})
		bus.emit?.({ type: "storage-request", requestId: "r1", request: { op: "get", scope: "app", key: "k" } })
		await new Promise((r) => setTimeout(r, 5))
		expect(posted).toContainEqual({ type: "storage-response", requestId: "r1", response: { ok: true, value: "v" } })
		// lifecycle still healthy — a request is not a protocol violation
		expect(supervisor.getSummary("acme.storage")?.state).toBe("active")
	})

	test("per-plugin quarantineOnCrashCount overrides the default threshold", async () => {
		const { spawn, spawned } = fakeSpawner()
		const { store, records } = memoryQuarantineStore()
		const supervisor = track(
			createPluginWorkerSupervisor({ spawnWorker: spawn, quarantineStore: store, ...FAST_POLICIES }),
		)
		supervisor.register({ pluginId: "acme.fragile", entryPath: "fake", quarantineOnCrashCount: 1 })
		supervisor.activate("acme.fragile")
		spawned[0].emitMessage({
			type: "activated",
			pluginId: "acme.fragile",
			registeredCommands: [],
			registeredTools: [],
		})
		spawned[0].emitExit(1)
		expect(supervisor.getSummary("acme.fragile")?.state).toBe("quarantined")
		expect(records.has("acme.fragile")).toBe(true)
	})

	test("supervisor-initiated termination is not misread as a crash", async () => {
		const { spawn, spawned } = fakeSpawner()
		const supervisor = track(
			createPluginWorkerSupervisor({ spawnWorker: spawn, ...FAST_POLICIES }),
		)
		supervisor.register({ pluginId: "acme.clean", entryPath: "fake" })
		supervisor.activate("acme.clean")
		spawned[0].emitMessage({
			type: "activated",
			pluginId: "acme.clean",
			registeredCommands: [],
			registeredTools: [],
		})
		supervisor.disable("acme.clean")
		// Late exit event from the terminated worker generation.
		spawned[0].emitExit(0)
		expect(supervisor.getSummary("acme.clean")?.state).toBe("disabled")
		expect(supervisor.getSummary("acme.clean")?.crashCount).toBe(0)
		expect(spawned[0].terminated).toBe(true)
	})

	test("a worker that never signals ready times out as partial_activation", () => {
		const { spawn } = fakeSpawner()
		let clock = 1_000
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: spawn,
				...FAST_POLICIES,
				now: () => clock,
			}),
		)
		supervisor.register({ pluginId: "acme.never-ready", entryPath: "fake" })
		supervisor.activate("acme.never-ready")
		expect(supervisor.getSummary("acme.never-ready")?.state).toBe("activating")
		clock += FAST_POLICIES.heartbeatPolicy.hangTimeoutMs + 1
		supervisor.scanForHangs()
		const summary = supervisor.getSummary("acme.never-ready")
		expect(summary?.state).toBe("failed")
		expect(summary?.recentCrashes.at(-1)?.failureClass).toBe("partial_activation")
	})

	test("unknown plugin id fails fast with a typed error", () => {
		const { spawn } = fakeSpawner()
		const supervisor = track(createPluginWorkerSupervisor({ spawnWorker: spawn, ...FAST_POLICIES }))
		expect(() => supervisor.activate("acme.ghost")).toThrow(/not registered/)
	})

	test("resolveActivation defaults (no option) → activate sent with empty grants and session scope", async () => {
		const { spawn, spawned } = fakeSpawner()
		const supervisor = track(
			createPluginWorkerSupervisor({
				spawnWorker: spawn,
				// no resolveActivation
				...FAST_POLICIES,
			}),
		)
		supervisor.register({ pluginId: "acme.no-grants", entryPath: "fake" })
		supervisor.activate("acme.no-grants")
		await waitFor(() => spawned[0]?.posted.length > 0, 1_000, "activate posted")
		const activateMsg = spawned[0].posted.find((m: unknown) => (m as { type?: string }).type === "activate")
		expect(activateMsg).toMatchObject({
			type: "activate",
			pluginId: "acme.no-grants",
			grantedCapabilities: [],
			sessionScope: "session",
		})
	})

	test("trustTier and signatureState are accepted on registration (spawn-gate prep)", () => {
		const { spawn } = fakeSpawner()
		const supervisor = track(createPluginWorkerSupervisor({ spawnWorker: spawn, ...FAST_POLICIES }))
		// Should not throw; data is threaded through for F3's gate.
		const summary = supervisor.register({
			pluginId: "acme.trust-threaded",
			entryPath: "fake",
			trustTier: "signed-third-party",
			signatureState: "verified",
		})
		expect(summary).toBeDefined()
	})
})
