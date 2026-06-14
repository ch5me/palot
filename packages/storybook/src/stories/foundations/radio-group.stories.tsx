import { Label } from "@ch5me/elf-ui/components/label"
import { RadioGroup, RadioGroupItem } from "@ch5me/elf-ui/components/radio-group"
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
