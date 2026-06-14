import { Label, RadioGroup, RadioGroupItem } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/RadioGroup",
	component: RadioGroup,
	args: {
		defaultValue: "local",
	},
	render: (args) => (
		<RadioGroup {...args} className="w-[360px]">
			<Label className="gap-3">
				<RadioGroupItem value="local" />
				<span>Local browser lane</span>
			</Label>
			<Label className="gap-3">
				<RadioGroupItem value="remote" />
				<span>Remote browser lane</span>
			</Label>
			<Label className="gap-3 opacity-60">
				<RadioGroupItem value="managed" disabled />
				<span>Managed lane unavailable</span>
			</Label>
		</RadioGroup>
	),
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
