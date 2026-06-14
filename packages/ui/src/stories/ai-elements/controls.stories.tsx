import { Canvas, Controls } from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Canvas/Controls",
	component: Controls,
	render: () => (
		<div className="h-[360px] w-[520px] overflow-hidden rounded-lg border bg-background">
			<Canvas defaultEdges={[]} defaultNodes={[]} fitViewOptions={{ padding: 0.2 }}>
				<Controls position="bottom-left" />
			</Canvas>
		</div>
	),
} satisfies Meta<typeof Controls>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
