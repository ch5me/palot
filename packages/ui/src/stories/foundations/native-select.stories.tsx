import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/NativeSelect",
	component: NativeSelect,
	args: {
		defaultValue: "gpt-5",
		size: "default",
	},
	render: (args) => (
		<NativeSelect {...args}>
			<NativeSelectOptGroup label="Preferred">
				<NativeSelectOption value="gpt-5">GPT-5</NativeSelectOption>
				<NativeSelectOption value="claude-sonnet">Claude Sonnet</NativeSelectOption>
			</NativeSelectOptGroup>
			<NativeSelectOptGroup label="Fallback">
				<NativeSelectOption value="mini">Mini</NativeSelectOption>
				<NativeSelectOption value="local">Local model</NativeSelectOption>
			</NativeSelectOptGroup>
		</NativeSelect>
	),
} satisfies Meta<typeof NativeSelect>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
	args: {
		size: "sm",
	},
}
