/**
 * Firefly Plugin System V2 — Runtime supervision contract
 *
 * Defines the host-owned plugin worker supervision contract. Every V2
 * plugin runs in a host-spawned worker (an Electron `utilityProcess`
 * for the plugin host + per-plugin `worker_thread` underneath; see
 * `docs/firefly-plugin-system-v2.md` §11). The host is the only
 * authoritative path for plugin state — this file encodes that
 * authority as pure, deterministic, greppable types and reducer
 * functions that later runtime code can implement against.
 *
 * Discipline:
 *   - Lifecycle state machine is locked (`PLUGIN_LIFECYCLE_TRANSITIONS`).
 *     Runtime code MUST route every state change through the reducer
 *     `applySupervisionEvent`. Ad-hoc state mutation is forbidden.
 *   - All decision functions are pure: a `nowMs` clock is injected,
 *     never read. Tests can pin time; runtime code passes
 *     `Date.now()`.
 *   - The `PluginDescriptor` (see `./descriptor`) stays the static
 *     contribution source of truth. This module is the dynamic
 *     supervision layer that lives on top of it.
 *   - Quarantine state has its own durable schema
 *     (`QuarantineRecord`) so the host can persist it across restarts.
 *
 * Coverage of the V2 plan §11 failure classes (each has a dedicated
 * helper or event kind below):
 *   - init crash           → `activationFailure` event, `crashCountWithin`
 *   - runtime crash        → `workerCrashed` event, `crashCountWithin`
 *   - hang / heartbeat     → `heartbeatMissed` event, `isHangDetected`
 *   - partial activation   → `partialActivation` event
 *   - manual disable       → `disableRequested` event
 *   - quarantine trigger   → `evaluateQuarantineTrigger` (pure check)
 *   - manual recovery      → `quarantineReleased` event, `requestOperatorOverride`
 *   - hot reload boundary  → `hotReloadRequested` event, `TearingDown` state
 *   - quarantine persistence → `serializeQuarantineState` / `parseQuarantineState`
 */

import { z } from "zod"

import type { PluginId } from "./manifest"

// ---------------------------------------------------------------------------
// Lifecycle state machine
// ---------------------------------------------------------------------------

/**
 * The locked plugin lifecycle vocabulary. Mirrors the V2 plan §11.2 with
 * one explicit transient boundary state (`tearingDown`) added so the
 * hot-reload teardown/restart boundary is auditable in source instead
 * of being implied by side-effects.
 *
 * Order is intentional: it traces the natural path from
 * `discovered → removed`. The terminal set is the tail of that path.
 */
export const PLUGIN_LIFECYCLE_STATES = [
	"discovered",
	"validated",
	"installed",
	"disabled",
	"activating",
	"active",
	"degraded",
	"failed",
	"tearingDown",
	"quarantined",
	"removed",
] as const

export type PluginLifecycleState = (typeof PLUGIN_LIFECYCLE_STATES)[number]

/**
 * Locked transition table. Source of truth for the reducer and for the
 * documentation. Mutations are forbidden at runtime; tests assert the
 * table is the only legal source.
 */
export const PLUGIN_LIFECYCLE_TRANSITIONS = {
	discovered: ["validated", "quarantined", "removed"],
	validated: ["installed", "quarantined", "removed"],
	installed: ["disabled", "activating", "removed"],
	disabled: ["activating", "removed"],
	activating: ["active", "failed", "disabled", "removed", "quarantined"],
	active: ["degraded", "tearingDown", "activating", "disabled", "quarantined", "removed"],
	degraded: ["active", "tearingDown", "activating", "disabled", "quarantined", "removed"],
	failed: ["activating", "disabled", "quarantined", "removed"],
	tearingDown: ["activating", "disabled", "quarantined", "removed"],
	quarantined: ["discovered", "removed"],
	removed: [],
} as const satisfies Readonly<Record<PluginLifecycleState, readonly PluginLifecycleState[]>>

/**
 * Terminal states. A `removed` plugin never transitions again. A
 * `quarantined` plugin CAN re-enter `discovered` after operator release
 * — see the `quarantineReleased` event.
 */
export const PLUGIN_LIFECYCLE_TERMINAL_STATES: ReadonlySet<PluginLifecycleState> = new Set([
	"removed",
])

/**
 * States where a worker is "live" (a process handle exists or is
 * being prepared). Used by the runtime to decide whether to flush
 * pending envelopes before teardown.
 */
export const PLUGIN_LIFECYCLE_RUNNING_STATES: ReadonlySet<PluginLifecycleState> = new Set([
	"activating",
	"active",
	"degraded",
	"tearingDown",
])

/**
 * States where the host accepts plugin tool calls. `degraded` accepts
 * calls at lower priority (plan §11.2) and is therefore included; the
 * tool dispatcher is responsible for the priority weighting.
 */
export const PLUGIN_LIFECYCLE_ACCEPTING_STATES: ReadonlySet<PluginLifecycleState> = new Set([
	"active",
	"degraded",
])

/**
 * Returns true iff `from -> to` is an allowed transition.
 */
export function isLifecycleTransitionAllowed(
	from: PluginLifecycleState,
	to: PluginLifecycleState,
): boolean {
	return (PLUGIN_LIFECYCLE_TRANSITIONS[from] as readonly PluginLifecycleState[]).includes(to)
}

/**
 * Returns true iff the state is terminal (no further transitions).
 */
export function isLifecycleTerminalState(state: PluginLifecycleState): boolean {
	return PLUGIN_LIFECYCLE_TERMINAL_STATES.has(state)
}

/**
 * Returns true iff the lifecycle state has a live worker (or is in
 * the middle of preparing / tearing one down).
 */
export function isLifecycleRunning(state: PluginLifecycleState): boolean {
	return PLUGIN_LIFECYCLE_RUNNING_STATES.has(state)
}

/**
 * Returns true iff the plugin is accepting new tool calls in its
 * current state.
 */
