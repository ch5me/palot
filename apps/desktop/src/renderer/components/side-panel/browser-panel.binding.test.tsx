import { describe, expect, test } from "bun:test"

function resolveLaneId(boundLaneId: string | null, activeLaneId: string): string {
	return boundLaneId ?? activeLaneId
}

describe("browser panel binding resolution", () => {
	test("prefers session binding lane over global fallback", () => {
		expect(resolveLaneId("lane_bound", "lane_global")).toBe("lane_bound")
	})

	test("falls back to global lane when no session binding exists", () => {
		expect(resolveLaneId(null, "lane_global")).toBe("lane_global")
	})
})
