import { describe, expect, test } from "bun:test"

import {
	classifyFeasibility,
	isVerdictAccepted,
	SAMPLE_VSCODE_IMPORT_VERDICTS,
	VSCODE_IMPORT_FEASIBILITY_TIERS,
	VSCODE_IMPORT_STANCE,
	VSCODE_IMPORT_TIER_CRITERIA,
	vscodeImportFeasibilitySchema,
	vscodeImportFeasibilityTierSchema,
	vscodeImportRejectionReasonSchema,
} from "./vscode-import"

describe("VSCODE_IMPORT_FEASIBILITY_TIERS vocabulary", () => {
	test("contains the four locked tiers in canonical order", () => {
		expect(VSCODE_IMPORT_FEASIBILITY_TIERS).toEqual(["green", "yellow", "orange", "red"])
	})

	test("vscodeImportFeasibilityTierSchema accepts each locked tier and rejects unknown", () => {
		for (const tier of VSCODE_IMPORT_FEASIBILITY_TIERS) {
			expect(vscodeImportFeasibilityTierSchema.parse(tier)).toBe(tier)
		}
		expect(vscodeImportFeasibilityTierSchema.safeParse("purple").success).toBe(false)
	})
})

describe("VSCODE_IMPORT_STANCE", () => {
	test("architecture is classifier + transpile-only", () => {
		expect(VSCODE_IMPORT_STANCE.architecture).toBe("classifier + transpile-only")
	})

	test("runtimeShim is false (V2 forbids it)", () => {
		expect(VSCODE_IMPORT_STANCE.runtimeShim).toBe(false)
	})

	test("hiddenSidecar is false (V2 forbids it)", () => {
		expect(VSCODE_IMPORT_STANCE.hiddenSidecar).toBe(false)
	})

	test("transpileContract is vscode.d.ts and the target is a V2 manifest", () => {
		expect(VSCODE_IMPORT_STANCE.transpileContract).toBe("vscode.d.ts")
		expect(VSCODE_IMPORT_STANCE.transpileTarget).toBe("firefly.plugin/v2 manifest")
	})

	test("notes explicitly reject the runtime shim and the hidden sidecar", () => {
		const joined = VSCODE_IMPORT_STANCE.notes.join("\n")
		expect(joined).toMatch(/runtime shim/i)
		expect(joined).toMatch(/hidden sidecar/i)
		expect(joined).toMatch(/no partial-load/i)
	})
})

describe("VSCODE_IMPORT_TIER_CRITERIA", () => {
	test("contains the locked set of criteria", () => {
		const criteria = VSCODE_IMPORT_TIER_CRITERIA.map((c) => c.criterion)
		expect(criteria).toContain("VS Code API surface used")
		expect(criteria).toContain("Native dependencies declared in package.json")
		expect(criteria).toContain("Tree-shake-friendly main entry")
		expect(criteria).toContain("State persistence")
		expect(criteria).toContain("Activation event shape")
	})

	test("every criterion row has a non-empty description for every tier", () => {
		for (const row of VSCODE_IMPORT_TIER_CRITERIA) {
			for (const tier of VSCODE_IMPORT_FEASIBILITY_TIERS) {
				expect(row[tier].length).toBeGreaterThan(0)
			}
		}
	})
})

describe("classifyFeasibility", () => {
	test("empty observations -> green verdict", () => {
		const verdict = classifyFeasibility({ observations: [] })
		expect(verdict.tier).toBe("green")
		expect(verdict.rejectionReasons).toEqual([])
	})

	test("single yellow observation -> yellow verdict", () => {
		const verdict = classifyFeasibility({
			observations: [
				{
					criterion: "Native dependencies declared in package.json",
					observed: "One optional native dep.",
					tier: "yellow",
				},
			],
		})
		expect(verdict.tier).toBe("yellow")
		expect(verdict.rejectionReasons).toHaveLength(1)
	})

	test("multiple observations pick the worst tier", () => {
		const verdict = classifyFeasibility({
			observations: [
				{ criterion: "State persistence", observed: "ok", tier: "green" },
				{
					criterion: "VS Code API surface used",
					observed: "uses webview",
					tier: "orange",
				},
				{
					criterion: "Native dependencies declared in package.json",
					observed: "requires native",
					tier: "red",
				},
			],
		})
		expect(verdict.tier).toBe("red")
		expect(verdict.rejectionReasons).toHaveLength(2)
	})

	test("the verdict always reports transpileOnly=true and runtimeShim=false", () => {
		const verdict = classifyFeasibility({
			observations: [
				{ criterion: "State persistence", observed: "writes to disk", tier: "red" },
			],
		})
		expect(verdict.transpileOnly).toBe(true)
		expect(verdict.runtimeShim).toBe(false)
		expect(verdict.hiddenSidecar).toBe(false)
	})

	test("the verdict is parseable by the Zod schema", () => {
		const verdict = classifyFeasibility({
			observations: [
				{ criterion: "Activation event shape", observed: "*", tier: "red" },
			],
		})
		expect(() => vscodeImportFeasibilitySchema.parse(verdict)).not.toThrow()
	})
})

describe("vscodeImportRejectionReasonSchema", () => {
	test("rejects an unknown tier", () => {
		expect(
			vscodeImportRejectionReasonSchema.safeParse({
				criterion: "x",
				observed: "y",
				tier: "purple",
				mitigation: "z",
			}).success,
		).toBe(false)
	})
})

describe("SAMPLE_VSCODE_IMPORT_VERDICTS", () => {
	test("covers all four tiers", () => {
		for (const tier of VSCODE_IMPORT_FEASIBILITY_TIERS) {
			expect(SAMPLE_VSCODE_IMPORT_VERDICTS[tier].tier).toBe(tier)
		}
	})
})

describe("isVerdictAccepted", () => {
	test("green is accepted", () => {
		expect(isVerdictAccepted(SAMPLE_VSCODE_IMPORT_VERDICTS.green)).toBe(true)
	})

	test("yellow is gated (not accepted outright)", () => {
		expect(isVerdictAccepted(SAMPLE_VSCODE_IMPORT_VERDICTS.yellow)).toBe(false)
	})

	test("orange is gated", () => {
		expect(isVerdictAccepted(SAMPLE_VSCODE_IMPORT_VERDICTS.orange)).toBe(false)
	})

	test("red is rejected", () => {
		expect(isVerdictAccepted(SAMPLE_VSCODE_IMPORT_VERDICTS.red)).toBe(false)
	})
})
