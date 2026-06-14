import {
	Canvas,
	Node as CanvasNode,
	Connection,
	Controls,
	Edge,
	NodeAction,
	NodeContent,
	NodeDescription,
	NodeFooter,
	NodeHeader,
	NodeTitle,
	Panel,
	Toolbar,
} from "@ch5me/agent-ui-web"
import { Badge, Button } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MarkerType, type Edge as ReactFlowEdge, type Node as ReactFlowNode } from "@xyflow/react"
import { CheckIcon, CopyIcon, PlayIcon } from "lucide-react"

const nodes: ReactFlowNode[] = [
	{
		id: "scope",
		type: "coverage",
		position: { x: 0, y: 80 },
		data: { label: "Local scope", state: "done" },
	},
	{
		id: "story",
		type: "coverage",
		position: { x: 330, y: 40 },
		data: { label: "Story render", state: "running" },
	},
	{
		id: "coverage",
		type: "coverage",
		position: { x: 660, y: 100 },
		data: { label: "CH5 coverage", state: "queued" },
	},
]

const edges: ReactFlowEdge[] = [
	{
		id: "scope-story",
		source: "scope",
		target: "story",
		type: "animated",
		markerEnd: { type: MarkerType.ArrowClosed },
	},
	{
		id: "story-coverage",
		source: "story",
		target: "coverage",
		type: "animated",
		markerEnd: { type: MarkerType.ArrowClosed },
	},
]

const edgeTypes = {
	animated: Edge.Animated,
	temporary: Edge.Temporary,
}

const nodeTypes = {
	coverage: StoryNode,
}

function StoryNode({ data, id }: { data: { label: string; state: string }; id: string }) {
	return (
		<CanvasNode handles={{ source: true, target: true }}>
			<Toolbar isVisible nodeId={id}>
				<Button size="icon-sm" type="button" variant="ghost">
					<CopyIcon className="size-3.5" />
					<span className="sr-only">Copy node</span>
				</Button>
				<Button size="icon-sm" type="button" variant="ghost">
					<PlayIcon className="size-3.5" />
					<span className="sr-only">Run node</span>
				</Button>
			</Toolbar>
			<NodeHeader>
				<div className="min-w-0">
					<NodeTitle>{data.label}</NodeTitle>
					<NodeDescription>Storybook service order step</NodeDescription>
				</div>
				<NodeAction>
					<Badge variant={data.state === "done" ? "default" : "secondary"}>{data.state}</Badge>
				</NodeAction>
			</NodeHeader>
			<NodeContent>
				<div className="text-muted-foreground text-sm">
					{data.state === "done"
						? "Scope checked against local source files."
						: "Awaiting render and coverage proof."}
				</div>
			</NodeContent>
			<NodeFooter>
				<div className="flex items-center gap-2 text-xs">
					<CheckIcon className="size-3.5 text-emerald-500" />
					<span>Tracked in docs/storybook-missing-ui-elements.md</span>
				</div>
			</NodeFooter>
		</CanvasNode>
	)
}

const meta = {
	title: "AI Elements/Canvas/Canvas",
	component: Canvas,
	render: () => (
		<div className="h-[520px] w-[840px] overflow-hidden rounded-lg border bg-background">
			<Canvas
				connectionLineComponent={Connection}
				defaultEdges={edges}
				defaultNodes={nodes}
				edgeTypes={edgeTypes}
				fitViewOptions={{ padding: 0.25 }}
				nodeTypes={nodeTypes}
			>
				<Controls position="bottom-left" />
				<Panel position="top-left">
					<div className="px-3 py-2">
						<p className="font-medium text-sm">Storybook coverage graph</p>
						<p className="text-muted-foreground text-xs">Local components only</p>
					</div>
				</Panel>
			</Canvas>
		</div>
	),
} satisfies Meta<typeof Canvas>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
