import { describe, expect, test } from "bun:test"
import { canDragSplitDockPanel } from "./split-dock-protection"
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview"

function panel(id: string, groupPanels: IDockviewPanel[]): IDockviewPanel {
	return {
		id,
		group: {
			panels: groupPanels,
		} as DockviewGroupPanel,
	} as IDockviewPanel
}

function api(panels: IDockviewPanel[]): DockviewApi {
	return { panels } as DockviewApi
}

describe("split dock protected panel policy", () => {
	test("blocks orphaning the only protected main chat panel", () => {
		const groupPanels: IDockviewPanel[] = []
		const chatPanel = panel("session-chat", groupPanels)
		groupPanels.push(chatPanel)

		expect(
			canDragSplitDockPanel({
				zone: "main",
				panel: chatPanel,
				api: api([chatPanel]),
				protection: { protected: true, requiredZone: "main" },
			}),
		).toBe(false)
	})

	test("allows regular dock panels to move between zones", () => {
		const groupPanels: IDockviewPanel[] = []
		const surfacePanel = panel("session-surface", groupPanels)
		groupPanels.push(surfacePanel)

		expect(
			canDragSplitDockPanel({
				zone: "right",
				panel: surfacePanel,
				api: api([surfacePanel]),
			}),
		).toBe(true)
	})
})
