import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-magic-browser-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("ensureMagicBrowserSessionForBinding persists only stable magicBrowserSessionId", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const laneMod = await import("./browser-lane-manager")
		const magicMod = await import("./palot-magic-browser")
		await laneMod.initBrowserLaneManager()
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_magic",
				browserLaneId: "default",
				status: "attached",
			}),
		)
		const binding = await magicMod.ensureMagicBrowserSessionForBinding("ses_magic")
		assert.ok(binding?.magicBrowserSessionId)
		const persisted = bindingMod.getSessionBindingByOpenCodeSession("ses_magic")
		assert.ok(persisted?.magicBrowserSessionId)
		assert.equal("viewerUrl" in persisted, false)
		assert.equal("authToken" in persisted, false)
		assert.ok(magicMod.getDerivedViewerUrlForBinding("ses_magic"))
	} finally {
		cleanup()
	}
})

test("clearMagicBrowserViewerState removes derived viewer url but keeps binding", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const laneMod = await import("./browser-lane-manager")
		const magicMod = await import("./palot-magic-browser")
		await laneMod.initBrowserLaneManager()
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_magic_clear",
				browserLaneId: "default",
				status: "attached",
			}),
		)
		await magicMod.ensureMagicBrowserSessionForBinding("ses_magic_clear")
		magicMod.clearMagicBrowserViewerState("ses_magic_clear")
		assert.equal(magicMod.getDerivedViewerUrlForBinding("ses_magic_clear"), null)
		assert.ok(bindingMod.getSessionBindingByOpenCodeSession("ses_magic_clear"))
	} finally {
		cleanup()
	}
})
