import assert from "node:assert/strict"
import test from "node:test"
import { fetchCh5PmDashboard } from "./client"
import { MOCK_CH5PM_DASHBOARD_STATE } from "./fixtures"
import type { Ch5PmPressurePayload, Ch5PmSnapshotPayload, Ch5PmSystemPayload } from "./types"

function ensureTicketRows(rows: unknown, label: string): void {
	assert.ok(Array.isArray(rows), `${label} should be an array`)
	for (const row of rows) {
		assert.equal(typeof row, "object", `${label} rows should be objects`)
	}
}

function assertSnapshotContract(snapshot: Ch5PmSnapshotPayload): void {
	assert.equal(typeof snapshot.schema, "string")
	assert.equal(typeof snapshot.kind, "string")
	assert.equal(typeof snapshot.generatedAt, "string")
	assert.equal(typeof snapshot.managerBrief, "string", "managerBrief is required")
	assert.ok(snapshot.runtime)
	assert.ok(snapshot.runtime?.dispatch)
	assert.equal(typeof snapshot.runtime?.dispatch?.enabled, "boolean")
	ensureTicketRows(snapshot.activeTickets, "activeTickets")
	ensureTicketRows(snapshot.queueTickets, "queueTickets")
	ensureTicketRows(snapshot.blockedTickets, "blockedTickets")
	assert.ok(Array.isArray(snapshot.sessionSignals), "sessionSignals should be an array")
	assert.ok(Array.isArray(snapshot.closedSessionSignals), "closedSessionSignals should be an array")
}

function assertPressureContract(pressure: Ch5PmPressurePayload): void {
	assert.equal(typeof pressure.generatedAt, "string")
	assert.ok(pressure.pressure)
	assert.equal(typeof pressure.pressure?.level, "string")
	assert.equal(typeof pressure.pressure?.score, "number")
	assert.ok(Array.isArray(pressure.system?.loadAvg), "system.loadAvg should be an array")
}

function assertSystemContract(system: Ch5PmSystemPayload): void {
	assert.equal(typeof system.generatedAt, "string")
	assert.ok(system.system)
	assert.ok(system.memory)
}

test("CH5PM fixture satisfies typed dashboard contract", () => {
	assertSnapshotContract(MOCK_CH5PM_DASHBOARD_STATE.snapshot!)
	assertPressureContract(MOCK_CH5PM_DASHBOARD_STATE.pressure!)
	assertSystemContract(MOCK_CH5PM_DASHBOARD_STATE.system!)
})

test("fetchCh5PmDashboard composes snapshot, pressure, and system payloads", async () => {
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
		assertSnapshotContract(state.snapshot!)
		assertPressureContract(state.pressure!)
		assertSystemContract(state.system!)
		assert.equal(state.streamConnected, false)
		assert.equal(state.streamError, null)
		assert.equal(state.lastEventAt, null)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test("contract check fails loudly when snapshot payload is missing required fields", () => {
	const broken = structuredClone(MOCK_CH5PM_DASHBOARD_STATE.snapshot!)
	delete broken.managerBrief
	assert.throws(() => assertSnapshotContract(broken), /managerBrief is required/)
})
