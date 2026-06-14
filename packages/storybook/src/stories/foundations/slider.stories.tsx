import { Label } from "@ch5me/elf-ui/components/label"
import { Slider } from "@ch5me/elf-ui/components/slider"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Slider",
	component: Slider,
	args: {
		defaultValue: [42],
		min: 0,
		max: 100,
	},
	render: (args) => (
		<div className="grid w-[360px] gap-3">
			<Label>Automation confidence</Label>
			<Slider {...args} />
		</div>
	),
} satisfies Meta<typeof Slider>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Range: Story = {
	args: {
		defaultValue: [24, 78],
	},
}
