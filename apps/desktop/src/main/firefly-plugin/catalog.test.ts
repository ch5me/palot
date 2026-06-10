import { describe, expect, test } from "bun:test"

import { buildPluginCatalog, summarizeProjection } from "./catalog"
import { decideCapability, decideCapabilityAll } from "./capability-broker"
import { KNOWN_PLUGIN_IDS } from "./catalog"

describe("firefly-plugin v2 catalog authority", () => {
	test("ships first-party and third-party exemplars through the same code path", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const ids = catalog.entries.map((entry) => entry.pluginId)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.palotBridge)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.memorySurface)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.acmeNotebook)
	})

	test("third-party exemplar lands with a non-built-in trust tier", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const acme = catalog.entries.find((e) => e.pluginId === KNOWN_PLUGIN_IDS.acmeNotebook)
		expect(acme?.trust).toBe("signed-third-party")
	})

	test("projection summaries are deterministic and match descriptor counts", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const summaries = summarizeProjection(catalog)
		for (const descriptor of catalog.descriptors) {
			const summary = summaries.find((s) => s.pluginId === descriptor.normalizedId)
			expect(summary).toBeDefined()
			expect(summary?.toolCount).toBe(descriptor.tools.length)
			const expectedPanelCount = catalog.projections.panels.filter(
				(p) => p.pluginId === descriptor.normalizedId,
			).length
			expect(summary?.panelCount).toBe(expectedPanelCount)
		}
		const memory = catalog.projections.panels.find(
			(panel) => panel.pluginId === KNOWN_PLUGIN_IDS.memorySurface,
		)
		expect(memory?.contributionId).toBe("memory")
		expect(memory?.renderMode).toBe("host-reconciler")
	})

	test("capability broker denies a third-party plugin trying to claim a high-risk host capability", () => {
		const decision = decideCapability({
			pluginId: "acme.acme-notebook",
			trust: "signed-third-party",
			token: "host:browser.lane-control",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(decision.granted).toBe(false)
		expect(decision.knownToHost).toBe(true)
	})

	test("capability broker grants built-in baseline tokens to first-party plugin", () => {
		const decision = decideCapability({
			pluginId: "firefly.built-in.palot-bridge",
			trust: "built-in",
			token: "host:command.register",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(decision.granted).toBe(true)
		expect(decision.reasonCode).toBe("granted-builtin-baseline")
	})

	test("decideCapabilityAll returns failures when any required token is denied", () => {
		const result = decideCapabilityAll({
			pluginId: "acme.acme-notebook",
			trust: "signed-third-party",
			tokens: ["host:bridge.session-read", "host:browser.lane-control"],
			sessionScope: "session",
			grantedTokens: ["host:bridge.session-read"],
		})
		expect(result.granted).toBe(false)
		expect(result.failures.length).toBe(1)
		expect(result.failures[0]?.token).toBe("host:browser.lane-control")
	})
})
