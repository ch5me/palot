import { useAtomValue } from "jotai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	loomAppendFrameAtom,
	loomDagSparklineDemoAtom,
	loomDualBindingsAtom,
} from "../atoms/feature-flags"

export interface LoomNode {
	id: string
	component: string
	props?: Record<string, unknown>
	children?: LoomNode[]
	meta?: Record<string, unknown>
	rev?: number
	dirtyFields?: string[]
}

export interface LoomConflictFrame {
	nodeId: string
	field: string
	humanValue: unknown
	agentValue: unknown
	policy: "agent-wins" | "human-wins" | "merge" | "ask"
}

interface LoomFrame {
	kind: "tree" | "patch" | "append" | "event"
	rev: number
	tree?: LoomNode | null
	patch?: {
		nodeId: string
		field: string
		value: unknown
		append?: boolean
	}
	event?: {
		type: string
		nodeId: string
		payload?: Record<string, unknown>
	}
}

interface LoomPollPayload {
	rev: number
	events: LoomFrame[]
	stateDelta: Array<{ nodeId: string; field: string; value: unknown }>
	conflicts: LoomConflictFrame[]
	treeSlice: LoomNode | null
}

function applyPatchToTree(tree: LoomNode | null, patch: LoomFrame["patch"]): LoomNode | null {
	if (!tree || !patch) return tree
	if (tree.id === patch.nodeId) {
		const currentValue =
			typeof ((tree as unknown as Record<string, unknown>)[patch.field]) === "string"
				? (((tree as unknown as Record<string, unknown>)[patch.field]) as string)
				: typeof tree.props?.[patch.field] === "string"
					? (tree.props?.[patch.field] as string)
					: null
		const nextValue = patch.append && currentValue !== null ? `${currentValue}${String(patch.value)}` : patch.value
		const nextProps =
			patch.field in tree ? tree.props : { ...(tree.props ?? {}), [patch.field]: nextValue }
		return patch.field in tree
			? { ...tree, [patch.field]: nextValue }
			: { ...tree, props: nextProps }
	}
	if (!tree.children?.length) return tree
	return {
		...tree,
		children: tree.children.map((child) => applyPatchToTree(child, patch)).filter(Boolean) as LoomNode[],
	}
}

function buildDemoTree(): LoomNode {
	return {
		id: "root",
		component: "dag-sparkline",
		props: {
			nodes: [
				{ id: "plan", label: "Plan" },
				{ id: "wire", label: "Wire" },
				{ id: "ship", label: "Ship" },
			],
			edges: [
				{ source: "plan", target: "wire" },
				{ source: "wire", target: "ship" },
			],
			animate: "reveal",
		},
	}
}

function buildDecisionCardDemoTree(): LoomNode {
	return {
		id: "decision-root",
		component: "decision_card",
		props: {
			title: "Pick launch path",
			options: [
				{ id: "opt_a", label: "Private beta" },
				{ id: "opt_b", label: "Public launch" },
			],
			selected: null,
			notes: "",
		},
		meta: {
			loomBindings: {
				events: ["submit"],
				state: ["notes", "selected"],
				conflictPolicy: "ask",
			},
		},
	}
}

export function useLoomSession({ sessionId }: { sessionId: string | null }) {
	const dualBindingsEnabled = useAtomValue(loomDualBindingsAtom)
	const demoEnabled = useAtomValue(loomDagSparklineDemoAtom)
	const appendEnabled = useAtomValue(loomAppendFrameAtom)
	const [tree, setTree] = useState<LoomNode | null>(null)
	const [rev, setRev] = useState(0)
	const [conflicts, setConflicts] = useState<LoomConflictFrame[]>([])
	const subscribersRef = useRef(new Set<(nextTree: LoomNode | null) => void>())
	const deltaQueueRef = useRef<Array<{ nodeId: string; field: string; value: unknown }>>([])
	const socketRef = useRef<WebSocket | null>(null)

	const applyPatch = useCallback((patch: LoomFrame["patch"]) => {
		setTree((current) => applyPatchToTree(current, patch))
	}, [])

	useEffect(() => {
		if (!sessionId) return
		if (typeof window === "undefined") return
		if (!window.elf?.palot?.openLoomSession) return
		let disposed = false
		void window.elf.palot.openLoomSession(sessionId).then((opened) => {
			if (disposed) return
			const socket = new WebSocket(opened.surfaceUrl)
			socketRef.current = socket
			socket.addEventListener("message", (event) => {
				const payload = JSON.parse(String(event.data)) as LoomPollPayload
				setRev(payload.rev)
				setConflicts(payload.conflicts)
				if (payload.treeSlice) {
					setTree(payload.treeSlice)
				}
				for (const frame of payload.events) {
					if (frame.kind === "tree") setTree(frame.tree ?? null)
					if (frame.kind === "patch") applyPatch(frame.patch)
					if (frame.kind === "append" && appendEnabled && frame.patch) applyPatch({ ...frame.patch, append: true })
				}
			})
		})
		return () => {
			disposed = true
			socketRef.current?.close()
			socketRef.current = null
		}
	}, [appendEnabled, applyPatch, sessionId])

	useEffect(() => {
		if (!sessionId) return
		if (tree) return
		if (dualBindingsEnabled) {
			setTree(buildDecisionCardDemoTree())
			return
		}
		if (demoEnabled) {
			setTree(buildDemoTree())
		}
	}, [demoEnabled, dualBindingsEnabled, sessionId, tree])

	useEffect(() => {
		subscribersRef.current.forEach((subscriber) => subscriber(tree))
	}, [tree])

	useEffect(() => {
		if (!sessionId || deltaQueueRef.current.length === 0) return
		const timer = window.setTimeout(() => {
			const queued = [...deltaQueueRef.current]
			deltaQueueRef.current = []
			void Promise.all(queued.map((delta) => window.elf.palot.sendLoomStateDelta?.(sessionId, delta)))
		}, 250)
		return () => window.clearTimeout(timer)
	}, [rev, sessionId, tree])

	const subscribe = useCallback(
		(listener: (nextTree: LoomNode | null) => void) => {
			subscribersRef.current.add(listener)
			listener(tree)
			return () => subscribersRef.current.delete(listener)
		},
		[tree],
	)

	const sendEvent = useCallback(
		(event: { type: string; nodeId: string; payload?: Record<string, unknown> }) => {
			if (!sessionId) return Promise.resolve()
			return window.elf.palot.sendLoomEvent?.(sessionId, event) ?? Promise.resolve()
		},
		[sessionId],
	)

	const sendStateDelta = useCallback((delta: { nodeId: string; field: string; value: unknown }) => {
		deltaQueueRef.current.push(delta)
		setTree((current) => applyPatchToTree(current, { nodeId: delta.nodeId, field: delta.field, value: delta.value }))
	}, [])

	return useMemo(
		() => ({ tree, rev, conflicts, subscribe, sendEvent, sendStateDelta, applyPatch }),
		[applyPatch, conflicts, rev, sendEvent, sendStateDelta, subscribe, tree],
	)
}
