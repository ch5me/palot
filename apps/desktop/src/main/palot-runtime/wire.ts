import { decode, encode } from "./toon"

export interface LoomNode {
	id: string
	component: string
	props?: Record<string, unknown>
	children?: LoomNode[]
	meta?: Record<string, unknown>
}

export interface LoomPatch {
	rev?: number
	nodeId: string
	field: string
	value: unknown
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

export interface LoomPollResult {
	rev: number
	events: Array<
		| { kind: "tree"; rev: number; tree: LoomNode | null }
		| { kind: "patch"; rev: number; patch: LoomPatch }
		| { kind: "event"; rev: number; event: LoomEventFrame }
	>
	stateDelta: LoomStateDeltaFrame[]
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
