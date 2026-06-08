/**
 * Firefly Plugin System V2 — Performance, quotas, and metering
 *
 * Locks the runtime limits in source. The V2 plan acceptance
 * criterion requires that per-plugin AI/tool cost attribution is
 * INCLUDED, not deferred. Quotas are enforced by the runtime; the
 * host aborts plugins that exceed them.
 */

import { z } from "zod"

export const quotaKeySchema = z.enum([
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
])
export type QuotaKey = z.infer<typeof quotaKeySchema>

export const quotaEntrySchema = z
	.object({
		key: quotaKeySchema,
		defaultValue: z.number().int().nonnegative(),
		unit: z.string().min(1).max(40),
		description: z.string().min(1).max(300),
		enforcement: z.enum(["abort", "drop-event", "throttle", "log-warning"]),
	})
	.strict()
export type QuotaEntry = z.infer<typeof quotaEntrySchema>

/**
 * The locked V2 quota table. Per-plugin, unless noted.
 */
export const V2_QUOTA_TABLE: readonly QuotaEntry[] = [
	{
		key: "worker-count",
		defaultValue: 4,
		unit: "workers per plugin",
		description:
			"Maximum number of worker threads a single plugin can spawn. Plugins exceeding this get their worker request denied at the broker.",
		enforcement: "abort",
	},
	{
		key: "memory-mb",
		defaultValue: 256,
		unit: "MB RSS per plugin",
		description:
			"Per-plugin memory budget. The host samples RSS every 30s; above the limit, the plugin is moved to `quarantined` with `quarantineStatus: 'auto'`.",
		enforcement: "abort",
	},
	{
		key: "event-rate",
		defaultValue: 100,
		unit: "events per second per plugin",
		description:
			"Per-plugin telemetry/event emission rate. Events above the rate are dropped with a counter; the counter is visible in the operator row.",
		enforcement: "drop-event",
	},
	{
		key: "ai-call-rate",
		defaultValue: 30,
		unit: "AI calls per minute per plugin",
		description:
			"Per-plugin AI call rate. Calls above the rate are queued (not denied) and the queue depth is visible in the operator row.",
		enforcement: "throttle",
	},
	{
		key: "tool-call-rate",
		defaultValue: 60,
		unit: "tool calls per minute per plugin",
		description:
			"Per-plugin tool call rate. Tool calls above the rate are queued.",
		enforcement: "throttle",
	},
	{
		key: "broker-call-rate",
		defaultValue: 600,
		unit: "broker calls per minute per plugin",
		description:
			"Per-plugin broker call rate (covers every capability grant and tool projection). Calls above the rate are dropped.",
		enforcement: "drop-event",
	},
	{
		key: "panel-count",
		defaultValue: 4,
		unit: "side-panels per plugin",
		description:
			"Maximum number of side-panels a single plugin can register. Panels above the limit are rejected at the manifest boundary.",
		enforcement: "abort",
	},
	{
		key: "widget-count",
		defaultValue: 8,
		unit: "session widgets per plugin",
		description:
			"Maximum number of session widgets a single plugin can register.",
		enforcement: "abort",
	},
	{
		key: "command-count",
		defaultValue: 16,
		unit: "commands per plugin",
		description:
			"Maximum number of commands/menu items/keybindings a single plugin can register.",
		enforcement: "abort",
	},
	{
		key: "theme-count",
		defaultValue: 2,
		unit: "themes per plugin",
		description:
			"Maximum number of themes a single plugin can register.",
		enforcement: "abort",
	},
] as const

/**
 * Cost attribution envelope. Every broker-mediated AI/tool call
 * carries this envelope so the host can attribute cost per plugin.
 * The V2 plan acceptance criterion requires this; it is NOT
 * deferred.
 */
export const costAttributionEnvelopeSchema = z
	.object({
		pluginId: z.string().min(1).max(160),
		callId: z.string().min(1).max(80),
		kind: z.enum(["ai", "tool", "broker", "telemetry"]),
		timestamp: z.number().int().nonnegative(),
		estimatedCostUsd: z.number().nonnegative(),
		tokenCountIn: z.number().int().nonnegative().optional(),
		tokenCountOut: z.number().int().nonnegative().optional(),
		modelId: z.string().min(1).max(160).optional(),
	})
	.strict()
export type CostAttributionEnvelope = z.infer<typeof costAttributionEnvelopeSchema>

/**
 * The default cost model for AI calls. Plugins MAY override the
 * per-call estimate, but a default is required so the host has a
 * non-zero attribution when a plugin reports nothing.
 */
export const DEFAULT_COST_PER_AI_CALL_USD = 0.001

/**
 * Worker assumptions: V2 plans for 4 workers per plugin, 16 plugins
 * per host. The host owns a shared pool of 64 workers across all
 * plugins. The exact numbers are locked in source so the gate
 * matrix (Task 28) can assert against them.
 */
export const V2_WORKER_ASSUMPTIONS = {
	workersPerPlugin: 4,
	pluginsPerHost: 16,
	hostSharedPool: 64,
	workerSampleIntervalMs: 30_000,
	aiQueueDepthLimit: 16,
	toolQueueDepthLimit: 32,
	brokerQueueDepthLimit: 256,
} as const

/**
 * Lookup helper. Returns the quota entry for a given key, or null
 * if the key is not in the table.
 */
export function findQuota(
	key: QuotaKey,
	table: readonly QuotaEntry[] = V2_QUOTA_TABLE,
): QuotaEntry | null {
	return table.find((q) => q.key === key) ?? null
}

/**
 * Build a cost attribution envelope. Pure helper; the runtime calls
 * this for every broker-mediated AI/tool call.
 */
export function buildCostAttribution(input: {
	pluginId: string
	callId: string
	kind: CostAttributionEnvelope["kind"]
	estimatedCostUsd: number
	tokenCountIn?: number
	tokenCountOut?: number
	modelId?: string
}): CostAttributionEnvelope {
	return costAttributionEnvelopeSchema.parse({
		pluginId: input.pluginId,
		callId: input.callId,
		kind: input.kind,
		timestamp: Date.now(),
		estimatedCostUsd: input.estimatedCostUsd,
		tokenCountIn: input.tokenCountIn,
		tokenCountOut: input.tokenCountOut,
		modelId: input.modelId,
	})
}
