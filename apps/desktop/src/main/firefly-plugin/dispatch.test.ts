import { describe, expect, test } from "bun:test"

import {
	_resetHostCommandsForTests,
	invokePluginCommand,
	listKnownCommands,
	registerBuiltInHostCommands,
} from "./dispatch"
import { getPluginCatalog } from "./authority"

function reset() {
	_resetHostCommandsForTests()
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

	test("third-party acme-notebook-open completes through the SAME code path", async () => {
		reset()
		registerBuiltInHostCommands()
		const envelope = await invokePluginCommand({
			pluginId: "acme.acme-notebook",
			commandId: "acme-notebook-open",
			args: {},
		})
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
		expect(ids).toContain("firefly.built-in.palot-bridge")
		expect(ids).toContain("acme.acme-notebook")
	})
})
