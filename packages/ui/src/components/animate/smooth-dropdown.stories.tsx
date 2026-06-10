import {
	SmoothDropdown,
	type SmoothDropdownEntry,
} from "@ch5me/elf-ui/components/animate/smooth-dropdown"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bell, LogOut, Settings, SlidersHorizontal, User } from "lucide-react"

const items: SmoothDropdownEntry[] = [
	{ id: "profile", label: "Profile", icon: User },
	{ id: "settings", label: "Settings", icon: Settings },
	{ id: "notifications", label: "Notifications", icon: Bell },
	{ type: "separator", id: "sep" },
	{ id: "sign-out", label: "Sign out", icon: LogOut, destructive: true, closeOnSelect: true },
]

const meta = {
	title: "Animate/SmoothDropdown",
	component: SmoothDropdown,
	args: {
		items,
		defaultOpen: false,
		defaultValue: "profile",
		triggerLabel: "Open menu",
		openWidth: 220,
	},
	argTypes: {
		defaultValue: {
			control: "select",
			options: [null, "profile", "settings", "notifications", "sign-out"],
		},
		openWidth: { control: { type: "range", min: 160, max: 360, step: 10 } },
		items: { control: false },
		open: { control: false },
		value: { control: false },
		triggerIcon: { control: false },
		onOpenChange: { control: false },
		onValueChange: { control: false },
	},
	decorators: [
		(Story) => (
			<div className="flex h-80 w-full justify-center pt-6">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SmoothDropdown>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex gap-56">
			<SmoothDropdown items={items} />
			<SmoothDropdown items={items} open value="settings" />
			<SmoothDropdown
				items={items}
				open
				value="sign-out"
				triggerIcon={SlidersHorizontal}
				openWidth={260}
			/>
		</div>
	),
}
