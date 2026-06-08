import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import {
	type ActiveOpenCodeClientProcess,
	createActiveOpenCodeSessionCollector,
} from "./opencode-active-sessions"

function plainProcess(
	overrides: Partial<ActiveOpenCodeClientProcess> = {},
): ActiveOpenCodeClientProcess {
	return {
		pid: 123,
		command: "opencode /repo",
		directory: "/repo",
		startedAtMs: 100_000,
		source: "plain",
		...overrides,
	}
}

function rootSession(id: string, created = 90_000): Session {
	return {
		id,
		time: {
			created,
			updated: created,
		},
	} as Session
}

describe("active OpenCode session collector", () => {
	test("caches complete inferred mappings for unchanged process groups", async () => {
		let now = 1_000_000
		let sessionListCalls = 0
		const collector = createActiveOpenCodeSessionCollector({
			listClientProcesses: async () => [plainProcess()],
			listRecentRootSessions: async (_serverUrl, _directory, limit) => {
				sessionListCalls += 1
				expect(limit).toBe(10)
				return [rootSession("ses_cached")]
			},
			now: () => now,
		})

		const first = await collector.getActiveOpenCodeSessions("http://127.0.0.1:4096")
		const second = await collector.getActiveOpenCodeSessions("http://127.0.0.1:4096")
		now += 46_000
		const third = await collector.getActiveOpenCodeSessions("http://127.0.0.1:4096")

		expect(first.sessions[0]?.sessionId).toBe("ses_cached")
		expect(second.sessions[0]?.sessionId).toBe("ses_cached")
		expect(third.sessions[0]?.sessionId).toBe("ses_cached")
		expect(sessionListCalls).toBe(2)
	})

	test("does not cache missing inferred mappings", async () => {
		let sessionListCalls = 0
		const collector = createActiveOpenCodeSessionCollector({
			listClientProcesses: async () => [plainProcess()],
			listRecentRootSessions: async () => {
				sessionListCalls += 1
				return []
			},
		})

		const first = await collector.getActiveOpenCodeSessions("http://127.0.0.1:4096")
		const second = await collector.getActiveOpenCodeSessions("http://127.0.0.1:4096")

		expect(first.sessions).toEqual([])
		expect(second.sessions).toEqual([])
		expect(sessionListCalls).toBe(2)
	})
})
