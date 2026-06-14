import { DayPicker } from "@ch5me/ch5-ui-web"
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
