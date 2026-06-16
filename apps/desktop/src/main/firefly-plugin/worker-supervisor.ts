/**
 * Firefly Plugin System V2 — plugin worker supervisor (process tier)
 *
 * The live runtime that the locked `runtime-supervision.ts` contract
 * specifies: one worker per active plugin, heartbeats, hang detection,
 * crash counters, exponential restart backoff, and durable quarantine.
 * EVERY state change routes through `applySupervisionEvent` — this
 * module owns no lifecycle logic of its own; it executes the reducer's
 * decisions against real worker handles.
 *
 * The worker transport is injected (`SpawnPluginWorker`) so:
 *   - production spawns `node:worker_threads` workers (see
 *     `createWorkerThreadSpawner`) inside whichever process hosts the
 *     supervisor (Electron main today; the utilityProcess plugin host
 *     when the per-plugin build pipeline lands),
 *   - tests spawn real worker_threads fixtures or scripted fakes.
 *
 * Containment bar (plan §2.1): a crashing or hanging worker is killed
 * and quarantined without affecting the host or any sibling plugin.
 */

import {
	parseWorkerToHostMessage,
	workerLifecycleMessageSchema,
	type HostToWorkerMessage,
	type WorkerLifecycleMessage,
	type WorkerToHostMessage,
} from "../../shared/firefly-plugin/extension-host-protocol"
import {
	applySupervisionEvent,
	computeNextRestartDelayMs,
	crashCountWithin,
	createEmptyPluginSupervision,
	DEFAULT_CRASH_WINDOW_POLICY,
	DEFAULT_HEARTBEAT_POLICY,
	DEFAULT_RESTART_BACKOFF_POLICY,
	isHangDetected,
	isLifecycleRunning,
	summarizePluginSupervision,
	type CrashWindowPolicy,
	type HeartbeatPolicy,
	type PluginSupervisionEvent,
	type PluginSupervisionState,
	type PluginSupervisionSummary,
	type QuarantineRecord,
	type RestartBackoffPolicy,
	type SupervisionDecision,
} from "../../shared/firefly-plugin/runtime-supervision"

import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/worker-supervisor")

// ---------------------------------------------------------------------------
// Worker transport contract
// ---------------------------------------------------------------------------

/** Lifecycle messages a plugin worker may send the supervisor. Re-exported
 *  from the extension-host protocol so there is one definition (S10). Anything
 *  outside the full worker→host protocol is a violation that degrades the
 *  worker (fail loud). */
export const pluginWorkerMessageSchema = workerLifecycleMessageSchema
export type PluginWorkerMessage = WorkerLifecycleMessage

export interface PluginWorkerHandle {
	postMessage(message: unknown): void
	/** Force-stop the worker. Must be idempotent. */
	terminate(): Promise<unknown> | unknown
	onMessage(listener: (message: unknown) => void): void
	onExit(listener: (exitCode: number | null) => void): void
	onError(listener: (error: Error) => void): void
}

export interface SpawnPluginWorkerInput {
	readonly pluginId: string
	readonly entryPath: string
}

export type SpawnPluginWorker = (input: SpawnPluginWorkerInput) => PluginWorkerHandle

// ---------------------------------------------------------------------------
// Quarantine persistence
// ---------------------------------------------------------------------------

export interface QuarantineStore {
	write(record: QuarantineRecord): void
	clear(pluginId: string): void
}

const noopQuarantineStore: QuarantineStore = {
	write: () => undefined,
	clear: () => undefined,
}

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

export interface PluginWorkerRegistration {
	readonly pluginId: string
	readonly entryPath: string
	/** Per-plugin crash threshold (descriptor `quarantineOnCrashCount`). */
	readonly quarantineOnCrashCount?: number
	readonly restartBackoffMs?: number
}

export interface PluginWorkerSupervisorOptions {
	readonly spawnWorker: SpawnPluginWorker
	readonly quarantineStore?: QuarantineStore
	readonly heartbeatPolicy?: HeartbeatPolicy
	readonly restartBackoffPolicy?: RestartBackoffPolicy
	readonly crashWindowPolicy?: CrashWindowPolicy
	/** Hang-scan cadence. Defaults to heartbeatPolicy.heartbeatIntervalMs. */
	readonly hangScanIntervalMs?: number
	readonly now?: () => number
	readonly random01?: () => number
	readonly onTransition?: (summary: PluginSupervisionSummary, decision: SupervisionDecision) => void
	/**
	 * Services non-lifecycle worker→host messages (storage / capability /
	 * invoke-result) per the extension-host protocol. Returns the message to
	 * post back to the worker, or null for fire-and-forget. Keeps the supervisor
	 * generic: the concrete routing (storage service, grant store) is injected.
	 */
	readonly onWorkerRequest?: (input: {
		pluginId: string
		message: WorkerToHostMessage
	}) => Promise<HostToWorkerMessage | null> | HostToWorkerMessage | null
}

