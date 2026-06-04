import { DagSpark, type DagSparkEdge, type DagSparkNode, type EdgeStyle, type NodeStyle } from "@ch5me/dag-sparkline"
import { MessageResponse } from "@ch5me/elf-ui/components/ai-elements/message"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { memo, useMemo } from "react"

// ============================================================
// DAG Fence Parser
// ============================================================

/** Matches ```dag ... ``` code fences; captures the body. */
const DAG_FENCE_RE = /```dag\s*\n([\s\S]*?)\n```/g

export interface ParsedDagBlock {
	kind: "dag"
	raw: string
	nodes: DagSparkNode[]
	edges: DagSparkEdge[]
}

export type DagSegment =
	| { kind: "text"; text: string }
	| ParsedDagBlock
	| { kind: "dag-error"; raw: string; error: string }

interface ParsedDagOk {
	ok: true
	nodes: DagSparkNode[]
	edges: DagSparkEdge[]
}

interface ParsedDagFail {
	ok: false
	error: string
}

function parseDagJson(raw: string): ParsedDagOk | ParsedDagFail {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" }
	}
	if (typeof parsed !== "object" || parsed === null) {
		return { ok: false, error: "Expected a JSON object" }
	}
	const obj = parsed as { nodes?: unknown; edges?: unknown }
	if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
		return { ok: false, error: "Expected { nodes: [...], edges: [...] }" }
	}
	const nodes: DagSparkNode[] = []
	for (const n of obj.nodes) {
		if (typeof n !== "object" || n === null) {
			return { ok: false, error: "Each node must be an object" }
		}
		const id = (n as { id?: unknown }).id
		if (typeof id !== "string" || id.length === 0) {
			return { ok: false, error: "Each node needs a non-empty string id" }
		}
		nodes.push(n as DagSparkNode)
	}
	const edges: DagSparkEdge[] = []
	for (const e of obj.edges) {
		if (typeof e !== "object" || e === null) {
			return { ok: false, error: "Each edge must be an object" }
		}
		const source = (e as { source?: unknown }).source
		const target = (e as { target?: unknown }).target
		if (typeof source !== "string" || typeof target !== "string") {
			return { ok: false, error: "Each edge needs string source + target" }
		}
		edges.push(e as DagSparkEdge)
	}
	return { ok: true, nodes, edges }
}

/**
 * Split a text block into alternating text / dag-block segments.
 * Dag fences are extracted in order; everything else stays as text.
 *
 * @param dropErrors when true, fences that fail to parse stay as plain
 *   text (so partial fences during streaming don't flash an error).
 */
export function splitDagFences(text: string, options: { dropErrors?: boolean } = {}): DagSegment[] {
	const segments: DagSegment[] = []
	let cursor = 0
	for (const match of text.matchAll(DAG_FENCE_RE)) {
		const start = match.index ?? 0
		if (start > cursor) {
			segments.push({ kind: "text", text: text.slice(cursor, start) })
		}
		const raw = match[1] ?? ""
		const parsed = parseDagJson(raw)
		if (parsed.ok) {
			segments.push({ kind: "dag", raw, nodes: parsed.nodes, edges: parsed.edges })
		} else if (!options.dropErrors) {
			segments.push({ kind: "dag-error", raw, error: parsed.error })
		} else {
			segments.push({ kind: "text", text: match[0] })
		}
		cursor = start + match[0].length
	}
	if (cursor < text.length) {
		segments.push({ kind: "text", text: text.slice(cursor) })
	}
	return segments
}

// ============================================================
// Styles — `currentColor` so the parent Tailwind text color drives the graph
// ============================================================

const HOST_STYLES = {
	dim: {
		node: { fill: "currentColor" } as NodeStyle,
		edge: { stroke: "currentColor", width: 1.4, opacity: 0.35, arrow: true } as EdgeStyle,
	},
	accent: {
		edge: { stroke: "currentColor", width: 1.6, arrow: true } as EdgeStyle,
	},
} as const

// ============================================================
// DagSparkBlock — render a single parsed DAG as a graph card
// ============================================================

interface DagSparkBlockProps {
	nodes: DagSparkNode[]
	edges: DagSparkEdge[]
	height?: number
	className?: string
}

/**
 * Renders a parsed DAG as an interactive sparkline graph. The parent
 * provides the theme via `text-muted-foreground` (or similar) and the
 * graph picks up `currentColor`. First and last node get a slightly
 * stronger edge style to mark the entry/exit of the flow.
 */
function DagSparkBlockImpl({ nodes, edges, height = 96, className }: DagSparkBlockProps) {
	const firstId = nodes[0]?.id
	const lastId = nodes.length > 1 ? nodes[nodes.length - 1]?.id : undefined
	const edgeStyles = useMemo(() => {
		const styles: Record<string, "accent"> = {}
		if (firstId) styles[`${firstId}->`] = "accent"
		if (lastId) styles[`->${lastId}`] = "accent"
		return styles
	}, [firstId, lastId])
	return (
		<div
			className={cn(
				"my-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground",
				className,
			)}
		>
			<DagSpark
				nodes={nodes}
				edges={edges}
				styles={HOST_STYLES}
				defaultNodeStyle="dim"
				defaultEdgeStyle="dim"
				edgeStyles={edgeStyles}
				height={height}
				r={3.5}
				layerGap={36}
				nodeGap={18}
			/>
		</div>
	)
}

export const DagSparkBlock = memo(DagSparkBlockImpl)

// ============================================================
// DagErrorBlock — surfaced for tool-call paths (text path drops errors)
// ============================================================

function DagErrorBlockImpl({ error, raw }: { error: string; raw: string }) {
	return (
		<div className="my-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
			<p className="font-medium">Invalid dag block: {error}</p>
			<pre className="mt-1 max-h-32 overflow-auto font-mono text-[11px] text-red-400/80">
				<code>{raw.length > 400 ? `${raw.slice(0, 400)}...` : raw}</code>
			</pre>
		</div>
	)
}

export const DagErrorBlock = memo(DagErrorBlockImpl)

// ============================================================
// TextWithDag — drop-in replacement for <MessageResponse> in chat turns
// ============================================================

interface TextWithDagProps {
	text: string
	isStreaming?: boolean
	className?: string
}

/**
 * Renders a text response, replacing any ```dag code fences with
 * inline interactive <DagSparkBlock> cards. Bad fences are dropped
 * silently so partial streaming text doesn't flash parse errors.
 *
 * Use this anywhere <MessageResponse>{text}</MessageResponse> would
 * appear in the chat renderer.
 */
export function TextWithDag({ text, isStreaming, className }: TextWithDagProps) {
	const segments = useMemo(() => splitDagFences(text, { dropErrors: true }), [text])
	if (segments.length === 1 && segments[0].kind === "text") {
		return (
			<MessageResponse className={className} animated={isStreaming}>
				{text}
			</MessageResponse>
		)
	}
	return (
		<div className={className}>
			{segments.map((seg, i) => {
				if (seg.kind === "text") {
					return (
						<MessageResponse key={i} animated={isStreaming}>
							{seg.text}
						</MessageResponse>
					)
				}
				if (seg.kind === "dag") {
					return <DagSparkBlock key={i} nodes={seg.nodes} edges={seg.edges} />
				}
				return <DagErrorBlock key={i} error={seg.error} raw={seg.raw} />
			})}
		</div>
	)
}

// ============================================================
// Re-exports
// ============================================================

export { DagSpark }
export type { DagSparkNode, DagSparkEdge }
