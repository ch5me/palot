import { expect, mock, test } from "bun:test"

mock.module("../../lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

const { describeGenUiEntry, parseGenUiProps } = await import("../registry")
const { DecisionCardEntry } = await import("../components/decision-card")

test("decision card entry validates props", () => {
	const parsed = parseGenUiProps(DecisionCardEntry, {
		title: "Pick",
		options: [{ id: "opt_a", label: "A" }],
		selected: null,
		notes: "",
	})
	expect(parsed.ok).toBe(true)
})

test("decision card describe includes events, state, conflict policy", () => {
	const described = describeGenUiEntry("decision_card")
	expect(described).toBeDefined()
	expect(described?.schema).toEqual(
		expect.objectContaining({
			events: expect.objectContaining({ submit: expect.anything() }),
			state: expect.objectContaining({ notes: expect.anything() }),
			conflictPolicy: "ask",
		}),
	)
})
