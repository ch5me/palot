import { afterEach, describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { createStore } from "jotai"
import type { SessionEntry } from "./sessions"
import {
	addPermissionAtom,
	attachedSessionFamily,
	replaceSessionPresenceAtom,
	setSessionErrorAtom,
	sessionFamily,
	sessionIdsAtom,
	upsertSessionAtom,
} from "./sessions"
import { agentFamily } from "./derived/agents"
import { effectivePermissionFamily, sessionDescendantIdsFamily } from "./derived/session-requests"

const testStore = createStore()
const readSessionEntry = (sessionId: string): SessionEntry | null => testStore.get(sessionFamily(sessionId))

function makeSession(id: string, parentID?: string): Session {
	return {
		id,
		projectID: "proj-test",
		title: id,
		parentID,
		directory: "/tmp/palot-test",
		time: { created: 1, updated: 2 },
	} as Session
}

afterEach(() => {
	testStore.set(sessionIdsAtom, new Set())
})

describe("session sync regressions", () => {
	test("hidden active session fixture restores canonical session entry", () => {
		testStore.set(upsertSessionAtom, { session: makeSession("ses_hidden"), directory: "/tmp/palot-test" })
		const entry = readSessionEntry("ses_hidden")
		expect(entry?.visibilityReason).toBe("visible")
		expect(entry?.lastActivityAt).toBe(2)
	})

	test("active presence preserves inferred source without marking attached", () => {
		testStore.set(upsertSessionAtom, { session: makeSession("ses_inferred"), directory: "/tmp/palot-test" })
		testStore.set(replaceSessionPresenceAtom, [
			{ sessionId: "ses_inferred", source: "inferred" },
		])

		const entry = readSessionEntry("ses_inferred")
		const agent = testStore.get(agentFamily("ses_inferred"))
		expect(entry?.presenceSource).toBe("inferred")
		expect(testStore.get(attachedSessionFamily("ses_inferred"))).toBe(false)
		expect(agent?.presenceSource).toBe("inferred")
		expect(agent?.isAttached).toBe(false)
	})

	test("active presence marks explicit attach source as attached", () => {
		testStore.set(upsertSessionAtom, { session: makeSession("ses_attached"), directory: "/tmp/palot-test" })
		testStore.set(replaceSessionPresenceAtom, [{ sessionId: "ses_attached", source: "attach" }])

		const entry = readSessionEntry("ses_attached")
		const agent = testStore.get(agentFamily("ses_attached"))
		expect(entry?.presenceSource).toBe("attach")
		expect(testStore.get(attachedSessionFamily("ses_attached"))).toBe(true)
		expect(agent?.presenceSource).toBe("attach")
		expect(agent?.isAttached).toBe(true)
	})

	test("child waiting bubbles through session request tree", () => {
		testStore.set(upsertSessionAtom, { session: makeSession("ses_parent"), directory: "/tmp/palot-test" })
		testStore.set(upsertSessionAtom, {
			session: makeSession("ses_child", "ses_parent"),
			directory: "/tmp/palot-test",
		})
		testStore.set(addPermissionAtom, {
			sessionId: "ses_child",
			permission: {
				id: "perm_child",
				permission: "file.write",
				sessionID: "ses_child",
				patterns: ["src/example.ts"],
				metadata: {},
				always: ["allow", "deny"],
			},
		})

		const effectivePermission = testStore.get(effectivePermissionFamily("ses_parent"))
		expect(effectivePermission?.sessionId).toBe("ses_child")
		expect(testStore.get(sessionDescendantIdsFamily("ses_parent"))).toEqual(["ses_child"])
	})

	test("timeout error marks parent-child divergence drift flag", () => {
		testStore.set(upsertSessionAtom, { session: makeSession("ses_child_timeout"), directory: "/tmp/palot-test" })
		testStore.set(setSessionErrorAtom, {
			sessionId: "ses_child_timeout",
			error: {
				name: "TimeoutError",
				data: { message: "Task timed out after 60s" },
			},
		})
		const entry = readSessionEntry("ses_child_timeout")
		expect(entry?.driftFlags).toContain("timed-out-parent-live-child")
	})
})
