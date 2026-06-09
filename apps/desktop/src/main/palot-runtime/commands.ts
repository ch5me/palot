import {
	endLoomSession,
	openLoomSession,
	patchLoomTree,
	pollLoomSession,
	recordLoomStateDelta,
	renderLoomTree,
} from "./session-store"
import {
	decodeWirePayload,
	type LoomPatchPayload,
	type LoomPollPayload,
	type LoomRenderPayload,
	type LoomSessionOpenPayload,
	type LoomStatePayload,
} from "./wire"

// Re-export store functions for callers that import from commands module
export {
	openLoomSession,
	endLoomSession,
	renderLoomTree,
	patchLoomTree,
	pollLoomSession,
	recordLoomStateDelta as pushLoomStateDelta,
	clearLoomDirtyField,
} from "./session-store"

export function sessionOpenCommand(sessionId: string, payloadToon: string): { rev: number; title: string } {
	const payload = decodeWirePayload<LoomSessionOpenPayload>(payloadToon)
	const result = openLoomSession(sessionId)
	return { ...result, title: payload.title }
}

export function sessionEndCommand(sessionId: string): { rev: number } {
	return endLoomSession(sessionId)
}

export function renderCommand(sessionId: string, payloadToon: string): { rev: number } {
	const payload = decodeWirePayload<LoomRenderPayload>(payloadToon)
	return renderLoomTree(sessionId, payload.tree)
}

export function patchCommand(
	sessionId: string,
	payloadToon: string,
): { rev: number; errorCode?: "stale_rev" | "dirty_field"; delta?: unknown; held?: unknown } {
	const payload = decodeWirePayload<LoomPatchPayload>(payloadToon)
	return patchLoomTree(sessionId, payload.patch)
}

export function pollCommand(sessionId: string, payloadToon: string) {
	const payload = decodeWirePayload<LoomPollPayload>(payloadToon)
	return pollLoomSession(sessionId, payload.rev)
}

export function stateCommand(sessionId: string, payloadToon: string): { rev: number } {
	const payload = decodeWirePayload<LoomStatePayload>(payloadToon)
	return recordLoomStateDelta(sessionId, payload.delta)
}
