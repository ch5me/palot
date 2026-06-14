import { describe, expect, test } from "bun:test"
import { applySplitDockTransfer, createSplitDockPlacementState } from "./split-dock-placement-state"

describe("split dock placement state", () => {
	test("moves stable hosts by zone state without touching mount identity", () => {
		const initial = createSplitDockPlacementState([
			{ id: "session-chat", zone: "main" },
			{ id: "session-surface", zone: "right" },
			{ id: "session-widgets", zone: "bottom" },
		])

		const moved = applySplitDockTransfer(initial, {
			panelId: "session-surface",
			sourceZone: "right",
			targetZone: "bottom",
			policy: "move",
		})

		expect(moved).not.toBeNull()
		expect(moved?.panelZones["session-surface"]).toBe("bottom")
		expect(moved?.panelZones["session-chat"]).toBe("main")
		expect(moved?.panelOrder).toEqual(initial.panelOrder)
	})

	test("rejects unsupported move attempts cleanly", () => {
		const initial = createSplitDockPlacementState([{ id: "session-surface", zone: "right" }])

		expect(
			applySplitDockTransfer(initial, {
				panelId: "session-surface",
				sourceZone: "right",
				targetZone: "right",
				policy: "move",
			}),
		).toBeNull()

		expect(
			applySplitDockTransfer(initial, {
				panelId: "session-surface",
				sourceZone: "right",
				targetZone: "bottom",
				policy: "clone",
			}),
		).toBeNull()

		expect(
			applySplitDockTransfer(initial, {
				panelId: "missing",
				sourceZone: "right",
				targetZone: "bottom",
				policy: "move",
			}),
		).toBeNull()
	})
})
