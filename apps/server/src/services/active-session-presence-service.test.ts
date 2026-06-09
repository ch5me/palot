import { describe, expect, test } from "bun:test"
import {
	createActiveSessionPresenceService,
	getActivePresenceErrorPollDelayMs,
	getActivePresencePollDelayMs,
} from "./active-session-presence-service"
import type { ActiveOpenCodeSessionsSnapshot } from "./opencode-active-sessions"

const DEFAULT_SERVER_URL = "http://127.0.0.1:14096"

function snapshot(sessionIds: string[], refreshedAt = 1000): ActiveOpenCodeSessionsSnapshot {
	return {
		serverUrl: DEFAULT_SERVER_URL,
		clientCount: sessionIds.length,
		sessionCount: sessionIds.length,
		sessions: sessionIds.map((sessionId, index) => ({
			sessionId,
			directory: "/repo",
			pid: 100 + index,
			source: "attach",
			command: `opencode attach --session ${sessionId}`,
		})),
		refreshedAt,
	}
}

describe("active session presence service", () => {
	test("fans out one collector result to multiple subscribers", async () => {
		const delays: number[] = []
		let collectCalls = 0
		const service = createActiveSessionPresenceService({
			collect: async () => {
				collectCalls += 1
				return snapshot(["ses_one"])
			},
			clearTimer: () => {},
			setTimer: (_callback, delayMs) => {
				delays.push(delayMs)
				return delayMs as unknown as ReturnType<typeof setTimeout>
			},
		})
		const seenA: ActiveOpenCodeSessionsSnapshot[] = []
		const seenB: ActiveOpenCodeSessionsSnapshot[] = []

		const unsubscribeA = service.subscribe(DEFAULT_SERVER_URL, {
			onSnapshot: (next) => seenA.push(next),
		})
		const unsubscribeB = service.subscribe(DEFAULT_SERVER_URL, {
			onSnapshot: (next) => seenB.push(next),
		})

		await service.refreshNow(DEFAULT_SERVER_URL)

		expect(collectCalls).toBe(1)
		expect(seenA.map((item) => item.sessionCount)).toEqual([1])
		expect(seenB.map((item) => item.sessionCount)).toEqual([1])
		expect(delays).toEqual([1000])

		unsubscribeA()
		unsubscribeB()
		service.stopAll()
	})

	test("uses stable cadence and exponential error backoff", () => {
		expect(getActivePresencePollDelayMs(0)).toBe(1000)
		expect(getActivePresencePollDelayMs(1)).toBe(2000)
		expect(getActivePresencePollDelayMs(2)).toBe(5000)
		expect(getActivePresencePollDelayMs(99)).toBe(5000)

		expect(getActivePresenceErrorPollDelayMs(1)).toBe(1000)
		expect(getActivePresenceErrorPollDelayMs(2)).toBe(2000)
		expect(getActivePresenceErrorPollDelayMs(3)).toBe(4000)
		expect(getActivePresenceErrorPollDelayMs(99)).toBe(30_000)
	})

	test("serves fresh HTTP snapshots from cache", async () => {
		let now = 1000
		let collectCalls = 0
		const service = createActiveSessionPresenceService({
			collect: async () => {
				collectCalls += 1
				return snapshot([`ses_${collectCalls}`], now)
			},
			now: () => now,
		})

		const first = await service.getSnapshot(DEFAULT_SERVER_URL)
		now += 100
		const second = await service.getSnapshot(DEFAULT_SERVER_URL)
		now += 6000
		const third = await service.getSnapshot(DEFAULT_SERVER_URL)

		expect(first.sessions[0]?.sessionId).toBe("ses_1")
		expect(second.sessions[0]?.sessionId).toBe("ses_1")
		expect(third.sessions[0]?.sessionId).toBe("ses_2")
		expect(collectCalls).toBe(2)
	})
})
