import { atom } from "jotai"
import { atomFamily } from "jotai-family"
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

const INITIAL_OVERLAY_STATE: BrowserActionOverlayState = {
	activeSessionId: null,
	frozen: false,
	showBestEffortBadge: false,
	showHumanControlBadge: false,
	showDriftBadge: false,
	lastEvent: null,
}

/**
 * Per-scope (laneId or sessionId) event ring buffer atom.
 * Key should be the laneId when known, falling back to sessionId.
 */
export const browserActionEventsFamilyAtom = atomFamily((_scopeKey: string) =>
	atom<BrowserActionEvent[]>([]),
)

/**
 * Per-scope overlay state atom.
 */
export const browserActionOverlayStateFamilyAtom = atomFamily((_scopeKey: string) =>
	atom<BrowserActionOverlayState>({ ...INITIAL_OVERLAY_STATE }),
)

// ── Legacy global atoms (back-compat for components not yet scoped) ──────────

/** @deprecated Prefer per-scope family atoms. Global ring of all events across lanes/sessions. */
export const browserActionEventsAtom = atom<BrowserActionEvent[]>([])
/** @deprecated Prefer per-scope family atoms. */
export const browserActionOverlayStateAtom = atom<BrowserActionOverlayState>({
	...INITIAL_OVERLAY_STATE,
})

// ── Write atoms ──────────────────────────────────────────────────────────────

/**
 * Push a BrowserActionEvent into the correct per-scope ring buffer.
 * Scope key = event.laneId if present, else event.sessionId.
 * Also pushes into the legacy global atom for backward-compat subscribers.
 */
export const pushBrowserActionEventAtom = atom(
	null,
	(get, set, event: BrowserActionEvent) => {
		const scopeKey = event.laneId ?? event.sessionId

		// ── per-scope update ──────────────────────────────────────────────────
		const currentScoped = get(browserActionEventsFamilyAtom(scopeKey))
		const dupScoped = currentScoped.find(
			(entry) => entry.id === event.id && entry.laneId === event.laneId,
		)
		if (!dupScoped) {
			const nextScoped = [...currentScoped, event].slice(-MAX_BROWSER_ACTION_EVENTS)
			set(browserActionEventsFamilyAtom(scopeKey), nextScoped)

			const prevScoped = get(browserActionOverlayStateFamilyAtom(scopeKey))
			set(browserActionOverlayStateFamilyAtom(scopeKey), deriveOverlayState(event, prevScoped))
		}

		// ── legacy global update ──────────────────────────────────────────────
		const currentGlobal = get(browserActionEventsAtom)
		const dupGlobal = currentGlobal.find(
			(entry) => entry.id === event.id && entry.laneId === event.laneId,
		)
		if (!dupGlobal) {
			set(browserActionEventsAtom, [...currentGlobal, event].slice(-MAX_BROWSER_ACTION_EVENTS))
			const prevGlobal = get(browserActionOverlayStateAtom)
			set(browserActionOverlayStateAtom, deriveOverlayState(event, prevGlobal))
		}
	},
)

/**
 * Clear events for a specific scope key (laneId or sessionId).
 */
export const clearBrowserActionEventsScopedAtom = atomFamily((_scopeKey: string) =>
	atom(null, (_get, set) => {
		set(browserActionEventsFamilyAtom(_scopeKey), [])
		set(browserActionOverlayStateFamilyAtom(_scopeKey), { ...INITIAL_OVERLAY_STATE })
	}),
)

/**
 * Clear all events — global and resets the global overlay state.
 * @deprecated Use clearBrowserActionEventsScopedAtom(scopeKey) for per-lane clearing.
 */
export const clearBrowserActionEventsAtom = atom(null, (_get, set) => {
	set(browserActionEventsAtom, [])
	set(browserActionOverlayStateAtom, { ...INITIAL_OVERLAY_STATE })
})

// ── Internal helpers ─────────────────────────────────────────────────────────

function deriveOverlayState(
	event: BrowserActionEvent,
	previous: BrowserActionOverlayState,
): BrowserActionOverlayState {
	return {
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
	}
}
