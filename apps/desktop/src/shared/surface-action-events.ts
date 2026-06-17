/**
 * Generic Surface Action Event — the reusable supertype for actor-tagged,
 * animated actions on any named surface (browser, terminal, editor, …).
 *
 * BrowserActionEvent (preload/api.d.ts) is the browser-specialized consumer;
 * a browser event is a SurfaceActionEvent whose surfaceId is the laneId.
 * This module DOES NOT import from preload/api so it stays dependency-free.
 */

import type { Actor } from "../preload/api"

// ── Status lifecycle ─────────────────────────────────────────────────────────

export type SurfaceActionStatus =
	| "queued"
	| "dispatched"
	| "runtime_ack"
	| "completed"
	| "failed"
	| "cancelled"

// ── Source of the action ─────────────────────────────────────────────────────

export type SurfaceActionSource =
	| "tool_request"
	| "automation_runtime"
	| "human_takeover"
	| "system_reconcile"

// ── Generic target description (surface-agnostic) ────────────────────────────

export interface SurfaceActionTarget {
	/** CSS selector or equivalent surface-local locator. */
	selector: string | null
	/** Human-readable text label for the target element. */
	text: string | null
	/** ARIA role or semantic role. */
	role: string | null
}

// ── Base event carrying the fields common to ALL surface action kinds ─────────

export interface SurfaceActionEventBase {
	/** Unique event id (opaque string, e.g. `<surfaceId>:<seq>:<kind>`). */
	id: string
	/**
	 * Surface this event belongs to.
	 *
	 * For browser surfaces this equals the laneId when known, otherwise the
	 * OpenCode sessionId (matching the existing browser-action bucketing rule).
	 * Other surface types use their own canonical id.
	 */
	surfaceId: string
	/** Actor that produced this action (undefined = anonymous / legacy). */
	actor?: Actor | null
	/**
	 * Monotonic per-(surfaceId, actorId) sequence number.
	 * Assigned by the bus on publish.
	 */
	sequence: number
	/** Wall-clock timestamp (ms since epoch). */
	timestamp: number
	/** Optional duration of the action in ms (null = not yet complete). */
	durationMs: number | null
	/** Lifecycle status. */
	status: SurfaceActionStatus
	/** Source of the action. */
	source: SurfaceActionSource
	/** Surface-agnostic target description (null if not applicable). */
	target: SurfaceActionTarget | null
	/** Optional request correlation id from the originating tool call. */
	requestId: string | null
	/** Error code when status is "failed" (null otherwise). */
	errorCode: string | null
	/** Human-readable error detail (null otherwise). */
	errorMessage: string | null
}

// ── Generic action kinds ─────────────────────────────────────────────────────

export interface SurfaceActionMoveEvent extends SurfaceActionEventBase {
	kind: "move"
}

export interface SurfaceActionClickEvent extends SurfaceActionEventBase {
	kind: "click"
	button: "left" | "middle" | "right"
	clickCount: number
}

export interface SurfaceActionTypeEvent extends SurfaceActionEventBase {
	kind: "type"
	text: string
}

export interface SurfaceActionScrollEvent extends SurfaceActionEventBase {
	kind: "scroll"
	deltaX: number
	deltaY: number
}

export interface SurfaceActionFocusEvent extends SurfaceActionEventBase {
	kind: "focus"
}

export interface SurfaceActionHoverEvent extends SurfaceActionEventBase {
	kind: "hover"
}

export interface SurfaceActionNavigateEvent extends SurfaceActionEventBase {
	kind: "navigate"
	url: string
}

export interface SurfaceActionToolRequestEvent extends SurfaceActionEventBase {
	kind: "toolRequest"
	toolName: string
	argsSummary: string | null
}

export interface SurfaceActionToolResultEvent extends SurfaceActionEventBase {
	kind: "toolResult"
	toolName: string
	resultSummary: string | null
}

export interface SurfaceActionSystemReconcileEvent extends SurfaceActionEventBase {
	kind: "systemReconcile"
	reason: string
}

export interface SurfaceActionHumanTakeoverPausedEvent extends SurfaceActionEventBase {
	kind: "humanTakeoverPaused"
	reason: string | null
}

export interface SurfaceActionHumanTakeoverResumedEvent extends SurfaceActionEventBase {
	kind: "humanTakeoverResumed"
	reason: string | null
}

/** Custom / surface-specific action. Consumers discriminate on `customKind`. */
export interface SurfaceActionCustomEvent extends SurfaceActionEventBase {
	kind: "custom"
	customKind: string
	payload: Record<string, unknown>
}

export type SurfaceActionEvent =
	| SurfaceActionMoveEvent
	| SurfaceActionClickEvent
	| SurfaceActionTypeEvent
	| SurfaceActionScrollEvent
	| SurfaceActionFocusEvent
	| SurfaceActionHoverEvent
	| SurfaceActionNavigateEvent
	| SurfaceActionToolRequestEvent
	| SurfaceActionToolResultEvent
	| SurfaceActionSystemReconcileEvent
	| SurfaceActionHumanTakeoverPausedEvent
	| SurfaceActionHumanTakeoverResumedEvent
	| SurfaceActionCustomEvent

// ── Overlay state derived from the event stream ──────────────────────────────

export interface SurfaceActionOverlayState {
	/** Last observed actor id / active session context. */
	activeSessionId: string | null
	/** True while a human takeover pause is active. */
	frozen: boolean
	/** True when a recent action has low geometry confidence. */
	showBestEffortBadge: boolean
	/** True while human-control badge should be shown. */
	showHumanControlBadge: boolean
	/** True when a recent drift reconcile event was received. */
	showDriftBadge: boolean
	/** The most-recently published event. */
	lastEvent: SurfaceActionEvent | null
}

export const INITIAL_SURFACE_ACTION_OVERLAY_STATE: SurfaceActionOverlayState = {
	activeSessionId: null,
	frozen: false,
	showBestEffortBadge: false,
	showHumanControlBadge: false,
	showDriftBadge: false,
	lastEvent: null,
}

export function deriveSurfaceActionOverlayState(
	event: SurfaceActionEvent,
	previous: SurfaceActionOverlayState,
): SurfaceActionOverlayState {
	return {
		activeSessionId: event.surfaceId,
		frozen:
			event.kind === "humanTakeoverPaused"
				? true
				: event.kind === "humanTakeoverResumed"
					? false
					: previous.frozen,
		showBestEffortBadge:
			event.errorCode === "geometry_low_confidence" ? true : previous.showBestEffortBadge,
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
