import type { Meta, StoryObj } from "@storybook/react-vite"
import { BellIcon, CalendarIcon, InboxIcon } from "lucide-react"

import { DiscreteTab, DiscreteTabs } from "@ch5me/elf-ui/components/animate/discrete-tabs"

const meta = {
	title: "Foundations/Navigation/DiscreteTabs",
	component: DiscreteTabs,
	tags: ["autodocs"],
	args: {
		defaultValue: "palot",
		size: "default",
	},
	argTypes: {
		onValueChange: { action: "value changed" },
	},
	render: (args) => (
		<DiscreteTabs {...args}>
			<DiscreteTab value="palot" icon={<InboxIcon />}>Palot</DiscreteTab>
			<DiscreteTab value="folio" icon={<CalendarIcon />}>Folio</DiscreteTab>
			<DiscreteTab value="signals" icon={<BellIcon />}>Signals</DiscreteTab>
		</DiscreteTabs>
	),
} satisfies Meta<typeof DiscreteTabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
	args: {
		size: "sm",
	},
}

export const Large: Story = {
	args: {
		size: "lg",
	},
}
