import { describe, expect, test } from "bun:test"
import {
	V2_RISK_REGISTER,
	highSeverityRisks,
	riskEntrySchema,
} from "./risk-register"

const REQUIRED_HIGH_RISK_TITLES = [
	"bridge version skew",
	"react singleton drift",
	"crash loops",
	"permission fatigue",
	"theme precedence bugs",
	"attached-server ambiguity",
] as const

describe("risk-register", () => {
	test("register contains every high-severity risk the V2 plan must-have names", () => {
		const titles = V2_RISK_REGISTER.map((r) => r.title.toLowerCase())
		for (const required of REQUIRED_HIGH_RISK_TITLES) {
			expect(titles.some((t) => t.includes(required))).toBe(true)
		}
	})

	test("every high-severity risk has both mitigation and fallback (no orphan risk)", () => {
		const high = highSeverityRisks()
		expect(high.length).toBeGreaterThan(0)
		for (const r of high) {
			expect(r.mitigation.length).toBeGreaterThan(0)
			expect(r.fallback.length).toBeGreaterThan(0)
			expect(r.detection.length).toBeGreaterThan(0)
		}
	})

	test("critical severity risks (R-vsix-runtime-shim) are present", () => {
		const critical = V2_RISK_REGISTER.filter((r) => r.severity === "critical")
		expect(critical.map((r) => r.id)).toContain("R-vsix-runtime-shim")
	})

	test("marketplace-creep risk is high severity and locks operator surface flags", () => {
		const m = V2_RISK_REGISTER.find((r) => r.id === "R-marketplace-creep")
		expect(m).toBeDefined()
		expect(m?.severity).toBe("high")
		expect(m?.mitigation).toContain("includesMarketplaceBrowse")
	})

	test("AI cost attribution is high severity (not deferred)", () => {
		const r = V2_RISK_REGISTER.find((r) => r.id === "R-AI-cost-attribution")
		expect(r).toBeDefined()
		expect(r?.severity).toBe("high")
	})

	test("riskEntrySchema rejects unknown fields (strict)", () => {
		const r = riskEntrySchema.safeParse({ ...V2_RISK_REGISTER[0], extra: "x" })
		expect(r.success).toBe(false)
	})

	test("riskEntrySchema rejects invalid severity enum", () => {
		const r = riskEntrySchema.safeParse({ ...V2_RISK_REGISTER[0], severity: "extreme" })
		expect(r.success).toBe(false)
	})

	test("every risk has a unique id", () => {
		const ids = V2_RISK_REGISTER.map((r) => r.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	test("highSeverityRisks includes critical risks too", () => {
		const hs = highSeverityRisks()
		const critical = V2_RISK_REGISTER.filter((r) => r.severity === "critical")
		for (const c of critical) {
			expect(hs.some((r) => r.id === c.id)).toBe(true)
		}
	})

	test("storage scope collision risk is medium severity (deferrable but tracked)", () => {
		const r = V2_RISK_REGISTER.find((r) => r.id === "R-storage-collision")
		expect(r).toBeDefined()
		expect(r?.severity).toBe("medium")
	})

	test("telemetry overrun risk names the per-plugin event rate limit", () => {
		const r = V2_RISK_REGISTER.find((r) => r.id === "R-telemetry-overrun")
		expect(r).toBeDefined()
		expect(r?.mitigation).toContain("rate limit")
	})

	test("register covers all 5 categories", () => {
		const cats = new Set(V2_RISK_REGISTER.map((r) => r.category))
		for (const c of ["technical", "trust", "runtime", "ui", "scope"] as const) {
			expect(cats.has(c)).toBe(true)
		}
	})
})
