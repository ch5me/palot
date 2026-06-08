/**
 * Firefly Plugin System V2 — runtime supervision contract tests
 *
 * Tests are organised by failure class. Every class the V2 plan §11
 * mandates (`init_crash`, `runtime_crash`, `hang`, `partial_activation`,
 * `manual_disable`, `quarantine`, `manual_recovery`, `hot_reload`) has
 * a dedicated `describe` block. Lifecycle, defaults, persistence, and
 * operator surface tests live in their own `describe` blocks.
 */

import { describe, expect, test } from "bun:test"

import {
	applySupervisionEvent,
	buildOperatorOverrideEvent,
	computeNextRestartDelayMs,
	crashCountWithin,
	crashRecordSchema,
	crashWindowPolicySchema,
	createEmptyPluginSupervision,
	DEFAULT_CRASH_WINDOW_POLICY,
	DEFAULT_HEARTBEAT_POLICY,
	DEFAULT_HANG_TIMEOUT_MS,
	DEFAULT_RESTART_BACKOFF_POLICY,
	DEFAULT_SUPERVISION_POLICIES,
	evaluateQuarantineTrigger,
	failureClassSchema,
	heartbeatPolicySchema,
	isHangDetected,
	isLifecycleAcceptingCalls,
	isLifecycleQuarantined,
	isLifecycleRunning,
	isLifecycleTerminalState,
	isLifecycleTransitionAllowed,
	parseQuarantineRecord,
	PLUGIN_FAILURE_CLASSES,
	PLUGIN_LIFECYCLE_OPERATOR_ACTIONS,
	PLUGIN_LIFECYCLE_STATES,
	PLUGIN_LIFECYCLE_TERMINAL_STATES,
	PLUGIN_LIFECYCLE_TRANSITIONS,
	pluginLifecycleDisableArgsShape,
	pluginLifecycleEnableArgsShape,
	pluginLifecycleHistoryArgsShape,
	pluginLifecycleHotReloadArgsShape,
	pluginLifecycleQuarantineArgsShape,
	pluginLifecycleReleaseArgsShape,
	pluginSupervisionStateSchema,
	QUARANTINE_FILE_PATH,
	QUARANTINE_REASONS,
	quarantineReasonSchema,
	quarantineRecordSchema,
	requestHotReloadDecision,
	restartBackoffPolicySchema,
	serializeQuarantineState,
	summarizePluginSupervision,
} from "./runtime-supervision"

// ---------------------------------------------------------------------------
// Lifecycle state machine
// ---------------------------------------------------------------------------

