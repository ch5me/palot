import { expect, mock, test } from "bun:test"

mock.module("../../../renderer/lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

const pluginModule = (await import("../plugin.js")) as unknown as {
	buildComponentsDescribeHandler: () => (args?: unknown) => Promise<string>
	buildComponentsListHandler: () => (args?: unknown) => Promise<string>
}
const { buildComponentsDescribeHandler, buildComponentsListHandler } = pluginModule

test("palot_components_list returns TOON catalog", async () => {
	const result = await buildComponentsListHandler()({})
	expect(result).toBe(
		"count: 1\ncomponents[1]{name,one_line,category}:\n  dag-sparkline,\"Render DAG with node + edge props\",diagram",
	)
})

test("palot_components_describe returns TOON details", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "dag-sparkline" })
	expect(result).toContain("name: dag-sparkline")
	expect(result).toContain('one_line: "Render DAG with node + edge props"')
	expect(result).toContain("props_schema")
	expect(result).toContain("example")
})

test("palot_components_describe returns unknown_component error", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "unknown" })
	expect(result).toContain("errorCode: unknown_component")
	expect(result).toContain('help[1]:')
})
