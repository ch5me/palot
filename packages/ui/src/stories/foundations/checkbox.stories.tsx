import { Checkbox } from "@ch5me/elf-ui/components/checkbox"
import { Label } from "@ch5me/elf-ui/components/label"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Checkbox",
	component: Checkbox,
	args: {
		defaultChecked: true,
	},
	render: (args) => (
		<Label className="gap-3">
			<Checkbox {...args} />
			<span>Capture browser screenshots during verification</span>
		</Label>
	),
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Checked: Story = {}

export const States: Story = {
	render: () => (
		<div className="grid gap-3">
			<Label className="gap-3">
				<Checkbox defaultChecked />
				<span>Checked</span>
			</Label>
			<Label className="gap-3">
				<Checkbox />
				<span>Unchecked</span>
			</Label>
			<Label className="gap-3 opacity-60">
				<Checkbox disabled />
				<span>Disabled</span>
			</Label>
			<Label className="gap-3 text-destructive">
				<Checkbox aria-invalid />
				<span>Invalid</span>
			</Label>
		</div>
	),
}
