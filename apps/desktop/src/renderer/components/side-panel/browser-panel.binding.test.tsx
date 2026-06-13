import { describe, expect, test } from "bun:test"
import { resolveBrowserPanelLaneId } from "../../atoms/browser"

describe("browser panel binding resolution", () => {
	test("prefers session binding lane over global fallback", () => {
		expect(resolveBrowserPanelLaneId("lane_bound", "lane_global")).toBe("lane_bound")
	})

	test("falls back to global lane when no session binding exists", () => {
		expect(resolveBrowserPanelLaneId(null, "lane_global")).toBe("lane_global")
	})
})
