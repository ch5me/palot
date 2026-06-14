import { Calendar } from "@ch5me/elf-ui/components/calendar"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Date/Calendar",
	component: Calendar,
	tags: ["autodocs"],
	args: {
		mode: "single",
		selected: new Date(2026, 5, 13),
		month: new Date(2026, 5, 1),
	},
	render: (args) => (
		<div className="rounded-lg border bg-card p-3 text-card-foreground">
			<Calendar {...args} />
		</div>
	),
} satisfies Meta<typeof Calendar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Range: Story = {
	args: {
		mode: "range",
		selected: {
			from: new Date(2026, 5, 9),
			to: new Date(2026, 5, 13),
		},
		month: new Date(2026, 5, 1),
	},
}
