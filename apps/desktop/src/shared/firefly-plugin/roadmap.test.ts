import { describe, expect, test } from "bun:test"
import {
	V2_NON_GOALS,
	V2_ROADMAP,
	milestoneSchema,
	nextPromotableMilestone,
} from "./roadmap"

describe("roadmap", () => {
	test("M1 is the first milestone (source-of-truth locked first)", () => {
		expect(V2_ROADMAP[0]?.id).toBe("M1-source-of-truth")
		expect(V2_ROADMAP[0]?.status).toBe("promoted")
	})

	test("M1 has no blockers (it is the seed milestone)", () => {
		expect(V2_ROADMAP[0]?.blockedBy).toEqual([])
	})

	test("M2 is the second milestone and blocked only by M1", () => {
		const m2 = V2_ROADMAP.find((m) => m.id === "M2-first-vertical-slice")
		expect(m2).toBeDefined()
		expect(m2?.blockedBy).toEqual(["M1-source-of-truth"])
	})

	test("M2 must precede M6 (third-party depends on first vertical slice)", () => {
		const m6 = V2_ROADMAP.find((m) => m.id === "M6-third-party")
		expect(m6?.blockedBy).toContain("M2-first-vertical-slice")
	})

	test("M10 release gates require M2, M3, M7, M9 to be promoted", () => {
		const m10 = V2_ROADMAP.find((m) => m.id === "M10-release-gates")
		expect(m10?.blockedBy).toEqual(
			expect.arrayContaining([
				"M2-first-vertical-slice",
				"M3-bridge-projection",
				"M7-operator-ui",
				"M9-perf-and-quotas",
			]),
		)
	})

	test("every milestone has at least one gate and an explicit summary", () => {
		for (const m of V2_ROADMAP) {
			expect(m.gates.length).toBeGreaterThan(0)
			expect(m.summary.length).toBeGreaterThan(0)
		}
	})

	test("milestoneSchema rejects unknown fields (strict)", () => {
		const r = milestoneSchema.safeParse({ ...V2_ROADMAP[0], extra: "x" })
		expect(r.success).toBe(false)
	})

	test("V2_NON_GOALS locks marketplace OUT of scope (lock-in-source)", () => {
		expect(V2_NON_GOALS.some((g) => g.includes("marketplace"))).toBe(true)
		expect(V2_NON_GOALS.some((g) => g.includes("vscode runtime shim"))).toBe(true)
		expect(V2_NON_GOALS.some((g) => g.includes("theme-studio"))).toBe(true)
		expect(V2_NON_GOALS.some((g) => g.includes("first-party bypass"))).toBe(true)
	})

	test("V2_NON_GOALS explicitly names first-party uses the SAME runtime path", () => {
		const firstParty = V2_NON_GOALS.find((g) => g.includes("first-party bypass"))
		expect(firstParty).toBeDefined()
		expect(firstParty).toContain("SAME runtime path")
	})

	test("nextPromotableMilestone returns M2 (M1 already promoted)", () => {
		const next = nextPromotableMilestone()
		expect(next?.id).toBe("M2-first-vertical-slice")
	})

	test("nextPromotableMilestone returns M3 if M2 is promoted", () => {
		const promoted = V2_ROADMAP.map((m) =>
			m.id === "M2-first-vertical-slice" ? { ...m, status: "promoted" as const } : m,
		)
		const next = nextPromotableMilestone(promoted)
		expect(next?.id).toBe("M3-bridge-projection")
	})

	test("nextPromotableMilestone returns null if all blockers satisfied but no other milestone exists", () => {
		const everything = V2_ROADMAP.map((m) => ({ ...m, status: "promoted" as const }))
		const next = nextPromotableMilestone(everything)
		expect(next).toBeNull()
	})

	test("roadmap order is M1, M2, M3, M4, M5, M6, M7, M8, M9, M10 (architecture-first)", () => {
		expect(V2_ROADMAP.map((m) => m.id)).toEqual([
			"M1-source-of-truth",
			"M2-first-vertical-slice",
			"M3-bridge-projection",
			"M4-renderer-projection",
			"M5-themes",
			"M6-third-party",
			"M7-operator-ui",
			"M8-vscode-import-gate",
			"M9-perf-and-quotas",
			"M10-release-gates",
		])
	})
})
