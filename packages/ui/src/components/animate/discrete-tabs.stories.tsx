import { DiscreteTab, DiscreteTabs } from "@ch5me/elf-ui/components/animate/discrete-tabs"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bell, Calendar, Inbox, Search } from "lucide-react"

const meta = {
	title: "Animate/DiscreteTabs",
	component: DiscreteTabs,
	args: {
		size: "default",
		defaultValue: "inbox",
	},
	argTypes: {
		size: {
			control: "select",
			options: ["sm", "default", "lg"],
		},
		defaultValue: {
			control: "select",
			options: ["inbox", "planner", "alerts", "search"],
		},
		value: { control: false },
		onValueChange: { control: false },
	},
	render: (args) => (
		<DiscreteTabs {...args}>
			<DiscreteTab value="inbox" icon={<Inbox />}>
				Inbox
			</DiscreteTab>
			<DiscreteTab value="planner" icon={<Calendar />}>
				Planner
			</DiscreteTab>
			<DiscreteTab value="alerts" icon={<Bell />}>
				Alerts
			</DiscreteTab>
			<DiscreteTab value="search" icon={<Search />}>
				Search
			</DiscreteTab>
		</DiscreteTabs>
	),
} satisfies Meta<typeof DiscreteTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const sizes = ["sm", "default", "lg"] as const

export const Sizes: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-col items-start gap-4">
			{sizes.map((size) => (
				<DiscreteTabs key={size} size={size} defaultValue="inbox">
					<DiscreteTab value="inbox" icon={<Inbox />}>
						Inbox
					</DiscreteTab>
					<DiscreteTab value="planner" icon={<Calendar />}>
						Planner
					</DiscreteTab>
					<DiscreteTab value="alerts" icon={<Bell />}>
						Alerts
					</DiscreteTab>
				</DiscreteTabs>
			))}
		</div>
	),
}
