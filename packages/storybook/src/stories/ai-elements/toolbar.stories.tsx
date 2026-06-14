import { Canvas } from "@ch5me/elf-ui/components/ai-elements/canvas"
import { Node } from "@ch5me/elf-ui/components/ai-elements/node"
import { Toolbar } from "@ch5me/elf-ui/components/ai-elements/toolbar"
import { Button } from "@ch5me/elf-ui/components/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CopyIcon, PlayIcon } from "lucide-react"

const nodes = [
	{
		id: "toolbar-node",
		type: "toolbarNode",
		position: { x: 110, y: 92 },
		data: { label: "Run story" },
	},
]

const nodeTypes = {
	toolbarNode: StoryNode,
}

function StoryNode({ data, id }: { data: { label: string }; id: string }) {
	return (
		<Node className="w-64" handles={{ source: true, target: false }}>
			<Toolbar isVisible nodeId={id}>
				<Button size="icon-sm" type="button" variant="ghost">
					<CopyIcon className="size-3.5" />
					<span className="sr-only">Copy</span>
				</Button>
				<Button size="icon-sm" type="button" variant="ghost">
					<PlayIcon className="size-3.5" />
					<span className="sr-only">Run</span>
				</Button>
			</Toolbar>
			<div className="p-4">
				<p className="font-medium text-sm">{data.label}</p>
				<p className="text-muted-foreground text-xs">Visible node toolbar actions</p>
			</div>
		</Node>
	)
}

const meta = {
	title: "AI Elements/Canvas/Toolbar",
	component: Toolbar,
	render: () => (
		<div className="h-[360px] w-[560px] overflow-hidden rounded-lg border bg-background">
			<Canvas defaultEdges={[]} defaultNodes={nodes} fitViewOptions={{ padding: 0.45 }} nodeTypes={nodeTypes} />
		</div>
	),
} satisfies Meta<typeof Toolbar>

export default meta

type Story = StoryObj

export const Default: Story = {}
