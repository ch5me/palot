import { describe, expect, test } from "bun:test"
import { z } from "zod"

import { derivePluginDescriptor } from "./descriptor"
import {
	BRIDGE_SERVER_MODE_MATRIX,
	getCanonicalBridgeServerErrorCode,
	INITIAL_SERVER_MODE_ROLLOUT_STANCE,
	projectBridgeToolDefinitions,
	projectDispatchPathwayDecision,
	projectHookSubscriptions,
	projectPerPluginSystemContextBlocks,
	projectSystemContextBlock,
	supportsBridgeServerModeInRollout,
} from "./bridge-projection"
import type { PluginManifest } from "./manifest"

const baseManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.bridge-projection-test",
	displayName: "Bridge Projection Test",
	version: "0.11.0",
	manifestRevision: 1,
	engines: { firefly: ">=0.11.0" },
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
	},
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		widgets: [],
		commands: [],
		themes: [],
		tools: [],
	},
	capabilities: ["host:tool.register"],
	tags: [],
} as PluginManifest

function createDescriptor(overrides?: Partial<PluginManifest>) {
	const manifest = {
		...baseManifest,
		...overrides,
		engines: overrides?.engines ?? baseManifest.engines,
		lifecycle: overrides?.lifecycle ?? baseManifest.lifecycle,
		activationEvents: overrides?.activationEvents ?? baseManifest.activationEvents,
		contributes: overrides?.contributes ?? baseManifest.contributes,
		capabilities: overrides?.capabilities ?? baseManifest.capabilities,
		tags: overrides?.tags ?? baseManifest.tags,
	} as PluginManifest
	return derivePluginDescriptor(manifest, {
		appVersion: "0.11.0",
		defaultToolTimeoutMs: 60_000,
	})
}

describe("bridge projection tool definitions", () => {
	test("preserve ids + raw shapes and wrap args with z.object(...).passthrough()", () => {
		const descriptor = createDescriptor({
			contributes: {
				panels: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [
					{
						id: "plugin.firefly.built-in.bridge-projection-test.inspect",
						title: "Inspect",
						description: "Inspect state",
						scope: "session",
						requires: ["host:tool.register"],
						args: {
							query: z.string().min(1),
							limit: z.number().int().positive().optional(),
						},
						preview: false,
					},
				],
			},
		})

		const [tool] = projectBridgeToolDefinitions(descriptor)
		expect(tool?.id).toBe("plugin.firefly.built-in.bridge-projection-test.inspect")
		expect(tool?.argsShape).toBe(descriptor.tools[0]?.args)
		expect(tool?.argsSchema.safeParse({ query: "ok", extra: true }).success).toBe(true)
		expect(tool?.argsSchema.safeParse({ limit: 3 }).success).toBe(false)
		expect(tool?.argsSchema.safeParse({ query: "ok", another: "field" }).success).toBe(true)
	})

	test("uses descriptor default timeout when tool timeout missing", () => {
		const descriptor = createDescriptor({
			contributes: {
				panels: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [
					{
						id: "plugin.firefly.built-in.bridge-projection-test.default-timeout",
						title: "Default timeout",
						description: "Uses descriptor timeout",
						scope: "session",
						requires: ["host:tool.register"],
						args: {},
						preview: false,
					},
				],
			},
		})

		const [tool] = projectBridgeToolDefinitions(descriptor)
		expect(tool?.timeoutMs).toBe(60_000)
	})
})

describe("bridge projection system context", () => {
	test("concatenates blocks deterministically in descriptor order", () => {
		const first = createDescriptor({
			id: "firefly.built-in.bridge-projection-first",
			bridge: {
				schemaVersion: 1,
				agentContextLabel: "first",
				systemContextBlock: "First block",
				requiresSessionBinding: false,
				bindOnActivation: false,
			},
		})
		const second = createDescriptor({
			id: "firefly.built-in.bridge-projection-second",
			bridge: {
				schemaVersion: 1,
				agentContextLabel: "second",
				systemContextBlock: "Second block",
				requiresSessionBinding: false,
				bindOnActivation: false,
			},
		})
		const empty = createDescriptor({
			id: "firefly.built-in.bridge-projection-empty",
			bridge: {
				schemaVersion: 1,
				agentContextLabel: "empty",
				systemContextBlock: "   ",
				requiresSessionBinding: false,
				bindOnActivation: false,
			},
		})

		expect(projectSystemContextBlock([first, empty, second])).toBe("First block\n\nSecond block")
	})

	test("per-plugin blocks preserve plugin id and label", () => {
		const descriptor = createDescriptor({
			bridge: {
				schemaVersion: 1,
				agentContextLabel: "bridge-label",
				systemContextBlock: "Bridge block",
				requiresSessionBinding: false,
				bindOnActivation: false,
			},
		})

		expect(projectPerPluginSystemContextBlocks([descriptor])).toEqual([
			{
				pluginId: descriptor.normalizedId,
				label: "bridge-label",
				block: "Bridge block",
			},
		])
	})
})


