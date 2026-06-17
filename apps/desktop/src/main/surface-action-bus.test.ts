import assert from "node:assert/strict"
import test from "node:test"
import {
	getAllSurfaceActionEvents,
	getSurfaceActionEvents,
	publishSurfaceAction,
	resetSurfaceActionBusForTests,
	subscribeAllSurfaceActions,
	subscribeSurfaceActions,
} from "./surface-action-bus"
import type { SurfaceActionEvent } from "../shared/surface-action-events"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
	surfaceId: string,
	seq: number,
	overrides?: Partial<SurfaceActionEvent>,
): SurfaceActionEvent {
	return {
		id: `${surfaceId}:${seq}`,
		surfaceId,
		sequence: seq,
		actor: null,
		timestamp: Date.now() + seq,
		durationMs: null,
		status: "queued",
		source: "tool_request",
		target: null,
		requestId: null,
		errorCode: null,
		errorMessage: null,
		kind: "move",
		...overrides,
	} as SurfaceActionEvent
}

function makeActor(id: string) {
	return { id, displayName: id, cursorColor: "#abc", kind: "main" as const }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("events are stored and retrievable by surfaceId", () => {
	resetSurfaceActionBusForTests()
	publishSurfaceAction(makeEvent("surf_a", 0))
	publishSurfaceAction(makeEvent("surf_a", 1))
	publishSurfaceAction(makeEvent("surf_b", 0))

	const a = getSurfaceActionEvents("surf_a")
	const b = getSurfaceActionEvents("surf_b")
	assert.equal(a.length, 2)
	assert.equal(b.length, 1)
})

test("publishes assign monotonic per-(surface,actor) sequence", () => {
	resetSurfaceActionBusForTests()
	const actor = makeActor("agent_1")
	const e1 = publishSurfaceAction(makeEvent("surf_a", 0, { id: "a:0", actor }))
	const e2 = publishSurfaceAction(makeEvent("surf_a", 0, { id: "a:1", actor }))
	const e3 = publishSurfaceAction(makeEvent("surf_a", 0, { id: "a:2", actor }))
	assert.equal(e1.sequence, 1)
	assert.equal(e2.sequence, 2)
	assert.equal(e3.sequence, 3)
})

test("per-actor sequences are independent across actors", () => {
	resetSurfaceActionBusForTests()
	const actorA = makeActor("agent_a")
	const actorB = makeActor("agent_b")
	const a1 = publishSurfaceAction(makeEvent("surf_x", 0, { id: "x:a:0", actor: actorA }))
	const b1 = publishSurfaceAction(makeEvent("surf_x", 0, { id: "x:b:0", actor: actorB }))
	const a2 = publishSurfaceAction(makeEvent("surf_x", 0, { id: "x:a:1", actor: actorA }))
	// actorA: 1, 2 — actorB: 1
	assert.equal(a1.sequence, 1)
	assert.equal(b1.sequence, 1)
	assert.equal(a2.sequence, 2)
})

test("duplicate event id returns existing event without re-publishing", () => {
	resetSurfaceActionBusForTests()
	const published: SurfaceActionEvent[] = []
	const unsub = subscribeSurfaceActions("surf_dup", (e) => published.push(e))

	const first = publishSurfaceAction(makeEvent("surf_dup", 0, { id: "dup:1" }))
	const second = publishSurfaceAction(makeEvent("surf_dup", 0, { id: "dup:1" })) // same id

	unsub()
	assert.equal(published.length, 1, "subscriber notified only once")
	assert.equal(second.sequence, first.sequence, "returns the stored event unchanged")
})

test("ring buffer caps at MAX_EVENTS_PER_SURFACE (100)", () => {
	resetSurfaceActionBusForTests()
	const surfaceId = "surf_cap"
	for (let i = 0; i < 105; i++) {
		publishSurfaceAction(makeEvent(surfaceId, i, { id: `cap:${i}` }))
	}
	const events = getSurfaceActionEvents(surfaceId)
	assert.equal(events.length, 100, "buffer capped at 100")
	// Oldest events (0..4) should have been evicted
	assert.equal(events[0]?.id, "cap:5", "oldest 5 events evicted")
})

test("subscribeSurfaceActions receives only matching surface events", () => {
	resetSurfaceActionBusForTests()
	const received: SurfaceActionEvent[] = []
	const unsub = subscribeSurfaceActions("surf_a", (e) => received.push(e))

	publishSurfaceAction(makeEvent("surf_a", 0, { id: "a:0" }))
	publishSurfaceAction(makeEvent("surf_b", 0, { id: "b:0" }))
	publishSurfaceAction(makeEvent("surf_a", 1, { id: "a:1" }))

	unsub()
	assert.equal(received.length, 2)
	assert.ok(received.every((e) => e.surfaceId === "surf_a"))
})

test("subscribeAllSurfaceActions receives events from all surfaces", () => {
	resetSurfaceActionBusForTests()
	const received: SurfaceActionEvent[] = []
	const unsub = subscribeAllSurfaceActions((e) => received.push(e))

	publishSurfaceAction(makeEvent("surf_a", 0, { id: "all:a:0" }))
	publishSurfaceAction(makeEvent("surf_b", 0, { id: "all:b:0" }))

	unsub()
	assert.equal(received.length, 2)
	const surfaceIds = received.map((e) => e.surfaceId).sort()
	assert.deepEqual(surfaceIds, ["surf_a", "surf_b"])
})

test("multi-surface isolation: getSurfaceActionEvents for unknown surface returns []", () => {
	resetSurfaceActionBusForTests()
	publishSurfaceAction(makeEvent("surf_a", 0, { id: "iso:a:0" }))
	const unknown = getSurfaceActionEvents("no_such_surface")
	assert.deepEqual(unknown, [])
})

test("unsubscribe stops delivery", () => {
	resetSurfaceActionBusForTests()
	const received: SurfaceActionEvent[] = []
	const unsub = subscribeSurfaceActions("surf_unsub", (e) => received.push(e))

	publishSurfaceAction(makeEvent("surf_unsub", 0, { id: "us:0" }))
	unsub()
	publishSurfaceAction(makeEvent("surf_unsub", 1, { id: "us:1" }))

	assert.equal(received.length, 1, "only the pre-unsub event was delivered")
})

test("getAllSurfaceActionEvents returns events across all surfaces sorted by timestamp", () => {
	resetSurfaceActionBusForTests()
	publishSurfaceAction(makeEvent("surf_a", 0, { id: "g:a:0", timestamp: 100 }))
	publishSurfaceAction(makeEvent("surf_b", 0, { id: "g:b:0", timestamp: 50 }))
	publishSurfaceAction(makeEvent("surf_a", 1, { id: "g:a:1", timestamp: 200 }))

	const all = getAllSurfaceActionEvents()
	assert.equal(all.length, 3)
	assert.equal(all[0]?.id, "g:b:0")
	assert.equal(all[1]?.id, "g:a:0")
	assert.equal(all[2]?.id, "g:a:1")
})

test("anonymous actor (null) gets its own sequence counter", () => {
	resetSurfaceActionBusForTests()
	const withActor = makeActor("agent_named")
	const e1 = publishSurfaceAction(makeEvent("surf_anon", 0, { id: "anon:0", actor: null }))
	const e2 = publishSurfaceAction(makeEvent("surf_anon", 0, { id: "anon:1", actor: null }))
	const e3 = publishSurfaceAction(makeEvent("surf_anon", 0, { id: "anon:2", actor: withActor }))
	assert.equal(e1.sequence, 1)
	assert.equal(e2.sequence, 2)
	// named actor starts its own counter at 1
	assert.equal(e3.sequence, 1)
})
