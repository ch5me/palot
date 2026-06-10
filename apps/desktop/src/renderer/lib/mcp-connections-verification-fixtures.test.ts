import assert from "node:assert/strict"
import test from "node:test"
import { summarizeMcpVerification } from "./mcp-connections-verification"

const fixtureScenarios = {
	mixed: [
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
	],
	cloudOnly: [
		{
			name: "notion",
			status: "needs_auth",
			runtimeState: "degraded",
			lastHealthyAt: null,
			canonicalStore: "gateway",
			ownershipMode: "cloud-only",
		},
	],
	localOnly: [
		{
			name: "filesystem",
			status: "connected",
			runtimeState: "active",
			lastHealthyAt: "2026-06-06T00:00:00.000Z",
			canonicalStore: "local",
			ownershipMode: "local-only",
		},
	],
} as const

test("MCP verification fixtures remain stable", () => {
	const snapshots = Object.fromEntries(
		Object.entries(fixtureScenarios).map(([scenario, records]) => [scenario, summarizeMcpVerification([...records])]),
	)

	assert.deepEqual(snapshots, {
		mixed: {
			serverNames: ["github", "postgres"],
			activeCount: 1,
			gatewayCount: 1,
			ownershipModes: ["cloud-only", "local-only"],
			hydrationStates: ["active", "projected"],
			statuses: ["connected", "configured"],
		},
		cloudOnly: {
			serverNames: ["notion"],
			activeCount: 0,
			gatewayCount: 1,
			ownershipModes: ["cloud-only"],
			hydrationStates: ["inactive"],
			statuses: ["needs_auth"],
		},
		localOnly: {
			serverNames: ["filesystem"],
			activeCount: 1,
			gatewayCount: 0,
			ownershipModes: ["local-only"],
			hydrationStates: ["active"],
			statuses: ["connected"],
		},
	})
})
