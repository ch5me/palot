import { expect, test } from "bun:test"

import { decode, encode } from "../toon"

test("round-trips primitive scalars", () => {
	expect(decode(encode("alpha"))).toBe("alpha")
	expect(decode(encode(42))).toBe(42)
	expect(decode(encode(true))).toBe(true)
	expect(decode(encode(null))).toBeNull()
})

test("round-trips flat arrays", () => {
	const value = ["alpha", 2, false, null]
	expect(decode(encode(value))).toEqual(value)
})

test("round-trips objects with array values", () => {
	const value = {
		name: "dag-sparkline",
		enabled: true,
		tags: ["diagram", "genui"],
		counts: [1, 2, 3],
	}
	expect(decode(encode(value))).toEqual(value)
})

test("round-trips tabular arrays of objects", () => {
	const value = {
		components: [
			{ name: "dag-sparkline", one_line: "Render DAG with node + edge props", category: "diagram" },
			{ name: "other", one_line: "Another", category: "custom" },
		],
	}
	expect(decode(encode(value))).toEqual(value)
})

test("round-trips object payloads through JSON fallback", () => {
	const value = {
		tree: {
			id: "root",
			component: "dag-sparkline",
			props: {
				nodes: [{ id: "plan", label: "Plan" }],
				edges: [],
			},
		},
	}
	expect(decode(encode(value))).toEqual(value)
})

test("throws on malformed input", () => {
	expect(() => decode("components[2]:\n  alpha")).toThrow("count mismatch")
})
