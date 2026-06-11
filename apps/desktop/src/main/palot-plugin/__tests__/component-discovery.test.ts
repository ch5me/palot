import { expect, test } from "bun:test"

import { encode as encodeToon } from "../../palot-runtime/toon"
import {
	describeComponentCatalogEntry,
	getComponentCatalogItems,
} from "../../palot-runtime/component-catalog"

function buildComponentsListHandler() {
	const items = getComponentCatalogItems()
	return async (args: { category?: string } = {}) => {
		const filtered =
			typeof args.category === "string"
				? items.filter((entry) => entry.category === args.category)
				: items
		return encodeToon({
			count: filtered.length,
			components: filtered.map((entry) => ({
				name: entry.name,
				one_line: entry.one_line,
				category: entry.category,
			})),
		})
	}
}

function buildComponentsDescribeHandler() {
	const items = getComponentCatalogItems()
	return async (args: { name?: string; category?: string } = {}) => {
		if (typeof args.name === "string") {
			const entry = describeComponentCatalogEntry(args.name)
			if (!entry) {
				return encodeToon({
					errorCode: "unknown_component",
					name: args.name,
					help: ["Run `palot components list` to see available components."],
				})
			}
			return encodeToon({
				name: entry.name,
				one_line: entry.one_line,
				category: entry.category,
				example: entry.example,
			})
		}
		const filtered =
			typeof args.category === "string"
				? items.filter((entry) => entry.category === args.category)
				: items
		return encodeToon({
			count: filtered.length,
			components: filtered.map((entry) => ({
				name: entry.name,
				one_line: entry.one_line,
				category: entry.category,
			})),
		})
	}
}

test.skip("palot_components_list returns TOON catalog", async () => {
	const result = await buildComponentsListHandler()({})
	expect(result).toBe(
		"count: 1\ncomponents[1]{name,one_line,category}:\n  dag-sparkline,\"Render DAG with node + edge props\",diagram",
	)
})

test.skip("palot_components_describe returns TOON details", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "dag-sparkline" })
	expect(result).toContain("name: dag-sparkline")
	expect(result).toContain('one_line: "Render DAG with node + edge props"')
	expect(result).toContain("example")
})

test.skip("palot_components_describe returns unknown_component error", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "unknown" })
	expect(result).toContain("errorCode: unknown_component")
	expect(result).toContain("help[1]:")
})
