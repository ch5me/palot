import { Separator } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Layout/Separator",
	component: Separator,
	args: {
		orientation: "horizontal",
	},
	render: (args) => (
		<div className="w-[360px] rounded-lg border bg-card p-4 text-card-foreground">
			<div className="text-sm font-medium">Session summary</div>
			<Separator {...args} className="my-3" />
			<div className="text-sm text-muted-foreground">3 tool calls, 1 browser lane, 0 blockers</div>
		</div>
	),
} satisfies Meta<typeof Separator>

export default meta

type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = {
	args: {
		orientation: "vertical",
	},
	render: (args) => (
		<div className="flex h-24 items-center rounded-lg border bg-card p-4 text-sm text-card-foreground">
			<span>Chat</span>
			<Separator {...args} className="mx-4" />
			<span>Browser</span>
			<Separator {...args} className="mx-4" />
			<span>Artifacts</span>
		</div>
	),
}
