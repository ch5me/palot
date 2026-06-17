import { describe, expect, test } from "bun:test"

import {
	_resetGrantResolverForTests,
	_resetHostCommandsForTests,
	invokePluginCommand,
	invokePluginTool,
	listKnownCommands,
	registerBuiltInHostCommands,
} from "./dispatch"
import { getPluginCatalog } from "./authority"
import {
	_resetWorkerInvokeRouterForTests,
	setWorkerInvokeRouter,
	type WorkerInvokeInput,
	type WorkerInvokeResult,
	type WorkerInvokeRouter,
} from "./worker-invoke-router"

function reset() {
	_resetHostCommandsForTests()
	_resetGrantResolverForTests()
	_resetWorkerInvokeRouterForTests()
}

// ---------------------------------------------------------------------------
// Fake router factory for B3 tests
// ---------------------------------------------------------------------------

function makeFakeRouter(opts: {
	workerBacked: Set<string>
	result: WorkerInvokeResult
	calls?: WorkerInvokeInput[]
}): WorkerInvokeRouter {
	return {
		isWorkerBacked: (pluginId) => opts.workerBacked.has(pluginId),
		invoke: async (input) => {
			opts.calls?.push(input)
			return opts.result
		},
	}
}

describe("V2 plugin command dispatch", () => {
	test("registers all built-in host commands at boot", () => {
		reset()
		registerBuiltInHostCommands()
		const commands = listKnownCommands()
		expect(commands).toContain("firefly.built-in.palot-bridge::palot-open-side-panel")
		expect(commands).toContain("firefly.built-in.palot-bridge::palot-refresh-ui-state")
		expect(commands).toContain("firefly.built-in.palot-bridge::palot-ui-state")
		expect(commands).toContain("acme.acme-notebook::acme-notebook-open")
		expect(commands).toContain("acme.acme-notebook::acme-notebook-clear")
	})

	test("first-party palot-open-side-panel completes with catalog-derived args", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "palot-open-side-panel",
			args: { tab: "review" },
		})
		expect(envelope.status).toBe("completed")
		expect(envelope.pluginId).toBe("firefly.built-in.palot-bridge")
		expect(envelope.commandId).toBe("palot-open-side-panel")
		expect(envelope.data).toEqual({ opened: true, tab: "review", source: "v2-plugin-dispatch" })
	})

	test("third-party acme-notebook-open is denied without grants (deny-by-default, P3d)", async () => {
		reset()
		registerBuiltInHostCommands()
		// signed-third-party with no persisted grant: the default resolver grants
		// it nothing, so its declared capabilities are denied.
		const envelope = await invokePluginCommand({
			pluginId: "acme.acme-notebook",
			commandId: "acme-notebook-open",
			args: {},
		})
		expect(envelope.status).toBe("denied")
		expect(envelope.errorCode).toBe("permission_denied")
	})

	test("third-party acme-notebook-open completes once its capabilities are granted", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand(
			{ pluginId: "acme.acme-notebook", commandId: "acme-notebook-open", args: {} },
			{ grantedTokens: ["host:command.register", "host:widget.register"], sessionScope: "session" },
		)
		expect(envelope.status).toBe("completed")
		expect(envelope.pluginId).toBe("acme.acme-notebook")
		expect(envelope.data).toMatchObject({ notebookId: "acme-default", opened: true })
	})

	test("unknown command returns unavailable envelope", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "ghost-command",
			args: {},
		})
		expect(envelope.status).toBe("unavailable")
		expect(envelope.errorCode).toBe("plugin_unavailable")
	})

	test("unknown plugin id returns unavailable envelope", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand({
			pluginId: "acme.no-such-plugin",
			commandId: "no-such-command",
			args: {},
		})
		expect(envelope.status).toBe("unavailable")
	})

	test("capability broker denies when the granted-tokens list is too sparse", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand(
			{
				pluginId: "firefly.built-in.palot-bridge",
				commandId: "palot-open-side-panel",
				args: { tab: "review" },
			},
			{
				grantedTokens: ["host:command.register"],
				sessionScope: "session",
			},
		)
		expect(envelope.status).toBe("denied")
		expect(envelope.errorCode).toBe("permission_denied")
	})

	test("first-party and third-party exemplars both load through the live catalog", () => {
		reset()
		const catalog = getPluginCatalog()
		const ids = catalog.entries.map((entry) => entry.pluginId)
		// Entries are stored under canonical namespace.name ids (§4 migration)
		expect(ids).toContain("firefly.palot-bridge")
		expect(ids).toContain("acme.acme-notebook")
	})
})

// ---------------------------------------------------------------------------
// B3 dispatch routing tests — worker-backed invocation
// ---------------------------------------------------------------------------

