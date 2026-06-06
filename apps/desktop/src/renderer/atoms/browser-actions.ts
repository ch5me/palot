import { atom } from "jotai"
import type { BrowserActionEvent } from "../../preload/api"

const MAX_BROWSER_ACTION_EVENTS = 100

export interface BrowserActionOverlayState {
	activeSessionId: string | null
	frozen: boolean
	showBestEffortBadge: boolean
	showHumanControlBadge: boolean
	showDriftBadge: boolean
	lastEvent: BrowserActionEvent | null
}

export const browserActionEventsAtom = atom<BrowserActionEvent[]>([])
export const browserActionOverlayStateAtom = atom<BrowserActionOverlayState>({
	activeSessionId: null,
	frozen: false,
	showBestEffortBadge: false,
	showHumanControlBadge: false,
	showDriftBadge: false,
	lastEvent: null,
})

export const pushBrowserActionEventAtom = atom(
	null,
	(get, set, event: BrowserActionEvent) => {
		const current = get(browserActionEventsAtom)
		const duplicate = current.find(
			(entry) => entry.id === event.id && entry.laneId === event.laneId,
		)
		if (duplicate) return
		const next = [...current, event]
		set(browserActionEventsAtom, next.slice(-MAX_BROWSER_ACTION_EVENTS))
		const previous = get(browserActionOverlayStateAtom)
		set(browserActionOverlayStateAtom, {
			activeSessionId: event.sessionId,
			frozen:
				event.kind === "humanTakeoverPaused"
					? true
					: event.kind === "humanTakeoverResumed"
						? false
						: previous.frozen,
			showBestEffortBadge:
				event.kind === "type"
					? event.caretConfidence !== "high"
					: event.errorCode === "geometry_low_confidence"
						? true
						: previous.showBestEffortBadge,
			showHumanControlBadge:
				event.kind === "humanTakeoverPaused"
					? true
					: event.kind === "humanTakeoverResumed"
						? false
						: previous.showHumanControlBadge,
			showDriftBadge:
				event.errorCode === "geometry_low_confidence" || event.kind === "systemReconcile"
					? true
					: previous.showDriftBadge,
			lastEvent: event,
		})
	},
)

export const clearBrowserActionEventsAtom = atom(null, (_get, set) => {
	set(browserActionEventsAtom, [])
	set(browserActionOverlayStateAtom, {
		activeSessionId: null,
		frozen: false,
		showBestEffortBadge: false,
		showHumanControlBadge: false,
		showDriftBadge: false,
		lastEvent: null,
	})
})
