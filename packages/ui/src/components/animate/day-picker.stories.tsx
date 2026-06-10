import { DayPicker } from "@ch5me/elf-ui/components/animate/day-picker"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Animate/DayPicker",
	component: DayPicker,
	args: {
		label: "Frequency",
		options: ["Daily", "Weekly", "Monthly", "Yearly"],
		defaultValue: "Weekly",
		dayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
		defaultDay: 1,
		dayStripOption: "Weekly",
		confirmLabel: "Confirm",
		className: "max-w-[20rem]",
	},
	argTypes: {
		options: { control: "object" },
		dayLabels: { control: "object" },
		defaultDay: { control: { type: "number", min: 0, max: 6, step: 1 } },
		value: { control: false },
		day: { control: false },
		onValueChange: { control: false },
		onDayChange: { control: false },
		className: { control: false },
	},
} satisfies Meta<typeof DayPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Configurations: Story = {
	parameters: { controls: { disable: true } },
	args: {
		defaultValue: "Weekly",
		dayStripOption: "Weekly",
	},
	render: () => (
		<div className="flex w-80 flex-col gap-4">
			<DayPicker defaultValue="Weekly" dayStripOption="Weekly" />
			<DayPicker
				label="Repeat"
				options={["Once", "Weekdays", "Weekly"]}
				defaultValue="Weekly"
				dayStripOption="Weekly"
				dayLabels={["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]}
				defaultDay={5}
			/>
			<DayPicker
				label="Backup"
				options={["Hourly", "Nightly", "Weekly"]}
				defaultValue="Weekly"
				dayStripOption="Weekly"
			/>
		</div>
	),
}
