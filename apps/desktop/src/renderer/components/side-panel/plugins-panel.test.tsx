import assert from "node:assert/strict"
import test from "node:test"

test("plugins panel MCP summary counts active and gateway-owned posture", () => {
	const records = [
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
	]
	const activeCount = records.filter((server) => server.runtimeState === "active" || server.lastHealthyAt).length
	const gatewayCount = records.filter((server) => server.canonicalStore === "gateway").length
	const summary = [`2 MCP servers`, `${activeCount} active`, `${gatewayCount} gateway-owned`].join(" · ")
	assert.equal(summary, "2 MCP servers · 1 active · 1 gateway-owned")
	assert.equal(records[0]?.ownershipMode, "cloud-only")
	assert.equal(records[1]?.runtimeState, "projected")
})
