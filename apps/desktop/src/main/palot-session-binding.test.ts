import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-session-binding-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("session binding persists and loads by OpenCode session id", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-session-binding")
		const binding = mod.createSessionBinding({
			openCodeSessionId: "ses_123",
			browserLaneId: "default",
			magicBrowserSessionId: "mb_123",
			status: "attached",
			now: 123,
		})
		mod.upsertSessionBinding(binding)
		const loaded = mod.getSessionBindingByOpenCodeSession("ses_123")
		assert.equal(loaded?.openCodeSessionId, "ses_123")
		assert.equal(loaded?.browserLaneId, "default")
		assert.equal(loaded?.magicBrowserSessionId, "mb_123")
		assert.equal(loaded?.status, "attached")
	} finally {
		cleanup()
	}
})

test("releaseSessionBinding marks released without deleting record", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-session-binding")
		mod.upsertSessionBinding(
			mod.createSessionBinding({
				openCodeSessionId: "ses_release",
				browserLaneId: "lane-a",
				status: "attached",
				now: 100,
			}),
		)
		const released = mod.releaseSessionBinding("ses_release", 200)
		assert.equal(released?.status, "released")
		assert.equal(released?.releasedAt, 200)
		const listed = mod.listSessionBindings()
		assert.equal(listed.length, 1)
		assert.equal(listed[0]?.status, "released")
	} finally {
		cleanup()
	}
})

test("authority contract keeps lane as transport and magic browser as browser authority", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-session-binding")
		const authority = mod.createSessionBindingAuthority({
			openCodeSessionId: "ses_authority",
			browserLaneId: "lane-1",
			magicBrowserSessionId: "mb-1",
		})
		assert.equal(authority.openCodeSessionId, "ses_authority")
		assert.equal(authority.browserLaneId, "lane-1")
		assert.equal(authority.magicBrowserSessionId, "mb-1")
		assert.equal(mod.SESSION_BINDING_AUTHORITY_CONTRACT.agentAuthority, "OpenCode session id")
	} finally {
		cleanup()
	}
})
