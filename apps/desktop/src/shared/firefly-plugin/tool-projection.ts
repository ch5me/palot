/**
 * Firefly Plugin System V2 — Tool projection (canonical runtime contract)
 *
 * Projections derived from `PluginDescriptor`:
 *   - OpenCode / agent-facing tool definitions (one per
 *     `descriptor.tools` entry, plus introspection tools and surface
 *     wrappers).
 *   - Standard tool result envelope.
 *   - 9-state tool-call state machine with locked transitions.
 *   - Default host timeout policy.
 *
 * See the V2 plan, Task 9, for the locked state machine, the locked
 * default timeouts, and the locked surface-tool symmetry rules.
 */

import { z } from "zod"

export const toolResultStatusSchema = z.enum([
	"completed",
	"failed",
	"denied",
	"unavailable",
	"queued",
	"cancelled",
])
export type ToolResultStatus = z.infer<typeof toolResultStatusSchema>

export const toolErrorCodeSchema = z.enum([
	"validation_error",
	"unbound_session",
	"lane_unavailable",
	"human_in_control",
	"magic_browser_unavailable",
	"geometry_low_confidence",
	"binding_in_flight",
	"permission_denied",
	"plugin_unavailable",
	"plugin_disabled",
	"plugin_quarantined",
	"timeout",
	"cancelled",
	"internal_error",
	"unsupported_scope",
	"bridge_unsupported_server",
	"no_active_server",
	"session_lost",
])
export type ToolErrorCode = z.infer<typeof toolErrorCodeSchema>

export const toolResultEnvelopeSchema = z
	.object({
		status: toolResultStatusSchema,
		errorCode: toolErrorCodeSchema.optional(),
		errorMessage: z.string().max(2000).optional(),
		data: z.unknown().optional(),
		uiHints: z
			.object({
				openPanel: z.string().max(64).optional(),
				focusWidget: z.string().max(64).optional(),
				refreshProjection: z.boolean().optional(),
			})
			.optional(),
		provenance: z
			.object({
				pluginId: z.string(),
				toolId: z.string(),
				scope: z.enum(["session", "project", "app"]),
				capabilitySet: z.array(z.string()).readonly().or(z.array(z.string())),
			})
			.optional(),
		retryable: z.boolean().optional(),
	})
	.strict()
export type ToolResultEnvelope = z.infer<typeof toolResultEnvelopeSchema>

export const toolCallStateSchema = z.enum([
	"queued",
	"dispatching",
	"running",
	"timeout",
	"completed",
	"failed",
	"denied",
	"unavailable",
	"cancelled",
])
export type ToolCallState = z.infer<typeof toolCallStateSchema>

const TOOL_CALL_TRANSITIONS = {
	queued: ["dispatching", "denied", "cancelled"],
	dispatching: ["running", "failed", "cancelled", "unavailable"],
	running: ["completed", "failed", "cancelled", "timeout"],
	timeout: ["failed", "cancelled"],
	completed: [],
	failed: [],
	denied: [],
	unavailable: [],
	cancelled: [],
} as const satisfies Readonly<Record<ToolCallState, readonly ToolCallState[]>>

export const TOOL_CALL_TERMINAL_STATES: ReadonlySet<ToolCallState> = new Set([
	"completed",
	"failed",
	"denied",
	"unavailable",
	"cancelled",
])

export const TOOL_CALL_NON_TERMINAL_STATES: ReadonlySet<ToolCallState> = new Set([
	"queued",
	"dispatching",
	"running",
	"timeout",
])

export const DEFAULT_DISPATCH_TIMEOUT_MS = 5_000
export const DEFAULT_RUNNING_TIMEOUT_MS = 60_000

export const TERMINAL_ERROR_CODES = {
	completed: null,
	failed: "internal_error",
	denied: "permission_denied",
	unavailable: "plugin_unavailable",
	cancelled: "cancelled",
	queued: null,
	dispatching: null,
	running: null,
	timeout: "timeout",
} as const satisfies Readonly<Record<ToolCallState, ToolErrorCode | null>>

/**
 * Returns true if the `from -> to` transition is allowed by the locked
 * V2 state machine.
 */
export function isToolCallTransitionAllowed(from: ToolCallState, to: ToolCallState): boolean {
	return (TOOL_CALL_TRANSITIONS[from] as readonly ToolCallState[]).includes(to)
}

export function isToolCallTerminalState(state: ToolCallState): boolean {
	return TOOL_CALL_TERMINAL_STATES.has(state)
}

export function getTerminalErrorCode(state: ToolCallState): ToolErrorCode | null {
	if (state === "completed") return null
	return TERMINAL_ERROR_CODES[state] ?? "internal_error"
}

export interface ToolTimeoutPolicy {
	readonly dispatchTimeoutMs: number
	readonly runningTimeoutMs: number
	readonly perPluginOverride: ReadonlyMap<string, { dispatchTimeoutMs?: number; runningTimeoutMs?: number }>
}