describe("bridge projection hooks", () => {
	test("include only experimental.chat.system.transform and event when supported", () => {
		const descriptor = createDescriptor({
			bridge: {
				schemaVersion: 1,
				systemContextBlock: "Bridge context",
				requiresSessionBinding: true,
				bindOnActivation: true,
			},
			contributes: {
				panels: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [
					{
						id: "plugin.firefly.built-in.bridge-projection-test.evented",
						title: "Evented",
						description: "Needs event hook",
						scope: "session",
						requires: ["host:tool.register"],
						args: {},
						preview: false,
					},
				],
			},
		})

		expect(projectHookSubscriptions(descriptor)).toEqual([
			{
				pluginId: descriptor.normalizedId,
				kind: "experimental.chat.system.transform",
			},
			{
				pluginId: descriptor.normalizedId,
				kind: "event",
			},
		])
	})

	test("returns no hook subscriptions when bridge metadata absent", () => {
		const descriptor = createDescriptor()
		expect(projectHookSubscriptions(descriptor)).toEqual([])
	})
})

describe("bridge projection dispatch pathways", () => {
	test("session-bound plugins require binding for every tool", () => {
		const descriptor = createDescriptor({
			bridge: {
				schemaVersion: 1,
				requiresSessionBinding: true,
				bindOnActivation: true,
			},
			contributes: {
				panels: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [
					{
						id: "plugin.firefly.built-in.bridge-projection-test.bound",
						title: "Bound",
						description: "Needs session binding",
						scope: "session",
						requires: ["host:tool.register"],
						args: {},
						preview: false,
					},
				],
			},
		})

		expect(projectDispatchPathwayDecision(descriptor)).toEqual({
			pluginId: descriptor.normalizedId,
			requiresSessionBinding: true,
			bindOnActivation: true,
			canDispatchWithoutSessionBinding: false,
			toolIdsRequiringSessionBinding: ["plugin.firefly.built-in.bridge-projection-test.bound"],
			toolIdsWithoutSessionBinding: [],
			toolBindingSummary: [
				{
					toolId: "plugin.firefly.built-in.bridge-projection-test.bound",
					scope: "session",
					needsSessionBinding: true,
				},
			],
		})
	})

	test("unbound plugins can dispatch without session binding", () => {
		const descriptor = createDescriptor({
			bridge: {
				schemaVersion: 1,
				requiresSessionBinding: false,
				bindOnActivation: false,
			},
			contributes: {
				panels: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [
					{
						id: "plugin.firefly.built-in.bridge-projection-test.unbound",
						title: "Unbound",
						description: "No session binding",
						scope: "app",
						requires: ["host:tool.register"],
						args: {},
						preview: false,
					},
				],
			},
		})

		const decision = projectDispatchPathwayDecision(descriptor)
		expect(decision.requiresSessionBinding).toBe(false)
		expect(decision.canDispatchWithoutSessionBinding).toBe(true)
		expect(decision.toolIdsWithoutSessionBinding).toEqual([
			"plugin.firefly.built-in.bridge-projection-test.unbound",
		])
		expect(decision.toolBindingSummary).toEqual([
			{
				toolId: "plugin.firefly.built-in.bridge-projection-test.unbound",
				scope: "app",
				needsSessionBinding: false,
			},
		])
	})
})

describe("bridge server mode matrix", () => {
	test("every row has status badge string and canonical error code or none", () => {
		for (const row of BRIDGE_SERVER_MODE_MATRIX) {
			expect(typeof row.statusBadge).toBe("string")
			expect(row.statusBadge.length).toBeGreaterThan(0)
			expect(row.canonicalErrorCode === "none" || typeof row.canonicalErrorCode === "string").toBe(true)
		}
	})

	test("managed server returns no error", () => {
		expect(getCanonicalBridgeServerErrorCode("managed")).toBeNull()
	})

	test("attached-no-install returns bridge_unsupported_server", () => {
		expect(getCanonicalBridgeServerErrorCode("attached-no-install")).toBe("bridge_unsupported_server")
	})

	test("offline returns no_active_server", () => {
		expect(getCanonicalBridgeServerErrorCode("offline")).toBe("no_active_server")
	})

	test("reconnect returns session_lost", () => {
		expect(getCanonicalBridgeServerErrorCode("reconnect")).toBe("session_lost")
	})

	test("V2 initial stance is managed-server-only", () => {
		expect(INITIAL_SERVER_MODE_ROLLOUT_STANCE).toBe("managed-server-only")
		expect(supportsBridgeServerModeInRollout("managed")).toBe(true)
		expect(supportsBridgeServerModeInRollout("attached-no-install")).toBe(false)
		expect(supportsBridgeServerModeInRollout("attached-with-install")).toBe(false)
	})
})
