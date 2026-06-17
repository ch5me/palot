import { describe, expect, it } from "bun:test"

import { computeInstallConsentPlan, consentPlanToGrantRecords } from "./install-consent"

const caps = (p: { autoGrant: readonly { capability: string }[]; needsConsent: readonly { capability: string }[] }) => ({
	auto: p.autoGrant.map((i) => i.capability).sort(),
	consent: p.needsConsent.map((i) => i.capability).sort(),
})

describe("computeInstallConsentPlan", () => {
	it("third-party: low auto-granted, medium/high/critical need consent", () => {
		const plan = computeInstallConsentPlan({
			trust: "signed-third-party",
			// net:https-only=low, net:http=medium, fs:write=high, shell:exec=critical
			capabilities: ["net:https-only", "net:http", "fs:write", "shell:exec"],
		})
		expect(caps(plan)).toEqual({
			auto: ["net:https-only"],
			consent: ["fs:write", "net:http", "shell:exec"],
		})
	})

	it("built-in: all non-critical auto-granted, critical still needs consent", () => {
		const plan = computeInstallConsentPlan({
			trust: "built-in",
			capabilities: ["net:http", "fs:write", "shell:exec"],
		})
		expect(caps(plan)).toEqual({
			auto: ["fs:write", "net:http"],
			consent: ["shell:exec"],
		})
	})

	it("unknown capabilities always need consent (never silently granted)", () => {
		const plan = computeInstallConsentPlan({ trust: "built-in", capabilities: ["totally:made-up"] })
		expect(plan.autoGrant).toEqual([])
		expect(plan.needsConsent.map((i) => i.capability)).toEqual(["totally:made-up"])
		expect(plan.needsConsent[0]?.knownToHost).toBe(false)
	})

	it("dedupes repeated capabilities", () => {
		const plan = computeInstallConsentPlan({ trust: "built-in", capabilities: ["fs:read", "fs:read"] })
		expect(plan.autoGrant.length).toBe(1)
	})
})

describe("consentPlanToGrantRecords", () => {
	it("auto-grants persist as granted; needs-consent as prompt-required until consented", () => {
		const plan = computeInstallConsentPlan({
			trust: "signed-third-party",
			capabilities: ["net:https-only", "net:http"],
		})
		const records = consentPlanToGrantRecords({
			plan,
			pluginId: "p.x",
			scope: "app",
			scopeId: null,
			consentedCapabilities: ["net:http"],
		})
		const byCap = Object.fromEntries(records.map((r) => [r.capability, r]))
		expect(byCap["net:https-only"]?.grantState).toBe("granted")
		expect(byCap["net:https-only"]?.grantedBy).toBe("builtin-policy")
		expect(byCap["net:http"]?.grantState).toBe("granted")
		expect(byCap["net:http"]?.grantedBy).toBe("user")
	})

	it("un-consented medium/high capabilities stay prompt-required", () => {
		const plan = computeInstallConsentPlan({ trust: "signed-third-party", capabilities: ["fs:write"] })
		const records = consentPlanToGrantRecords({ plan, pluginId: "p.y", scope: "app", scopeId: null })
		expect(records[0]?.grantState).toBe("prompt-required")
	})
})
