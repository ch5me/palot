import { Spinner } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Feedback/Spinner",
	component: Spinner,
	args: {
		className: "size-5",
	},
	render: (args) => (
		<div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground">
			<Spinner {...args} />
			<span>Starting managed OpenCode runtime</span>
		</div>
	),
} satisfies Meta<typeof Spinner>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
	render: () => (
		<div className="flex items-center gap-4">
			<Spinner className="size-4" />
			<Spinner className="size-6" />
			<Spinner className="size-8" />
		</div>
	),
}
