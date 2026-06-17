import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo } from "react"
import type { Actor, BrowserActionEvent } from "../../preload/api"
import {
	browserActionEventsFamilyAtom,
	browserActionOverlayStateFamilyAtom,
	clearBrowserActionEventsScopedAtom,
	pushBrowserActionEventAtom,
	type BrowserActionOverlayState,
} from "../atoms/browser-actions"
import { subscribeToBrowserActions } from "../services/backend"

export interface BrowserActionsResult {
	/** All events for the scope, sorted by sequence. */
	events: BrowserActionEvent[]
	/** Overlay state for the scope. */
	overlayState: BrowserActionOverlayState
	/** Map of actorId -> Actor for all actors seen in this scope. */
	actors: Map<string, Actor>
	/** Events partitioned by actor id (undefined key = no actor). */
	eventsByActor: Map<string | undefined, BrowserActionEvent[]>
}

/**
 * Subscribe to browser action events for a specific scope.
 *
 * `scopeKey` must be the laneId when known (matches how events are bucketed in
 * the push atom). Falls back to sessionId when laneId is unavailable (e.g.
 * the lane hasn't been assigned yet).
 *
 * Multi-actor: returns `actors` map and `eventsByActor` partition so callers
 * can render one cursor per distinct agent.
 */
export function useBrowserActions(scopeKey: string): BrowserActionsResult {
	const events = useAtomValue(browserActionEventsFamilyAtom(scopeKey))
	const overlayState = useAtomValue(browserActionOverlayStateFamilyAtom(scopeKey))
	const pushEvent = useSetAtom(pushBrowserActionEventAtom)
	const clearEvents = useSetAtom(clearBrowserActionEventsScopedAtom(scopeKey))

	useEffect(() => {
		clearEvents()
		const unsubscribe = subscribeToBrowserActions((event) => {
			const eventScopeKey = event.laneId ?? event.sessionId
			if (eventScopeKey !== scopeKey) return
			pushEvent(event)
		})
		return () => {
			unsubscribe()
		}
	}, [clearEvents, pushEvent, scopeKey])

	const actors = useMemo(() => {
		const map = new Map<string, Actor>()
		for (const event of events) {
			if (event.actor) {
				map.set(event.actor.id, event.actor)
			}
		}
		return map
	}, [events])

	const eventsByActor = useMemo(() => {
		const map = new Map<string | undefined, BrowserActionEvent[]>()
		for (const event of events) {
			const key = event.actor?.id
			const bucket = map.get(key)
			if (bucket) {
				bucket.push(event)
			} else {
				map.set(key, [event])
			}
		}
		return map
	}, [events])

	return { events, overlayState, actors, eventsByActor }
}
