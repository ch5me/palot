import { describe, expect, test } from "bun:test"

import {
	DEFAULT_STATE_PRESERVATION,
	DEV_MODE_POLICY,
	HOT_RELOAD_DURATION_BUDGET_MS,
	HOT_RELOAD_EVENT_KINDS,
	HOT_RELOAD_KIND_POLICY,
	HOT_RELOAD_PHASE_SEQUENCE,
	HOT_RELOAD_PHASES,
	HOT_RELOAD_TERMINAL_PHASES,
	HOT_RELOAD_TRANSITIONS,
	PRODUCTION_MODE_POLICY,
	hotReloadEventSchema,
	isHotReloadTerminalPhase,
	isHotReloadTransitionAllowed,
	planHotReloadCycle,
	resolveHotReloadModePolicy,
} from "./hot-reload"

describe("hot-reload phase vocabulary", () => {
	test("HOT_RELOAD_PHASES covers every locked stage", () => {
		expect(HOT_RELOAD_PHASES).toEqual([
			"idle",
			"detected",
			"queued",
			"tearingDown",
			"rebuilding",
			"reprojecting",
			"republishing",
			"ready",
			"failed",
		])
	})

	test("terminal phases are ready and failed", () => {
		expect(HOT_RELOAD_TERMINAL_PHASES.has("ready")).toBe(true)
		expect(HOT_RELOAD_TERMINAL_PHASES.has("failed")).toBe(true)
		for (const phase of HOT_RELOAD_PHASES) {
			if (phase === "ready" || phase === "failed") continue
			expect(isHotReloadTerminalPhase(phase)).toBe(false)
		}
	})
})

describe("hot-reload transition table", () => {
	test("the transition table covers every phase exactly once", () => {
		expect(Object.keys(HOT_RELOAD_TRANSITIONS).sort()).toEqual([...HOT_RELOAD_PHASES].sort())
	})

	test("every non-terminal phase has at least one outgoing transition", () => {
		for (const phase of HOT_RELOAD_PHASES) {
			if (isHotReloadTerminalPhase(phase)) continue
			expect(HOT_RELOAD_TRANSITIONS[phase].length).toBeGreaterThan(0)
		}
	})

	test("terminal phases have no outgoing transitions", () => {
		for (const phase of HOT_RELOAD_TERMINAL_PHASES) {
			expect(HOT_RELOAD_TRANSITIONS[phase]).toEqual([])
		}
	})

	test("happy path: idle -> detected -> queued -> tearingDown -> rebuilding -> reprojecting -> republishing -> ready", () => {
		const path: string[] = ["idle"]
		while (path[path.length - 1] !== "ready") {
			const current = path[path.length - 1] as keyof typeof HOT_RELOAD_TRANSITIONS
			const next = HOT_RELOAD_TRANSITIONS[current][0]
			if (!next) throw new Error(`no transition from ${current}`)
			path.push(next)
		}
		expect(path).toEqual([
			"idle",
			"detected",
			"queued",
			"tearingDown",
			"rebuilding",
			"reprojecting",
			"republishing",
			"ready",
		])
	})

	test("any non-terminal phase can short-circuit to failed", () => {
		const nonTerminal = HOT_RELOAD_PHASES.filter((p) => !isHotReloadTerminalPhase(p))
		for (const phase of nonTerminal) {
			expect(HOT_RELOAD_TRANSITIONS[phase]).toContain("failed")
		}
	})

	test("isHotReloadTransitionAllowed only allows declared transitions", () => {
		expect(isHotReloadTransitionAllowed("idle", "ready")).toBe(false)
		expect(isHotReloadTransitionAllowed("queued", "republishing")).toBe(false)
		expect(isHotReloadTransitionAllowed("idle", "detected")).toBe(true)
	})
})

