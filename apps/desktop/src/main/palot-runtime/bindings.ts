import { resolveGenUiEntry } from "../../renderer/genui/registry"
import type {
	LoomConflictPolicy,
	LoomEventFrame,
	LoomNode,
	LoomNodeBindingDescriptor,
	LoomStateDeltaFrame,
} from "./wire"

function clone<T>(value: T): T {
	return structuredClone(value)
}

export interface LoomSignalBindingInput {
	nodeId: string
	event: string
	payload?: Record<string, unknown>
}

export interface LoomStateBindingInput {
	nodeId: string
	field: string
	value: unknown
}

export interface LoomBindingState {
	events: LoomEventFrame[]
	stateDelta: LoomStateDeltaFrame[]
}

export function getNodeBindingDescriptor(node: LoomNode): LoomNodeBindingDescriptor {
	const entry = resolveGenUiEntry(node.component)
	const eventKeys = Object.keys(entry?.events ?? {})
	const stateKeys = Object.keys(entry?.state ?? {})
	const nodePolicy = (node.meta?.loomBindings as { conflictPolicy?: LoomConflictPolicy } | undefined)
		?.conflictPolicy
	const policy: LoomConflictPolicy = nodePolicy ?? entry?.conflictPolicy ?? "ask"
	return {
		events: eventKeys,
		state: stateKeys,
		conflictPolicy: policy,
	}
}

export function attachBindingsToTree(node: LoomNode, inheritedRev = 0): LoomNode {
	const descriptor = getNodeBindingDescriptor(node)
	const nodeRev = typeof node.rev === "number" ? node.rev : inheritedRev + 1
	return {
		...clone(node),
		rev: nodeRev,
		meta: {
			...(node.meta ?? {}),
			loomBindings: descriptor,
		},
		children: node.children?.map((child) => attachBindingsToTree(child, nodeRev)),
	}
}

export function createSignalFrame(input: LoomSignalBindingInput): LoomEventFrame {
	return {
		type: input.event,
		nodeId: input.nodeId,
		payload: input.payload ? clone(input.payload) : undefined,
	}
}

export function createStateDeltaFrame(input: LoomStateBindingInput): LoomStateDeltaFrame {
	return {
		nodeId: input.nodeId,
		field: input.field,
		value: clone(input.value),
	}
}

export function mergeBindingState(
	current: LoomBindingState,
	next: Partial<LoomBindingState>,
): LoomBindingState {
	return {
		events: next.events ? [...current.events, ...next.events.map((event) => clone(event))] : [...current.events],
		stateDelta: next.stateDelta
			? [...current.stateDelta, ...next.stateDelta.map((delta) => clone(delta))]
			: [...current.stateDelta],
	}
}