export function isLifecycleAcceptingCalls(state: PluginLifecycleState): boolean {
	return PLUGIN_LIFECYCLE_ACCEPTING_STATES.has(state)
}

/**
 * Returns true iff the plugin is currently quarantined. `quarantined`
 * is the only state this helper matches — terminal `removed` is NOT
 * a quarantine.
 */
export function isLifecycleQuarantined(state: PluginLifecycleState): boolean {
	return state === "quarantined"
}

// ---------------------------------------------------------------------------
// Failure class taxonomy
// ---------------------------------------------------------------------------

/**
 * The failure classes the V2 plan §11.3 mandates we cover explicitly
 * in source. Each class drives a specific supervision event kind and
 * quarantine trigger check.
 */
export const PLUGIN_FAILURE_CLASSES = [
	"init_crash",
	"runtime_crash",
	"hang",
	"partial_activation",
	"oom",
	"load_failure",
	"critical_security",
	"manual_disable",
	"manifest_mismatch",
] as const

export type PluginFailureClass = (typeof PLUGIN_FAILURE_CLASSES)[number]

export const failureClassSchema = z.enum(PLUGIN_FAILURE_CLASSES)

// ---------------------------------------------------------------------------
// Heartbeat + hang policy
// ---------------------------------------------------------------------------

/**
 * Heartbeat / hang detection policy. The host keeps a `lastHeartbeatAt`
 * timestamp on the supervision state; when it is older than
 * `hangTimeoutMs` past the most recent `heartbeat` event, the
 * supervisor considers the worker hung and emits a `hang` failure.
 *
 * `heartbeatIntervalMs` is the cadence the host requests from the
 * worker; the worker MAY use a faster cadence, but never slower.
 */
export interface HeartbeatPolicy {
	readonly hangTimeoutMs: number
	readonly heartbeatIntervalMs: number
}

export const DEFAULT_HANG_TIMEOUT_MS = 30_000
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000

export const DEFAULT_HEARTBEAT_POLICY: HeartbeatPolicy = {
	hangTimeoutMs: DEFAULT_HANG_TIMEOUT_MS,
	heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
}

export const heartbeatPolicySchema = z
	.object({
		hangTimeoutMs: z.number().int().positive().max(10 * 60_000),
		heartbeatIntervalMs: z.number().int().positive().max(2 * 60_000),
	})
	.strict()

/**
 * Returns true iff the most recent heartbeat is older than
 * `hangTimeoutMs` at `nowMs`. The host must emit a `heartbeat` event
 * on every worker beat; the reducer stamps `lastHeartbeatAt` so this
 * check stays pure.
 */
export function isHangDetected(
	lastHeartbeatAt: number | null,
	nowMs: number,
	policy: HeartbeatPolicy = DEFAULT_HEARTBEAT_POLICY,
): boolean {
	if (lastHeartbeatAt === null) return false
	return nowMs - lastHeartbeatAt > policy.hangTimeoutMs
}

// ---------------------------------------------------------------------------
// Restart backoff policy
// ---------------------------------------------------------------------------

/**
 * Exponential backoff policy for plugin worker restarts. The host
 * uses the result of `computeNextRestartDelayMs` to schedule the
 * next activation attempt. The defaults mirror the V2 plan: start
 * fast (1s), cap at 60s.
 */
export interface RestartBackoffPolicy {
	readonly baseMs: number
	readonly maxMs: number
	readonly factor: number
	readonly jitterRatio: number
}

export const DEFAULT_RESTART_BACKOFF_POLICY: RestartBackoffPolicy = {
	baseMs: 1_000,
	maxMs: 60_000,
	factor: 2,
	jitterRatio: 0.1,
}

export const restartBackoffPolicySchema = z
	.object({
		baseMs: z.number().int().positive().max(60_000),
		maxMs: z.number().int().positive().max(10 * 60_000),
		factor: z.number().min(1).max(8),
		jitterRatio: z.number().min(0).max(1),
	})
	.strict()
	.refine((value) => value.maxMs >= value.baseMs, {
		message: "maxMs must be >= baseMs",
	})

/**
 * Compute the delay (ms) until the next activation attempt after
 * `attemptCount` consecutive failures. Pure: a `random01` factory
 * is injected so tests can pin the jitter.
 *
 * Schedule:
 *   attempt 0 → baseMs
 *   attempt 1 → baseMs * factor
 *   attempt N → baseMs * factor^N (capped at maxMs)
 */
export function computeNextRestartDelayMs(
	attemptCount: number,
	policy: RestartBackoffPolicy = DEFAULT_RESTART_BACKOFF_POLICY,
	random01: () => number = Math.random,
): number {
	const clamped = Math.max(0, Math.floor(attemptCount))
	const exp = policy.baseMs * policy.factor ** Math.min(clamped, 20)
	const capped = Math.min(exp, policy.maxMs)
	const jitter = capped * policy.jitterRatio * (random01() * 2 - 1)
	return Math.max(0, Math.round(capped + jitter))
}

// ---------------------------------------------------------------------------
// Crash record + crash window
// ---------------------------------------------------------------------------

/**
 * Append-only record of one failure event. The supervisor keeps the
 * tail (`MAX_CRASH_HISTORY`) and counts the slice inside the active
 * `crashWindowMs` for quarantine-trigger checks.
 */
export interface CrashRecord {
	readonly failureClass: PluginFailureClass
	readonly timestamp: number
	readonly message: string
	readonly exitCode: number | null
	readonly attempt: number
}

export const crashRecordSchema = z
	.object({
		failureClass: failureClassSchema,
		timestamp: z.number().int().nonnegative(),
		message: z.string().min(1).max(2000),
		exitCode: z.number().int().nullable(),
		attempt: z.number().int().nonnegative(),
	})
	.strict()

