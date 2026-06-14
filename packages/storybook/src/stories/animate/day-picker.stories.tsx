import { DayPicker } from "@ch5me/elf-ui/components/animate/day-picker"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Animate/Controls/DayPicker",
	component: DayPicker,
	render: () => (
		<div className="w-[420px] p-8">
			<DayPicker defaultValue="Weekly" defaultDay={2} label="Schedule" />
		</div>
	),
} satisfies Meta<typeof DayPicker>

export default meta

type Story = StoryObj

export const Default: Story = {}
