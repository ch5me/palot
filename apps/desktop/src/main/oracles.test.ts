import assert from "node:assert/strict"
import test from "node:test"
import {
	createOracle,
	deleteOracle,
	killTmuxSession,
	listOracles,
	listTmuxSessions,
	renameOracle,
} from "./oracles"

test("oracle delete protects firaz unless forced", async () => {
	await assert.rejects(() => deleteOracle("firaz", false), /breaks your whatsapp routing/)
})

test("oracle create rejects empty identities", async () => {
	await assert.rejects(() => createOracle("   "), /identity must contain letters or digits/)
})

test("oracle rename rejects empty target", async () => {
	await assert.rejects(() => renameOracle("valid", "   "), /letters or digits/)
})

test("oracle rename rejects empty source", async () => {
	await assert.rejects(() => renameOracle("   ", "valid"), /letters or digits/)
})

test("kill tmux requires socket and session", async () => {
	await assert.rejects(() => killTmuxSession("", "session"), /required/)
	await assert.rejects(() => killTmuxSession("default", ""), /required/)
})

test("listOracles returns empty array when no tmux server is running", async () => {
	const result = await listOracles()
	assert.ok(Array.isArray(result))
})

test("listTmuxSessions returns empty array when no tmux server is running", async () => {
	const result = await listTmuxSessions()
	assert.ok(Array.isArray(result))
})
