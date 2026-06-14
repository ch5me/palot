import { AspectRatio } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Layout/AspectRatio",
	component: AspectRatio,
	args: {
		ratio: 16 / 9,
	},
	render: (args) => (
		<AspectRatio
			{...args}
			className="w-[520px] overflow-hidden rounded-lg border bg-[linear-gradient(135deg,var(--color-muted),var(--color-background))]"
		>
			<div className="absolute inset-0 grid place-items-center p-8 text-center">
				<div>
					<div className="text-sm font-medium">Browser lane preview</div>
					<div className="mt-1 text-xs text-muted-foreground">Locked 16:9 capture frame</div>
				</div>
			</div>
		</AspectRatio>
	),
} satisfies Meta<typeof AspectRatio>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Square: Story = {
	args: {
		ratio: 1,
	},
	render: (args) => (
		<AspectRatio {...args} className="w-64 rounded-lg border bg-card text-card-foreground">
			<div className="absolute inset-0 grid place-items-center text-sm font-medium">
				Avatar crop
			</div>
		</AspectRatio>
	),
}