/**
 * How many crash records are inside `[nowMs - windowMs, nowMs]`. The
 * reducer keeps the full history but the trigger checks use this
 * count so the window is honored even if old records linger. Records
 * stamped in the future (timestamp > nowMs) are also excluded so a
 * skewed clock never inflates the count.
 */
export function crashCountWithin(
	history: readonly CrashRecord[],
	windowMs: number,
	nowMs: number,
	failureClass?: PluginFailureClass,
): number {
	const cutoff = nowMs - windowMs
	let n = 0
	for (const record of history) {
		if (record.timestamp < cutoff) continue
		if (record.timestamp > nowMs) continue
		if (failureClass && record.failureClass !== failureClass) continue
		n += 1
	}
	return n
}

// ---------------------------------------------------------------------------
// Quarantine record (durable across restarts)
// ---------------------------------------------------------------------------

/**
 * Reason a plugin is (or was) quarantined. Locked vocabulary so
 * operator UI / logs can render predictable strings.
 */
export const QUARANTINE_REASONS = [
	"activation_crashes",
	"runtime_crashes",
	"hangs",
	"oom",
	"partial_activation_persistent",
	"critical_security",
	"manifest_mismatch",
	"operator_manual",
	"load_failure",
] as const

export type QuarantineReason = (typeof QUARANTINE_REASONS)[number]

export const quarantineReasonSchema = z.enum(QUARANTINE_REASONS)

/**
 * The durable shape written to `~/.config/elf/firefly-client/quarantine.json`.
 * Mirrors the plan §11.4 requirements: `quarantinedAt` + reason + detail,
 * never a snapshot of full crash history (crash history is part of the
 * plugin supervision state, not the quarantine file).
 */
export interface QuarantineRecord {
	readonly pluginId: PluginId
	readonly reason: QuarantineReason
	readonly detail: string
	readonly quarantinedAt: number
	readonly crashCount: number
	readonly windowMs: number
	readonly releasedAt: number | null
	readonly releasedBy: "operator" | "host" | null
	readonly releaseNote: string | null
}

export const quarantineRecordSchema = z
	.object({
		pluginId: z.string().min(1).max(128),
		reason: quarantineReasonSchema,
		detail: z.string().min(1).max(2000),
		quarantinedAt: z.number().int().nonnegative(),
		crashCount: z.number().int().nonnegative().max(1_000_000),
		windowMs: z.number().int().nonnegative().max(7 * 24 * 60 * 60 * 1000),
		releasedAt: z.number().int().nonnegative().nullable(),
		releasedBy: z.enum(["operator", "host"]).nullable(),
		releaseNote: z.string().min(1).max(2000).nullable(),
	})
	.strict()

// ---------------------------------------------------------------------------
// Crash window + counter decay policy (for trigger checks)
// ---------------------------------------------------------------------------

/**
 * The host's crash-window policy. Defaults mirror the V2 plan §11.4:
 *   - 3 activation crashes within 5 minutes → quarantine
 *   - 3 runtime crashes within 5 minutes → quarantine
 *   - 3 hangs → quarantine
 *
 * `crashCounterTtlMs` is the decay TTL: a crash record's contribution
 * to the counter expires `crashCounterTtlMs` after the crash (plan
 * §11.4 says 24h). Trigger checks should `crashCountWithin` over the
 * window; the runtime additionally rolls history forward when the
 * most-recent record is older than the TTL.
 */
export interface CrashWindowPolicy {
	readonly windowMs: number
	readonly activationCrashThreshold: number
	readonly runtimeCrashThreshold: number
	readonly hangThreshold: number
	readonly crashCounterTtlMs: number
	readonly maxCrashHistory: number
}

export const DEFAULT_CRASH_WINDOW_POLICY: CrashWindowPolicy = {
	windowMs: 5 * 60_000,
	activationCrashThreshold: 3,
	runtimeCrashThreshold: 3,
	hangThreshold: 3,
	crashCounterTtlMs: 24 * 60 * 60_000,
	maxCrashHistory: 50,
}

export const crashWindowPolicySchema = z
	.object({
		windowMs: z.number().int().positive().max(60 * 60_000),
		activationCrashThreshold: z.number().int().positive().max(20),
		runtimeCrashThreshold: z.number().int().positive().max(20),
		hangThreshold: z.number().int().positive().max(20),
		crashCounterTtlMs: z.number().int().positive().max(7 * 24 * 60 * 60_000),
		maxCrashHistory: z.number().int().positive().max(1_000),
	})
	.strict()

// ---------------------------------------------------------------------------
// Plugin supervision state
// ---------------------------------------------------------------------------

/**
 * The full per-plugin supervision record. The host keeps one of
 * these per plugin id; the reducer updates it in response to events.
 *
 * The record is intentionally JSON-serializable. The durable part
 * (quarantine file) is a strict subset; runtime code is responsible
 * for splitting it.
 */
export interface PluginSupervisionState {
	readonly pluginId: PluginId
	readonly state: PluginLifecycleState
	readonly attempt: number
	readonly lastHeartbeatAt: number | null
	readonly crashHistory: readonly CrashRecord[]
	readonly hangStreak: number
	readonly quarantined: QuarantineRecord | null
	readonly lastTransitionAt: number
	readonly lastEventAt: number
	readonly lastError: { code: string; message: string; timestamp: number } | null
	readonly enabledByOperator: boolean
}

export const pluginSupervisionStateSchema = z
	.object({
		pluginId: z.string().min(1).max(128),
		state: z.enum(PLUGIN_LIFECYCLE_STATES),
		attempt: z.number().int().nonnegative(),
		lastHeartbeatAt: z.number().int().nonnegative().nullable(),
		crashHistory: z.array(crashRecordSchema),
		hangStreak: z.number().int().nonnegative(),
		quarantined: quarantineRecordSchema.nullable(),
		lastTransitionAt: z.number().int().nonnegative(),
		lastEventAt: z.number().int().nonnegative(),
		lastError: z
			.object({
				code: z.string().min(1).max(120),
				message: z.string().min(1).max(2000),
				timestamp: z.number().int().nonnegative(),
			})
			.strict()
			.nullable(),
		enabledByOperator: z.boolean(),
	})
	.strict()

