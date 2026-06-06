import type { BrowserActionEvent } from "../preload/api"
import { publishBrowserAction } from "./palot-browser-ipc"

function createTakeoverEvent(input: {
	sessionId: string
	kind: "humanTakeoverPaused" | "humanTakeoverResumed"
	reason?: string | null
}): BrowserActionEvent {
	return {
		id: `${input.sessionId}:${input.kind}`,
		sessionId: input.sessionId,
		laneId: null,
		source: "human_takeover",
		sequence: 0,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: Date.now(),
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: input.kind,
		reason: input.reason ?? null,
	}
}

export async function pauseForHumanTakeover(sessionId: string, reason?: string): Promise<BrowserActionEvent> {
	return await publishBrowserAction({
		event: createTakeoverEvent({ sessionId, kind: "humanTakeoverPaused", reason }),
	})
}

export async function resumeFromHumanTakeover(sessionId: string, reason?: string): Promise<BrowserActionEvent> {
	return await publishBrowserAction({
		event: createTakeoverEvent({ sessionId, kind: "humanTakeoverResumed", reason }),
	})
}
