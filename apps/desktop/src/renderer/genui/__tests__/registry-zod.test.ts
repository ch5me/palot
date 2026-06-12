import { expect, mock, test } from "bun:test"
import { z } from "zod"

mock.module("../../lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

const {
	describeGenUiEntry,
	parseGenUiProps,
} = await import("../registry")
const { DagSparklineEntry } = await import("../components/dag-sparkline")
const { DecisionCardEntry } = await import("../components/decision-card")
const { StatusThinkingCardEntry } = await import("../components/status-thinking-card")

test("DagSparklineEntry props uses zod schema", () => {
	expect(DagSparklineEntry.props).toBeInstanceOf(z.ZodType)
})

test("DagSparklineEntry declares dag legacy fence", () => {
	expect(DagSparklineEntry.legacyFences).toEqual([{ fence: "dag", parseBody: expect.any(Function) }])
})

test("parseGenUiProps accepts valid dag sparkline props", () => {
	const parsed = parseGenUiProps(DagSparklineEntry, {
		nodes: [{ id: "plan", label: "Plan" }],
		edges: [],
	})
	expect(parsed.ok).toBe(true)
})

test("parseGenUiProps rejects invalid dag sparkline props", () => {
	const parsed = parseGenUiProps(DagSparklineEntry, {
		nodes: [{ label: "Plan" }],
		edges: [],
	})
	expect(parsed.ok).toBe(false)
})

test("describeGenUiEntry returns dag sparkline metadata", () => {
	expect(describeGenUiEntry("dag-sparkline")?.schema).toEqual(
		expect.objectContaining({
			presentation: "inline-artifact",
			scope: "generic",
			maturity: "stable",
			defaultPlacement: "inline",
			allowedPlacements: ["inline", "chat-inline-right", "side-panel"],
			sourcePackage: "@ch5me/dag-sparkline",
		}),
	)
})

test("DecisionCardEntry exposes event/state metadata", () => {
	expect(DecisionCardEntry.events.submit).toBeDefined()
	expect(DecisionCardEntry.state.notes).toBeDefined()
	expect(DecisionCardEntry.conflictPolicy).toBe("ask")
	expect(DecisionCardEntry.presentation).toBe("inline-artifact")
	expect(DecisionCardEntry.scope).toBe("generic")
})

test("StatusThinkingCardEntry validates props and declares Storybook source", () => {
	const parsed = parseGenUiProps(StatusThinkingCardEntry, {
		title: "Work",
		status: "running",
		steps: [{ id: "scan", label: "Scan", state: "running" }],
	})
	expect(parsed.ok).toBe(true)
	expect(StatusThinkingCardEntry.storybookPath).toBe(
		"packages/web/remotion-experiences/src/spikes/StatusThinkingCard.stories.tsx",
	)
	expect(describeGenUiEntry("status-thinking-card")?.schema).toEqual(
		expect.objectContaining({
			presentation: "inline-artifact",
			scope: "generic",
			maturity: "beta",
			sourcePackage: "@ch5me/remotion-experiences",
		}),
	)
})

test("describeGenUiEntry returns undefined for unknown components", () => {
	expect(describeGenUiEntry("unknown")).toBeUndefined()
})