/**
 * Build the empty starting state for a freshly-discovered plugin. The
 * runtime calls this once per plugin id, then runs the reducer.
 */
export function createEmptyPluginSupervision(pluginId: PluginId, nowMs: number): PluginSupervisionState {
	return {
		pluginId,
		state: "discovered",
		attempt: 0,
		lastHeartbeatAt: null,
		crashHistory: [],
		hangStreak: 0,
		quarantined: null,
		lastTransitionAt: nowMs,
		lastEventAt: nowMs,
		lastError: null,
		enabledByOperator: true,
	}
}

// ---------------------------------------------------------------------------
// Quarantine trigger evaluation (pure)
// ---------------------------------------------------------------------------

/**
 * The structured reason a quarantine SHOULD fire. The reducer uses
 * this to decide whether to land in `quarantined` after a failure
 * event. Pure: it never mutates the state.
 */
export interface QuarantineTrigger {
	readonly reason: QuarantineReason
	readonly detail: string
	readonly crashCount: number
	readonly windowMs: number
}

function asQuarantineTrigger(
	reason: QuarantineReason,
	detail: string,
	crashCount: number,
	windowMs: number,
): QuarantineTrigger {
	return { reason, detail, crashCount, windowMs }
}

/**
 * Evaluate whether a failure event should trip quarantine, given the
 * state AFTER the reducer has appended the new crash record. Pure:
 * takes the state snapshot, the failure class, and the policy.
 *
 * Returns `null` if no quarantine is warranted. Otherwise returns a
 * trigger the reducer can stamp onto the state.
 */
export function evaluateQuarantineTrigger(input: {
	state: PluginSupervisionState
	failureClass: PluginFailureClass
	policy: CrashWindowPolicy
	nowMs: number
}): QuarantineTrigger | null {
	const { state, failureClass, policy, nowMs } = input
	if (failureClass === "critical_security" || failureClass === "manifest_mismatch") {
		return asQuarantineTrigger(
			failureClass === "critical_security" ? "critical_security" : "manifest_mismatch",
			`${failureClass} tripped immediate quarantine`,
			state.crashHistory.length,
			policy.windowMs,
		)
	}
	if (failureClass === "load_failure") {
		return asQuarantineTrigger(
			"load_failure",
			"plugin bundle could not be loaded (manifest parse / dependency missing)",
			state.crashHistory.length,
			policy.windowMs,
		)
	}
	if (failureClass === "oom") {
		return asQuarantineTrigger("oom", "host OOM event for plugin worker", state.crashHistory.length, policy.windowMs)
	}
	if (failureClass === "partial_activation") {
		const partialCount = crashCountWithin(state.crashHistory, policy.windowMs, nowMs, "partial_activation")
		if (partialCount >= policy.activationCrashThreshold) {
			return asQuarantineTrigger(
				"partial_activation_persistent",
				`partial activation persisted ${partialCount} times within ${policy.windowMs}ms`,
				partialCount,
				policy.windowMs,
			)
		}
		return null
	}
	if (failureClass === "hang") {
		if (state.hangStreak >= policy.hangThreshold) {
			return asQuarantineTrigger(
				"hangs",
				`${state.hangStreak} consecutive hangs (threshold ${policy.hangThreshold})`,
				state.hangStreak,
				policy.windowMs,
			)
		}
		return null
	}
	if (failureClass === "init_crash") {
		const n = crashCountWithin(state.crashHistory, policy.windowMs, nowMs, "init_crash")
		if (n >= policy.activationCrashThreshold) {
			return asQuarantineTrigger(
				"activation_crashes",
				`${n} activation crashes within ${policy.windowMs}ms (threshold ${policy.activationCrashThreshold})`,
				n,
				policy.windowMs,
			)
		}
		return null
	}
	if (failureClass === "runtime_crash") {
		const n = crashCountWithin(state.crashHistory, policy.windowMs, nowMs, "runtime_crash")
		if (n >= policy.runtimeCrashThreshold) {
			return asQuarantineTrigger(
				"runtime_crashes",
				`${n} runtime crashes within ${policy.windowMs}ms (threshold ${policy.runtimeCrashThreshold})`,
				n,
				policy.windowMs,
			)
		}
		return null
	}
	return null
}

// ---------------------------------------------------------------------------
// Supervision event taxonomy (discriminated union)
// ---------------------------------------------------------------------------

/**
 * The event vocabulary the reducer accepts. Each variant carries the
 * data the reducer needs; clock is injected separately so all events
 * are deterministic.
 */
export type PluginSupervisionEvent =
	| {
			readonly kind: "manifestDiscovered"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "manifestValidated"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "manifestLoadFailed"
			readonly pluginId: PluginId
			readonly message: string
	  }
	| {
			readonly kind: "manifestMismatch"
			readonly pluginId: PluginId
			readonly message: string
	  }
	| {
			readonly kind: "installed"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "uninstalled"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "activationRequested"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "activationSucceeded"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "activationFailed"
			readonly pluginId: PluginId
			readonly failureClass: "init_crash" | "partial_activation" | "load_failure"
			readonly message: string
			readonly exitCode: number | null
	  }
	| {
			readonly kind: "heartbeat"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "heartbeatMissed"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "workerCrashed"
			readonly pluginId: PluginId
			readonly exitCode: number | null
			readonly message: string
	  }
	| {
			readonly kind: "workerOom"
			readonly pluginId: PluginId
			readonly message: string
	  }
	| {
			readonly kind: "healthDegraded"
			readonly pluginId: PluginId
			readonly message: string
	  }
	| {
			readonly kind: "healthRestored"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "disableRequested"
			readonly pluginId: PluginId
			readonly by: "operator" | "host"
	  }
	| {
			readonly kind: "enableRequested"
			readonly pluginId: PluginId
			readonly by: "operator" | "host"
	  }
	| {
			readonly kind: "quarantineRequested"
			readonly pluginId: PluginId
			readonly reason: QuarantineReason
			readonly detail: string
			readonly by: "operator" | "host"
	  }
	| {
			readonly kind: "quarantineReleased"
			readonly pluginId: PluginId
			readonly by: "operator" | "host"
			readonly note: string
	  }
	| {
			readonly kind: "hotReloadRequested"
			readonly pluginId: PluginId
			readonly by: "operator" | "host"
	  }
	| {
			readonly kind: "teardownComplete"
			readonly pluginId: PluginId
	  }
	| {
			readonly kind: "criticalSecuritySignal"
			readonly pluginId: PluginId
			readonly message: string
	  }

