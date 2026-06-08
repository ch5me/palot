import { describe, expect, test } from "bun:test"

import {
	buildPluginBusinessToolId,
	DEFAULT_DISPATCH_TIMEOUT_MS,
	DEFAULT_RUNNING_TIMEOUT_MS,
	getTerminalErrorCode,
	isToolCallTerminalState,
	isToolCallTransitionAllowed,
	PLUGIN_INSPECTION_TOOL_IDS,
	PLUGIN_SURFACE_TOOL_IDS,
	resolveToolTimeoutPolicy,
	TERMINAL_ERROR_CODES,
	toolCallStateSchema,
	TOOL_CALL_NON_TERMINAL_STATES,
	TOOL_CALL_TERMINAL_STATES,
	toolErrorCodeSchema,
	toolResultEnvelopeSchema,
	toolResultStatusSchema,
} from "./tool-projection"

describe("V2 9-state tool-call state machine", () => {
	test("every state is enumerated and parseable", () => {
		const expected = [
			"queued",
			"dispatching",
			"running",
			"timeout",
			"completed",
			"failed",
			"denied",
			"unavailable",
			"cancelled",
		] as const
		for (const s of expected) {
			expect(toolCallStateSchema.parse(s)).toBe(s)
		}
	})

	test("non-terminal states can be cancelled from", () => {
		expect(TOOL_CALL_NON_TERMINAL_STATES.has("queued")).toBe(true)
		expect(TOOL_CALL_NON_TERMINAL_STATES.has("dispatching")).toBe(true)
		expect(TOOL_CALL_NON_TERMINAL_STATES.has("running")).toBe(true)
		expect(TOOL_CALL_NON_TERMINAL_STATES.has("timeout")).toBe(true)
		for (const s of TOOL_CALL_NON_TERMINAL_STATES) {
			expect(isToolCallTransitionAllowed(s, "cancelled")).toBe(true)
		}
	})

	test("terminal states have no outgoing transitions", () => {
		for (const s of TOOL_CALL_TERMINAL_STATES) {
			expect(isToolCallTerminalState(s)).toBe(true)
			for (const target of TOOL_CALL_TERMINAL_STATES) {
				expect(isToolCallTransitionAllowed(s, target)).toBe(false)
			}
		}
	})

	test("queued -> dispatching -> running -> completed happy path", () => {
		expect(isToolCallTransitionAllowed("queued", "dispatching")).toBe(true)
		expect(isToolCallTransitionAllowed("dispatching", "running")).toBe(true)
		expect(isToolCallTransitionAllowed("running", "completed")).toBe(true)
	})

	test("queued -> denied short-circuits the broker", () => {
		expect(isToolCallTransitionAllowed("queued", "denied")).toBe(true)
		expect(getTerminalErrorCode("denied")).toBe("permission_denied")
	})

	test("running -> timeout -> failed", () => {
		expect(isToolCallTransitionAllowed("running", "timeout")).toBe(true)
		expect(isToolCallTransitionAllowed("timeout", "failed")).toBe(true)
		expect(getTerminalErrorCode("failed")).toBe("internal_error")
	})

	test("dispatching -> unavailable (worker offline)", () => {
		expect(isToolCallTransitionAllowed("dispatching", "unavailable")).toBe(true)
		expect(getTerminalErrorCode("unavailable")).toBe("plugin_unavailable")
	})

	test("every terminal state maps to a canonical error code (or null for completed)", () => {
		for (const s of TOOL_CALL_TERMINAL_STATES) {
			const code = getTerminalErrorCode(s)
			if (s === "completed") {
				expect(code).toBeNull()
			} else {
				expect(code).toBe(TERMINAL_ERROR_CODES[s])
			}
		}
	})

	test("terminal error codes are all valid ToolErrorCode values", () => {
		for (const code of Object.values(TERMINAL_ERROR_CODES)) {
			if (code === null) continue
			expect(toolErrorCodeSchema.safeParse(code).success).toBe(true)
		}
	})

	test("cancelled is reachable from every non-terminal state", () => {
		for (const s of TOOL_CALL_NON_TERMINAL_STATES) {
			expect(isToolCallTransitionAllowed(s, "cancelled")).toBe(true)
		}
	})

	test("dispatching -> failed is allowed for worker immediate errors (per V2 plan table)", () => {
		expect(isToolCallTransitionAllowed("dispatching", "failed")).toBe(true)
	})

	test("only running -> completed produces the success terminal", () => {
		expect(isToolCallTransitionAllowed("queued", "completed")).toBe(false)
		expect(isToolCallTransitionAllowed("dispatching", "completed")).toBe(false)
		expect(isToolCallTransitionAllowed("running", "completed")).toBe(true)
	})

	test("no transition loops back from a terminal", () => {
		expect(isToolCallTransitionAllowed("completed", "running")).toBe(false)
		expect(isToolCallTransitionAllowed("failed", "queued")).toBe(false)
		expect(isToolCallTransitionAllowed("denied", "queued")).toBe(false)
		expect(isToolCallTransitionAllowed("cancelled", "queued")).toBe(false)
	})
})

