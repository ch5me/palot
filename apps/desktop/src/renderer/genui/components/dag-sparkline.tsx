import { DagSparkline } from "@ch5me/dag-sparkline"
import type {
	DagSparklineDirection,
	DagSparklineEdge,
	DagSparklineNode,
	DagSparklineProps,
} from "@ch5me/dag-sparkline"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { memo } from "react"
import type { GenUiEntry, ParsePropsResult } from "../registry"

type DagSparklineFenceProps = {
	nodes: DagSparklineNode[]
	edges: DagSparklineEdge[]
	dir?: DagSparklineDirection
	animate?: DagSparklineProps["animate"]
	height?: number
	showLabels?: boolean
	className?: string
}

const VALID_DIRS: ReadonlySet<string> = new Set(["LR", "TB"])
const VALID_ANIMATE: ReadonlySet<string> = new Set(["none", "reveal", "flow"])

function parseProps(raw: unknown): ParsePropsResult<DagSparklineFenceProps> {
	if (typeof raw !== "object" || raw === null) {
		return { ok: false, error: "Expected an object with { nodes, edges }" }
	}
	const obj = raw as Record<string, unknown>
	if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
		return { ok: false, error: "Expected { nodes: [...], edges: [...] }" }
	}
	const nodes: DagSparklineNode[] = []
	for (const n of obj.nodes) {
		if (typeof n !== "object" || n === null) return { ok: false, error: "Each node must be an object" }
		const id = (n as { id?: unknown }).id
		if (typeof id !== "string" || id.length === 0) {
			return { ok: false, error: "Each node needs a non-empty string id" }
		}
		nodes.push(n as DagSparklineNode)
	}
	const edges: DagSparklineEdge[] = []
	for (const e of obj.edges) {
		if (typeof e !== "object" || e === null) return { ok: false, error: "Each edge must be an object" }
		const source = (e as { source?: unknown }).source
		const target = (e as { target?: unknown }).target
		if (typeof source !== "string" || typeof target !== "string") {
			return { ok: false, error: "Each edge needs string source + target" }
		}
		edges.push(e as DagSparklineEdge)
	}
	const dir = typeof obj.dir === "string" && VALID_DIRS.has(obj.dir) ? (obj.dir as DagSparklineDirection) : undefined
	const animate =
		typeof obj.animate === "string" && VALID_ANIMATE.has(obj.animate)
			? (obj.animate as DagSparklineProps["animate"])
			: undefined
	const height = typeof obj.height === "number" && Number.isFinite(obj.height) ? obj.height : undefined
	const showLabels = typeof obj.showLabels === "boolean" ? obj.showLabels : undefined
	return { ok: true, props: { nodes, edges, dir, animate, height, showLabels } }
}

function DagSparklineGenUiImpl({ className, ...props }: DagSparklineFenceProps) {
	return (
		<div
			className={cn(
				"my-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground",
				className,
			)}
		>
			<DagSparkline {...props} />
		</div>
	)
}

const DagSparklineGenUi = memo(DagSparklineGenUiImpl)

export const DagSparklineEntry: GenUiEntry<DagSparklineFenceProps> = {
	name: "dag-sparkline",
	aliases: ["dag", "dag spark", "dag sparkline", "graph", "flow graph", "dependency graph"],
	description:
		"Compact inline DAG (directed graph) sparkline. Use for plans, pipelines, dependency or step flows. Props: nodes [{id, label?, tone?}], edges [{source, target, tone?, animated?}], optional dir (LR|TB), animate (none|reveal|flow), height, showLabels.",
	Component: DagSparklineGenUi,
	parseProps,
	example: {
		component: "dag-sparkline",
		props: {
			nodes: [
				{ id: "plan", label: "Plan" },
				{ id: "build", label: "Build" },
				{ id: "ship", label: "Ship" },
			],
			edges: [
				{ source: "plan", target: "build" },
				{ source: "build", target: "ship" },
			],
		},
	},
}
