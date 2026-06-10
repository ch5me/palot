import type { AnimatedListProps } from "@ch5me/elf-ui/components/animate/list-item"
import {
	AnimatedList,
	AnimatedListItem,
	AnimatedListItemIndicator,
} from "@ch5me/elf-ui/components/animate/list-item"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bell, Database, Lock, Palette, User } from "lucide-react"
import { useState } from "react"

const meta = {
	title: "Animate/AnimatedList",
	component: AnimatedList,
	args: {
		"aria-label": "Sections",
	},
} satisfies Meta<typeof AnimatedList>

export default meta
type Story = StoryObj<typeof meta>

const items = [
	{ label: "Profile", icon: User },
	{ label: "Notifications", icon: Bell },
	{ label: "Appearance", icon: Palette },
	{ label: "Privacy", icon: Lock },
	{ label: "Storage", icon: Database },
]

function SelectableList(props: AnimatedListProps) {
	const [selectedIndex, setSelectedIndex] = useState(0)

	return (
		<AnimatedList className="w-64" {...props}>
			{items.map(({ label, icon: Icon }, index) => (
				<AnimatedListItem
					key={label}
					index={index}
					selected={index === selectedIndex}
					className="cursor-pointer"
					onClick={() => setSelectedIndex(index)}
				>
					<span className="flex items-center gap-2 text-sm">
						<Icon aria-hidden="true" className="size-4" />
						{label}
					</span>
					<AnimatedListItemIndicator selected={index === selectedIndex} />
				</AnimatedListItem>
			))}
		</AnimatedList>
	)
}

export const Playground: Story = {
	render: (args) => <SelectableList {...args} />,
}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<AnimatedList aria-label="Row states" className="w-64">
			<AnimatedListItem index={0}>
				<span className="text-sm">Unselected</span>
				<AnimatedListItemIndicator />
			</AnimatedListItem>
			<AnimatedListItem index={1} selected>
				<span className="text-sm">Selected</span>
				<AnimatedListItemIndicator selected />
			</AnimatedListItem>
			<AnimatedListItem index={2}>
				<span className="text-sm">Without indicator</span>
			</AnimatedListItem>
		</AnimatedList>
	),
}