export const pluginSupervisionEventKindSchema = z.enum([
	"manifestDiscovered",
	"manifestValidated",
	"manifestLoadFailed",
	"manifestMismatch",
	"installed",
	"uninstalled",
	"activationRequested",
	"activationSucceeded",
	"activationFailed",
	"heartbeat",
	"heartbeatMissed",
	"workerCrashed",
	"workerOom",
	"healthDegraded",
	"healthRestored",
	"disableRequested",
	"enableRequested",
	"quarantineRequested",
	"quarantineReleased",
	"hotReloadRequested",
	"teardownComplete",
	"criticalSecuritySignal",
])

// ---------------------------------------------------------------------------
// Reducer return value
// ---------------------------------------------------------------------------

/**
 * What the reducer returns. `state` is the next state. `decision`
 * is the structured outcome the runtime should act on (e.g. "spawn
 * worker", "send SIGTERM", "write quarantine file").
 */
export interface SupervisionDecision {
	readonly action:
		| "none"
		| "spawn-worker"
		| "teardown-worker"
		| "restart-worker"
		| "stop-worker"
		| "purge-bundle"
		| "write-quarantine"
		| "clear-quarantine"
		| "notify-operator"
	readonly detail: string
}

export interface SupervisionReducerResult {
	readonly state: PluginSupervisionState
	readonly decision: SupervisionDecision
	readonly transitions: readonly PluginLifecycleState[]
}

// ---------------------------------------------------------------------------
// Reducer (pure)
// ---------------------------------------------------------------------------

/**
 * Apply a supervision event to a state and return the next state +
 * the host action. Pure: a `nowMs` clock is injected. The runtime
 * can re-run this reducer freely (e.g. after restoring from disk)
 * and the result is deterministic.
 */