interface SupervisedPlugin {
	registration: PluginWorkerRegistration
	state: PluginSupervisionState
	crashPolicy: CrashWindowPolicy
	backoffPolicy: RestartBackoffPolicy
	worker: PluginWorkerHandle | null
	/** Worker generation guard: stale exit events from a terminated
	 *  worker must not be attributed to its replacement. */
	generation: number
	restartTimer: ReturnType<typeof setTimeout> | null
	/** True while the supervisor itself is stopping the worker, so the
	 *  resulting exit event is not misread as a crash. */
	stopping: boolean
}

export interface PluginWorkerSupervisor {
	register(registration: PluginWorkerRegistration): PluginSupervisionSummary
	activate(pluginId: string): PluginSupervisionSummary
	disable(pluginId: string): PluginSupervisionSummary
	enable(pluginId: string): PluginSupervisionSummary
	releaseQuarantine(pluginId: string, note: string): PluginSupervisionSummary
	getSummary(pluginId: string): PluginSupervisionSummary | null
	listSummaries(): PluginSupervisionSummary[]
	/** Test/diagnostic hook: run one hang-detection pass now. */
	scanForHangs(): void
	dispose(): Promise<void>
}

class UnknownPluginError extends Error {
	constructor(pluginId: string) {
		super(`plugin ${pluginId} is not registered with the worker supervisor`)
		this.name = "UnknownPluginError"
	}
}

/** Don't keep the host process alive for supervisor timers. Node
 *  timers expose `unref`; DOM-typed environments return numbers. */
function unrefTimer(timer: unknown): void {
	if (
		timer !== null &&
		typeof timer === "object" &&
		typeof (timer as { unref?: unknown }).unref === "function"
	) {
		;(timer as { unref: () => void }).unref()
	}
}