describe("PLUGIN_LIFECYCLE_STATES", () => {
	test("enumerates the locked vocabulary in canonical order", () => {
		expect(PLUGIN_LIFECYCLE_STATES).toEqual([
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
		])
	})

	test("isLifecycleTransitionAllowed reflects the locked table", () => {
		expect(isLifecycleTransitionAllowed("discovered", "validated")).toBe(true)
		expect(isLifecycleTransitionAllowed("discovered", "active")).toBe(false)
		expect(isLifecycleTransitionAllowed("active", "degraded")).toBe(true)
		expect(isLifecycleTransitionAllowed("tearingDown", "activating")).toBe(true)
		expect(isLifecycleTransitionAllowed("tearingDown", "active")).toBe(false)
		expect(isLifecycleTransitionAllowed("quarantined", "discovered")).toBe(true)
		expect(isLifecycleTransitionAllowed("removed", "discovered")).toBe(false)
	})

	test("every state has a transition row registered in the table", () => {
		for (const state of PLUGIN_LIFECYCLE_STATES) {
			expect(PLUGIN_LIFECYCLE_TRANSITIONS[state]).toBeDefined()
		}
	})

	test("the transition table never contains a self-loop except for terminal-removed", () => {
		for (const [from, targets] of Object.entries(PLUGIN_LIFECYCLE_TRANSITIONS) as [
			(typeof PLUGIN_LIFECYCLE_STATES)[number],
			readonly (typeof PLUGIN_LIFECYCLE_STATES)[number][],
		][]) {
			for (const target of targets) {
				if (from === target) {
					expect(from).toBe("removed")
				}
			}
		}
	})

	test("isLifecycleTerminalState is true only for removed", () => {
		expect(isLifecycleTerminalState("removed")).toBe(true)
		for (const s of PLUGIN_LIFECYCLE_STATES) {
			if (s === "removed") continue
			expect(isLifecycleTerminalState(s)).toBe(false)
		}
		expect(PLUGIN_LIFECYCLE_TERMINAL_STATES.has("removed")).toBe(true)
	})

	test("isLifecycleRunning matches activating, active, degraded, tearingDown", () => {
		expect(isLifecycleRunning("activating")).toBe(true)
		expect(isLifecycleRunning("active")).toBe(true)
		expect(isLifecycleRunning("degraded")).toBe(true)
		expect(isLifecycleRunning("tearingDown")).toBe(true)
		expect(isLifecycleRunning("disabled")).toBe(false)
		expect(isLifecycleRunning("quarantined")).toBe(false)
		expect(isLifecycleRunning("removed")).toBe(false)
	})

	test("isLifecycleAcceptingCalls matches active and degraded only", () => {
		expect(isLifecycleAcceptingCalls("active")).toBe(true)
		expect(isLifecycleAcceptingCalls("degraded")).toBe(true)
		expect(isLifecycleAcceptingCalls("activating")).toBe(false)
		expect(isLifecycleAcceptingCalls("tearingDown")).toBe(false)
		expect(isLifecycleAcceptingCalls("quarantined")).toBe(false)
	})

	test("isLifecycleQuarantined matches quarantined only", () => {
		expect(isLifecycleQuarantined("quarantined")).toBe(true)
		expect(isLifecycleQuarantined("removed")).toBe(false)
		expect(isLifecycleQuarantined("disabled")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Failure class taxonomy
// ---------------------------------------------------------------------------

describe("PLUGIN_FAILURE_CLASSES", () => {
	test("covers every failure class the V2 plan §11 mandates", () => {
		expect(PLUGIN_FAILURE_CLASSES).toEqual([
			"init_crash",
			"runtime_crash",
			"hang",
			"partial_activation",
			"oom",
			"load_failure",
			"critical_security",
			"manual_disable",
			"manifest_mismatch",
		])
	})

	test("failureClassSchema round-trips every entry", () => {
		for (const fc of PLUGIN_FAILURE_CLASSES) {
			expect(failureClassSchema.parse(fc)).toBe(fc)
		}
	})

	test("QUARANTINE_REASONS covers the trigger reasons", () => {
		expect(QUARANTINE_REASONS).toContain("activation_crashes")
		expect(QUARANTINE_REASONS).toContain("runtime_crashes")
		expect(QUARANTINE_REASONS).toContain("hangs")
		expect(QUARANTINE_REASONS).toContain("oom")
		expect(QUARANTINE_REASONS).toContain("partial_activation_persistent")
		expect(QUARANTINE_REASONS).toContain("critical_security")
		expect(QUARANTINE_REASONS).toContain("manifest_mismatch")
		expect(QUARANTINE_REASONS).toContain("operator_manual")
		expect(QUARANTINE_REASONS).toContain("load_failure")
		expect(quarantineReasonSchema.parse("activation_crashes")).toBe("activation_crashes")
	})
})

// ---------------------------------------------------------------------------
// Default policies
// ---------------------------------------------------------------------------

describe("default supervision policies", () => {
	test("heartbeat defaults are 30s hang / 10s interval", () => {
		expect(DEFAULT_HANG_TIMEOUT_MS).toBe(30_000)
		expect(DEFAULT_HEARTBEAT_POLICY).toEqual({
			hangTimeoutMs: 30_000,
			heartbeatIntervalMs: 10_000,
		})
	})

	test("restart backoff defaults to 1s base / 60s cap / 2x / 10% jitter", () => {
		expect(DEFAULT_RESTART_BACKOFF_POLICY).toEqual({
			baseMs: 1_000,
			maxMs: 60_000,
			factor: 2,
			jitterRatio: 0.1,
		})
	})

	test("crash window defaults mirror the V2 plan §11.4", () => {
		expect(DEFAULT_CRASH_WINDOW_POLICY).toEqual({
			windowMs: 5 * 60_000,
			activationCrashThreshold: 3,
			runtimeCrashThreshold: 3,
			hangThreshold: 3,
			crashCounterTtlMs: 24 * 60 * 60_000,
			maxCrashHistory: 50,
		})
	})

	test("schemas reject out-of-bounds values", () => {
		expect(() => heartbeatPolicySchema.parse({ hangTimeoutMs: 0, heartbeatIntervalMs: 1 })).toThrow()
		expect(() =>
			restartBackoffPolicySchema.parse({ baseMs: 100, maxMs: 50, factor: 1, jitterRatio: 0 }),
		).toThrow()
		expect(() => crashWindowPolicySchema.parse({ ...DEFAULT_CRASH_WINDOW_POLICY, windowMs: 0 })).toThrow()
	})

	test("DEFAULT_SUPERVISION_POLICIES aggregates the three defaults", () => {
		expect(DEFAULT_SUPERVISION_POLICIES.heartbeat).toBe(DEFAULT_HEARTBEAT_POLICY)
		expect(DEFAULT_SUPERVISION_POLICIES.restartBackoff).toBe(DEFAULT_RESTART_BACKOFF_POLICY)
		expect(DEFAULT_SUPERVISION_POLICIES.crashWindow).toBe(DEFAULT_CRASH_WINDOW_POLICY)
	})

	test("QUARANTINE_FILE_PATH is the XDG-relative durable record location", () => {
		expect(QUARANTINE_FILE_PATH).toBe("firefly-client/quarantine.json")
	})
})

// ---------------------------------------------------------------------------
// isHangDetected
// ---------------------------------------------------------------------------

describe("isHangDetected", () => {
	test("returns false when there is no last heartbeat", () => {
		expect(isHangDetected(null, 1_000)).toBe(false)
	})

	test("returns false when the heartbeat is within the timeout", () => {
		expect(isHangDetected(1_000, 1_000 + 10_000, DEFAULT_HEARTBEAT_POLICY)).toBe(false)
	})

	test("returns true when the heartbeat is older than the timeout", () => {
		expect(isHangDetected(1_000, 1_000 + 30_001, DEFAULT_HEARTBEAT_POLICY)).toBe(true)
	})

	test("honors a custom policy", () => {
		const policy = { hangTimeoutMs: 5_000, heartbeatIntervalMs: 1_000 }
		expect(isHangDetected(0, 4_000, policy)).toBe(false)
		expect(isHangDetected(0, 5_001, policy)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// computeNextRestartDelayMs
// ---------------------------------------------------------------------------

describe("computeNextRestartDelayMs", () => {
	test("returns base on first attempt", () => {
		expect(
			computeNextRestartDelayMs(0, DEFAULT_RESTART_BACKOFF_POLICY, () => 0.5),
		).toBe(1_000)
	})

	test("grows exponentially by factor", () => {
		const noJitter = { ...DEFAULT_RESTART_BACKOFF_POLICY, jitterRatio: 0 }
		expect(computeNextRestartDelayMs(1, noJitter, () => 0.5)).toBe(2_000)
		expect(computeNextRestartDelayMs(2, noJitter, () => 0.5)).toBe(4_000)
		expect(computeNextRestartDelayMs(3, noJitter, () => 0.5)).toBe(8_000)
	})

	test("caps at maxMs", () => {
		const noJitter = { ...DEFAULT_RESTART_BACKOFF_POLICY, jitterRatio: 0 }
		expect(computeNextRestartDelayMs(20, noJitter, () => 0.5)).toBe(60_000)
		expect(computeNextRestartDelayMs(100, noJitter, () => 0.5)).toBe(60_000)
	})

	test("applies jitter in the configured range", () => {
		const policy = { ...DEFAULT_RESTART_BACKOFF_POLICY, baseMs: 1_000, jitterRatio: 0.5 }
		const minDelay = computeNextRestartDelayMs(0, policy, () => 0)
		const maxDelay = computeNextRestartDelayMs(0, policy, () => 1)
		expect(minDelay).toBeLessThan(maxDelay)
		expect(minDelay).toBeGreaterThanOrEqual(500)
		expect(maxDelay).toBeLessThanOrEqual(1_500)
	})
})

// ---------------------------------------------------------------------------
// crashCountWithin
// ---------------------------------------------------------------------------

describe("crashCountWithin", () => {
	const baseRecord = {
		failureClass: "init_crash" as const,
		timestamp: 1_000,
		message: "x",
		exitCode: null,
		attempt: 0,
	}

	test("counts only records inside the window", () => {
		const history = [
			{ ...baseRecord, timestamp: 1_000 },
			{ ...baseRecord, timestamp: 1_500 },
			{ ...baseRecord, timestamp: 9_001 },
		]
		expect(crashCountWithin(history, 5_000, 6_000)).toBe(2)
	})

	test("filters by failure class when provided", () => {
		const history = [
			{ ...baseRecord, timestamp: 1_000, failureClass: "init_crash" as const },
			{ ...baseRecord, timestamp: 1_500, failureClass: "runtime_crash" as const },
			{ ...baseRecord, timestamp: 1_700, failureClass: "init_crash" as const },
		]
		expect(crashCountWithin(history, 5_000, 2_000, "init_crash")).toBe(2)
		expect(crashCountWithin(history, 5_000, 2_000, "runtime_crash")).toBe(1)
	})

	test("returns zero on empty history", () => {
		expect(crashCountWithin([], 5_000, 10_000)).toBe(0)
	})

	test("crashRecordSchema round-trips a record", () => {
		const parsed = crashRecordSchema.parse(baseRecord)
		expect(parsed).toEqual(baseRecord)
	})
})

// ---------------------------------------------------------------------------
// createEmptyPluginSupervision
// ---------------------------------------------------------------------------

describe("createEmptyPluginSupervision", () => {
	test("returns a `discovered` state with no history, no error, no quarantine", () => {
		const s = createEmptyPluginSupervision("firefly.built-in.review", 1_000)
		expect(s.pluginId).toBe("firefly.built-in.review")
		expect(s.state).toBe("discovered")
		expect(s.attempt).toBe(0)
		expect(s.crashHistory).toEqual([])
		expect(s.hangStreak).toBe(0)
		expect(s.quarantined).toBeNull()
		expect(s.lastHeartbeatAt).toBeNull()
		expect(s.lastError).toBeNull()
		expect(s.enabledByOperator).toBe(true)
		expect(s.lastTransitionAt).toBe(1_000)
		expect(s.lastEventAt).toBe(1_000)
	})

	test("pluginSupervisionStateSchema accepts the empty state", () => {
		const s = createEmptyPluginSupervision("firefly.built-in.review", 0)
		expect(() => pluginSupervisionStateSchema.parse(s)).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// Failure class: init_crash
// ---------------------------------------------------------------------------

describe("init_crash failure class", () => {
	test("single activation failure moves to `failed` and asks for restart", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		expect(s.state).toBe("activating")
		expect(s.attempt).toBe(1)
		const result = applySupervisionEvent(
			s,
			{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "boom", exitCode: 1 },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_400,
		)
		expect(result.state.state).toBe("failed")
		expect(result.state.crashHistory).toHaveLength(1)
		expect(result.state.crashHistory[0].failureClass).toBe("init_crash")
		expect(result.decision.action).toBe("restart-worker")
	})

	test("3 activation crashes inside the window trip quarantine", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		const now = 2_000
		for (let i = 0; i < 3; i += 1) {
			s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, now + i * 100).state
			s = applySupervisionEvent(
				s,
				{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "boom", exitCode: 1 },
				DEFAULT_CRASH_WINDOW_POLICY,
				now + i * 100 + 50,
			).state
		}
		expect(s.state).toBe("quarantined")
		expect(s.quarantined?.reason).toBe("activation_crashes")
		expect(s.quarantined?.crashCount).toBe(3)
	})

	test("2 activation crashes do NOT trip quarantine", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		const now = 2_000
		for (let i = 0; i < 2; i += 1) {
			s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, now + i * 100).state
			s = applySupervisionEvent(
				s,
				{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "boom", exitCode: 1 },
				DEFAULT_CRASH_WINDOW_POLICY,
				now + i * 100 + 50,
			).state
		}
		expect(s.state).not.toBe("quarantined")
		expect(s.state).toBe("failed")
	})

	test("old crashes outside the window do not contribute to the count", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s.crashHistory = [
			{ failureClass: "init_crash", timestamp: 1_000, message: "old", exitCode: 1, attempt: 0 },
		]
		const trigger = evaluateQuarantineTrigger({
			state: s,
			failureClass: "init_crash",
			policy: DEFAULT_CRASH_WINDOW_POLICY,
			nowMs: 1_000 + 5 * 60_000 + 1,
		})
		expect(trigger).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// Failure class: runtime_crash
// ---------------------------------------------------------------------------

describe("runtime_crash failure class", () => {
	function activeState(now: number) {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		return s
	}

	test("a runtime crash moves active -> failed and requests restart", () => {
		const s = activeState(1_400)
		const result = applySupervisionEvent(
			s,
			{ kind: "workerCrashed", pluginId: "p1", exitCode: 1, message: "segfault" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_500,
		)
		expect(result.state.state).toBe("failed")
		expect(result.state.crashHistory[0].failureClass).toBe("runtime_crash")
		expect(result.state.crashHistory[0].exitCode).toBe(1)
		expect(result.decision.action).toBe("restart-worker")
	})

	test("3 runtime crashes inside the window trip quarantine", () => {
		let s = activeState(1_400)
		for (let i = 0; i < 3; i += 1) {
			s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_000 + i * 200).state
			s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_000 + i * 200 + 10).state
			s = applySupervisionEvent(
				s,
				{ kind: "workerCrashed", pluginId: "p1", exitCode: 1, message: "boom" },
				DEFAULT_CRASH_WINDOW_POLICY,
				2_000 + i * 200 + 100,
			).state
		}
		expect(s.state).toBe("quarantined")
		expect(s.quarantined?.reason).toBe("runtime_crashes")
		expect(s.quarantined?.crashCount).toBe(3)
	})
})

// ---------------------------------------------------------------------------
// Failure class: hang / heartbeat timeout
// ---------------------------------------------------------------------------

describe("hang / heartbeat timeout failure class", () => {
	test("isHangDetected compares correctly against the policy timeout", () => {
		expect(isHangDetected(1_000, 1_000 + 29_999, DEFAULT_HEARTBEAT_POLICY)).toBe(false)
		expect(isHangDetected(1_000, 1_000 + 30_001, DEFAULT_HEARTBEAT_POLICY)).toBe(true)
	})

	test("a heartbeat event refreshes lastHeartbeatAt and resets hangStreak", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		s = applySupervisionEvent(s, { kind: "heartbeat", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_500).state
		expect(s.lastHeartbeatAt).toBe(1_500)
		expect(s.hangStreak).toBe(0)
	})

	test("3 consecutive hangs trip quarantine with `hangs` reason", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		for (let i = 0; i < 3; i += 1) {
			const result = applySupervisionEvent(
				s,
				{ kind: "heartbeatMissed", pluginId: "p1" },
				DEFAULT_CRASH_WINDOW_POLICY,
				2_000 + i * 100,
			)
			s = result.state
		}
		expect(s.state).toBe("quarantined")
		expect(s.quarantined?.reason).toBe("hangs")
		expect(s.hangStreak).toBe(3)
	})

	test("a heartbeat in between missed beats resets the hang streak", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		s = applySupervisionEvent(s, { kind: "heartbeatMissed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_000).state
		s = applySupervisionEvent(s, { kind: "heartbeatMissed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_100).state
		expect(s.hangStreak).toBe(2)
		// Worker is back up; bring it online so a heartbeat is accepted.
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_150).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_160).state
		s = applySupervisionEvent(s, { kind: "heartbeat", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 2_200).state
		expect(s.hangStreak).toBe(0)
		const result = applySupervisionEvent(
			s,
			{ kind: "heartbeatMissed", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_300,
		)
		expect(result.state.hangStreak).toBe(1)
		expect(result.state.state).not.toBe("quarantined")
	})
})

// ---------------------------------------------------------------------------
// Failure class: partial_activation
// ---------------------------------------------------------------------------

describe("partial_activation failure class", () => {
	test("a single partial activation does not trip quarantine", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{
				kind: "activationFailed",
				pluginId: "p1",
				failureClass: "partial_activation",
				message: "ready emitted but capability projection failed",
				exitCode: null,
			},
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("failed")
		expect(result.state.quarantined).toBeNull()
	})

	test("3 persistent partial activations trip quarantine", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		for (let i = 0; i < 3; i += 1) {
			s = applySupervisionEvent(
				s,
				{
					kind: "activationFailed",
					pluginId: "p1",
					failureClass: "partial_activation",
					message: "ready emitted but capability projection failed",
					exitCode: null,
				},
				DEFAULT_CRASH_WINDOW_POLICY,
				2_000 + i * 100,
			).state
		}
		expect(s.state).toBe("quarantined")
		expect(s.quarantined?.reason).toBe("partial_activation_persistent")
	})
})

// ---------------------------------------------------------------------------
// Failure class: manual disable
// ---------------------------------------------------------------------------

describe("manual disable failure class", () => {
	test("operator disableRequested from active goes via tearingDown -> disabled", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		const result = applySupervisionEvent(
			s,
			{ kind: "disableRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("tearingDown")
		expect(result.state.enabledByOperator).toBe(false)
		expect(result.decision.action).toBe("teardown-worker")
		const result2 = applySupervisionEvent(
			result.state,
			{ kind: "teardownComplete", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_100,
		)
		expect(result2.state.state).toBe("disabled")
	})

	test("operator disableRequested from activating moves straight to disabled", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		const result = applySupervisionEvent(
			s,
			{ kind: "disableRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_400,
		)
		expect(result.state.state).toBe("disabled")
		expect(result.decision.action).toBe("stop-worker")
	})
})

// ---------------------------------------------------------------------------
// Failure class: quarantine (operator + critical_security + manifest_mismatch + oom)
// ---------------------------------------------------------------------------

describe("quarantine failure class", () => {
	test("operator_manual quarantine from any state lands in quarantined", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{
				kind: "quarantineRequested",
				pluginId: "p1",
				reason: "operator_manual",
				detail: "operator clicked quarantine",
				by: "operator",
			},
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("operator_manual")
		expect(result.decision.action).toBe("write-quarantine")
	})

	test("criticalSecuritySignal trips immediate quarantine", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "capability denied audit" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("critical_security")
	})

	test("manifestMismatch trips immediate quarantine", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "manifestMismatch", pluginId: "p1", message: "hash mismatch" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("manifest_mismatch")
	})

	test("manifestLoadFailed trips load_failure quarantine", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "manifestLoadFailed", pluginId: "p1", message: "zod parse failed" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("load_failure")
	})

	test("OOM trips quarantine with oom reason", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		const result = applySupervisionEvent(
			s,
			{ kind: "workerOom", pluginId: "p1", message: "max heap" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("oom")
	})

	test("activationRequested while quarantined notifies operator and stays quarantined", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{
				kind: "quarantineRequested",
				pluginId: "p1",
				reason: "operator_manual",
				detail: "x",
				by: "operator",
			},
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "activationRequested", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.decision.action).toBe("notify-operator")
	})

	test("activation crash window policy with smaller thresholds trips earlier", () => {
		const policy = { ...DEFAULT_CRASH_WINDOW_POLICY, activationCrashThreshold: 1 }
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, policy, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, policy, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, policy, 1_300).state
		const result = applySupervisionEvent(
			s,
			{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "x", exitCode: 1 },
			policy,
			1_400,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.state.quarantined?.reason).toBe("activation_crashes")
	})
})

// ---------------------------------------------------------------------------
// Quarantine persistence
// ---------------------------------------------------------------------------

describe("quarantine persistence", () => {
	test("serializeQuarantineState returns the active record", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		const record = serializeQuarantineState(result.state)
		expect(record).not.toBeNull()
		expect(record?.reason).toBe("critical_security")
	})

	test("serializeQuarantineState returns null when not quarantined", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		expect(serializeQuarantineState(s)).toBeNull()
	})

	test("parseQuarantineRecord round-trips a valid record", () => {
		const record = {
			pluginId: "p1",
			reason: "activation_crashes" as const,
			detail: "x",
			quarantinedAt: 1_000,
			crashCount: 3,
			windowMs: 300_000,
			releasedAt: null,
			releasedBy: null,
			releaseNote: null,
		}
		expect(parseQuarantineRecord(record)).toEqual(record)
	})

	test("quarantineRecordSchema rejects malformed input", () => {
		expect(() => quarantineRecordSchema.parse({ pluginId: "x" })).toThrow()
	})

	test("released record survives a state restore (rehydrate cycle)", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const releaseResult = applySupervisionEvent(
			s,
			{ kind: "quarantineReleased", pluginId: "p1", by: "operator", note: "cleared" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(releaseResult.state.state).toBe("discovered")
		const record = serializeQuarantineState(releaseResult.state)
		expect(record?.releasedAt).toBe(2_000)
		expect(record?.releasedBy).toBe("operator")
		expect(record?.releaseNote).toBe("cleared")
	})
})

// ---------------------------------------------------------------------------
// Manual recovery / operator override
// ---------------------------------------------------------------------------

describe("manual recovery / operator override", () => {
	test("quarantineReleased returns the plugin to `discovered`", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "quarantineReleased", pluginId: "p1", by: "operator", note: "verified safe" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("discovered")
		expect(result.state.quarantined?.releasedBy).toBe("operator")
		expect(result.decision.action).toBe("clear-quarantine")
	})

	test("quarantineReleased on a non-quarantined plugin is a no-op", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "quarantineReleased", pluginId: "p1", by: "operator", note: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("discovered")
		expect(result.decision.action).toBe("none")
	})

	test("operator action builder maps every action to a reducer event", () => {
		for (const action of PLUGIN_LIFECYCLE_OPERATOR_ACTIONS) {
			const event = buildOperatorOverrideEvent("p1", action, "test note")
			expect(event.kind).toBeDefined()
			expect(event.pluginId).toBe("p1")
		}
	})

	test("operator enableRequested while quarantined notifies operator", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "enableRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.decision.action).toBe("notify-operator")
		expect(result.state.state).toBe("quarantined")
	})

	test("enableRequested after release works normally", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		s = applySupervisionEvent(
			s,
			{ kind: "quarantineReleased", pluginId: "p1", by: "operator", note: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "enableRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			3_000,
		)
		expect(result.state.enabledByOperator).toBe(true)
		expect(result.decision.action).toBe("none")
	})
})

// ---------------------------------------------------------------------------
// Hot reload boundary
// ---------------------------------------------------------------------------

describe("hot reload boundary", () => {
	function activeState() {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		return s
	}

	test("hotReloadRequested from active goes through tearingDown -> activating", () => {
		const s = activeState()
		const result = applySupervisionEvent(
			s,
			{ kind: "hotReloadRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("tearingDown")
		expect(result.decision.action).toBe("teardown-worker")
		const result2 = applySupervisionEvent(
			result.state,
			{ kind: "teardownComplete", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_100,
		)
		expect(result2.state.state).toBe("activating")
		// activationSucceeded reset the attempt counter, so the post-reload restart is attempt 1.
		expect(result2.state.attempt).toBe(1)
		expect(result2.decision.action).toBe("spawn-worker")
	})

	test("hotReloadRequested while quarantined is a no-op", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "hotReloadRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("quarantined")
		expect(result.decision.action).toBe("none")
	})

	test("requestHotReloadDecision mirrors the reducer behaviour", () => {
		expect(requestHotReloadDecision(activeState()).outcome).toBe("teardown-then-restart")
		let q = createEmptyPluginSupervision("p1", 1_000)
		q = applySupervisionEvent(
			q,
			{ kind: "criticalSecuritySignal", pluginId: "p1", message: "x" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		expect(requestHotReloadDecision(q).outcome).toBe("no-op")
		const removed = applySupervisionEvent(
			q,
			{ kind: "uninstalled", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		).state
		expect(requestHotReloadDecision(removed).outcome).toBe("no-op")
	})
})

// ---------------------------------------------------------------------------
// Removal boundary
// ---------------------------------------------------------------------------

describe("uninstall removal boundary", () => {
	test("uninstalled lands in `removed` and asks the runtime to purge", () => {
		const s = createEmptyPluginSupervision("p1", 1_000)
		const result = applySupervisionEvent(
			s,
			{ kind: "uninstalled", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("removed")
		expect(result.decision.action).toBe("purge-bundle")
		expect(isLifecycleTerminalState("removed")).toBe(true)
	})

	test("a removed plugin never transitions again", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(
			s,
			{ kind: "uninstalled", pluginId: "p1" },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_000,
		).state
		const result = applySupervisionEvent(
			s,
			{ kind: "enableRequested", pluginId: "p1", by: "operator" },
			DEFAULT_CRASH_WINDOW_POLICY,
			2_000,
		)
		expect(result.state.state).toBe("removed")
		expect(result.decision.action).toBe("none")
	})
})

// ---------------------------------------------------------------------------
// Operator summary
// ---------------------------------------------------------------------------

describe("summarizePluginSupervision", () => {
	test("summarises a running active plugin", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		s = applySupervisionEvent(s, { kind: "heartbeat", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_500).state
		const summary = summarizePluginSupervision(s)
		expect(summary.pluginId).toBe("p1")
		expect(summary.state).toBe("active")
		expect(summary.acceptingCalls).toBe(true)
		expect(summary.quarantined).toBe(false)
		expect(summary.attempt).toBe(0)
		expect(summary.lastHeartbeatAt).toBe(1_500)
		expect(summary.crashCount).toBe(0)
	})

	test("summarises a quarantined plugin with crash history", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(
			s,
			{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "x", exitCode: 1 },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_400,
		).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_500).state
		s = applySupervisionEvent(
			s,
			{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "y", exitCode: 1 },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_600,
		).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_700).state
		s = applySupervisionEvent(
			s,
			{ kind: "activationFailed", pluginId: "p1", failureClass: "init_crash", message: "z", exitCode: 1 },
			DEFAULT_CRASH_WINDOW_POLICY,
			1_800,
		).state
		const summary = summarizePluginSupervision(s)
		expect(summary.state).toBe("quarantined")
		expect(summary.quarantined).toBe(true)
		expect(summary.quarantine?.reason).toBe("activation_crashes")
		expect(summary.recentCrashes).toHaveLength(3)
	})
})

// ---------------------------------------------------------------------------
// Operator tool arg shapes
// ---------------------------------------------------------------------------

describe("plugins.lifecycle tool arg shapes", () => {
	test("pluginLifecycleEnableArgsShape accepts a valid payload", () => {
		const parsed = pluginLifecycleEnableArgsShape.pluginId.parse("firefly.built-in.review")
		expect(parsed).toBe("firefly.built-in.review")
	})

	test("pluginLifecycleDisableArgsShape rejects empty pluginId", () => {
		expect(() => pluginLifecycleDisableArgsShape.pluginId.parse("")).toThrow()
	})

	test("pluginLifecycleQuarantineArgsShape requires a note", () => {
		expect(() => pluginLifecycleQuarantineArgsShape.pluginId.parse("p1")).not.toThrow()
	})

	test("pluginLifecycleReleaseArgsShape requires a note", () => {
		expect(() => pluginLifecycleReleaseArgsShape.pluginId.parse("p1")).not.toThrow()
	})

	test("pluginLifecycleHotReloadArgsShape is pluginId-only", () => {
		expect(() => pluginLifecycleHotReloadArgsShape.pluginId.parse("p1")).not.toThrow()
	})

	test("pluginLifecycleHistoryArgsShape caps limit at 50", () => {
		const result = pluginLifecycleHistoryArgsShape.limit?.safeParse(100)
		expect(result?.success).toBe(false)
		expect(pluginLifecycleHistoryArgsShape.limit?.safeParse(10)?.success).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Reducer determinism
// ---------------------------------------------------------------------------

describe("reducer determinism", () => {
	test("running the same event twice against the same state is idempotent within the event", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		s = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300).state
		s = applySupervisionEvent(s, { kind: "activationSucceeded", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_400).state
		const r1 = applySupervisionEvent(s, { kind: "heartbeat", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_500)
		const r2 = applySupervisionEvent(s, { kind: "heartbeat", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_500)
		expect(r1.state.lastHeartbeatAt).toBe(1_500)
		expect(r2.state.lastHeartbeatAt).toBe(1_500)
		expect(r1.state).toEqual(r2.state)
	})

	test("the reducer is pure: clock is injected, no global reads", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		const a = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 5_000)
		const b = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 9_999)
		expect(a.state.state).toBe("activating")
		expect(b.state.state).toBe("activating")
		expect(a.state.attempt).toBe(b.state.attempt)
	})

	test("the transition log records every state change", () => {
		let s = createEmptyPluginSupervision("p1", 1_000)
		s = applySupervisionEvent(s, { kind: "manifestValidated", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_100).state
		s = applySupervisionEvent(s, { kind: "installed", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_200).state
		const result = applySupervisionEvent(s, { kind: "activationRequested", pluginId: "p1" }, DEFAULT_CRASH_WINDOW_POLICY, 1_300)
		expect(result.transitions).toEqual(["installed", "activating"])
	})
})