describe("V2 default timeouts", () => {
	test("dispatching->running ceiling is 5s", () => {
		expect(DEFAULT_DISPATCH_TIMEOUT_MS).toBe(5_000)
	})

	test("running ceiling is 60s", () => {
		expect(DEFAULT_RUNNING_TIMEOUT_MS).toBe(60_000)
	})

	test("per-plugin override takes precedence over descriptor default", () => {
		const map = new Map([["acme.foo", { dispatchTimeoutMs: 1_000, runningTimeoutMs: 30_000 }]])
		const policy = resolveToolTimeoutPolicy(5_000, 60_000, map, "acme.foo")
		expect(policy).toEqual({ dispatchTimeoutMs: 1_000, runningTimeoutMs: 30_000 })
	})

	test("descriptor default applies when no override", () => {
		const policy = resolveToolTimeoutPolicy(7_500, 90_000, new Map(), "acme.foo")
		expect(policy).toEqual({ dispatchTimeoutMs: 7_500, runningTimeoutMs: 90_000 })
	})
})

describe("V2 tool result envelope", () => {
	test("accepts a complete envelope", () => {
		const env = {
			status: "completed" as const,
			data: { ok: true },
			provenance: {
				pluginId: "firefly.built-in.review",
				toolId: "review.run",
				scope: "session" as const,
				capabilitySet: ["host:tool.register"],
			},
		}
		const parsed = toolResultEnvelopeSchema.parse(env)
		expect(parsed.status).toBe("completed")
	})

	test("rejects unknown status", () => {
		expect(toolResultStatusSchema.safeParse("exploding").success).toBe(false)
	})

	test("rejects unknown error code", () => {
		expect(toolErrorCodeSchema.safeParse("totally_made_up").success).toBe(false)
	})
})

describe("V2 surface-tool symmetry", () => {
	test("reserved host inspection tool ids", () => {
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.list")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.describe")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.tools")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.panels")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.widgets")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.commands")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.themes")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.state")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.permissions")
		expect(PLUGIN_INSPECTION_TOOL_IDS).toContain("plugins.lifecycle")
	})

	test("reserved host surface wrapper ids cover all four families", () => {
		expect(PLUGIN_SURFACE_TOOL_IDS.some((t) => t.startsWith("plugin.panel."))).toBe(true)
		expect(PLUGIN_SURFACE_TOOL_IDS.some((t) => t.startsWith("plugin.widget."))).toBe(true)
		expect(PLUGIN_SURFACE_TOOL_IDS.some((t) => t.startsWith("plugin.command."))).toBe(true)
		expect(PLUGIN_SURFACE_TOOL_IDS.some((t) => t.startsWith("plugin.theme."))).toBe(true)
	})

	test("plugin business tool id namespace is namespaced per plugin", () => {
		expect(buildPluginBusinessToolId("acme.foo", "ping")).toBe("plugin.acme.foo.ping")
	})
})
