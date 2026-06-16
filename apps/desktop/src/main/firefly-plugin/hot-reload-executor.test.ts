/**
 * Hot-reload executor: drives the locked FSM contract against an
 * injected supervisor + broadcaster. Locks the §8 effect table:
 *   - project/soft → reproject (refresh + broadcast), no worker restart
 *   - restart      → worker restart THEN reproject
 *   - failed cycle → reload-required signal (fail loud, never silent)
 */

import { describe, expect, test } from "bun:test"

import type { HotReloadEvent, HotReloadEventKind } from "../../shared/firefly-plugin/hot-reload"
import { createHotReloadExecutor } from "./hot-reload-executor"
import type { PluginWorkerSupervisor } from "./worker-supervisor"
import type { PluginSupervisionSummary } from "../../shared/firefly-plugin/runtime-supervision"

const PLUGIN_ID = "firefly.built-in.surface.notes"

function summary(pluginId: string, state: PluginSupervisionSummary["state"]): PluginSupervisionSummary {
	return {
		pluginId,
		state,
		acceptingCalls: state === "active",
		quarantined: false,
		quarantine: null,
		attempt: 0,
		lastHeartbeatAt: null,
		lastTransitionAt: 0,
		lastEventAt: 0,
		hangStreak: 0,
		crashCount: 0,
		crashWindowMs: 60_000,
		lastError: null,
		enabledByOperator: true,
		recentCrashes: [],
	}
}

interface SupervisorSpy {
	supervisor: PluginWorkerSupervisor
	calls: { method: string; pluginId: string }[]
}

/** A supervisor stub that records enable/disable/getSummary calls. */
function spySupervisor(registered: Set<string>): SupervisorSpy {
	const calls: { method: string; pluginId: string }[] = []
	const supervisor = {
		register: () => summary("x", "installed"),
		activate: (pluginId: string) => summary(pluginId, "active"),
		disable: (pluginId: string) => {
			calls.push({ method: "disable", pluginId })
			return summary(pluginId, "disabled")
		},
		enable: (pluginId: string) => {
			calls.push({ method: "enable", pluginId })
			return summary(pluginId, "active")
		},
		releaseQuarantine: (pluginId: string) => summary(pluginId, "active"),
		getSummary: (pluginId: string) =>
			registered.has(pluginId) ? summary(pluginId, "active") : null,
		listSummaries: () => [],
		scanForHangs: () => undefined,
		dispose: async () => undefined,
	} satisfies PluginWorkerSupervisor
	return { supervisor, calls }
}

function event(kind: HotReloadEventKind, pluginId = PLUGIN_ID): HotReloadEvent {
	return { pluginId, kind, observedAt: 1, source: `${pluginId}/file` }
}

describe("createHotReloadExecutor", () => {
	test("contribution-changed (project) reprojects without restarting the worker", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		let refreshed = 0
		const broadcasts: (string | undefined)[] = []
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				refreshed += 1
			},
			broadcast: (reason) => broadcasts.push(reason),
		})

		const result = executor.execute(event("contribution-changed"))

		expect(result.outcome).toBe("ready")
		expect(result.plan.policy).toBe("project")
		expect(result.restartedWorker).toBe(false)
		expect(calls).toEqual([]) // no worker restart on a project cycle
		expect(refreshed).toBe(1)
		expect(broadcasts).toEqual(["hot-reload:contribution-changed"])
	})

	test("config-changed (soft) reprojects, no restart", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		let refreshed = 0
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				refreshed += 1
			},
			broadcast: () => undefined,
		})

		const result = executor.execute(event("config-changed"))

		expect(result.plan.policy).toBe("soft")
		expect(result.restartedWorker).toBe(false)
		expect(calls).toEqual([])
		expect(refreshed).toBe(1)
	})

	test("worker-code-changed (restart) restarts the worker THEN reprojects", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		let refreshed = 0
		const broadcasts: (string | undefined)[] = []
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				refreshed += 1
			},
			broadcast: (reason) => broadcasts.push(reason),
		})

		const result = executor.execute(event("worker-code-changed"))

		expect(result.plan.policy).toBe("restart")
		expect(result.restartedWorker).toBe(true)
		// disable (teardown) then enable (re-activate) — module-cache hacks forbidden.
		expect(calls).toEqual([
			{ method: "disable", pluginId: PLUGIN_ID },
			{ method: "enable", pluginId: PLUGIN_ID },
		])
		expect(refreshed).toBe(1)
		expect(broadcasts).toEqual(["hot-reload:worker-code-changed"])
	})

	test("manifest-changed (restart) on a surface-only plugin is a safe no-op restart", () => {
		// Plugin not registered with the supervisor (no worker entry).
		const { supervisor, calls } = spySupervisor(new Set())
		let refreshed = 0
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				refreshed += 1
			},
			broadcast: () => undefined,
		})

		const result = executor.execute(event("manifest-changed"))

		expect(result.outcome).toBe("ready")
		expect(result.plan.policy).toBe("restart")
		expect(result.restartedWorker).toBe(false) // nothing to restart
		expect(calls).toEqual([]) // never touched the supervisor
		expect(refreshed).toBe(1) // still reprojects
	})

	test("a refresh failure flags reload-required (fail loud, never silent stale serve)", () => {
		const { supervisor } = spySupervisor(new Set([PLUGIN_ID]))
		const errors: { message: string; meta?: Record<string, unknown> }[] = []
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				throw new Error("disk manifest reparse blew up")
			},
			broadcast: () => undefined,
			log: {
				info: () => undefined,
				warn: () => undefined,
				error: (message, meta) => errors.push({ message, meta }),
			},
		})

		const result = executor.execute(event("contribution-changed"))

		expect(result.outcome).toBe("failed")
		expect(result.reloadRequired?.pluginId).toBe(PLUGIN_ID)
		expect(result.reloadRequired?.reason).toContain("disk manifest reparse blew up")
		expect(executor.listReloadRequired().map((s) => s.pluginId)).toEqual([PLUGIN_ID])
		expect(errors.length).toBe(1) // logged loudly

		executor.clearReloadRequired(PLUGIN_ID)
		expect(executor.listReloadRequired()).toEqual([])
	})

	test("a successful cycle clears a prior reload-required flag", () => {
		const { supervisor } = spySupervisor(new Set([PLUGIN_ID]))
		let shouldFail = true
		const executor = createHotReloadExecutor({
			supervisor,
			refreshCatalog: () => {
				if (shouldFail) throw new Error("boom")
			},
			broadcast: () => undefined,
		})

		expect(executor.execute(event("contribution-changed")).outcome).toBe("failed")
		expect(executor.listReloadRequired().length).toBe(1)

		shouldFail = false
		expect(executor.execute(event("contribution-changed")).outcome).toBe("ready")
		expect(executor.listReloadRequired()).toEqual([])
	})

	test("null supervisor (not booted) ⇒ restart is a no-op, reproject still happens", () => {
		let refreshed = 0
		const executor = createHotReloadExecutor({
			supervisor: null,
			refreshCatalog: () => {
				refreshed += 1
			},
			broadcast: () => undefined,
		})

		const result = executor.execute(event("worker-code-changed"))
		expect(result.outcome).toBe("ready")
		expect(result.restartedWorker).toBe(false)
		expect(refreshed).toBe(1)
	})
})