export function createPluginWorkerSupervisor(
	options: PluginWorkerSupervisorOptions,
): PluginWorkerSupervisor {
	const now = options.now ?? (() => Date.now())
	const random01 = options.random01 ?? Math.random
	const quarantineStore = options.quarantineStore ?? noopQuarantineStore
	const heartbeatPolicy = options.heartbeatPolicy ?? DEFAULT_HEARTBEAT_POLICY
	const baseCrashPolicy = options.crashWindowPolicy ?? DEFAULT_CRASH_WINDOW_POLICY
	const baseBackoffPolicy = options.restartBackoffPolicy ?? DEFAULT_RESTART_BACKOFF_POLICY

	const plugins = new Map<string, SupervisedPlugin>()
	let disposed = false

	const hangScanIntervalMs = options.hangScanIntervalMs ?? heartbeatPolicy.heartbeatIntervalMs
	const hangScanTimer = setInterval(() => scanForHangs(), hangScanIntervalMs)
	// Do not keep the host process alive just for the scanner.
	unrefTimer(hangScanTimer)

	function mustGet(pluginId: string): SupervisedPlugin {
		const entry = plugins.get(pluginId)
		if (!entry) throw new UnknownPluginError(pluginId)
		return entry
	}

	function emit(entry: SupervisedPlugin, decision: SupervisionDecision): void {
		options.onTransition?.(summarizePluginSupervision(entry.state, entry.crashPolicy), decision)
	}

	/**
	 * Route an event through the locked reducer and execute the decision.
	 * The ONLY place state changes.
	 */
	function apply(entry: SupervisedPlugin, event: PluginSupervisionEvent): SupervisionDecision {
		const result = applySupervisionEvent(entry.state, event, entry.crashPolicy, now())
		entry.state = result.state
		execute(entry, result.decision)
		emit(entry, result.decision)
		return result.decision
	}

	function execute(entry: SupervisedPlugin, decision: SupervisionDecision): void {
		switch (decision.action) {
			case "spawn-worker":
				spawn(entry)
				return
			case "restart-worker":
				stopWorker(entry)
				scheduleRestart(entry)
				return
			case "teardown-worker":
				stopWorker(entry)
				apply(entry, { kind: "teardownComplete", pluginId: entry.state.pluginId })
				return
			case "stop-worker":
				stopWorker(entry)
				return
			case "write-quarantine": {
				stopWorker(entry)
				clearRestartTimer(entry)
				if (entry.state.quarantined) quarantineStore.write(entry.state.quarantined)
				log.warn("Plugin quarantined", {
					pluginId: entry.state.pluginId,
					reason: entry.state.quarantined?.reason,
					detail: decision.detail,
				})
				return
			}
			case "clear-quarantine":
				quarantineStore.clear(entry.state.pluginId)
				return
			case "purge-bundle":
				stopWorker(entry)
				clearRestartTimer(entry)
				return
			case "notify-operator":
				log.warn("Plugin supervisor operator notice", {
					pluginId: entry.state.pluginId,
					detail: decision.detail,
				})
				return
			case "none":
				return
		}
	}

	function handleWorkerRequest(
		entry: SupervisedPlugin,
		worker: PluginWorkerHandle,
		message: WorkerToHostMessage,
	): void {
		const handler = options.onWorkerRequest
		if (!handler) return
		void Promise.resolve(handler({ pluginId: entry.state.pluginId, message }))
			.then((response) => {
				if (response) worker.postMessage(response)
			})
			.catch((err) => {
				log.warn("worker request handler failed", {
					pluginId: entry.state.pluginId,
					error: err instanceof Error ? err.message : String(err),
				})
			})
	}

	function spawn(entry: SupervisedPlugin): void {
		if (disposed) return
		clearRestartTimer(entry)
		entry.generation += 1
		const generation = entry.generation
		const pluginId = entry.state.pluginId
		entry.stopping = false

		let worker: PluginWorkerHandle
		try {
			worker = options.spawnWorker({ pluginId, entryPath: entry.registration.entryPath })
		} catch (err) {
			apply(entry, {
				kind: "activationFailed",
				pluginId,
				failureClass: "load_failure",
				message: `spawn failed: ${err instanceof Error ? err.message : String(err)}`,
				exitCode: null,
			})
			return
		}
		entry.worker = worker

		worker.onMessage((raw) => {
			if (entry.generation !== generation) return
			const parsed = parseWorkerToHostMessage(raw)
			if (!parsed.ok) {
				apply(entry, {
					kind: "healthDegraded",
					pluginId,
					message: `protocol violation: ${parsed.reason}`,
				})
				return
			}
			const message = parsed.message
			switch (message.type) {
				case "ready":
					apply(entry, { kind: "activationSucceeded", pluginId })
					return
				case "heartbeat":
					apply(entry, { kind: "heartbeat", pluginId })
					return
				case "fatal":
					apply(entry, { kind: "workerCrashed", pluginId, exitCode: null, message: message.message })
					return
				case "storage-request":
				case "capability-request":
				case "invoke-result":
					handleWorkerRequest(entry, worker, message)
					return
			}
		})

		worker.onExit((exitCode) => {
			if (entry.generation !== generation) return
			entry.worker = null
			if (entry.stopping) return
			if (entry.state.state === "activating") {
				apply(entry, {
					kind: "activationFailed",
					pluginId,
					failureClass: "init_crash",
					message: `worker exited during activation (code ${exitCode ?? "null"})`,
					exitCode,
				})
				return
			}
			if (isLifecycleRunning(entry.state.state)) {
				apply(entry, {
					kind: "workerCrashed",
					pluginId,
					exitCode,
					message: `worker exited unexpectedly (code ${exitCode ?? "null"})`,
				})
			}
		})

		worker.onError((error) => {
			if (entry.generation !== generation) return
			if (entry.stopping) return
			if (entry.state.state === "activating") {
				apply(entry, {
					kind: "activationFailed",
					pluginId,
					failureClass: "init_crash",
					message: error.message,
					exitCode: null,
				})
				return
			}
			apply(entry, { kind: "workerCrashed", pluginId, exitCode: null, message: error.message })
		})
	}

	function stopWorker(entry: SupervisedPlugin): void {
		const worker = entry.worker
		if (!worker) return
		entry.stopping = true
		// Invalidate the generation so late exit/error events are ignored.
		entry.generation += 1
		entry.worker = null
		try {
			void worker.terminate()
		} catch (err) {
			log.warn("Worker terminate threw", {
				pluginId: entry.state.pluginId,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	function scheduleRestart(entry: SupervisedPlugin): void {
		if (disposed) return
		clearRestartTimer(entry)
		const delayMs = computeNextRestartDelayMs(entry.state.attempt, entry.backoffPolicy, random01)
		entry.restartTimer = setTimeout(() => {
			entry.restartTimer = null
			if (disposed) return
			if (entry.state.state !== "failed") return
			if (!entry.state.enabledByOperator) return
			apply(entry, { kind: "activationRequested", pluginId: entry.state.pluginId })
		}, delayMs)
		unrefTimer(entry.restartTimer)
	}

	function clearRestartTimer(entry: SupervisedPlugin): void {
		if (entry.restartTimer) {
			clearTimeout(entry.restartTimer)
			entry.restartTimer = null
		}
	}

	function scanForHangs(): void {
		if (disposed) return
		for (const entry of plugins.values()) {
			const pluginId = entry.state.pluginId
			if (entry.state.state === "activating") {
				// A worker that never signals ready is a hang of the
				// activation path: fail it so the crash counters see it.
				if (now() - entry.state.lastTransitionAt > heartbeatPolicy.hangTimeoutMs) {
					stopWorker(entry)
					apply(entry, {
						kind: "activationFailed",
						pluginId,
						failureClass: "partial_activation",
						message: `worker did not signal ready within ${heartbeatPolicy.hangTimeoutMs}ms`,
						exitCode: null,
					})
				}
				continue
			}
			if (entry.state.state !== "active" && entry.state.state !== "degraded") continue
			if (isHangDetected(entry.state.lastHeartbeatAt, now(), heartbeatPolicy)) {
				// Kill the hung worker before the reducer decides restart vs
				// quarantine — a wedged worker never gets to keep running.
				stopWorker(entry)
				apply(entry, { kind: "heartbeatMissed", pluginId })
				// Host policy on top of the locked reducer: the reducer's
				// hangStreak only counts CONSECUTIVE misses and resets on a
				// successful re-activation, so a hang→restart→hang loop
				// would cycle forever. Repeated hang-class crashes within
				// the crash window quarantine via the host-initiated path.
				// (`apply` replaced `entry.state`; re-read it fresh so the
				// earlier active/degraded narrowing does not apply.)
				const stateAfterMiss = entry.state
				if (stateAfterMiss.state !== "quarantined") {
					const hangCrashes = crashCountWithin(
						entry.state.crashHistory,
						entry.crashPolicy.windowMs,
						now(),
						"hang",
					)
					if (hangCrashes >= entry.crashPolicy.hangThreshold) {
						apply(entry, {
							kind: "quarantineRequested",
							pluginId,
							reason: "hangs",
							detail: `${hangCrashes} hang-class crashes within ${entry.crashPolicy.windowMs}ms (host hang policy)`,
							by: "host",
						})
					}
				}
			}
		}
	}

	return {
		register(registration) {
			const existing = plugins.get(registration.pluginId)
			if (existing) {
				return summarizePluginSupervision(existing.state, existing.crashPolicy)
			}
			const crashPolicy: CrashWindowPolicy = registration.quarantineOnCrashCount
				? {
						...baseCrashPolicy,
						activationCrashThreshold: registration.quarantineOnCrashCount,
						runtimeCrashThreshold: registration.quarantineOnCrashCount,
				  }
				: baseCrashPolicy
			const backoffPolicy: RestartBackoffPolicy = registration.restartBackoffMs
				? { ...baseBackoffPolicy, baseMs: registration.restartBackoffMs }
				: baseBackoffPolicy
			const entry: SupervisedPlugin = {
				registration,
				state: createEmptyPluginSupervision(registration.pluginId, now()),
				crashPolicy,
				backoffPolicy,
				worker: null,
				generation: 0,
				restartTimer: null,
				stopping: false,
			}
			plugins.set(registration.pluginId, entry)
			apply(entry, { kind: "manifestValidated", pluginId: registration.pluginId })
			apply(entry, { kind: "installed", pluginId: registration.pluginId })
			return summarizePluginSupervision(entry.state, entry.crashPolicy)
		},

		activate(pluginId) {
			const entry = mustGet(pluginId)
			apply(entry, { kind: "activationRequested", pluginId })
			return summarizePluginSupervision(entry.state, entry.crashPolicy)
		},

		disable(pluginId) {
			const entry = mustGet(pluginId)
			clearRestartTimer(entry)
			apply(entry, { kind: "disableRequested", pluginId, by: "operator" })
			return summarizePluginSupervision(entry.state, entry.crashPolicy)
		},

		enable(pluginId) {
			const entry = mustGet(pluginId)
			apply(entry, { kind: "enableRequested", pluginId, by: "operator" })
			if (entry.state.state === "disabled" || entry.state.state === "installed") {
				apply(entry, { kind: "activationRequested", pluginId })
			}
			return summarizePluginSupervision(entry.state, entry.crashPolicy)
		},

		releaseQuarantine(pluginId, note) {
			const entry = mustGet(pluginId)
			apply(entry, { kind: "quarantineReleased", pluginId, by: "operator", note })
			if (entry.state.state === "discovered") {
				apply(entry, { kind: "manifestValidated", pluginId })
				apply(entry, { kind: "installed", pluginId })
			}
			return summarizePluginSupervision(entry.state, entry.crashPolicy)
		},

		getSummary(pluginId) {
			const entry = plugins.get(pluginId)
			return entry ? summarizePluginSupervision(entry.state, entry.crashPolicy) : null
		},

		listSummaries() {
			return [...plugins.values()].map((entry) =>
				summarizePluginSupervision(entry.state, entry.crashPolicy),
			)
		},

		scanForHangs,

		async dispose() {
			disposed = true
			clearInterval(hangScanTimer)
			for (const entry of plugins.values()) {
				clearRestartTimer(entry)
				stopWorker(entry)
			}
		},
	}
}
