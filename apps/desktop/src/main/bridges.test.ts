import assert from "node:assert/strict"
import test from "node:test"
import { bridgeActivity, listBridges } from "./bridges"

test("listBridges returns the full truthful roster", async () => {
	const result = await listBridges()
	assert.ok(Array.isArray(result.bridges))
	assert.ok(result.bridges.length >= 4, `expected full roster, got ${result.bridges.length}`)
	const ids = result.bridges.map((channel) => channel.id)
	assert.ok(ids.includes("opencode"))
	assert.ok(ids.includes("skills"))
	assert.ok(ids.includes("mcp"))
	assert.ok(ids.includes("contacts"))
})

test("each channel carries a truthful status", async () => {
	const result = await listBridges()
	for (const channel of result.bridges) {
		assert.ok(
			channel.status === "connected" || channel.status === "disconnected" || channel.status === "soon",
			`channel ${channel.id} has unexpected status: ${channel.status}`,
		)
		assert.equal(typeof channel.alive, "boolean")
	}
})

test("soon/draft channels are not marked connected without a real probe", async () => {
	const result = await listBridges()
	const candidates = result.bridges.filter((channel) =>
		["contacts", "instagram", "threads", "gchat", "x", "telegram", "gmail", "imessage"].includes(
			channel.id,
		),
	)
	assert.ok(candidates.length > 0)
	for (const channel of candidates) {
		assert.notEqual(channel.status, "connected", `${channel.id} should not be marked connected`)
	}
})

test("bridgeActivity returns a messages array for known channels", async () => {
	const result = await bridgeActivity("opencode", 5)
	assert.ok(Array.isArray(result.messages))
})

test("bridgeActivity returns empty messages for unknown channel ids", async () => {
	const result = await bridgeActivity("does-not-exist", 5)
	assert.deepEqual(result.messages, [])
})
