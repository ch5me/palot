import { expect, test } from "bun:test"

import { decode as decodeToon } from "../../palot-runtime/toon"
import { buildComponentsDescribeHandler, buildComponentsListHandler } from "../plugin.js"

test("palot_components_list returns TOON catalog with surface metadata", async () => {
	const result = await buildComponentsListHandler()({})
	const decoded = decodeToon(result) as { count: number; components: Array<Record<string, unknown>> }
	expect(decoded.count).toBeGreaterThanOrEqual(3)
	expect(decoded.components).toContainEqual(
		expect.objectContaining({
			name: "dag-sparkline",
			category: "diagram",
			presentation: "inline-artifact",
			scope: "generic",
			maturity: "stable",
			defaultPlacement: "inline",
			sourcePackage: "@ch5me/dag-sparkline",
		}),
	)
	expect(decoded.components).toContainEqual(
		expect.objectContaining({
			name: "status_thinking_card",
			presentation: "inline-artifact",
			maturity: "beta",
			sourcePackage: "@ch5me/remotion-experiences",
		}),
	)
})

test("palot_components_list filters by metadata", async () => {
	const result = await buildComponentsListHandler()({ maturity: "beta" })
	const decoded = decodeToon(result) as { count: number; components: Array<Record<string, unknown>> }
	expect(decoded.components.map((component) => component.name)).toContain("status_thinking_card")
	expect(decoded.components.every((component) => component.maturity === "beta")).toBe(true)
})

test("palot_components_describe returns TOON details", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "status_thinking_card" })
	const decoded = decodeToon(result) as Record<string, unknown>
	expect(decoded).toMatchObject({
		name: "status_thinking_card",
		one_line: "Compact status card for multi-step agent work",
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "beta",
		defaultPlacement: "inline",
		sourcePackage: "@ch5me/remotion-experiences",
	})
	expect(decoded.allowedPlacements).toEqual(["inline", "above-chat", "chat-inline-right"])
	expect(decoded.example).toEqual(
		expect.objectContaining({
			component: "status_thinking_card",
		}),
	)
})

test("palot_components_describe returns unknown_component error", async () => {
	const result = await buildComponentsDescribeHandler()({ name: "unknown" })
	expect(result).toContain("errorCode: unknown_component")
	expect(result).toContain("help[1]:")
})
