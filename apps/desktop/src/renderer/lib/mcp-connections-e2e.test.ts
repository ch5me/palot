import assert from "node:assert/strict"
import test from "node:test"
import {
	assessMcpConnectionsDomReadiness,
	buildMcpE2eSnapshot,
} from "./mcp-connections-e2e"

test("buildMcpE2eSnapshot models settings-to-plugins posture", () => {
	const snapshot = buildMcpE2eSnapshot([
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

	assert.equal(snapshot.connectionsRoute, "/settings/connections")
	assert.equal(snapshot.connectionsLabel, "Connections")
	assert.deepEqual(snapshot.pluginSummary.serverNames, ["github", "postgres"])
	assert.deepEqual(snapshot.activeConnectionNames, ["github"])
	assert.deepEqual(snapshot.gatewayConnectionNames, ["github"])
	assert.deepEqual(snapshot.duplicateConnectionFamilies, [])
	assert.equal(snapshot.domReadiness, undefined)
})

test("DOM readiness prefers visible loading blockers over stale DOM snapshot positives", () => {
	const readiness = assessMcpConnectionsDomReadiness({
		visibleText: "elf Loading projects...",
		domSnapshot: "Connections Browse MCP catalog Test connection Connect notion",
	})

	assert.equal(readiness.ready, false)
	assert.equal(readiness.blockerScore, 10)
	assert.ok(readiness.positiveScore >= 3)
	assert.deepEqual(
		readiness.matchedSignals.map((signal) => signal.id),
		["connections-heading-snapshot", "browse-catalog-snapshot", "connection-actions-snapshot", "loading-projects"],
	)
})

test("DOM readiness passes once visible connections UI is loaded", () => {
	const snapshot = buildMcpE2eSnapshot(
		[
			{
				name: "notion",
				status: "connected",
				runtimeState: "active",
				lastHealthyAt: "2026-06-06T00:00:00.000Z",
				canonicalStore: "local",
				ownershipMode: "local-only",
			},
		],
		{
			visibleText:
				"Connections Connect MCP servers for docs, data, and runtime actions without leaving Elf. Browse MCP catalog Test connection Connect notion",
		},
	)

	assert.equal(snapshot.domReadiness?.ready, true)
	assert.equal(snapshot.domReadiness?.blockerScore, 0)
	assert.ok((snapshot.domReadiness?.positiveScore ?? 0) >= (snapshot.domReadiness?.threshold ?? 0))
})

test("buildMcpE2eSnapshot detects duplicate logical connections by target identity", () => {
	const snapshot = buildMcpE2eSnapshot([
		{
			name: "notion",
			transport: "remote-http",
			target: "https://mcp.notion.com/mcp",
			status: "connected",
			runtimeState: "active",
			lastHealthyAt: "2026-06-06T00:00:00.000Z",
		},
		{
			name: "notion-test",
			transport: "remote-http",
			target: "https://mcp.notion.com/mcp/",
			status: "degraded",
			runtimeState: "degraded",
		},
	])

	assert.deepEqual(snapshot.duplicateConnectionFamilies, [
		{
			identity: "remote:https://mcp.notion.com/mcp",
			names: ["notion", "notion-test"],
		},
	])
})
