import { Input, Label } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Input",
	component: Input,
	args: {
		placeholder: "Search sessions",
		type: "text",
	},
	render: (args) => (
		<div className="grid w-[360px] gap-2">
			<Label htmlFor="session-search">Session search</Label>
			<Input {...args} id="session-search" />
		</div>
	),
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Invalid: Story = {
	args: {
		"aria-invalid": true,
		defaultValue: "missing-project",
	},
}
