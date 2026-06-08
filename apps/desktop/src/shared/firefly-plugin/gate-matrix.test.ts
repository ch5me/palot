import { describe, expect, test } from "bun:test"
import {
	V2_GATE_MATRIX,
	blockingObligations,
	gateObligationSchema,
	obligationsForStream,
} from "./gate-matrix"

describe("gate-matrix", () => {
	test("every stream has at least one obligation (no orphan stream)", () => {
		for (const stream of ["runtime", "bridge", "renderer", "theme"] as const) {
			const items = obligationsForStream(stream)
			expect(items.length).toBeGreaterThan(0)
		}
	})

	test("every tier has at least one obligation (no orphan tier)", () => {
		const localCount = V2_GATE_MATRIX.filter((g) => g.tier === "local").length
		const preMergeCount = V2_GATE_MATRIX.filter((g) => g.tier === "pre-merge").length
		const releaseCount = V2_GATE_MATRIX.filter((g) => g.tier === "release").length
		expect(localCount).toBeGreaterThan(0)
		expect(preMergeCount).toBeGreaterThan(0)
		expect(releaseCount).toBeGreaterThan(0)
	})

	test("local tier does not block merge; pre-merge and release tiers do", () => {
		for (const g of V2_GATE_MATRIX) {
			if (g.tier === "local") {
				expect(g.blocksMerge).toBe(false)
			} else {
				expect(g.blocksMerge).toBe(true)
			}
		}
	})

	test("blockingObligations returns pre-merge and release gates only", () => {
		const blocking = blockingObligations("pre-merge")
		expect(blocking.every((g) => g.blocksMerge && g.tier === "pre-merge")).toBe(true)
		const releaseBlocking = blockingObligations("release")
		expect(releaseBlocking.every((g) => g.blocksMerge && g.tier === "release")).toBe(true)
	})

	test("every obligation has a non-empty command and module", () => {
		for (const g of V2_GATE_MATRIX) {
			expect(g.command.length).toBeGreaterThan(0)
			expect(g.module.length).toBeGreaterThan(0)
		}
	})

	test("commands are grounded in real repo commands (tsgo + bun test + bun run lint)", () => {
		const allCommands = V2_GATE_MATRIX.map((g) => g.command).join("\n")
		expect(allCommands).toContain("bunx tsgo --noEmit")
		expect(allCommands).toContain("bun test")
	})

	test("runtime / pre-merge obligation references the canonical modules", () => {
		const runtimePreMerge = V2_GATE_MATRIX.filter(
			(g) => g.stream === "runtime" && g.tier === "pre-merge",
		)
		const modules = runtimePreMerge.map((g) => g.module)
		expect(modules).toContain("manifest")
		expect(modules).toContain("hot-reload")
		expect(modules).toContain("first-party-migration")
	})

	test("theme / release obligation references roadmap M5-themes", () => {
		const themeRelease = V2_GATE_MATRIX.filter(
			(g) => g.stream === "theme" && g.tier === "release",
		)
		expect(themeRelease.some((g) => g.command.includes("M5-themes"))).toBe(true)
	})

	test("gateObligationSchema rejects unknown fields (strict)", () => {
		const r = gateObligationSchema.safeParse({ ...V2_GATE_MATRIX[0], extra: "x" })
		expect(r.success).toBe(false)
	})

	test("gateObligationSchema rejects invalid stream enum", () => {
		const r = gateObligationSchema.safeParse({ ...V2_GATE_MATRIX[0], stream: "ui" })
		expect(r.success).toBe(false)
	})

	test("every (tier, stream) combination has at least one obligation", () => {
		const tiers = ["local", "pre-merge", "release"] as const
		const streams = ["runtime", "bridge", "renderer", "theme"] as const
		for (const t of tiers) {
			for (const s of streams) {
				const items = V2_GATE_MATRIX.filter((g) => g.tier === t && g.stream === s)
				expect(items.length).toBeGreaterThan(0)
			}
		}
	})
})
