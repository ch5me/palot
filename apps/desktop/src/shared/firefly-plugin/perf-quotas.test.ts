import { describe, expect, test } from "bun:test"
import {
	DEFAULT_COST_PER_AI_CALL_USD,
	V2_QUOTA_TABLE,
	V2_WORKER_ASSUMPTIONS,
	buildCostAttribution,
	costAttributionEnvelopeSchema,
	findQuota,
	quotaEntrySchema,
} from "./perf-quotas"

describe("perf-quotas", () => {
	test("quota table covers every locked quota key", () => {
		for (const key of [
			"worker-count",
			"memory-mb",
			"event-rate",
			"ai-call-rate",
			"tool-call-rate",
			"broker-call-rate",
			"panel-count",
			"widget-count",
			"command-count",
			"theme-count",
		] as const) {
			expect(findQuota(key)).not.toBeNull()
		}
	})

	test("every quota has a non-negative default value and a unit", () => {
		for (const q of V2_QUOTA_TABLE) {
			expect(q.defaultValue).toBeGreaterThanOrEqual(0)
			expect(q.unit.length).toBeGreaterThan(0)
		}
	})

	test("every quota has a real enforcement mode", () => {
		for (const q of V2_QUOTA_TABLE) {
			expect(["abort", "drop-event", "throttle", "log-warning"]).toContain(q.enforcement)
		}
	})

	test("memory-mb is enforced as abort (the host quarantines runaway plugins)", () => {
		const m = findQuota("memory-mb")
		expect(m?.enforcement).toBe("abort")
		expect(m?.defaultValue).toBe(256)
	})

	test("event-rate is enforced as drop-event (telemetry overrun is non-fatal)", () => {
		const e = findQuota("event-rate")
		expect(e?.enforcement).toBe("drop-event")
	})

	test("ai-call-rate is enforced as throttle (queue, not deny)", () => {
		const a = findQuota("ai-call-rate")
		expect(a?.enforcement).toBe("throttle")
	})

	test("worker assumptions are consistent (host pool >= workers per plugin)", () => {
		expect(V2_WORKER_ASSUMPTIONS.hostSharedPool).toBeGreaterThanOrEqual(
			V2_WORKER_ASSUMPTIONS.workersPerPlugin,
		)
	})

	test("worker assumptions support at least 4 plugins concurrently", () => {
		const maxPlugins = Math.floor(
			V2_WORKER_ASSUMPTIONS.hostSharedPool / V2_WORKER_ASSUMPTIONS.workersPerPlugin,
		)
		expect(maxPlugins).toBeGreaterThanOrEqual(4)
	})

	test("DEFAULT_COST_PER_AI_CALL_USD is a positive dollar amount (cost attribution is real)", () => {
		expect(DEFAULT_COST_PER_AI_CALL_USD).toBeGreaterThan(0)
	})

	test("cost attribution envelope carries pluginId, callId, kind, timestamp, cost", () => {
		const env = buildCostAttribution({
			pluginId: "firefly.built-in.palot-bridge",
			callId: "call-1",
			kind: "ai",
			estimatedCostUsd: 0.01,
		})
		expect(env.pluginId).toBe("firefly.built-in.palot-bridge")
		expect(env.callId).toBe("call-1")
		expect(env.kind).toBe("ai")
		expect(env.estimatedCostUsd).toBe(0.01)
		expect(env.timestamp).toBeGreaterThan(0)
	})

	test("cost attribution envelope rejects negative cost", () => {
		const r = costAttributionEnvelopeSchema.safeParse({
			pluginId: "p",
			callId: "c",
			kind: "ai",
			timestamp: Date.now(),
			estimatedCostUsd: -1,
		})
		expect(r.success).toBe(false)
	})

	test("cost attribution envelope allows optional token counts and modelId", () => {
		const r = costAttributionEnvelopeSchema.safeParse({
			pluginId: "p",
			callId: "c",
			kind: "ai",
			timestamp: Date.now(),
			estimatedCostUsd: 0,
			tokenCountIn: 100,
			tokenCountOut: 200,
			modelId: "claude-opus-4",
		})
		expect(r.success).toBe(true)
	})

	test("quotaEntrySchema rejects unknown fields (strict)", () => {
		const r = quotaEntrySchema.safeParse({ ...V2_QUOTA_TABLE[0], extra: "x" })
		expect(r.success).toBe(false)
	})

	test("every quota has a unique key", () => {
		const keys = V2_QUOTA_TABLE.map((q) => q.key)
		expect(new Set(keys).size).toBe(keys.length)
	})

	test("findQuota returns null for an unknown key", () => {
		const r = findQuota("not-a-key" as never)
		expect(r).toBeNull()
	})
})
