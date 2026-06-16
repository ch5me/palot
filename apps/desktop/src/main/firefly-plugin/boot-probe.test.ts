/**
 * Firefly Plugin System V2 — end-to-end boot probe (slice 6 proof)
 *
 * Verifies that a host can boot the V2 catalog and round-trip a
 * contributed command through the same handlers the live Electron
 * app uses, with the same arg coercion / broker / dispatcher path.
 *
 * Slice 6 doesn't need to launch the full Electron main process
 * (the ipcMain.handle registration in registerFireflyPluginIpc() is
 * the same shape of call), but it does prove the V2 runtime
 * contract end-to-end:
 *   1. catalog builds (palot-bridge + acme-notebook)
 *   2. catalog exposes known commands (palot-* + acme-*)
 *   3. broker grants the dispatcher's baseline token set
 *   4. dispatcher returns a completed envelope for a first-party
 *      command and a third-party command
 *   5. dispatch envelope shape matches the live IPC return type
 *
 * If this test passes, the V2 plugin system is wired correctly
 * for the live Electron app to consume; the only thing slice 6
 * doesn't prove is the renderer-side data flow (covered by the
 * `useFireflyPlugins` + `V2PluginsPanel` integration in slice 5
 * and the live command palette in slice 3).
 */

import { afterEach, beforeAll, describe, expect, it } from "bun:test"

import { decideCapability } from "./capability-broker"
import {
	_resetHostCommandsForTests,
	invokePluginCommand,
	listKnownCommands,
	registerBuiltInHostCommands,
} from "./dispatch"
import { getPluginCatalog, refreshPluginCatalog } from "./authority"

const log = (...args: unknown[]) => {
	if (process.env.FIREFLY_BOOT_PROBE_VERBOSE === "1") {
		// eslint-disable-next-line no-console
		console.log(...args)
	}
}

describe("firefly-plugin boot probe", () => {
	beforeAll(() => {
		registerBuiltInHostCommands()
	})
	afterEach(() => {
		_resetHostCommandsForTests()
		registerBuiltInHostCommands()
	})

	it("boots the V2 catalog with both first-party and third-party exemplars", () => {
		const catalog = getPluginCatalog()
		const ids = catalog.descriptors.map((d) => d.normalizedId)
		log("boot probe catalog", { ids, appVersion: catalog.appVersion })
		expect(ids).toContain("firefly.built-in.palot-bridge")
		expect(ids).toContain("acme.acme-notebook")
	})

	it("exposes V2-contributed commands the same way the IPC list channel would", () => {
		const known = listKnownCommands()
		log("boot probe knownCommands", known)
		// first-party
		expect(known).toContain("firefly.built-in.palot-bridge::palot-open-side-panel")
		expect(known).toContain("firefly.built-in.palot-bridge::palot-refresh-ui-state")
		expect(known).toContain("firefly.built-in.palot-bridge::palot-ui-state")
		// third-party
		expect(known).toContain("acme.acme-notebook::acme-notebook-open")
		expect(known).toContain("acme.acme-notebook::acme-notebook-clear")
	})

	it("brokers a low-risk baseline token for built-in plugins", () => {
		const trust = "built-in" as const
		const decision = decideCapability({
			pluginId: "firefly.built-in.palot-bridge",
			trust,
			token: "host:ui.read",
			sessionScope: "session",
			grantedTokens: [
				"host:command.register",
				"host:tool.register",
				"host:panel.register",
				"host:widget.register",
				"host:theme.register",
				"host:ui.read",
				"host:bridge.session-read",
				"host:bridge.ui-state-read",
				"host:bridge.ui-state-write",
				"host:theme.preview",
			],
		})
		log("boot probe broker decision", decision)
		expect(decision.granted).toBe(true)
	})

	it("round-trips a first-party command through the dispatcher (V2 invoke path)", async () => {
		const result = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "palot-refresh-ui-state",
			args: {},
		})
		log("boot probe first-party envelope", result)
		expect(result.status).toBe("completed")
		expect(result.pluginId).toBe("firefly.built-in.palot-bridge")
		expect(result.commandId).toBe("palot-refresh-ui-state")
	})

	it("round-trips a third-party command through the dispatcher (V2 invoke path)", async () => {
		// Post-P3d third-party is deny-by-default: dispatch with the consented
		// grants the command declares (host:command.register + host:widget.register).
		const result = await invokePluginCommand(
			{
				pluginId: "acme.acme-notebook",
				commandId: "acme-notebook-open",
				args: {},
			},
			{ grantedTokens: ["host:command.register", "host:widget.register"], sessionScope: "session" },
		)
		log("boot probe third-party envelope", result)
		expect(result.status).toBe("completed")
		expect(result.pluginId).toBe("acme.acme-notebook")
		expect(result.commandId).toBe("acme-notebook-open")
	})

	it("survives a catalog refresh and continues to dispatch", async () => {
		const before = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "palot-refresh-ui-state",
			args: {},
		})
		expect(before.status).toBe("completed")
		await refreshPluginCatalog()
		const result = await invokePluginCommand({
			pluginId: "firefly.built-in.palot-bridge",
			commandId: "palot-refresh-ui-state",
			args: {},
		})
		log("boot probe after refresh", result)
		expect(result.status).toBe("completed")
	})

	it("denies an unknown plugin id with a structured envelope", async () => {
		const result = await invokePluginCommand({
			pluginId: "acme.unknown-plugin",
			commandId: "anything",
			args: {},
		})
		log("boot probe unknown envelope", result)
		expect(result.status).toBe("unavailable")
		expect(result.errorCode).toBe("plugin_unavailable")
	})
})
