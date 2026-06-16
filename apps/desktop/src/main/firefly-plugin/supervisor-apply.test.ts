/**
 * set-enabled → supervisor bridge: the runtime half of the P0
 * "disable does something" fix. Locks:
 *   - enable/disable a worker-backed plugin routes to supervisor.enable/disable
 *   - a surface-only plugin (no registration) is a SAFE no-op (no throw)
 *   - restart = disable then enable
 *   - null supervisor (pre-boot) is a no-op
 */

import { describe, expect, test } from "bun:test"

import { applyEnabledToSupervisor, restartSupervisedWorker } from "./supervisor-apply"
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

function spySupervisor(registered: Set<string>) {
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

describe("applyEnabledToSupervisor", () => {
	test("disable on a worker-backed plugin calls supervisor.disable", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		const result = applyEnabledToSupervisor(supervisor, PLUGIN_ID, false)
		expect(result.supervised).toBe(true)
		expect(result.summary?.state).toBe("disabled")
		expect(calls).toEqual([{ method: "disable", pluginId: PLUGIN_ID }])
	})

	test("enable on a worker-backed plugin calls supervisor.enable", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		const result = applyEnabledToSupervisor(supervisor, PLUGIN_ID, true)
		expect(result.supervised).toBe(true)
		expect(result.summary?.state).toBe("active")
		expect(calls).toEqual([{ method: "enable", pluginId: PLUGIN_ID }])
	})

	test("surface-only plugin (no registration) is a safe no-op", () => {
		const { supervisor, calls } = spySupervisor(new Set())
		const result = applyEnabledToSupervisor(supervisor, "firefly.built-in.surface.crm", false)
		expect(result.supervised).toBe(false)
		expect(result.summary).toBeNull()
		expect(calls).toEqual([]) // never touched enable/disable → no throw
	})

	test("null supervisor (pre-boot) is a no-op", () => {
		const result = applyEnabledToSupervisor(null, PLUGIN_ID, false)
		expect(result.supervised).toBe(false)
		expect(result.summary).toBeNull()
	})
})

describe("restartSupervisedWorker", () => {
	test("restart = disable then enable for a worker-backed plugin", () => {
		const { supervisor, calls } = spySupervisor(new Set([PLUGIN_ID]))
		const result = restartSupervisedWorker(supervisor, PLUGIN_ID)
		expect(result.supervised).toBe(true)
		expect(calls).toEqual([
			{ method: "disable", pluginId: PLUGIN_ID },
			{ method: "enable", pluginId: PLUGIN_ID },
		])
	})

	test("surface-only plugin restart is a safe no-op", () => {
		const { supervisor, calls } = spySupervisor(new Set())
		const result = restartSupervisedWorker(supervisor, "firefly.built-in.surface.crm")
		expect(result.supervised).toBe(false)
		expect(calls).toEqual([])
	})
})
