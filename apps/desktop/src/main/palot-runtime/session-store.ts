import { resolveGenUiEntry } from "../../renderer/genui/registry"
import { attachBindingsToTree, createStateDeltaFrame } from "./bindings"
import { LoomDirtyTracker } from "./dirty"
import { clearSessionRevision, getSessionRevision, nextSessionRevision, setSessionRevision } from "./revision"
import type {
	LoomConflictFrame,
	LoomEventFrame,
	LoomNode,
	LoomPatch,
	LoomPollResult,
	LoomStateDeltaFrame,
} from "./wire"

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
	conflicts: LoomConflictFrame[]
	dirty: boolean
	dirtyTracker: LoomDirtyTracker
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
		conflicts: [],
		dirty: false,
		dirtyTracker: new LoomDirtyTracker(),
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

function readNodeField(node: LoomNode | null, nodeId: string, field: string): unknown {
	if (!node) return undefined
	if (node.id === nodeId) {
		const candidate = (node as unknown as Record<string, unknown>)[field]
		if (typeof candidate !== "undefined") return clone(candidate)
		return clone(node.props?.[field])
	}
	for (const child of node.children ?? []) {
		const value = readNodeField(child, nodeId, field)
		if (typeof value !== "undefined") return value
	}
	return undefined
}

function writeNodeField(node: LoomNode, field: string, value: unknown): LoomNode {
	if (field in node && field !== "props") {
		return {
			...node,
			[field]: clone(value),
		}
	}
	return {
		...node,
		props: {
			...(node.props ?? {}),
			[field]: clone(value),
		},
	}
}

function patchNodeField(tree: LoomNode | null, patch: LoomPatch, value = patch.value, rev?: number): LoomNode | null {
	let matched = false
	const nextTree = visitNodes(tree, (node) => {
		if (node.id !== patch.nodeId) return { ...node }
		matched = true
		return {
			...writeNodeField(node, patch.field, value),
			rev: typeof rev === "number" ? rev : node.rev,
		}
	})
	if (!matched) throw new Error(`Unknown Loom node: ${patch.nodeId}`)
	return nextTree
}

function refreshNodeMetadata(tree: LoomNode | null, tracker: LoomDirtyTracker): LoomNode | null {
	return visitNodes(tree, (node) => ({
		...node,
		dirtyFields: tracker.getDirtyFields(node.id),
		meta: {
			...(node.meta ?? {}),
			loomBindings: node.meta?.loomBindings ?? attachBindingsToTree(node).meta?.loomBindings,
		},
	}))
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
	state.tree = refreshNodeMetadata(attachBindingsToTree(tree, rev), state.dirtyTracker)
	state.rev = rev
	state.eventQueue.push({ kind: "tree", rev, tree: clone(state.tree) })
	state.dirty = true
	return { rev }
}

export function patchLoomTree(
	sessionId: string,
	patch: LoomPatch,
): { rev: number; errorCode?: "stale_rev" | "dirty_field"; delta?: LoomPatch[]; held?: LoomConflictFrame } {
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
	const currentValue = readNodeField(state.tree, patch.nodeId, patch.field)
	const node = findLoomNode(state.tree, patch.nodeId)
	const resolution = state.dirtyTracker.resolvePatch({
		node,
		patch,
		humanValue: currentValue,
	})
	const rev = nextSessionRevision(sessionId)
	state.rev = rev
	if (resolution.kind === "held") {
		state.conflicts.push(clone(resolution.conflict))
		state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
		state.dirty = true
		return { rev, errorCode: "dirty_field", held: resolution.conflict }
	}
	state.tree = patchNodeField(state.tree, patch, resolution.value, rev)
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	state.eventQueue.push({ kind: "patch", rev, patch: clone({ ...patch, value: resolution.value, rev }) })
	state.dirty = true
	return { rev }
}

function findLoomNode(tree: LoomNode | null, nodeId: string): LoomNode | null {
	if (!tree) return null
	if (tree.id === nodeId) return tree
	for (const child of tree.children ?? []) {
		const found = findLoomNode(child, nodeId)
		if (found) return found
	}
	return null
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
	const node = findLoomNode(state.tree, delta.nodeId)
	const entry = node ? resolveGenUiEntry(node.component) : undefined
	const value = delta.value
	state.tree = patchNodeField(state.tree, delta as LoomPatch, value)
	state.dirtyTracker.setDirty(delta.nodeId, delta.field, true)
	state.stateDelta.push(createStateDeltaFrame(delta))
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	state.dirty = true
	if (entry?.state[delta.field]) {
		return { rev: state.rev }
	}
	return { rev: state.rev }
}

export function clearLoomDirtyField(sessionId: string, nodeId: string, field: string): { rev: number } {
	const state = ensureSessionState(sessionId)
	state.dirtyTracker.clearDirty(nodeId, field)
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	return { rev: state.rev }
}

export function pollLoomSession(sessionId: string, sinceRev: number): LoomPollResult {
	const state = ensureSessionState(sessionId)
	const events = state.eventQueue.filter((frame) => frame.rev > sinceRev).map((frame) => clone(frame))
	const conflicts = state.conflicts.map((frame) => clone(frame))
	state.dirtyTracker.dequeueConflicts()
	const result: LoomPollResult = {
		rev: state.rev,
		events,
		stateDelta: clone(state.stateDelta),
		conflicts,
		treeSlice: sinceRev < state.rev && state.tree ? clone(state.tree) : null,
	}
	state.eventQueue = state.eventQueue.filter((frame) => frame.kind === "event")
	state.stateDelta = []
	state.conflicts = []
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
			conflicts: state.conflicts.map((frame) => clone(frame)),
		}
		: null
}
