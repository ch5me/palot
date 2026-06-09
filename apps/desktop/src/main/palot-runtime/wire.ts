import { decode, encode } from "./toon"

export type LoomConflictPolicy = "agent-wins" | "human-wins" | "merge" | "ask"

export interface LoomNodeBindingDescriptor {
	events: string[]
	state: string[]
	conflictPolicy: LoomConflictPolicy
}

export interface LoomNode {
	id: string
	component: string
	props?: Record<string, unknown>
	children?: LoomNode[]
	meta?: Record<string, unknown>
	rev?: number
	dirtyFields?: string[]
}

export interface LoomPatch {
	rev?: number
	nodeId: string
	field: string
	value: unknown
	append?: boolean
}

export interface LoomConflictResolvedEventPayload {
	field: string
	policy: LoomConflictPolicy
	humanValue: unknown
	agentValue: unknown
	resolvedValue: unknown
}

export interface LoomStateDeltaFrame {
	nodeId: string
	field: string
	value: unknown
}

export interface LoomEventFrame {
	type: string
	nodeId: string
	payload?: Record<string, unknown>
}

export interface LoomConflictFrame {
	nodeId: string
	field: string
	humanValue: unknown
	agentValue: unknown
	policy: LoomConflictPolicy
}

export interface LoomPollResult {
	rev: number
	events: Array<
		| { kind: "tree"; rev: number; tree: LoomNode | null }
		| { kind: "patch"; rev: number; patch: LoomPatch }
		| { kind: "append"; rev: number; patch: LoomPatch }
		| { kind: "event"; rev: number; event: LoomEventFrame }
	>
	stateDelta: LoomStateDeltaFrame[]
	conflicts: LoomConflictFrame[]
	treeSlice: LoomNode | null
}

export interface LoomSessionOpenPayload {
	title: string
}

export interface LoomRenderPayload {
	tree: LoomNode
}

export interface LoomPatchPayload {
	patch: LoomPatch
}

export interface LoomPollPayload {
	rev: number
}

export interface LoomStatePayload {
	delta: LoomStateDeltaFrame
}

export function encodeWirePayload(value: unknown): string {
	return encode(value)
}

export function decodeWirePayload<T>(toon: string): T {
	return decode(toon) as T
}
