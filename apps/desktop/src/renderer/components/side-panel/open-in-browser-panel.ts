import { useCallback } from "react"
import { useSetAtom } from "jotai"

import { activeBrowserLaneIdAtom, lastBrowserUrlAtom } from "../../atoms/browser"
import { openSidePanelTabAtom } from "../../atoms/ui"
import { createRemoteBrowserLane, fetchBrowserLanes } from "../../services/backend"

/**
 * The Browser side-panel surface's public "open a URL" action — the seam other
 * surfaces use to hand a URL to the browser panel (e.g. the DevMux toolbar's
 * "In app" launch). This is the plugin → surface boundary: lane management is
 * the browser surface's concern, not the caller's.
 *
 * The browser panel only renders an `<iframe>` for a `direct-iframe` lane, so
 * this ensures a lightweight direct-iframe lane keyed by `laneId` (created once,
 * reused after), makes it the active lane, points it at `url`, and opens the
 * side panel to the browser tab. Pure atoms + HTTP — works in both the Electron
 * and web builds (no `window.elf` dependency).
 */
export function useOpenInBrowserPanel() {
	const setActiveLaneId = useSetAtom(activeBrowserLaneIdAtom)
	const setLastUrl = useSetAtom(lastBrowserUrlAtom)
	const openSidePanelTab = useSetAtom(openSidePanelTabAtom)

	return useCallback(
		async (url: string, laneId: string, label: string) => {
			const lanes = await fetchBrowserLanes().catch(() => [])
			if (!lanes.some((lane) => lane.id === laneId)) {
				await createRemoteBrowserLane({
					id: laneId,
					label,
					surfaceKind: "direct-iframe",
					streamBackendUrl: url,
					cdpEndpoint: null,
					host: null,
					profilePath: null,
				})
			}
			setActiveLaneId(laneId)
			setLastUrl(url)
			openSidePanelTab("browser")
		},
		[setActiveLaneId, setLastUrl, openSidePanelTab],
	)
}
