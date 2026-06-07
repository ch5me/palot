import { describe, expect, test } from "bun:test"

import {
	BUILT_IN_DEFAULT_CAPABILITIES,
	CAPABILITY_CATALOG,
	HOST_CAPABILITIES,
	NEVER_AUTO_GRANT,
	PRIMITIVE_CAPABILITIES,
	RISK_ORDER,
	evaluateBrokerRequest,
	isKnownCapability,
	lookupCapability,
} from "./capabilities"

describe("CAPABILITY_CATALOG", () => {
	test("contains every primitive class", () => {
		expect(Object.keys(PRIMITIVE_CAPABILITIES).length).toBeGreaterThan(0)
		for (const [token, cls] of Object.entries(PRIMITIVE_CAPABILITIES)) {
			expect(token.startsWith(`${cls.group}:`)).toBe(true)
		}
	})

	test("contains every host class", () => {
		expect(Object.keys(HOST_CAPABILITIES).length).toBeGreaterThan(0)
		for (const [token, cls] of Object.entries(HOST_CAPABILITIES)) {
			expect(token.startsWith(`${cls.group}:`)).toBe(true)
		}
	})

	test("catalog is the union of primitives and host classes", () => {
		const union = { ...PRIMITIVE_CAPABILITIES, ...HOST_CAPABILITIES }
		expect(Object.keys(CAPABILITY_CATALOG).sort()).toEqual(Object.keys(union).sort())
	})

	test("every token has a valid risk classification", () => {
		for (const cls of Object.values(CAPABILITY_CATALOG)) {
			expect(["low", "medium", "high", "critical"]).toContain(cls.risk)
		}
	})
})

describe("lookupCapability", () => {
	test("returns metadata for a known host capability", () => {
		const cls = lookupCapability("host:browser.lane-control")
		expect(cls).not.toBeNull()
		expect(cls?.group).toBe("host")
		expect(cls?.risk).toBe("high")
	})

	test("returns null for an unknown capability", () => {
		expect(lookupCapability("host:made-up.thing")).toBeNull()
	})

	test("isKnownCapability narrows the type", () => {
		expect(isKnownCapability("host:tool.register")).toBe(true)
		expect(isKnownCapability("host:nope")).toBe(false)
	})
})

describe("evaluateBrokerRequest", () => {
	test("denies unknown capability outright", () => {
		const d = evaluateBrokerRequest({
			token: "host:does.not.exist",
			trust: "built-in",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(d.granted).toBe(false)
		expect(d.reason).toContain("unknown")
	})

	test("built-in plugins get the baseline grant for low/medium-risk host caps", () => {
		const d = evaluateBrokerRequest({
			token: "host:command.register",
			trust: "built-in",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(d.granted).toBe(true)
	})

	test("built-in plugins do NOT auto-grant NEVER_AUTO_GRANT tokens", () => {
		for (const token of NEVER_AUTO_GRANT) {
			const d = evaluateBrokerRequest({
				token,
				trust: "built-in",
				sessionScope: "session",
				grantedTokens: [],
			})
			expect(d.granted).toBe(false)
			expect(d.reason.toLowerCase()).toContain("explicit")
		}
	})

	test("critical-risk tokens always require explicit grant", () => {
		const d = evaluateBrokerRequest({
			token: "shell:exec",
			trust: "built-in",
			sessionScope: "session",
			grantedTokens: ["shell:exec"],
		})
		expect(d.granted).toBe(true)
		const d2 = evaluateBrokerRequest({
			token: "shell:exec",
			trust: "built-in",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(d2.granted).toBe(false)
	})

	test("unsigned-third-party cannot request high-risk tokens", () => {
		const d = evaluateBrokerRequest({
			token: "host:browser.lane-control",
			trust: "unsigned-third-party",
			sessionScope: "session",
			grantedTokens: ["host:browser.lane-control"],
		})
		expect(d.granted).toBe(false)
		expect(d.reason).toContain("low-risk")
	})

	test("unsigned-third-party can request low-risk tokens if explicitly granted", () => {
		const d = evaluateBrokerRequest({
			token: "host:ui.read",
			trust: "unsigned-third-party",
			sessionScope: "session",
			grantedTokens: ["host:ui.read"],
		})
		expect(d.granted).toBe(true)
	})

	test("local-dev requires explicit grant for every token", () => {
		const d = evaluateBrokerRequest({
			token: "host:command.register",
			trust: "local-dev",
			sessionScope: "session",
			grantedTokens: [],
		})
		expect(d.granted).toBe(false)
		const d2 = evaluateBrokerRequest({
			token: "host:command.register",
			trust: "local-dev",
			sessionScope: "session",
			grantedTokens: ["host:command.register"],
		})
		expect(d2.granted).toBe(true)
	})

	test("signed-third-party requires explicit grant for every token", () => {
		const d = evaluateBrokerRequest({
			token: "host:theme.apply",
			trust: "signed-third-party",
			sessionScope: "app",
			grantedTokens: [],
		})
		expect(d.granted).toBe(false)
	})
})

describe("BUILT_IN_DEFAULT_CAPABILITIES", () => {
	test("contains only known tokens", () => {
		for (const t of BUILT_IN_DEFAULT_CAPABILITIES) {
			expect(isKnownCapability(t)).toBe(true)
		}
	})

	test("does NOT include NEVER_AUTO_GRANT tokens", () => {
		for (const t of BUILT_IN_DEFAULT_CAPABILITIES) {
			expect(NEVER_AUTO_GRANT.includes(t)).toBe(false)
		}
	})
})

describe("RISK_ORDER", () => {
	test("ranks risks in the expected order", () => {
		expect(RISK_ORDER.low).toBeLessThan(RISK_ORDER.medium)
		expect(RISK_ORDER.medium).toBeLessThan(RISK_ORDER.high)
		expect(RISK_ORDER.high).toBeLessThan(RISK_ORDER.critical)
	})
})
