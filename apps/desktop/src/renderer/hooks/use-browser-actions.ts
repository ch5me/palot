import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import type { BrowserActionEvent } from "../../preload/api"
import {
	browserActionEventsAtom,
	browserActionOverlayStateAtom,
	clearBrowserActionEventsAtom,
	pushBrowserActionEventAtom,
} from "../atoms/browser-actions"
import { subscribeToBrowserActions } from "../services/backend"

export function useBrowserActions(sessionId?: string): {
	events: BrowserActionEvent[]
	overlayState: ReturnType<typeof useAtomValue<typeof browserActionOverlayStateAtom>>
} {
	const events = useAtomValue(browserActionEventsAtom)
	const overlayState = useAtomValue(browserActionOverlayStateAtom)
	const pushEvent = useSetAtom(pushBrowserActionEventAtom)
	const clearEvents = useSetAtom(clearBrowserActionEventsAtom)

	useEffect(() => {
		clearEvents()
		const unsubscribe = subscribeToBrowserActions((event) => {
			if (sessionId && event.sessionId !== sessionId) return
			pushEvent(event)
		})
		return () => {
			unsubscribe()
		}
	}, [clearEvents, pushEvent, sessionId])

	const filtered = sessionId ? events.filter((event) => event.sessionId === sessionId) : events
	return { events: filtered, overlayState }
}
