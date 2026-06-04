import assert from "node:assert/strict"
import test from "node:test"
import { reopenClosedSession } from "./actions"
import { MOCK_CH5PM_DASHBOARD_STATE } from "./fixtures"

const row = MOCK_CH5PM_DASHBOARD_STATE.snapshot?.closedSessionSignals?.[0]
if (!row) {
	throw new Error("Expected closed session fixture")
}

test("reopenClosedSession returns CMUX destination on success", async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = ((async () =>
		Response.json({ ok: true, workspace: "CH5PM", surface: "Done lane" })) as unknown) as typeof fetch

	try {
		const result = await reopenClosedSession("http://daemon.test", row)
		assert.equal(result.openedIn, "CH5PM / Done lane")
	} finally {
		globalThis.fetch = originalFetch
	}
})

test("reopenClosedSession throws backend error on failure", async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = ((async () =>
		new Response(JSON.stringify({ ok: false, error: "no surface bound" }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		})) as unknown) as typeof fetch

	try {
		await assert.rejects(
			() => reopenClosedSession("http://daemon.test", row),
			/no surface bound/,
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})
