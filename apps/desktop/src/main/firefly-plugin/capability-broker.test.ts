import { describe, expect, test } from "bun:test"

import {
	builtInBaselineGrants,
	decideCapability,
	decideCapabilityAll,
} from "./capability-broker"

describe("decideCapability", () => {
	test("unknown capability is always denied", () => {
		const result = decideCapability({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			token: "host:totally.fake",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(result.granted).toBe(false)
		expect(result.reasonCode).toBe("denied-unknown-capability")
		expect(result.knownToHost).toBe(false)
	})

	test("built-in baseline grant for a low-risk token is granted", () => {
		const result = decideCapability({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			token: "host:command.register",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(result.granted).toBe(true)
		expect(result.reasonCode).toBe("granted-builtin-baseline")
		expect(result.knownToHost).toBe(true)
	})

	test("built-in never-auto-grant token requires explicit grant", () => {
		const result = decideCapability({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			token: "host:browser.lane-control",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(result.granted).toBe(false)
		expect(result.reasonCode).toBe("denied-never-auto-grant")
	})

	test("explicit grant bypasses the never-auto-grant list", () => {
		const result = decideCapability({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			token: "host:browser.lane-control",
			sessionScope: "session",
			grantedTokens: ["host:browser.lane-control"],
		})
		expect(result.granted).toBe(true)
		expect(result.reasonCode).toBe("granted-explicit")
	})

	test("unsigned third-party can only request low-risk capabilities", () => {
		const allowed = decideCapability({
			pluginId: "acme.acme-notebook",
			trust: "unsigned-third-party",
			token: "host:ui.read",
			sessionScope: "session",
			grantedTokens: ["host:ui.read"],
		})
		expect(allowed.granted).toBe(true)

		const blocked = decideCapability({
			pluginId: "acme.acme-notebook",
			trust: "unsigned-third-party",
			token: "host:bridge.session-write",
			sessionScope: "session",
			grantedTokens: ["host:bridge.session-write"],
		})
		expect(blocked.granted).toBe(false)
		expect(blocked.reasonCode).toBe("denied-third-party-unsigned-medium")
	})

	test("disabled plugin denies every token", () => {
		const result = decideCapability({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			token: "host:command.register",
			sessionScope: "session",
			grantedTokens: ["host:command.register"],
			pluginDisabled: true,
		})
		expect(result.granted).toBe(false)
		expect(result.reasonCode).toBe("denied-disabled")
	})
})

describe("decideCapabilityAll", () => {
	test("returns granted=true when every token is granted", () => {
		const result = decideCapabilityAll({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			tokens: ["host:command.register", "host:tool.register"],
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(result.granted).toBe(true)
		expect(result.failures).toHaveLength(0)
	})

	test("returns granted=false with the failure list when any token is missing", () => {
		const result = decideCapabilityAll({
			pluginId: "firefly.built-in.test",
			trust: "built-in",
			tokens: ["host:command.register", "host:browser.lane-control"],
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(result.granted).toBe(false)
		expect(result.failures.length).toBeGreaterThan(0)
	})
})

describe("builtInBaselineGrants", () => {
	test("returns the closed built-in baseline set", () => {
		const tokens = builtInBaselineGrants("built-in")
		expect(tokens).toContain("host:command.register")
		expect(tokens).toContain("host:tool.register")
		expect(tokens).toContain("host:panel.register")
	})

	test("returns empty for any non-built-in trust", () => {
		expect(builtInBaselineGrants("local-dev")).toEqual([])
		expect(builtInBaselineGrants("signed-third-party")).toEqual([])
		expect(builtInBaselineGrants("unsigned-third-party")).toEqual([])
	})
})