export function applySupervisionEvent(
	prev: PluginSupervisionState,
	event: PluginSupervisionEvent,
	policy: CrashWindowPolicy,
	nowMs: number,
): SupervisionReducerResult {
	const transitions: PluginLifecycleState[] = [prev.state]
	const lastErrorFromFailure = (failureClass: PluginFailureClass, message: string) => ({
		code: failureClass,
		message,
		timestamp: nowMs,
	})

	const transition = (next: PluginLifecycleState): PluginSupervisionState => {
		transitions.push(next)
		return {
			...prev,
			state: next,
			lastTransitionAt: nowMs,
			lastEventAt: nowMs,
		}
	}

	const appendCrash = (record: CrashRecord): PluginSupervisionState => {
		const trimmed =
			prev.crashHistory.length >= policy.maxCrashHistory
				? prev.crashHistory.slice(prev.crashHistory.length - policy.maxCrashHistory + 1)
				: prev.crashHistory
		return {
			...prev,
			crashHistory: [...trimmed, record],
			lastEventAt: nowMs,
		}
	}

	const recordCrash = (failureClass: PluginFailureClass, message: string, exitCode: number | null): PluginSupervisionState => {
		const attempt = prev.attempt
		return appendCrash({ failureClass, timestamp: nowMs, message, exitCode, attempt })
	}

	const buildFailedFromCrash = (input: {
		failureClass: PluginFailureClass
		message: string
		exitCode: number | null
		hangStreak?: number
	}): { state: PluginSupervisionState; trigger: QuarantineTrigger | null } => {
		const withCrash = recordCrash(input.failureClass, input.message, input.exitCode)
		const hangStreak = input.hangStreak ?? prev.hangStreak
		const hydrated: PluginSupervisionState = { ...withCrash, hangStreak, state: prev.state }
		const trigger = evaluateQuarantineTrigger({
			state: hydrated,
			failureClass: input.failureClass,
			policy,
			nowMs,
		})
		return { state: hydrated, trigger }
	}

	const stampQuarantine = (trigger: QuarantineTrigger, next: PluginSupervisionState): PluginSupervisionState => {
		const stamped: PluginSupervisionState = {
			...next,
			quarantined: {
				pluginId: prev.pluginId,
				reason: trigger.reason,
				detail: trigger.detail,
				quarantinedAt: nowMs,
				crashCount: trigger.crashCount,
				windowMs: trigger.windowMs,
				releasedAt: null,
				releasedBy: null,
				releaseNote: null,
			},
		}
		return stamped
	}

	switch (event.kind) {
		case "manifestDiscovered":
			if (prev.state === "discovered") {
				return { state: prev, decision: { action: "none", detail: "already discovered" }, transitions }
			}
			return {
				state: transition("discovered"),
				decision: { action: "none", detail: "manifest discovered" },
				transitions,
			}
		case "manifestValidated": {
			const next = transition("validated")
			return {
				state: next,
				decision: { action: "none", detail: "manifest validated" },
				transitions,
			}
		}
		case "manifestLoadFailed": {
			const trigger: QuarantineTrigger = {
				reason: "load_failure",
				detail: event.message,
				crashCount: 0,
				windowMs: policy.windowMs,
			}
			const next = stampQuarantine(trigger, transition("quarantined"))
			return {
				state: next,
				decision: { action: "write-quarantine", detail: `load failure: ${event.message}` },
				transitions,
			}
		}
		case "manifestMismatch": {
			const trigger: QuarantineTrigger = {
				reason: "manifest_mismatch",
				detail: event.message,
				crashCount: 0,
				windowMs: policy.windowMs,
			}
			const next = stampQuarantine(trigger, transition("quarantined"))
			return {
				state: next,
				decision: { action: "write-quarantine", detail: `manifest mismatch: ${event.message}` },
				transitions,
			}
		}
		case "installed": {
			if (prev.state === "validated") {
				return {
					state: transition("installed"),
					decision: { action: "none", detail: "bundle installed" },
					transitions,
				}
			}
			return {
				state: prev,
				decision: { action: "none", detail: `installed event ignored in state ${prev.state}` },
				transitions,
			}
		}
		case "uninstalled": {
			const next: PluginSupervisionState = {
				...prev,
				state: "removed",
				lastTransitionAt: nowMs,
				lastEventAt: nowMs,
				quarantined: prev.quarantined ? { ...prev.quarantined } : null,
			}
			transitions.push("removed")
			return {
				state: next,
				decision: { action: "purge-bundle", detail: "uninstalled" },
				transitions,
			}
		}
		case "activationRequested": {
			if (
				prev.state === "installed" ||
				prev.state === "disabled" ||
				prev.state === "failed"
			) {
				return {
					state: { ...transition("activating"), attempt: prev.attempt + 1 },
					decision: { action: "spawn-worker", detail: "activation requested" },
					transitions,
				}
			}
			if (prev.state === "quarantined") {
				return {
					state: prev,
					decision: {
						action: "notify-operator",
						detail: "activation requested while quarantined; operator must release",
					},
					transitions,
				}
			}
			return {
				state: prev,
				decision: { action: "none", detail: `activation requested ignored in state ${prev.state}` },
				transitions,
			}
		}
		case "activationSucceeded": {
			if (prev.state === "activating") {
				return {
					state: { ...transition("active"), lastHeartbeatAt: nowMs, attempt: 0, hangStreak: 0 },
					decision: { action: "none", detail: "worker ready" },
					transitions,
				}
			}
			return {
				state: prev,
				decision: {
					action: "none",
					detail: `activationSucceeded ignored in state ${prev.state}`,
				},
				transitions,
			}
		}
		case "activationFailed": {
			const { state: hydrated, trigger } = buildFailedFromCrash({
				failureClass: event.failureClass,
				message: event.message,
				exitCode: event.exitCode,
			})
			if (trigger) {
				const next = stampQuarantine(trigger, transition("quarantined"))
				return {
					state: { ...next, crashHistory: hydrated.crashHistory },
					decision: {
						action: "write-quarantine",
						detail: `${event.failureClass} -> ${trigger.reason}`,
					},
					transitions,
				}
			}
			const next = transition("failed")
			return {
				state: {
					...next,
					crashHistory: hydrated.crashHistory,
					lastError: lastErrorFromFailure(event.failureClass, event.message),
				},
				decision: { action: "restart-worker", detail: `activation failed: ${event.failureClass}` },
				transitions,
			}
		}
		case "heartbeat": {
			if (!isLifecycleRunning(prev.state) && prev.state !== "discovered") {
				return {
					state: prev,
					decision: { action: "none", detail: "heartbeat ignored: worker not running" },
					transitions,
				}
			}
			return {
				state: { ...prev, lastHeartbeatAt: nowMs, lastEventAt: nowMs, hangStreak: 0 },
				decision: { action: "none", detail: "heartbeat" },
				transitions,
			}
		}
		case "heartbeatMissed": {
			const nextHangStreak = prev.hangStreak + 1
			const { state: hydrated, trigger } = buildFailedFromCrash({
				failureClass: "hang",
				message: "heartbeat timeout",
				exitCode: null,
				hangStreak: nextHangStreak,
			})
			if (trigger) {
				const next = stampQuarantine(trigger, transition("quarantined"))
				return {
					state: { ...next, crashHistory: hydrated.crashHistory, hangStreak: nextHangStreak },
					decision: { action: "write-quarantine", detail: trigger.detail },
					transitions,
				}
			}
			return {
				state: {
					...transition("failed"),
					crashHistory: hydrated.crashHistory,
					hangStreak: nextHangStreak,
					lastError: lastErrorFromFailure("hang", "heartbeat timeout"),
				},
				decision: { action: "restart-worker", detail: "hang detected" },
				transitions,
			}
		}
		case "workerCrashed": {
			const { state: hydrated, trigger } = buildFailedFromCrash({
				failureClass: "runtime_crash",
				message: event.message,
				exitCode: event.exitCode,
			})
			if (trigger) {
				const next = stampQuarantine(trigger, transition("quarantined"))
				return {
					state: { ...next, crashHistory: hydrated.crashHistory },
					decision: { action: "write-quarantine", detail: trigger.detail },
					transitions,
				}
			}
			return {
				state: {
					...transition("failed"),
					crashHistory: hydrated.crashHistory,
					lastError: lastErrorFromFailure("runtime_crash", event.message),
				},
				decision: { action: "restart-worker", detail: "runtime crash" },
				transitions,
			}
		}
		case "workerOom": {
			const { state: hydrated, trigger } = buildFailedFromCrash({
				failureClass: "oom",
				message: event.message,
				exitCode: null,
			})
			if (trigger) {
				const next = stampQuarantine(trigger, transition("quarantined"))
				return {
					state: { ...next, crashHistory: hydrated.crashHistory },
					decision: { action: "write-quarantine", detail: trigger.detail },
					transitions,
				}
			}
			return {
				state: {
					...transition("failed"),
					crashHistory: hydrated.crashHistory,
					lastError: lastErrorFromFailure("oom", event.message),
				},
				decision: { action: "restart-worker", detail: "worker OOM" },
				transitions,
			}
		}
		case "healthDegraded": {
			if (prev.state === "active") {
				return {
					state: {
						...transition("degraded"),
						lastError: lastErrorFromFailure("runtime_crash", event.message),
					},
					decision: { action: "none", detail: "health degraded" },
					transitions,
				}
			}
			return {
				state: prev,
				decision: { action: "none", detail: `healthDegraded ignored in state ${prev.state}` },
				transitions,
			}
		}
		case "healthRestored": {
			if (prev.state === "degraded") {
				return {
					state: { ...transition("active"), lastHeartbeatAt: nowMs },
					decision: { action: "none", detail: "health restored" },
					transitions,
				}
			}
			return {
				state: prev,
				decision: { action: "none", detail: `healthRestored ignored in state ${prev.state}` },
				transitions,
			}
		}
		case "disableRequested": {
			if (prev.state === "active" || prev.state === "degraded") {
				return {
					state: { ...transition("tearingDown"), enabledByOperator: false },
					decision: { action: "teardown-worker", detail: "disable requested" },
					transitions,
				}
			}
			if (prev.state === "activating" || prev.state === "failed") {
				return {
					state: { ...transition("disabled"), enabledByOperator: false },
					decision: { action: "stop-worker", detail: "disable requested" },
					transitions,
				}
			}
			return {
				state: { ...prev, enabledByOperator: false, lastEventAt: nowMs },
				decision: { action: "none", detail: `disable applied in state ${prev.state}` },
				transitions,
			}
		}
		case "enableRequested": {
			const next: PluginSupervisionState = {
				...prev,
				enabledByOperator: true,
				lastEventAt: nowMs,
			}
			if (prev.state === "quarantined") {
				return {
					state: next,
					decision: {
						action: "notify-operator",
						detail: "enable ignored while quarantined; release quarantine first",
					},
					transitions,
				}
			}
			return {
				state: next,
				decision: { action: "none", detail: "enable acknowledged" },
				transitions,
			}
		}
		case "quarantineRequested": {
			const trigger: QuarantineTrigger = {
				reason: event.reason,
				detail: event.detail,
				crashCount: prev.crashHistory.length,
				windowMs: policy.windowMs,
			}
			const next = stampQuarantine(trigger, transition("quarantined"))
			return {
				state: next,
				decision: { action: "write-quarantine", detail: event.detail },
				transitions,
			}
		}
		case "quarantineReleased": {
			if (prev.state !== "quarantined" || !prev.quarantined) {
				return {
					state: prev,
					decision: { action: "none", detail: "quarantineReleased ignored: not quarantined" },
					transitions,
				}
			}
			const released: PluginSupervisionState = {
				...prev,
				quarantined: {
					...prev.quarantined,
					releasedAt: nowMs,
					releasedBy: event.by,
					releaseNote: event.note,
				},
				lastEventAt: nowMs,
			}
			const next: PluginSupervisionState = { ...released, state: "discovered" }
			transitions.push("discovered")
			return {
				state: next,
				decision: {
					action: "clear-quarantine",
					detail: `quarantine released by ${event.by}: ${event.note}`,
				},
				transitions,
			}
		}
		case "hotReloadRequested": {
			if (prev.state === "active" || prev.state === "degraded") {
				return {
					state: transition("tearingDown"),
					decision: { action: "teardown-worker", detail: "hot reload requested" },
					transitions,
				}
			}
			return {
				state: prev,
				decision: {
					action: "none",
					detail: `hot reload ignored in state ${prev.state}; not running`,
				},
				transitions,
			}
		}
		case "teardownComplete": {
			if (prev.state !== "tearingDown") {
				return {
					state: prev,
					decision: { action: "none", detail: "teardownComplete ignored: not tearing down" },
					transitions,
				}
			}
			if (!prev.enabledByOperator) {
				return {
					state: transition("disabled"),
					decision: { action: "none", detail: "teardown complete -> disabled" },
					transitions,
				}
			}
			return {
				state: { ...transition("activating"), attempt: prev.attempt + 1 },
				decision: { action: "spawn-worker", detail: "teardown complete -> re-activating" },
				transitions,
			}
		}
		case "criticalSecuritySignal": {
			const trigger: QuarantineTrigger = {
				reason: "critical_security",
				detail: event.message,
				crashCount: prev.crashHistory.length,
				windowMs: policy.windowMs,
			}
			const next = stampQuarantine(trigger, transition("quarantined"))
			return {
				state: next,
				decision: { action: "write-quarantine", detail: event.message },
				transitions,
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Quarantine persistence (durable across restarts)
// ---------------------------------------------------------------------------

/**
 * Convert the runtime supervision state to the durable quarantine
 * record. Pure: returns `null` when no quarantine is active.
 */
export function serializeQuarantineState(state: PluginSupervisionState): QuarantineRecord | null {
	return state.quarantined
}

export function parseQuarantineRecord(input: unknown): QuarantineRecord {
	return quarantineRecordSchema.parse(input)
}

/**
 * `~/.config/elf/firefly-client/quarantine.json` — relative path the
 * runtime resolves against the XDG base directory. Tracked here so
 * contract readers know where the durable record lives.
 */
export const QUARANTINE_FILE_PATH = "firefly-client/quarantine.json" as const

// ---------------------------------------------------------------------------
// Operator recovery (manual override)
// ---------------------------------------------------------------------------

/**
 * Operator recovery actions. Each maps to a single `applySupervisionEvent`
 * call. The runtime exposes them through the `plugins.lifecycle`
 * inspection tool (see `./tool-projection`) and the operator UI.
 */
export const PLUGIN_LIFECYCLE_OPERATOR_ACTIONS = [
	"enable",
	"disable",
	"quarantine",
	"quarantine_release",
	"hot_reload",
	"purge",
] as const

export type PluginLifecycleOperatorAction = (typeof PLUGIN_LIFECYCLE_OPERATOR_ACTIONS)[number]

/**
 * Translate an operator action to the supervision event the reducer
 * expects. Pure: caller still has to pass `nowMs` to the reducer.
 */
export function buildOperatorOverrideEvent(
	pluginId: PluginId,
	action: PluginLifecycleOperatorAction,
	note: string,
): PluginSupervisionEvent {
	switch (action) {
		case "enable":
			return { kind: "enableRequested", pluginId, by: "operator" }
		case "disable":
			return { kind: "disableRequested", pluginId, by: "operator" }
		case "quarantine":
			return {
				kind: "quarantineRequested",
				pluginId,
				reason: "operator_manual",
				detail: note,
				by: "operator",
			}
		case "quarantine_release":
			return { kind: "quarantineReleased", pluginId, by: "operator", note }
		case "hot_reload":
			return { kind: "hotReloadRequested", pluginId, by: "operator" }
		case "purge":
			return { kind: "uninstalled", pluginId }
	}
}

// ---------------------------------------------------------------------------
// Hot reload boundary decision
// ---------------------------------------------------------------------------

/**
 * Pure: returns the decision the runtime should take when a hot
 * reload is requested. Mirrors the reducer's behaviour but
 * separates the policy question from the state-mutation so the
 * UI layer can show "what will happen if I click reload".
 */
export type HotReloadDecision =
	| { readonly outcome: "no-op"; readonly detail: string }
	| { readonly outcome: "teardown-then-restart"; readonly detail: string }

export function requestHotReloadDecision(state: PluginSupervisionState): HotReloadDecision {
	if (state.state === "quarantined") {
		return { outcome: "no-op", detail: "plugin is quarantined; release before reloading" }
	}
	if (state.state === "removed") {
		return { outcome: "no-op", detail: "plugin is removed" }
	}
	if (state.state === "active" || state.state === "degraded") {
		return { outcome: "teardown-then-restart", detail: "tear down running worker, then re-activate" }
	}
	return {
		outcome: "no-op",
		detail: `hot reload not applicable in state ${state.state}`,
	}
}

// ---------------------------------------------------------------------------
// Summary for the operator UI / introspection tool
// ---------------------------------------------------------------------------

/**
 * JSON-serializable summary used by `plugins.lifecycle` and the
 * operator panel. Mirrors the introspection tool result shape
 * (see `pluginIntrospectionResultSchema` in `./tool-projection`)
 * so consumers do not need two views.
 */
export interface PluginSupervisionSummary {
	readonly pluginId: PluginId
	readonly state: PluginLifecycleState
	readonly acceptingCalls: boolean
	readonly quarantined: boolean
	readonly quarantine: QuarantineRecord | null
	readonly attempt: number
	readonly lastHeartbeatAt: number | null
	readonly lastTransitionAt: number
	readonly lastEventAt: number
	readonly hangStreak: number
	readonly crashCount: number
	readonly crashWindowMs: number
	readonly lastError: { code: string; message: string; timestamp: number } | null
	readonly enabledByOperator: boolean
	readonly recentCrashes: readonly CrashRecord[]
}

export function summarizePluginSupervision(
	state: PluginSupervisionState,
	policy: CrashWindowPolicy = DEFAULT_CRASH_WINDOW_POLICY,
): PluginSupervisionSummary {
	return {
		pluginId: state.pluginId,
		state: state.state,
		acceptingCalls: isLifecycleAcceptingCalls(state.state),
		quarantined: isLifecycleQuarantined(state.state),
		quarantine: state.quarantined,
		attempt: state.attempt,
		lastHeartbeatAt: state.lastHeartbeatAt,
		lastTransitionAt: state.lastTransitionAt,
		lastEventAt: state.lastEventAt,
		hangStreak: state.hangStreak,
		crashCount: state.crashHistory.length,
		crashWindowMs: policy.windowMs,
		lastError: state.lastError,
		enabledByOperator: state.enabledByOperator,
		recentCrashes: state.crashHistory.slice(-10),
	}
}

// ---------------------------------------------------------------------------
// Plugin lifecycle inspection tool (arg shapes)
// ---------------------------------------------------------------------------

/**
 * Arg shapes for the operator-facing `plugins.lifecycle` inspection
 * tool. The tool itself is registered through the projection layer
 * (see `PLUGIN_INSPECTION_TOOL_IDS` in `./tool-projection`); these
 * shapes live here so the supervision contract is the single source
 * of truth for what the tool accepts.
 */
export const pluginLifecycleEnableArgsShape = {
	pluginId: z.string().min(1).max(128),
	note: z.string().min(1).max(2000).optional(),
} as const

export const pluginLifecycleDisableArgsShape = {
	pluginId: z.string().min(1).max(128),
	note: z.string().min(1).max(2000).optional(),
} as const

export const pluginLifecycleQuarantineArgsShape = {
	pluginId: z.string().min(1).max(128),
	note: z.string().min(1).max(2000),
} as const

export const pluginLifecycleReleaseArgsShape = {
	pluginId: z.string().min(1).max(128),
	note: z.string().min(1).max(2000),
} as const

export const pluginLifecycleHotReloadArgsShape = {
	pluginId: z.string().min(1).max(128),
} as const

export const pluginLifecycleHistoryArgsShape = {
	pluginId: z.string().min(1).max(128),
	limit: z.number().int().positive().max(50).optional(),
} as const

// ---------------------------------------------------------------------------
// Defaults aggregation
// ---------------------------------------------------------------------------

/**
 * The single place to ask for "what default policies does the host
 * ship with?". Keeping them in one object makes the operator UI
 * "reset to defaults" affordance trivial to implement and test.
 */
export const DEFAULT_SUPERVISION_POLICIES = {
	heartbeat: DEFAULT_HEARTBEAT_POLICY,
	restartBackoff: DEFAULT_RESTART_BACKOFF_POLICY,
	crashWindow: DEFAULT_CRASH_WINDOW_POLICY,
} as const
