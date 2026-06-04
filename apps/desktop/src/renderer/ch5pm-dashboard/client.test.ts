import assert from "node:assert/strict"
import test from "node:test"
import {
	fetchCh5PmDashboard,
	PRESSURE_REFRESH_MS,
	SNAPSHOT_REFRESH_MS,
	SYSTEM_REFRESH_MS,
	subscribeToCh5PmEvents,
} from "./client"
import { MOCK_CH5PM_DASHBOARD_STATE } from "./fixtures"

class FakeEventSource {
	static instances: FakeEventSource[] = []
	url: string
	onopen: (() => void) | null = null
	onerror: (() => void) | null = null
	listeners = new Map<string, Array<(event: { data: string }) => void>>()
	closed = false

	constructor(url: string) {
		this.url = url
		FakeEventSource.instances.push(this)
	}

	addEventListener(name: string, callback: (event: { data: string }) => void) {
		const current = this.listeners.get(name) ?? []
		current.push(callback)
		this.listeners.set(name, current)
	}

	emit(name: string, payload?: unknown) {
		for (const callback of this.listeners.get(name) ?? []) {
			callback({ data: payload === undefined ? "" : JSON.stringify(payload) })
		}
	}

	close() {
		this.closed = true
	}
}

test("Task 12 polling cadences match inline dashboard defaults", () => {
	assert.equal(SNAPSHOT_REFRESH_MS, 60_000)
	assert.equal(PRESSURE_REFRESH_MS, 30_000)
	assert.equal(SYSTEM_REFRESH_MS, 30_000)
})

test("subscribeToCh5PmEvents wires SSE updates and fallback error state", () => {
	const original = globalThis.EventSource
	globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
	;(globalThis as { window?: Window & typeof globalThis }).window = globalThis as Window & typeof globalThis

	const seen: string[] = []
	let streamError: string | null = null
	let heartbeatCount = 0

	try {
		const unsubscribe = subscribeToCh5PmEvents("http://daemon.test", {
			onOpen: () => seen.push("open"),
			onSnapshot: () => seen.push("snapshot"),
			onPressure: () => seen.push("pressure"),
			onSystem: () => seen.push("system"),
			onHeartbeat: () => {
				heartbeatCount += 1
			},
			onError: (message) => {
				streamError = message
			},
		})

		const instance = FakeEventSource.instances.at(-1)
		assert.ok(instance)
		instance!.onopen?.()
		instance!.emit("snapshot", MOCK_CH5PM_DASHBOARD_STATE.snapshot)
		instance!.emit("pressure", MOCK_CH5PM_DASHBOARD_STATE.pressure)
		instance!.emit("system", MOCK_CH5PM_DASHBOARD_STATE.system)
		instance!.emit("heartbeat")
		instance!.onerror?.()

		assert.deepEqual(seen, ["open", "snapshot", "pressure", "system"])
		assert.equal(heartbeatCount, 1)
		assert.equal(streamError, "event stream reconnecting")

		unsubscribe()
		assert.equal(instance!.closed, true)
	} finally {
		globalThis.EventSource = original
		FakeEventSource.instances.length = 0
	}
})

test("fetchCh5PmDashboard still composes all three polling layers", async () => {
	const payloads = {
		"http://daemon.test/data/snapshot.json": MOCK_CH5PM_DASHBOARD_STATE.snapshot,
		"http://daemon.test/data/pressure.json": MOCK_CH5PM_DASHBOARD_STATE.pressure,
		"http://daemon.test/data/system.json": MOCK_CH5PM_DASHBOARD_STATE.system,
	}

	const originalFetch = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const request = input instanceof Request ? input : new Request(input)
		const url = request.url.replace(/\?t=\d+$/, "")
		const payload = payloads[url as keyof typeof payloads]
		if (!payload) {
			return new Response("not found", { status: 404 })
		}
		return Response.json(payload)
	}) as typeof fetch

	try {
		const state = await fetchCh5PmDashboard("http://daemon.test")
		assert.ok(state.snapshot)
		assert.ok(state.pressure)
		assert.ok(state.system)
	} finally {
		globalThis.fetch = originalFetch
	}
})
