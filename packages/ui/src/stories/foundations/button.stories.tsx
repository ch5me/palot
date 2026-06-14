import { Button } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { SparklesIcon } from "lucide-react"

const meta = {
	title: "Foundations/Actions/Button",
	component: Button,
	args: {
		children: "Run capture",
		variant: "default",
		size: "default",
	},
	argTypes: {
		onClick: { action: "clicked" },
	},
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Outline: Story = {
	args: {
		variant: "outline",
	},
}

export const IconLeading: Story = {
	render: (args) => (
		<Button {...args}>
			<SparklesIcon />
			<span>{args.children}</span>
		</Button>
	),
}
