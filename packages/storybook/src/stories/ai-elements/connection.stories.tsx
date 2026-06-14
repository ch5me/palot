import { Connection } from "@ch5me/elf-ui/components/ai-elements/connection"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Handle, InternalNode } from "@xyflow/react"
import { ConnectionLineType, Position } from "@xyflow/react"

const sourceNode = {
	id: "source",
	position: { x: 0, y: 0 },
	data: {},
	measured: { width: 120, height: 56 },
	internals: {
		positionAbsolute: { x: 72, y: 70 },
		z: 0,
		userNode: {
			id: "source",
			position: { x: 0, y: 0 },
			data: {},
		},
	},
} satisfies InternalNode

const sourceHandle = {
	height: 12,
	id: "source-right",
	nodeId: "source",
	position: Position.Right,
	type: "source",
	width: 12,
	x: 120,
	y: 22,
} satisfies Handle

const meta = {
	title: "AI Elements/Canvas/Connection",
	component: Connection,
	render: () => (
		<div className="w-[520px] p-8">
			<svg className="h-[220px] w-full rounded-lg border bg-sidebar" viewBox="0 0 520 220">
				<title>Connection line preview between two canvas handles</title>
				<Connection
					connectionLineType={ConnectionLineType.Bezier}
					connectionStatus="valid"
					fromHandle={sourceHandle}
					fromNode={sourceNode}
					fromPosition={Position.Right}
					fromX={72}
					fromY={70}
					pointer={{ x: 448, y: 150 }}
					toHandle={null}
					toNode={null}
					toPosition={Position.Left}
					toX={448}
					toY={150}
				/>
				<circle cx={72} cy={70} fill="var(--background)" r={10} stroke="var(--color-ring)" />
				<circle cx={448} cy={150} fill="var(--background)" r={10} stroke="var(--color-ring)" />
				<text className="fill-muted-foreground text-xs" x={56} y={42}>
					source
				</text>
				<text className="fill-muted-foreground text-xs" x={424} y={184}>
					target
				</text>
			</svg>
		</div>
	),
} satisfies Meta<typeof Connection>

export default meta

type Story = StoryObj

export const Default: Story = {}