describe("hot-reload event kinds", () => {
	test("every kind is enumerated", () => {
		expect(HOT_RELOAD_EVENT_KINDS).toEqual([
			"manifest-changed",
			"contribution-changed",
			"worker-code-changed",
			"config-changed",
		])
	})

	test("manifest + worker-code changes require restart", () => {
		expect(HOT_RELOAD_KIND_POLICY["manifest-changed"]).toBe("restart")
		expect(HOT_RELOAD_KIND_POLICY["worker-code-changed"]).toBe("restart")
	})

	test("contribution changes project (no restart)", () => {
		expect(HOT_RELOAD_KIND_POLICY["contribution-changed"]).toBe("project")
	})

	test("config changes are the lightest path", () => {
		expect(HOT_RELOAD_KIND_POLICY["config-changed"]).toBe("soft")
	})

	test("hotReloadEventSchema accepts a well-formed event", () => {
		const parsed = hotReloadEventSchema.parse({
			pluginId: "acme.foo",
			kind: "manifest-changed",
			observedAt: 1_700_000_000_000,
			source: "fs:watcher",
		})
		expect(parsed.kind).toBe("manifest-changed")
	})

	test("hotReloadEventSchema rejects unknown event kinds", () => {
		expect(
			hotReloadEventSchema.safeParse({
				pluginId: "acme.foo",
				kind: "ghost",
				observedAt: 0,
				source: "x",
			}).success,
		).toBe(false)
	})
})

describe("dev vs production policy", () => {
	test("dev mode enables unsigned plugins and skips manifest signature check", () => {
		expect(DEV_MODE_POLICY.enableUnsignedPlugins).toBe(true)
		expect(DEV_MODE_POLICY.skipManifestSignatureCheck).toBe(true)
	})

	test("production mode forbids both", () => {
		expect(PRODUCTION_MODE_POLICY.enableUnsignedPlugins).toBe(false)
		expect(PRODUCTION_MODE_POLICY.skipManifestSignatureCheck).toBe(false)
	})

	test("resolveHotReloadModePolicy dispatches on the mode flag", () => {
		expect(resolveHotReloadModePolicy("dev")).toEqual(DEV_MODE_POLICY)
		expect(resolveHotReloadModePolicy("production")).toEqual(PRODUCTION_MODE_POLICY)
	})
})

describe("planHotReloadCycle", () => {
	test("restart policy uses the full phase sequence and rebuilds every projection", () => {
		const plan = planHotReloadCycle({
			pluginId: "acme.foo",
			event: {
				pluginId: "acme.foo",
				kind: "manifest-changed",
				observedAt: 0,
				source: "fs:watcher",
			},
			mode: "production",
		})
		expect(plan.policy).toBe("restart")
		expect(plan.phaseSequence).toEqual(HOT_RELOAD_PHASE_SEQUENCE.restart)
		expect(plan.reusesRendererProjection).toBe(false)
		expect(plan.reusesOpenCodeProjection).toBe(false)
		expect(plan.preservesSessionState).toBe(true)
		expect(plan.preservesProjectState).toBe(true)
		expect(plan.preservesAppState).toBe(true)
		expect(plan.expectedDurationMs).toBe(HOT_RELOAD_DURATION_BUDGET_MS.restart)
	})

	test("soft policy reuses both projections", () => {
		const plan = planHotReloadCycle({
			pluginId: "acme.foo",
			event: {
				pluginId: "acme.foo",
				kind: "config-changed",
				observedAt: 0,
				source: "fs:watcher",
			},
			mode: "dev",
		})
		expect(plan.policy).toBe("soft")
		expect(plan.reusesRendererProjection).toBe(true)
		expect(plan.reusesOpenCodeProjection).toBe(true)
		expect(plan.phaseSequence).toEqual(HOT_RELOAD_PHASE_SEQUENCE.soft)
	})

	test("project policy reuses projections when the tool surface is unchanged", () => {
		const plan = planHotReloadCycle({
			pluginId: "acme.foo",
			event: {
				pluginId: "acme.foo",
				kind: "contribution-changed",
				observedAt: 0,
				source: "fs:watcher",
			},
			mode: "dev",
			toolSurfaceChanged: false,
		})
		expect(plan.policy).toBe("project")
		expect(plan.reusesRendererProjection).toBe(true)
		expect(plan.reusesOpenCodeProjection).toBe(true)
	})

	test("project policy re-derives projections when the tool surface changes", () => {
		const plan = planHotReloadCycle({
			pluginId: "acme.foo",
			event: {
				pluginId: "acme.foo",
				kind: "contribution-changed",
				observedAt: 0,
				source: "fs:watcher",
			},
			mode: "dev",
			toolSurfaceChanged: true,
		})
		expect(plan.reusesRendererProjection).toBe(false)
		expect(plan.reusesOpenCodeProjection).toBe(false)
	})
})

describe("DEFAULT_STATE_PRESERVATION", () => {
	test("session, project, and app state are all preserved by default", () => {
		expect(DEFAULT_STATE_PRESERVATION).toEqual({ session: true, project: true, app: true })
	})
})
