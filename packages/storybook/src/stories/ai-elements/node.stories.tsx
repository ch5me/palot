import { Canvas } from "@ch5me/elf-ui/components/ai-elements/canvas"
import {
	Node,
	NodeAction,
	NodeContent,
	NodeDescription,
	NodeFooter,
	NodeHeader,
	NodeTitle,
} from "@ch5me/elf-ui/components/ai-elements/node"
import { Badge } from "@ch5me/elf-ui/components/badge"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckCircleIcon } from "lucide-react"

const nodes = [
	{
		id: "node-story",
		type: "storyNode",
		position: { x: 96, y: 80 },
		data: { title: "Story coverage", state: "mapped" },
	},
]

const nodeTypes = {
	storyNode: StoryNode,
}

function StoryNode({ data }: { data: { title: string; state: string } }) {
	return (
		<Node handles={{ source: true, target: true }}>
			<NodeHeader>
				<div className="min-w-0">
					<NodeTitle>{data.title}</NodeTitle>
					<NodeDescription>Direct local node component story</NodeDescription>
				</div>
				<NodeAction>
					<Badge variant="secondary">{data.state}</Badge>
				</NodeAction>
			</NodeHeader>
			<NodeContent>
				<p className="text-muted-foreground text-sm">
					Used for graph-like Storybook service orders.
				</p>
			</NodeContent>
			<NodeFooter>
				<div className="flex items-center gap-2 text-xs">
					<CheckCircleIcon className="size-3.5 text-emerald-500" />
					<span>Local source represented directly</span>
				</div>
			</NodeFooter>
		</Node>
	)
}

const meta = {
	title: "AI Elements/Canvas/Node",
	component: Node,
	render: () => (
		<div className="h-[360px] w-[560px] overflow-hidden rounded-lg border bg-background">
			<Canvas
				defaultEdges={[]}
				defaultNodes={nodes}
				fitViewOptions={{ padding: 0.45 }}
				nodeTypes={nodeTypes}
			/>
		</div>
	),
} satisfies Meta<typeof Node>

export default meta

type Story = StoryObj

export const Default: Story = {}