export function resolveToolTimeoutPolicy(
	descriptorDefaultDispatch: number,
	descriptorDefaultRunning: number,
	perPlugin: ReadonlyMap<string, { dispatchTimeoutMs?: number; runningTimeoutMs?: number }>,
	pluginId: string,
): { dispatchTimeoutMs: number; runningTimeoutMs: number } {
	const override = perPlugin.get(pluginId) ?? {}
	return {
		dispatchTimeoutMs: override.dispatchTimeoutMs ?? descriptorDefaultDispatch ?? DEFAULT_DISPATCH_TIMEOUT_MS,
		runningTimeoutMs: override.runningTimeoutMs ?? descriptorDefaultRunning ?? DEFAULT_RUNNING_TIMEOUT_MS,
	}
}

export const pluginIntrospectionResultSchema = z
	.object({
		pluginId: z.string(),
		displayName: z.string(),
		version: z.string(),
		trust: z.enum(["built-in", "local-dev", "signed-third-party", "unsigned-third-party"]),
		enabled: z.boolean(),
		quarantined: z.boolean(),
		crashCount: z.number().int().nonnegative(),
		grantedCapabilities: z.array(z.string()),
		requiredCapabilities: z.array(z.string()),
		toolIds: z.array(z.string()),
		panelIds: z.array(z.string()),
		widgetIds: z.array(z.string()),
		commandIds: z.array(z.string()),
		themeIds: z.array(z.string()),
		activeSessionBindings: z.number().int().nonnegative(),
		lastError: z
			.object({
				code: z.string(),
				message: z.string(),
				timestamp: z.number(),
			})
			.optional(),
	})
	.strict()

export const pluginListResultSchema = z.object({
	plugins: z.array(pluginIntrospectionResultSchema),
})

export const pluginListArgsShape = {} satisfies z.ZodRawShape
export const pluginDescribeArgsShape = {
	pluginId: z.string().min(1).max(128),
} satisfies z.ZodRawShape
export const pluginToolsArgsShape = {
	pluginId: z.string().min(1).max(128).optional(),
} satisfies z.ZodRawShape
export const pluginPanelsArgsShape = {
	pluginId: z.string().min(1).max(128).optional(),
} satisfies z.ZodRawShape
export const pluginWidgetsArgsShape = {
	pluginId: z.string().min(1).max(128).optional(),
} satisfies z.ZodRawShape
export const pluginCommandsArgsShape = {
	pluginId: z.string().min(1).max(128).optional(),
} satisfies z.ZodRawShape
export const pluginThemesArgsShape = {
	pluginId: z.string().min(1).max(128).optional(),
} satisfies z.ZodRawShape
export const pluginStateArgsShape = {
	pluginId: z.string().min(1).max(128),
} satisfies z.ZodRawShape
export const pluginPermissionsArgsShape = {
	pluginId: z.string().min(1).max(128),
} satisfies z.ZodRawShape
export const pluginLifecycleArgsShape = {
	pluginId: z.string().min(1).max(128),
} satisfies z.ZodRawShape

export const pluginPanelOpenArgsShape = {
	pluginId: z.string().min(1).max(128),
	panelId: z.string().min(1).max(64),
} satisfies z.ZodRawShape

export const pluginWidgetPlaceArgsShape = {
	pluginId: z.string().min(1).max(128),
	widgetId: z.string().min(1).max(64),
	zoneId: z.string().min(1).max(40),
} satisfies z.ZodRawShape

export const pluginCommandRunArgsShape = {
	pluginId: z.string().min(1).max(128),
	commandId: z.string().min(1).max(120),
	args: z.record(z.string(), z.unknown()).optional(),
} satisfies z.ZodRawShape

export const pluginThemeApplyArgsShape = {
	themeId: z.string().min(1).max(64),
	preview: z.boolean().optional(),
} satisfies z.ZodRawShape
export const pluginThemeResetArgsShape = {} satisfies z.ZodRawShape

export const PLUGIN_INSPECTION_TOOL_IDS = [
	"plugins.list",
	"plugins.describe",
	"plugins.tools",
	"plugins.panels",
	"plugins.widgets",
	"plugins.commands",
	"plugins.themes",
	"plugins.state",
	"plugins.permissions",
	"plugins.lifecycle",
] as const
export type PluginInspectionToolId = (typeof PLUGIN_INSPECTION_TOOL_IDS)[number]

export const PLUGIN_SURFACE_TOOL_IDS = [
	"plugin.panel.open",
	"plugin.widget.place",
	"plugin.command.run",
	"plugin.theme.apply",
	"plugin.theme.reset",
	"plugin.theme.preview",
] as const
export type PluginSurfaceToolId = (typeof PLUGIN_SURFACE_TOOL_IDS)[number]

/**
 * Compute the per-plugin business tool id namespace prefix. V2 reserves
 * the bare `plugin.<id>.*` shape for plugin business tools; the host
 * uses `plugins.*` for inspection and `plugin.{surface}.*` for the
 * surface wrappers.
 */
export function buildPluginBusinessToolId(pluginId: string, shortName: string): string {
	return `plugin.${pluginId}.${shortName}`
}
