import assert from "node:assert/strict"
import test from "node:test"
import { MOCK_CH5PM_DASHBOARD_STATE } from "./fixtures"

test("dashboard panel fixture keeps safe empty-state and parity data surfaces", () => {
	const snapshot = MOCK_CH5PM_DASHBOARD_STATE.snapshot
	assert.ok(snapshot)
	assert.equal(Array.isArray(snapshot?.activeTickets), true)
	assert.equal(Array.isArray(snapshot?.queueTickets), true)
	assert.equal(Array.isArray(snapshot?.closedSessionSignals), true)
	assert.equal(Array.isArray(snapshot?.claudeCodeSessions), true)
	assert.equal(Array.isArray(snapshot?.sessionSignals), true)
	assert.equal(Array.isArray(snapshot?.idleNudges), true)
	assert.equal(Array.isArray(snapshot?.runtime?.cmux?.slots), true)
	assert.equal(typeof snapshot?.managerBrief, "string")
	assert.equal(typeof MOCK_CH5PM_DASHBOARD_STATE.pressure?.pressure?.level, "string")
	assert.equal(typeof MOCK_CH5PM_DASHBOARD_STATE.system?.generatedAt, "string")
	assert.equal(snapshot?.closedSessionSignals?.[0]?.reopenable, true)
})
