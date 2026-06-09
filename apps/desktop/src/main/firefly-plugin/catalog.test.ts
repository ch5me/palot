import { describe, expect, test } from "bun:test"

import { buildPluginCatalog, summarizeProjection } from "./catalog"
import { decideCapability, decideCapabilityAll } from "./capability-broker"
import { KNOWN_PLUGIN_IDS } from "./catalog"

describe("firefly-plugin v2 catalog authority", () => {
	test("ships first-party and third-party exemplars through the same code path", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const ids = catalog.entries.map((entry) => entry.pluginId)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.palotBridge)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.acmeNotebook)
		expect(ids).toContain(KNOWN_PLUGIN_IDS.acmeComponents)
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
			expect(summary?.componentCount).toBe(
				catalog.projections.components.filter((component) => component.pluginId === descriptor.normalizedId).length,
			)
		}
	})

	test("built-in manifest exposes first-party components", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const palotComponents = catalog.projections.components.filter(
			(component) => component.pluginId === KNOWN_PLUGIN_IDS.palotBridge,
		)
		expect(palotComponents.map((component) => component.contributionId)).toEqual([
			"dag-sparkline",
			"decision_card",
		])
	})

	test("acme components exemplar validates through catalog", () => {
		const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
		const acmeComponent = catalog.projections.components.find(
			(component) => component.pluginId === KNOWN_PLUGIN_IDS.acmeComponents,
		)
		expect(acmeComponent?.contributionId).toBe("acme.loyalty_progress_bar")
		expect(acmeComponent?.capabilityGates[0]?.token).toBe("acme:read")
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
			token: "host:bridge.session-read",
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
