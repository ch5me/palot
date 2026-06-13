import { getBoundBrowserLaneId, resolveBrowserPanelLaneId } from "../../atoms/browser"
import type { BrowserLane } from "../../lib/types"
import type { SessionBinding } from "../../../preload/api"

export function selectBrowserPanelLane(input: {
	lanes: BrowserLane[]
	activeLaneId: string
	binding: SessionBinding | null
}): BrowserLane | null {
	const boundLaneId = getBoundBrowserLaneId(input.binding)
	const preferredLaneId = resolveBrowserPanelLaneId(boundLaneId, input.activeLaneId)
	return input.lanes.find((lane) => lane.id === preferredLaneId) ?? input.lanes[0] ?? null
}
