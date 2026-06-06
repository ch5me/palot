import { describe, expect, test } from "bun:test"
import { createStore } from "jotai"
import type { BrowserActionEvent } from "../../preload/api"
import {
	browserActionEventsAtom,
	clearBrowserActionEventsAtom,
	pushBrowserActionEventAtom,
} from "./browser-actions"

function createEvent(id: string, laneId = "lane_a"): BrowserActionEvent {
	return {
		id,
		sessionId: "ses_renderer",
		laneId,
		source: "tool_request",
		sequence: 1,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: 1,
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "move",
	}
}

describe("browser action event atom", () => {
	test("dedupes on id and laneId", () => {
		const store = createStore()
		store.set(pushBrowserActionEventAtom, createEvent("evt-1"))
		store.set(pushBrowserActionEventAtom, createEvent("evt-1"))
		expect(store.get(browserActionEventsAtom)).toHaveLength(1)
	})

	test("caps event queue length", () => {
		const store = createStore()
		for (let index = 0; index < 120; index++) {
			store.set(pushBrowserActionEventAtom, createEvent(`evt-${index}`))
		}
		expect(store.get(browserActionEventsAtom)).toHaveLength(100)
	})

	test("clear resets queue", () => {
		const store = createStore()
		store.set(pushBrowserActionEventAtom, createEvent("evt-1"))
		store.set(clearBrowserActionEventsAtom)
		expect(store.get(browserActionEventsAtom)).toEqual([])
	})
})
