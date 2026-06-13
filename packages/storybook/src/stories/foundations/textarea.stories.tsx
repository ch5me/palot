import { Label } from "@ch5me/elf-ui/components/label"
import { Textarea } from "@ch5me/elf-ui/components/textarea"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Textarea",
	component: Textarea,
	tags: ["autodocs"],
	args: {
		placeholder: "Describe what the agent should inspect",
	},
	render: (args) => (
		<div className="grid w-[420px] gap-2">
			<Label htmlFor="task-brief">Task brief</Label>
			<Textarea {...args} id="task-brief" />
		</div>
	),
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
	args: {
		defaultValue: "Inspect the browser lane, capture the failing state, and report exact proof.",
	},
}
