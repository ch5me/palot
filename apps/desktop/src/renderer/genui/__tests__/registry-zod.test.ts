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
	expect(describeGenUiEntry("dag-sparkline")).toBeDefined()
})

test("describeGenUiEntry returns undefined for unknown components", () => {
	expect(describeGenUiEntry("unknown")).toBeUndefined()
})
