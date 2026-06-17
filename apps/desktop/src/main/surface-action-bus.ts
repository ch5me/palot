/**
 * Generic Surface Action Bus (main process).
 *
 * publish/subscribe keyed by surfaceId.  Semantics mirror the proven
 * palot-browser-ipc.publishBrowserAction path but are surface-agnostic:
 *
 *   • Monotonic per-(surfaceId, actorId) sequence counter.
 *   • Capped ring buffer (MAX_EVENTS_PER_SURFACE most-recent events per surface).
 *   • Dedup by event.id within a surface.
 *   • subscribe(surfaceId, callback) — synchronous fan-out to all listeners.
 *   • subscribeAll(callback)          — receives every event across surfaces.
 *
 * Browser path stays on palot-browser-ipc/publishBrowserAction; this bus is
 * the GENERIC primitive for any new surface kind.
 */

import type { SurfaceActionEvent } from "../shared/surface-action-events"

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS_PER_SURFACE = 100

// ── Private state ────────────────────────────────────────────────────────────

/** Ring buffer per surfaceId. */
const eventsBySurface = new Map<string, SurfaceActionEvent[]>()

/**
 * Per-(surfaceId, actorId) monotonic counter.
 * Key format: `<surfaceId>\0<actorId>` (null actor uses empty string).
 */
const sequenceCounters = new Map<string, number>()

/** Subscribers keyed by surfaceId. */
const subscribersBySurface = new Map<string, Set<(event: SurfaceActionEvent) => void>>()

/** Global (cross-surface) subscribers. */
const globalSubscribers = new Set<(event: SurfaceActionEvent) => void>()

// ── Sequence helpers ─────────────────────────────────────────────────────────

function nextSequenceFor(surfaceId: string, actorId: string | null | undefined): number {
	const key = `${surfaceId}\0${actorId ?? ""}`
	const next = (sequenceCounters.get(key) ?? 0) + 1
	sequenceCounters.set(key, next)
	return next
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Publish a SurfaceActionEvent to the bus.
 *
 * Assigns a monotonic per-(surfaceId, actorId) sequence, deduplicates by
 * event.id, caps the ring buffer, and notifies all matching subscribers.
 *
 * Returns the stored event (may be an existing one on dedup hit).
 */
export function publishSurfaceAction(event: SurfaceActionEvent): SurfaceActionEvent {
	const { surfaceId } = event

	// Ensure ring buffer exists.
	if (!eventsBySurface.has(surfaceId)) {
		eventsBySurface.set(surfaceId, [])
	}
	const buffer = eventsBySurface.get(surfaceId)!

	// Dedup by id within this surface.
	const existing = buffer.find((e) => e.id === event.id)
	if (existing) return existing

	// Assign monotonic sequence for this (surface, actor) pair.
	const seq = nextSequenceFor(surfaceId, event.actor?.id)
	const stored: SurfaceActionEvent = { ...event, sequence: seq }

	// Append and cap.
	buffer.push(stored)
	if (buffer.length > MAX_EVENTS_PER_SURFACE) {
		buffer.splice(0, buffer.length - MAX_EVENTS_PER_SURFACE)
	}

	// Fan-out to surface-scoped subscribers.
	const surfaceSubscribers = subscribersBySurface.get(surfaceId)
	if (surfaceSubscribers) {
		for (const cb of surfaceSubscribers) {
			cb(stored)
		}
	}

	// Fan-out to global subscribers.
	for (const cb of globalSubscribers) {
		cb(stored)
	}

	return stored
}

/**
 * Subscribe to events for a specific surfaceId.
 * Returns an unsubscribe function.
 */
export function subscribeSurfaceActions(
	surfaceId: string,
	callback: (event: SurfaceActionEvent) => void,
): () => void {
	let subscribers = subscribersBySurface.get(surfaceId)
	if (!subscribers) {
		subscribers = new Set()
		subscribersBySurface.set(surfaceId, subscribers)
	}
	subscribers.add(callback)
	return () => {
		subscribers!.delete(callback)
		if (subscribers!.size === 0) {
			subscribersBySurface.delete(surfaceId)
		}
	}
}

/**
 * Subscribe to ALL events across every surface.
 * Returns an unsubscribe function.
 */
export function subscribeAllSurfaceActions(
	callback: (event: SurfaceActionEvent) => void,
): () => void {
	globalSubscribers.add(callback)
	return () => {
		globalSubscribers.delete(callback)
	}
}

/**
 * Read the current ring buffer for a surfaceId (snapshot copy).
 */
export function getSurfaceActionEvents(surfaceId: string): SurfaceActionEvent[] {
	return [...(eventsBySurface.get(surfaceId) ?? [])]
}

/**
 * Get all events across ALL surfaces (snapshot copy, sorted by timestamp).
 */
export function getAllSurfaceActionEvents(): SurfaceActionEvent[] {
	const all: SurfaceActionEvent[] = []
	for (const events of eventsBySurface.values()) {
		all.push(...events)
	}
	return all.sort((a, b) => a.timestamp - b.timestamp)
}

// ── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Reset all bus state. Only for use in tests.
 */
export function resetSurfaceActionBusForTests(): void {
	eventsBySurface.clear()
	sequenceCounters.clear()
	subscribersBySurface.clear()
	globalSubscribers.clear()
}
