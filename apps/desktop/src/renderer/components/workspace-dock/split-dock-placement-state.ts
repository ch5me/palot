import type { SplitDockTransferRequest } from "./split-dock-transfer-bridge"
import type { SplitDockZone } from "./split-dock-protection"

export interface SplitDockPlacementState {
	panelOrder: string[]
	panelZones: Record<string, SplitDockZone>
}

export function createSplitDockPlacementState(
	panels: ReadonlyArray<{ id: string; zone: SplitDockZone }>,
): SplitDockPlacementState {
	return {
		panelOrder: panels.map((panel) => panel.id),
		panelZones: Object.fromEntries(panels.map((panel) => [panel.id, panel.zone])),
	}
}

export function applySplitDockTransfer(
	state: SplitDockPlacementState,
	request: SplitDockTransferRequest,
): SplitDockPlacementState | null {
	if (request.policy !== "move") {
		return null
	}

	const currentZone = state.panelZones[request.panelId]
	if (!currentZone || currentZone !== request.sourceZone || request.targetZone === request.sourceZone) {
		return null
	}

	return {
		panelOrder: [...state.panelOrder],
		panelZones: {
			...state.panelZones,
			[request.panelId]: request.targetZone,
		},
	}
}
