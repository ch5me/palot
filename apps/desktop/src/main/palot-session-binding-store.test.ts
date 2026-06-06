import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-binding-store-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("binding lifecycle create idle delete works", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-session-binding-store")
		const binding = mod.ensureSessionBindingForSession({ sessionId: "ses_lifecycle" })
		assert.equal(binding.status, "attaching")
		const attached = mod.markSessionBindingAttached("ses_lifecycle")
		assert.equal(attached?.status, "attached")
		const released = mod.releaseBindingForSession("ses_lifecycle")
		assert.equal(released?.status, "released")
	} finally {
		cleanup()
	}
})

test("reconcile restores active released bindings and releases inactive ones", async () => {
	const cleanup = setupTempXdg()
	try {
		const store = await import("./palot-session-binding-store")
		store.ensureSessionBindingForSession({ sessionId: "ses_active" })
		store.markSessionBindingAttached("ses_active")
		store.ensureSessionBindingForSession({ sessionId: "ses_inactive" })
		store.markSessionBindingAttached("ses_inactive")
		store.releaseBindingForSession("ses_active")
		const results = store.reconcileBindingsWithActiveSessions(["ses_active"])
		assert.ok(results.some((entry) => entry.openCodeSessionId === "ses_active" && entry.status === "restored"))
		assert.ok(results.some((entry) => entry.openCodeSessionId === "ses_inactive" && entry.status === "released"))
	} finally {
		cleanup()
	}
})

test("event adapter maps session events into binding lifecycle", async () => {
	const cleanup = setupTempXdg()
	try {
		const store = await import("./palot-session-binding-store")
		const created = store.applyBindingLifecycleEvent({
			type: "session.created",
			properties: { info: { id: "ses_evt" } },
		} as never)
		assert.equal(created?.status, "attaching")
		const idle = store.applyBindingLifecycleEvent({
			type: "session.idle",
			properties: { sessionID: "ses_evt" },
		} as never)
		assert.equal(idle?.status, "attached")
		const statusIdle = store.applyBindingLifecycleEvent({
			type: "session.status",
			properties: { sessionID: "ses_evt", status: { type: "idle" } },
		} as never)
		assert.equal(statusIdle?.status, "attached")
		const deleted = store.applyBindingLifecycleEvent({
			type: "session.deleted",
			properties: { info: { id: "ses_evt" } },
		} as never)
		assert.equal(deleted?.status, "released")
	} finally {
		cleanup()
	}
})
