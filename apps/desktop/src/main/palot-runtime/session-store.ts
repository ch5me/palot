import { resolveGenUiEntry } from "../../renderer/genui/registry"
import { attachBindingsToTree, createStateDeltaFrame } from "./bindings"
import { LoomDirtyTracker } from "./dirty"
import { deleteSessionSnapshot, readSessionSnapshot, writeSessionSnapshot } from "./persistence"
import { clearSessionRevision, getSessionRevision, nextSessionRevision, setSessionRevision } from "./revision"
import type {
	LoomConflictFrame,
	LoomConflictResolvedEventPayload,
	LoomEventFrame,
	LoomNode,
	LoomPatch,
	LoomPollResult,
	LoomStateDeltaFrame,
} from "./wire"

export interface LoomFrameBase {
	kind: "tree" | "patch" | "append" | "event"
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

export interface LoomAppendFrame extends LoomFrameBase {
	kind: "append"
	patch: LoomPatch
}

export interface LoomEventQueueFrame extends LoomFrameBase {
	kind: "event"
	event: LoomEventFrame
}

export type LoomFrame = LoomTreeFrame | LoomPatchFrame | LoomAppendFrame | LoomEventQueueFrame

interface LoomSessionState {
	tree: LoomNode | null
	rev: number
	nodeRevisions: Map<string, number>
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
	const snapshot = readSessionSnapshot(sessionId)
	const restoredTree = snapshot?.tree ?? null
	const created: LoomSessionState = {
		tree: restoredTree,
		rev: setSessionRevision(sessionId, snapshot?.rev ?? 0),
		nodeRevisions: buildNodeRevisionMap(restoredTree),
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

function patchNodeField(
	tree: LoomNode | null,
	patch: LoomPatch,
	value = patch.value,
	nodeRev?: number,
): LoomNode | null {
	let matched = false
	const nextTree = visitNodes(tree, (node) => {
		if (node.id !== patch.nodeId) return { ...node }
		matched = true
		const currentValue =
			typeof ((node as unknown as Record<string, unknown>)[patch.field]) === "string"
				? (((node as unknown as Record<string, unknown>)[patch.field]) as string)
				: typeof node.props?.[patch.field] === "string"
					? (node.props?.[patch.field] as string)
					: null
		const nextValue = patch.append && currentValue !== null ? `${currentValue}${String(value)}` : value
		return {
			...writeNodeField(node, patch.field, nextValue),
			rev: typeof nodeRev === "number" ? nodeRev : node.rev,
		}
	})
	if (!matched) throw new Error(`Unknown Loom node: ${patch.nodeId}`)
	return nextTree
}

function persistSessionState(sessionId: string, state: LoomSessionState): void {
	writeSessionSnapshot(sessionId, state.rev, state.tree ? clone(state.tree) : null)
}

function buildNodeRevisionMap(tree: LoomNode | null): Map<string, number> {
	const revisions = new Map<string, number>()
	visitNodes(tree, (node) => {
		revisions.set(node.id, node.rev ?? 0)
		return { ...node }
	})
	return revisions
}

function refreshNodeMetadata(tree: LoomNode | null, tracker: LoomDirtyTracker): LoomNode | null {
	return visitNodes(tree, (node) => {
		const attachedNode = attachBindingsToTree(node, Math.max((node.rev ?? 1) - 1, 0))
		const bindings = (node.meta?.loomBindings ?? attachedNode.meta?.loomBindings) as
			| {
					conflictPolicy?: "agent-wins" | "human-wins" | "merge" | "ask"
					events?: string[]
					state?: string[]
			  }
			| undefined
		const attachedBindings = attachedNode.meta?.loomBindings as
			| { conflictPolicy?: "agent-wins" | "human-wins" | "merge" | "ask" }
			| undefined
		return {
			...node,
			dirtyFields: tracker.getDirtyFields(node.id),
			meta: {
				...(node.meta ?? {}),
				loomBindings: {
					...(bindings ?? {}),
					conflictPolicy:
						typeof bindings?.conflictPolicy === "string"
							? bindings.conflictPolicy
							: attachedBindings?.conflictPolicy,
				},
			},
		}
	})
}

function createConflictResolvedEvent(
	nodeId: string,
	payload: LoomConflictResolvedEventPayload,
): LoomEventFrame {
	return {
		type: "conflict_resolved",
		nodeId,
		payload: clone(payload) as unknown as Record<string, unknown>,
	}
}

export function openLoomSession(sessionId: string): { rev: number } {
	const state = ensureSessionState(sessionId)
	return { rev: state.rev }
}

export function endLoomSession(sessionId: string): { rev: number } {
	const rev = getSessionRevision(sessionId)
	sessionStore.delete(sessionId)
	clearSessionRevision(sessionId)
	deleteSessionSnapshot(sessionId)
	return { rev }
}

export function renderLoomTree(sessionId: string, tree: LoomNode): { rev: number } {
	const state = ensureSessionState(sessionId)
	const rev = nextSessionRevision(sessionId)
	state.tree = refreshNodeMetadata(attachBindingsToTree(tree, 0), state.dirtyTracker)
	state.nodeRevisions = buildNodeRevisionMap(state.tree)
	state.rev = rev
	state.eventQueue.push({ kind: "tree", rev, tree: clone(state.tree) })
	state.dirty = true
	persistSessionState(sessionId, state)
	return { rev }
}

export function patchLoomTree(
	sessionId: string,
	patch: LoomPatch,
): { rev: number; errorCode?: "stale_rev" | "dirty_field"; delta?: LoomPatch[]; held?: LoomConflictFrame } {
	const state = ensureSessionState(sessionId)
	const currentNodeRev = state.nodeRevisions.get(patch.nodeId) ?? 0
	if (typeof patch.rev === "number" && patch.rev !== currentNodeRev) {
		return {
			rev: currentNodeRev,
			errorCode: "stale_rev",
			delta: state.eventQueue
				.filter((frame): frame is LoomPatchFrame => frame.kind === "patch" && frame.patch.nodeId === patch.nodeId)
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
	if (resolution.kind === "held") {
		state.conflicts.push(clone(resolution.conflict))
		state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
		state.dirty = true
		persistSessionState(sessionId, state)
		return { rev: currentNodeRev, errorCode: "dirty_field", held: resolution.conflict }
	}
	const rev = nextSessionRevision(sessionId)
	const nextNodeRev = currentNodeRev + 1
	state.rev = rev
	state.nodeRevisions.set(patch.nodeId, nextNodeRev)
	if (resolution.kind === "drop") {
		state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
		state.eventQueue.push({
			kind: "event",
			rev,
			event: createConflictResolvedEvent(patch.nodeId, {
				field: patch.field,
				policy: resolution.policy,
				humanValue: currentValue,
				agentValue: patch.value,
				resolvedValue: resolution.value,
			}),
		})
		state.dirty = true
		persistSessionState(sessionId, state)
		return { rev: nextNodeRev }
	}
	state.tree = patchNodeField(state.tree, patch, resolution.value, nextNodeRev)
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	state.eventQueue.push({
		kind: patch.append ? "append" : "patch",
		rev,
		patch: clone({ ...patch, value: resolution.value, rev: nextNodeRev }),
	})
	if (resolution.policy !== "ask") {
		state.eventQueue.push({
			kind: "event",
			rev,
			event: createConflictResolvedEvent(patch.nodeId, {
				field: patch.field,
				policy: resolution.policy,
				humanValue: currentValue,
				agentValue: patch.value,
				resolvedValue: resolution.value,
			}),
		})
	}
	state.dirty = true
	persistSessionState(sessionId, state)
	return { rev: nextNodeRev }
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
	state.nodeRevisions = buildNodeRevisionMap(state.tree)
	state.dirtyTracker.setDirty(delta.nodeId, delta.field, true)
	state.stateDelta.push(createStateDeltaFrame(delta))
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	state.dirty = true
	persistSessionState(sessionId, state)
	if (entry?.state[delta.field]) {
		return { rev: state.rev }
	}
	return { rev: state.rev }
}

export function clearLoomDirtyField(sessionId: string, nodeId: string, field: string): { rev: number } {
	const state = ensureSessionState(sessionId)
	state.dirtyTracker.clearDirty(nodeId, field)
	state.tree = refreshNodeMetadata(state.tree, state.dirtyTracker)
	persistSessionState(sessionId, state)
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
			nodeRevisions: new Map(state.nodeRevisions),
			eventQueue: state.eventQueue.map((frame) => clone(frame)),
			stateDelta: state.stateDelta.map((frame) => clone(frame)),
			conflicts: state.conflicts.map((frame) => clone(frame)),
		}
		: null
}
