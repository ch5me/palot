import assert from "node:assert/strict"
import test from "node:test"
import { summarizeMcpVerification } from "./mcp-connections-verification"

test("summarizeMcpVerification counts active and gateway-owned records", () => {
	const snapshot = summarizeMcpVerification([
		{
			name: "github",
			status: "connected",
			runtimeState: "active",
			lastHealthyAt: "2026-06-06T00:00:00.000Z",
			canonicalStore: "gateway",
			ownershipMode: "cloud-only",
		},
		{
			name: "postgres",
			status: "configured",
			runtimeState: "projected",
			lastHealthyAt: null,
			canonicalStore: "local",
			ownershipMode: "local-only",
		},
	])

	assert.deepEqual(snapshot.serverNames, ["github", "postgres"])
	assert.equal(snapshot.activeCount, 1)
	assert.equal(snapshot.gatewayCount, 1)
	assert.deepEqual(snapshot.ownershipModes, ["cloud-only", "local-only"])
	assert.deepEqual(snapshot.hydrationStates, ["active", "projected"])
	assert.deepEqual(snapshot.statuses, ["connected", "configured"])
})

test("summarizeMcpVerification derives fallback statuses and hydration", () => {
	const snapshot = summarizeMcpVerification([
		{
			name: "notion",
			authState: "failed",
			testState: "failing",
			runtimeState: "degraded",
		},
	])

	assert.equal(snapshot.activeCount, 0)
	assert.equal(snapshot.gatewayCount, 0)
	assert.deepEqual(snapshot.ownershipModes, ["local-only"])
	assert.deepEqual(snapshot.hydrationStates, ["inactive"])
	assert.deepEqual(snapshot.statuses, ["degraded"])
})