describe("B3 dispatch routing — worker-backed command/tool invocation", () => {
	// The catalog contains `acme.acme-notebook` as a signed-third-party plugin.
	// We fake-declare it worker-backed so we can assert routing without a real
	// supervisor or catalog mutation.

	test("worker-backed command: ok:true → completed envelope, router.invoke called", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: true, data: { fromWorker: true } },
				calls,
			}),
		)
		const envelope = await invokePluginCommand(
			{ pluginId: "acme.acme-notebook", commandId: "acme-notebook-open", args: {} },
			{ grantedTokens: ["host:command.register", "host:widget.register"], sessionScope: "session" },
		)
		expect(envelope.status).toBe("completed")
		expect(envelope.data).toEqual({ fromWorker: true })
		expect(calls).toHaveLength(1)
		expect(calls[0]).toMatchObject({
			pluginId: "acme.acme-notebook",
			kind: "command",
			targetId: "acme-notebook-open",
		})
	})

	test("worker-backed command: ok:false → failed envelope, router.invoke called", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: false, errorCode: "handler_not_found", errorMessage: "no handler" },
				calls,
			}),
		)
		const envelope = await invokePluginCommand(
			{ pluginId: "acme.acme-notebook", commandId: "acme-notebook-open", args: {} },
			{ grantedTokens: ["host:command.register", "host:widget.register"], sessionScope: "session" },
		)
		expect(envelope.status).toBe("failed")
		expect(envelope.errorCode).toBe("handler_not_found")
		expect(calls).toHaveLength(1)
	})

	test("DENIED capability returns denied and router.invoke is NOT called (broker first)", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: true, data: {} },
				calls,
			}),
		)
		// No grants → broker denies before router is reached
		const envelope = await invokePluginCommand({
			pluginId: "acme.acme-notebook",
			commandId: "acme-notebook-open",
			args: {},
		})
		expect(envelope.status).toBe("denied")
		expect(envelope.errorCode).toBe("permission_denied")
		expect(calls).toHaveLength(0)
	})

	test("built-in plugin is NOT worker-backed, still hits in-process handler", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		// Router reports nothing as worker-backed → built-ins use in-process path
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(),
				result: { ok: true, data: { shouldNotAppear: true } },
				calls,
			}),
		)
		const envelope = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "palot-open-side-panel",
			args: { tab: "review" },
		})
		expect(envelope.status).toBe("completed")
		// The in-process handler's data, not the fake router data
		expect(envelope.data).toMatchObject({ opened: true, tab: "review", source: "v2-plugin-dispatch" })
		expect(calls).toHaveLength(0)
	})

	test("worker-backed tool: ok:true → completed envelope, router.invoke called with kind=tool", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: true, data: { cells: [] } },
				calls,
			}),
		)
		const envelope = await invokePluginTool(
			{
				pluginId: "acme.acme-notebook",
				toolId: "plugin.acme.acme-notebook.addCell",
				args: { content: "hello", kind: "text" },
			},
			{
				grantedTokens: ["host:bridge.session-read", "host:bridge.session-write"],
				sessionScope: "session",
			},
		)
		expect(envelope.status).toBe("completed")
		expect(envelope.data).toEqual({ cells: [] })
		expect(calls).toHaveLength(1)
		expect(calls[0]).toMatchObject({
			pluginId: "acme.acme-notebook",
			kind: "tool",
			targetId: "plugin.acme.acme-notebook.addCell",
		})
	})

	test("worker-backed tool: ok:false → failed envelope", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: false, errorCode: "worker_invoke_timeout", errorMessage: "timed out" },
				calls,
			}),
		)
		const envelope = await invokePluginTool(
			{
				pluginId: "acme.acme-notebook",
				toolId: "plugin.acme.acme-notebook.addCell",
				args: { content: "hello", kind: "text" },
			},
			{
				grantedTokens: ["host:bridge.session-read", "host:bridge.session-write"],
				sessionScope: "session",
			},
		)
		expect(envelope.status).toBe("failed")
		expect(envelope.errorCode).toBe("worker_invoke_timeout")
		expect(calls).toHaveLength(1)
	})

	test("DENIED tool capability: denied envelope, router.invoke NOT called", async () => {
		reset()
		registerBuiltInHostCommands()
		const calls: WorkerInvokeInput[] = []
		setWorkerInvokeRouter(
			makeFakeRouter({
				workerBacked: new Set(["acme.acme-notebook"]),
				result: { ok: true, data: {} },
				calls,
			}),
		)
		// No grants → broker denies before router is reached
		const envelope = await invokePluginTool({
			pluginId: "acme.acme-notebook",
			toolId: "plugin.acme.acme-notebook.addCell",
			args: { content: "hello", kind: "text" },
		})
		expect(envelope.status).toBe("denied")
		expect(envelope.errorCode).toBe("permission_denied")
		expect(calls).toHaveLength(0)
	})
})
