import { Shimmer } from "@ch5me/elf-ui/components/ai-elements/shimmer"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Feedback/Shimmer",
	component: Shimmer,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[520px] p-8">
			<Shimmer as="div" className="font-medium text-2xl" duration={1.8} spread={1.4}>
				Generating verified Storybook proof...
			</Shimmer>
		</div>
	),
} satisfies Meta<typeof Shimmer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		children: "Generating verified Storybook proof...",
		duration: 1.8,
		spread: 1.4,
	},
}
