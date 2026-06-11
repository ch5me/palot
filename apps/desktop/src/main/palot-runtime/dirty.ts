import { resolveGenUiEntry } from "../../renderer/genui/registry"
import type {
	LoomConflictFrame,
	LoomConflictPolicy,
	LoomNode,
	LoomPatch,
} from "./wire"

function clone<T>(value: T): T {
	return structuredClone(value)
}

function getEntryForNode(node: LoomNode | null) {
	if (!node) return undefined
	const entry = resolveGenUiEntry(node.component)
	if (!entry) return undefined
	const nodePolicy = (node.meta?.loomBindings as { conflictPolicy?: LoomConflictPolicy } | undefined)
		?.conflictPolicy
	if (nodePolicy) {
		return { ...entry, conflictPolicy: nodePolicy }
	}
	return entry
}

export class LoomDirtyTracker {
	private readonly dirtyFields = new Map<string, Set<string>>()
	private readonly heldConflicts: LoomConflictFrame[] = []

	setDirty(nodeId: string, field: string, dirty: boolean) {
		const fields = this.dirtyFields.get(nodeId) ?? new Set<string>()
		if (dirty) {
			fields.add(field)
			this.dirtyFields.set(nodeId, fields)
			return
		}
		fields.delete(field)
		if (fields.size === 0) {
			this.dirtyFields.delete(nodeId)
			return
		}
		this.dirtyFields.set(nodeId, fields)
	}

	clearDirty(nodeId: string, field: string) {
		this.setDirty(nodeId, field, false)
	}

	isDirty(nodeId: string, field: string): boolean {
		return this.dirtyFields.get(nodeId)?.has(field) ?? false
	}

	getDirtyFields(nodeId: string): string[] {
		return [...(this.dirtyFields.get(nodeId) ?? new Set<string>())]
	}

	dequeueConflicts(): LoomConflictFrame[] {
		const next = this.heldConflicts.map((frame) => clone(frame))
		this.heldConflicts.length = 0
		return next
	}

	resolvePatch(options: {
		node: LoomNode | null
		patch: LoomPatch
		humanValue: unknown
	}):
		| { kind: "apply"; value: unknown; policy: LoomConflictPolicy }
		| { kind: "drop"; value: unknown; policy: LoomConflictPolicy }
		| { kind: "held"; conflict: LoomConflictFrame } {
		const policy = getEntryForNode(options.node)?.conflictPolicy ?? "ask"
		if (!this.isDirty(options.patch.nodeId, options.patch.field)) {
			return { kind: "apply", value: clone(options.patch.value), policy }
		}
		if (policy === "agent-wins") {
			this.clearDirty(options.patch.nodeId, options.patch.field)
			return { kind: "apply", value: clone(options.patch.value), policy }
		}
		if (policy === "human-wins") {
			const humanValue = clone(options.humanValue)
			this.clearDirty(options.patch.nodeId, options.patch.field)
			return { kind: "drop", value: humanValue, policy }
		}
		if (policy === "merge") {
			const merged = getEntryForNode(options.node)?.merge?.(
				clone(options.humanValue),
				clone(options.patch.value),
				options.patch.field,
			)
			this.clearDirty(options.patch.nodeId, options.patch.field)
			return { kind: "apply", value: clone(merged), policy }
		}
		return {
			kind: "held",
			conflict: this.queueConflict(options.patch, options.humanValue, options.patch.value, policy),
		}
	}

	private queueConflict(
		patch: LoomPatch,
		humanValue: unknown,
		agentValue: unknown,
		policy: LoomConflictPolicy,
	): LoomConflictFrame {
		const conflict: LoomConflictFrame = {
			nodeId: patch.nodeId,
			field: patch.field,
			humanValue: clone(humanValue),
			agentValue: clone(agentValue),
			policy,
		}
		this.heldConflicts.push(conflict)
		return clone(conflict)
	}
}
