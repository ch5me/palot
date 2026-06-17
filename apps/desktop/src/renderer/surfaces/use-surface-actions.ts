/**
 * Generic useSurfaceActions hook.
 *
 * Mirrors the semantics of useBrowserActions (hooks/use-browser-actions.ts)
 * but is surface-agnostic: any surface wires in its own IPC subscription via
 * the `subscribe` parameter.
 *
 * useBrowserActions is NOT modified — it remains the browser-specialized
 * consumer.  This hook is the generic primitive for new surface kinds.
 *
 * Usage:
 *   const { events, actors, eventsByActor, overlayState } =
 *     useSurfaceActions(surfaceId, mySubscribeFn)
 */

import { atom, useAtomValue, useSetAtom } from "jotai"
import { atomFamily } from "jotai-family"
import { useEffect, useMemo } from "react"
import type { Actor } from "../../preload/api"
import type { SurfaceActionEvent, SurfaceActionOverlayState } from "../../shared/surface-action-events"
import {
	deriveSurfaceActionOverlayState,
	INITIAL_SURFACE_ACTION_OVERLAY_STATE,
} from "../../shared/surface-action-events"

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SURFACE_ACTION_EVENTS = 100

// ── Atom families (module-scoped, shared across all useSurfaceActions calls) ──

const surfaceActionEventsFamilyAtom = atomFamily((_surfaceId: string) =>
	atom<SurfaceActionEvent[]>([]),
)

const surfaceActionOverlayStateFamilyAtom = atomFamily((_surfaceId: string) =>
	atom<SurfaceActionOverlayState>({ ...INITIAL_SURFACE_ACTION_OVERLAY_STATE }),
)

// ── Write atoms ───────────────────────────────────────────────────────────────

const pushSurfaceActionEventFamilyAtom = atomFamily((_surfaceId: string) =>
	atom(null, (get, set, event: SurfaceActionEvent) => {
		const current = get(surfaceActionEventsFamilyAtom(event.surfaceId))
		const isDup = current.some((e) => e.id === event.id)
		if (isDup) return

		const next = [...current, event].slice(-MAX_SURFACE_ACTION_EVENTS)
		set(surfaceActionEventsFamilyAtom(event.surfaceId), next)

		const prev = get(surfaceActionOverlayStateFamilyAtom(event.surfaceId))
		set(
			surfaceActionOverlayStateFamilyAtom(event.surfaceId),
			deriveSurfaceActionOverlayState(event, prev),
		)
	}),
)

const clearSurfaceActionEventsFamilyAtom = atomFamily((_surfaceId: string) =>
	atom(null, (_get, set, surfaceId: string) => {
		set(surfaceActionEventsFamilyAtom(surfaceId), [])
		set(surfaceActionOverlayStateFamilyAtom(surfaceId), {
			...INITIAL_SURFACE_ACTION_OVERLAY_STATE,
		})
	}),
)

// ── Public hook types ─────────────────────────────────────────────────────────

export interface SurfaceActionsResult {
	/** All events for this surface, in arrival order (ascending sequence). */
	events: SurfaceActionEvent[]
	/** Overlay state derived from the event stream. */
	overlayState: SurfaceActionOverlayState
	/** Map of actorId → Actor for all actors seen on this surface. */
	actors: Map<string, Actor>
	/** Events partitioned by actorId (undefined key = anonymous / no actor). */
	eventsByActor: Map<string | undefined, SurfaceActionEvent[]>
}

/**
 * Subscribe function signature — receives each incoming SurfaceActionEvent
 * for the surface identified by `surfaceId`.  Returns an unsubscribe fn.
 *
 * Implementations are responsible for their own IPC / transport binding.
 * Pass a no-op `() => () => {}` when the surface has no live transport yet.
 */
export type SurfaceActionSubscribeFn = (
	surfaceId: string,
	callback: (event: SurfaceActionEvent) => void,
) => () => void

/**
 * Generic hook for subscribing to surface action events.
 *
 * @param surfaceId  Canonical surface identifier (laneId, terminalId, …).
 * @param subscribe  IPC subscription factory for this surface kind.
 */
export function useSurfaceActions(
	surfaceId: string,
	subscribe: SurfaceActionSubscribeFn,
): SurfaceActionsResult {
	const events = useAtomValue(surfaceActionEventsFamilyAtom(surfaceId))
	const overlayState = useAtomValue(surfaceActionOverlayStateFamilyAtom(surfaceId))

	// Each surface id gets its own push/clear atom so writers don't collide.
	const pushEvent = useSetAtom(pushSurfaceActionEventFamilyAtom(surfaceId))
	const clearEvents = useSetAtom(clearSurfaceActionEventsFamilyAtom(surfaceId))

	useEffect(() => {
		clearEvents(surfaceId)
		const unsubscribe = subscribe(surfaceId, (event) => {
			if (event.surfaceId !== surfaceId) return
			pushEvent(event)
		})
		return () => {
			unsubscribe()
		}
	}, [clearEvents, pushEvent, subscribe, surfaceId])

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
		const map = new Map<string | undefined, SurfaceActionEvent[]>()
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
