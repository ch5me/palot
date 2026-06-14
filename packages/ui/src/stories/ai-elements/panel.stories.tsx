import { Canvas, Panel } from "@ch5me/agent-ui-web"
import { Badge } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Canvas/Panel",
	component: Panel,
	render: () => (
		<div className="h-[360px] w-[560px] overflow-hidden rounded-lg border bg-background">
			<Canvas defaultEdges={[]} defaultNodes={[]} fitViewOptions={{ padding: 0.2 }}>
				<Panel position="top-left">
					<div className="space-y-2 px-3 py-2">
						<div className="flex items-center gap-2">
							<p className="font-medium text-sm">Coverage panel</p>
							<Badge variant="secondary">local</Badge>
						</div>
						<p className="text-muted-foreground text-xs">
							Storybook checks use Palot-owned components only.
						</p>
					</div>
				</Panel>
			</Canvas>
		</div>
	),
} satisfies Meta<typeof Panel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
