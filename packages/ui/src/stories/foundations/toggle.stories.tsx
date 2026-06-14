import { Toggle } from "@ch5me/elf-ui/components/toggle"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BoldIcon, ItalicIcon } from "lucide-react"

const meta = {
	title: "Foundations/Actions/Toggle",
	component: Toggle,
	args: {
		defaultPressed: true,
		variant: "outline",
		children: "Trace",
	},
} satisfies Meta<typeof Toggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const IconStates: Story = {
	render: () => (
		<div className="flex gap-2">
			<Toggle variant="outline" defaultPressed aria-label="Bold">
				<BoldIcon aria-hidden="true" />
			</Toggle>
			<Toggle variant="outline" aria-label="Italic">
				<ItalicIcon aria-hidden="true" />
			</Toggle>
		</div>
	),
}
