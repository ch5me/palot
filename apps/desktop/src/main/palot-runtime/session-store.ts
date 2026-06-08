import { clearSessionRevision, getSessionRevision, nextSessionRevision, setSessionRevision } from "./revision"
import type { LoomEventFrame, LoomNode, LoomPatch, LoomPollResult, LoomStateDeltaFrame } from "./wire"

export interface LoomFrameBase {
	kind: "tree" | "patch" | "event"
	rev: number
}

export interface LoomTreeFrame extends LoomFrameBase {
	kind: "tree"
	tree: LoomNode | null
}

export interface LoomPatchFrame extends LoomFrameBase {
	kind: "patch"
	patch: LoomPatch
}

export interface LoomEventQueueFrame extends LoomFrameBase {
	kind: "event"
	event: LoomEventFrame
}

export type LoomFrame = LoomTreeFrame | LoomPatchFrame | LoomEventQueueFrame

interface LoomSessionState {
	tree: LoomNode | null
	rev: number
	eventQueue: LoomFrame[]
	stateDelta: LoomStateDeltaFrame[]
	dirty: boolean
}

const sessionStore = new Map<string, LoomSessionState>()

function clone<T>(value: T): T {
	return structuredClone(value)
}

function ensureSessionState(sessionId: string): LoomSessionState {
	const existing = sessionStore.get(sessionId)
	if (existing) return existing
	const created: LoomSessionState = {
		tree: null,
		rev: setSessionRevision(sessionId, 0),
		eventQueue: [],
		stateDelta: [],
		dirty: false,
	}
	sessionStore.set(sessionId, created)
	return created
}

function visitNodes(node: LoomNode | null, visitor: (node: LoomNode) => LoomNode): LoomNode | null {
	if (!node) return null
	const next = visitor(node)
	if (!next.children || next.children.length === 0) return next
	return {
		...next,
		children: next.children.map((child) => visitNodes(child, visitor)).filter(Boolean) as LoomNode[],
	}
}

function patchNodeField(tree: LoomNode | null, patch: LoomPatch): LoomNode | null {
	let matched = false
	const nextTree = visitNodes(tree, (node) => {
		if (node.id !== patch.nodeId) return { ...node }
		matched = true
		return {
			...node,
			[patch.field]: clone(patch.value),
		}
	})
	if (!matched) throw new Error(`Unknown Loom node: ${patch.nodeId}`)
	return nextTree
}

export function openLoomSession(sessionId: string): { rev: number } {
	const state = ensureSessionState(sessionId)
	return { rev: state.rev }
}

export function endLoomSession(sessionId: string): { rev: number } {
	const rev = getSessionRevision(sessionId)
	sessionStore.delete(sessionId)
	clearSessionRevision(sessionId)
	return { rev }
}

export function renderLoomTree(sessionId: string, tree: LoomNode): { rev: number } {
	const state = ensureSessionState(sessionId)
	const rev = nextSessionRevision(sessionId)
	state.tree = clone(tree)
	state.rev = rev
	state.eventQueue.push({ kind: "tree", rev, tree: clone(tree) })
	state.dirty = true
	return { rev }
}

export function patchLoomTree(
	sessionId: string,
	patch: LoomPatch,
): { rev: number; errorCode?: "stale_rev"; delta?: LoomPatch[] } {
	const state = ensureSessionState(sessionId)
	if (typeof patch.rev === "number" && patch.rev !== state.rev) {
		return {
			rev: state.rev,
			errorCode: "stale_rev",
			delta: state.eventQueue
				.filter((frame): frame is LoomPatchFrame => frame.kind === "patch")
				.map((frame) => clone(frame.patch)),
		}
	}
	state.tree = patchNodeField(state.tree, patch)
	const rev = nextSessionRevision(sessionId)
	state.rev = rev
	state.eventQueue.push({ kind: "patch", rev, patch: clone({ ...patch, rev }) })
	state.dirty = true
	return { rev }
}

export function queueLoomEvent(sessionId: string, event: LoomEventFrame): { rev: number } {
	const state = ensureSessionState(sessionId)
	state.eventQueue.push({
		kind: "event",
		rev: state.rev,
		event: {
			type: event.type,
			nodeId: event.nodeId,
			payload: event.payload ? clone(event.payload) : undefined,
		},
	})
	return { rev: state.rev }
}

export function recordLoomStateDelta(sessionId: string, delta: LoomStateDeltaFrame): { rev: number } {
	const state = ensureSessionState(sessionId)
	state.stateDelta.push(clone(delta))
	state.dirty = true
	return { rev: state.rev }
}

export function pollLoomSession(sessionId: string, sinceRev: number): LoomPollResult {
	const state = ensureSessionState(sessionId)
	const events = state.eventQueue.filter((frame) => frame.rev > sinceRev).map((frame) => clone(frame))
	const result: LoomPollResult = {
		rev: state.rev,
		events,
		stateDelta: clone(state.stateDelta),
		treeSlice: sinceRev < state.rev && state.tree ? clone(state.tree) : null,
	}
	state.eventQueue = state.eventQueue.filter((frame) => frame.kind === "event")
	state.stateDelta = []
	state.dirty = false
	return result
}

export function getLoomSessionState(sessionId: string): LoomSessionState | null {
	const state = sessionStore.get(sessionId)
	return state
		? {
			...state,
			tree: state.tree ? clone(state.tree) : null,
			eventQueue: state.eventQueue.map((frame) => clone(frame)),
			stateDelta: state.stateDelta.map((frame) => clone(frame)),
		}
		: null
}
