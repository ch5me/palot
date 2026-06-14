import { Edge } from "@ch5me/elf-ui/components/ai-elements/edge"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Position } from "@xyflow/react"

const TemporaryEdge = Edge.Temporary

const meta = {
	title: "AI Elements/Canvas/Edge",
	component: TemporaryEdge,
	render: () => (
		<div className="w-[520px] p-8">
			<svg className="h-[220px] w-full rounded-lg border bg-sidebar" viewBox="0 0 520 220">
				<TemporaryEdge
					id="storybook-temporary-edge"
					selected={false}
					source="draft"
					sourcePosition={Position.Right}
					sourceX={84}
					sourceY={96}
					target="coverage"
					targetPosition={Position.Left}
					targetX={436}
					targetY={126}
				/>
				<circle cx={84} cy={96} fill="var(--background)" r={11} stroke="var(--color-ring)" />
				<circle cx={436} cy={126} fill="var(--background)" r={11} stroke="var(--color-ring)" />
				<text className="fill-muted-foreground text-xs" x={52} y={68}>
					draft
				</text>
				<text className="fill-muted-foreground text-xs" x={404} y={160}>
					coverage
				</text>
			</svg>
		</div>
	),
} satisfies Meta<typeof TemporaryEdge>

export default meta

type Story = StoryObj

export const Default: Story = {}
