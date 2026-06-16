import { describe, expect, test } from "bun:test"

import {
	assertGreenProbe,
	classifyFromProbe,
	GREEN_TIER_VSCODE_API_NAMESPACES,
	ORANGE_TIER_TOKENS,
	probeToObservations,
	RED_TIER_TOKENS,
	YELLOW_TIER_WINDOW_TOKENS,
	vscodeCompatibilityProbeSchema,
	VscodeProbeRejectedError,
	type VscodeCompatibilityProbe,
} from "./vscode-probe"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe("vscodeCompatibilityProbeSchema", () => {
	test("accepts a minimal valid probe", () => {
		const probe: VscodeCompatibilityProbe = {
			vscodeEngineRange: "^1.85.0",
			extensionKind: ["web"],
			activationEvents: ["onCommand:myext.doThing"],
			contributionPoints: ["commands"],
			apiUsage: [],
			nativeDependencyRisk: "none",
		}
		expect(() => vscodeCompatibilityProbeSchema.parse(probe)).not.toThrow()
	})

	test("rejects missing required fields", () => {
		expect(
			vscodeCompatibilityProbeSchema.safeParse({ vscodeEngineRange: "^1.0.0" }).success,
		).toBe(false)
	})

	test("rejects unknown nativeDependencyRisk values", () => {
		const result = vscodeCompatibilityProbeSchema.safeParse({
			vscodeEngineRange: "^1.0.0",
			extensionKind: ["web"],
			activationEvents: [],
			contributionPoints: [],
			apiUsage: [],
			nativeDependencyRisk: "extreme",
		})
		expect(result.success).toBe(false)
	})

	test("rejects unknown extensionKind values", () => {
		const result = vscodeCompatibilityProbeSchema.safeParse({
			vscodeEngineRange: "^1.0.0",
			extensionKind: ["editor"],
			activationEvents: [],
			contributionPoints: [],
			apiUsage: [],
			nativeDependencyRisk: "none",
		})
		expect(result.success).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Tier token lists
// ---------------------------------------------------------------------------

describe("tier token lists", () => {
	test("GREEN_TIER_VSCODE_API_NAMESPACES contains the canonical namespaces", () => {
		expect(GREEN_TIER_VSCODE_API_NAMESPACES).toContain("vscode.commands")
		expect(GREEN_TIER_VSCODE_API_NAMESPACES).toContain("vscode.window")
		expect(GREEN_TIER_VSCODE_API_NAMESPACES).toContain("vscode.workspace")
		expect(GREEN_TIER_VSCODE_API_NAMESPACES).toContain("vscode.languages")
	})

	test("RED_TIER_TOKENS contains debug, tasks, env.openExternal", () => {
		expect(RED_TIER_TOKENS).toContain("vscode.debug")
		expect(RED_TIER_TOKENS).toContain("vscode.tasks")
		expect(RED_TIER_TOKENS).toContain("vscode.env.openExternal")
	})

	test("ORANGE_TIER_TOKENS contains createWebviewPanel", () => {
		expect(ORANGE_TIER_TOKENS).toContain("vscode.window.createWebviewPanel")
	})

	test("YELLOW_TIER_WINDOW_TOKENS contains showInputBox and showQuickPick", () => {
		expect(YELLOW_TIER_WINDOW_TOKENS).toContain("vscode.window.showInputBox")
		expect(YELLOW_TIER_WINDOW_TOKENS).toContain("vscode.window.showQuickPick")
	})
})

// ---------------------------------------------------------------------------
// probeToObservations
// ---------------------------------------------------------------------------

function makeGreenProbe(overrides?: Partial<VscodeCompatibilityProbe>): VscodeCompatibilityProbe {
	return {
		vscodeEngineRange: "^1.85.0",
		extensionKind: ["web"],
		activationEvents: ["onCommand:myext.hello"],
		contributionPoints: ["commands"],
		apiUsage: [],
		nativeDependencyRisk: "none",
		...overrides,
	}
}

describe("probeToObservations", () => {
	test("clean probe -> empty observations", () => {
		const obs = probeToObservations(makeGreenProbe())
		expect(obs).toHaveLength(0)
	})

	test("red API usage -> one red observation", () => {
		const obs = probeToObservations(makeGreenProbe({ apiUsage: ["vscode.debug.startDebugging"] }))
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("red")
		expect(obs[0].criterion).toBe("VS Code API surface used")
		expect(obs[0].observed).toMatch(/vscode\.debug/)
	})

	test("orange API usage -> one orange observation", () => {
		const obs = probeToObservations(
			makeGreenProbe({ apiUsage: ["vscode.window.createWebviewPanel"] }),
		)
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("orange")
	})

	test("yellow API usage -> one yellow observation", () => {
		const obs = probeToObservations(
			makeGreenProbe({ apiUsage: ["vscode.window.showInputBox"] }),
		)
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("yellow")
	})

	test("red tier overrides yellow/orange when multiple APIs present", () => {
		const obs = probeToObservations(
			makeGreenProbe({
				apiUsage: ["vscode.window.showInputBox", "vscode.debug"],
			}),
		)
		// red check runs first, so we get the red observation
		const tiers = obs.map((o) => o.tier)
		expect(tiers).toContain("red")
	})

	test("required native deps -> red observation", () => {
		const obs = probeToObservations(makeGreenProbe({ nativeDependencyRisk: "required" }))
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("red")
		expect(obs[0].criterion).toBe("Native dependencies declared in package.json")
	})

	test("optional native deps -> yellow observation", () => {
		const obs = probeToObservations(makeGreenProbe({ nativeDependencyRisk: "optional" }))
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("yellow")
	})

	test("orange activation event -> orange observation", () => {
		const obs = probeToObservations(
			makeGreenProbe({ activationEvents: ["onCustomEditor:my.editor"] }),
		)
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("orange")
	})

	test("yellow activation event -> yellow observation", () => {
		const obs = probeToObservations(
			makeGreenProbe({ activationEvents: ["workspaceContains:**/.myrc"] }),
		)
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("yellow")
	})

	test("workspace-only extensionKind -> yellow observation", () => {
		const obs = probeToObservations(makeGreenProbe({ extensionKind: ["workspace"] }))
		expect(obs).toHaveLength(1)
		expect(obs[0].tier).toBe("yellow")
	})

	test("web extensionKind alone -> no extensionKind observation", () => {
		const obs = probeToObservations(makeGreenProbe({ extensionKind: ["web"] }))
		expect(obs).toHaveLength(0)
	})

	test("both web and workspace extensionKind -> no extensionKind observation (portable path exists)", () => {
		const obs = probeToObservations(makeGreenProbe({ extensionKind: ["workspace", "web"] }))
		// web is present so portable path exists; no extra observation
		expect(obs.find((o) => o.observed.includes("extensionKind"))).toBeUndefined()
	})

	test("multiple issues accumulate multiple observations", () => {
		const obs = probeToObservations(
			makeGreenProbe({
				apiUsage: ["vscode.window.showInputBox"],
				nativeDependencyRisk: "optional",
			}),
		)
		expect(obs.length).toBeGreaterThanOrEqual(2)
	})
})

// ---------------------------------------------------------------------------
// classifyFromProbe
// ---------------------------------------------------------------------------

describe("classifyFromProbe", () => {
	test("clean probe -> green verdict", () => {
		const verdict = classifyFromProbe(makeGreenProbe())
		expect(verdict.tier).toBe("green")
		expect(verdict.transpileOnly).toBe(true)
		expect(verdict.runtimeShim).toBe(false)
		expect(verdict.hiddenSidecar).toBe(false)
	})

	test("red API usage -> red verdict", () => {
		const verdict = classifyFromProbe(makeGreenProbe({ apiUsage: ["vscode.tasks"] }))
		expect(verdict.tier).toBe("red")
	})

	test("optional native deps -> yellow verdict", () => {
		const verdict = classifyFromProbe(makeGreenProbe({ nativeDependencyRisk: "optional" }))
		expect(verdict.tier).toBe("yellow")
	})

	test("orange API -> orange verdict", () => {
		const verdict = classifyFromProbe(
			makeGreenProbe({ apiUsage: ["vscode.languages.registerHoverProvider"] }),
		)
		expect(verdict.tier).toBe("orange")
	})

	test("verdict always has the transpile-only stance", () => {
		for (const api of ["vscode.debug", "vscode.window.createWebviewPanel", "vscode.window.showInputBox"]) {
			const verdict = classifyFromProbe(makeGreenProbe({ apiUsage: [api] }))
			expect(verdict.transpileOnly).toBe(true)
			expect(verdict.runtimeShim).toBe(false)
			expect(verdict.hiddenSidecar).toBe(false)
		}
	})
})

// ---------------------------------------------------------------------------
// VscodeProbeRejectedError
// ---------------------------------------------------------------------------

describe("VscodeProbeRejectedError", () => {
	test("contains the full verdict", () => {
		const verdict = classifyFromProbe(makeGreenProbe({ apiUsage: ["vscode.debug"] }))
		const err = new VscodeProbeRejectedError(verdict)
		expect(err.verdict).toBe(verdict)
		expect(err.name).toBe("VscodeProbeRejectedError")
		expect(err.message).toMatch(/tier=red/)
	})
})

// ---------------------------------------------------------------------------
// assertGreenProbe
// ---------------------------------------------------------------------------

describe("assertGreenProbe", () => {
	test("does not throw for a green probe", () => {
		expect(() => assertGreenProbe(makeGreenProbe())).not.toThrow()
	})

	test("throws VscodeProbeRejectedError for a red probe", () => {
		expect(() =>
			assertGreenProbe(makeGreenProbe({ apiUsage: ["vscode.debug.startDebugging"] })),
		).toThrow(VscodeProbeRejectedError)
	})

	test("throws VscodeProbeRejectedError for an orange probe", () => {
		expect(() =>
			assertGreenProbe(makeGreenProbe({ apiUsage: ["vscode.window.createWebviewPanel"] })),
		).toThrow(VscodeProbeRejectedError)
	})

	test("throws VscodeProbeRejectedError for a yellow probe (gated, not auto-accepted)", () => {
		expect(() =>
			assertGreenProbe(makeGreenProbe({ nativeDependencyRisk: "optional" })),
		).toThrow(VscodeProbeRejectedError)
	})

	test("error message names the tier and a criterion", () => {
		let err: VscodeProbeRejectedError | null = null
		try {
			assertGreenProbe(makeGreenProbe({ apiUsage: ["vscode.tasks"] }))
		} catch (e) {
			if (e instanceof VscodeProbeRejectedError) err = e
		}
		expect(err).not.toBeNull()
		expect(err?.message).toMatch(/tier=red/)
		expect(err?.message).toMatch(/VS Code API surface used/)
	})
})
