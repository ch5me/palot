import {
	BottomMenu,
	type BottomMenuItem,
	BottomMenuOptionGroup,
	BottomMenuRow,
} from "@ch5me/elf-ui/components/animate/bottom-menu"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	Bell,
	Link,
	Mail,
	MessageSquare,
	Monitor,
	Moon,
	Search,
	Settings,
	Share2,
	Sun,
} from "lucide-react"

const items: BottomMenuItem[] = [
	{
		id: "share",
		label: "Share",
		icon: Share2,
		content: (
			<div className="flex min-w-56 flex-col px-1">
				<BottomMenuRow icon={Link}>Copy link</BottomMenuRow>
				<BottomMenuRow icon={Mail}>Email</BottomMenuRow>
				<BottomMenuRow icon={MessageSquare}>Message</BottomMenuRow>
			</div>
		),
	},
	{
		id: "appearance",
		label: "Appearance",
		icon: Settings,
		content: (
			<div className="min-w-72 px-1">
				<BottomMenuOptionGroup
					defaultValue="system"
					options={[
						{ value: "light", label: "Light", icon: Sun },
						{ value: "dark", label: "Dark", icon: Moon },
						{ value: "system", label: "Auto", icon: Monitor },
					]}
				/>
			</div>
		),
	},
	{
		id: "notifications",
		label: "Notifications",
		icon: Bell,
		content: (
			<div className="flex min-w-64 flex-col px-1">
				<BottomMenuRow icon={Bell}>Mute for 1 hour</BottomMenuRow>
				<BottomMenuRow icon={Bell}>Mute for 1 day</BottomMenuRow>
			</div>
		),
	},
	{
		id: "search",
		label: "Search",
		icon: Search,
	},
]

const meta = {
	title: "Animate/BottomMenu",
	component: BottomMenu,
	args: {
		items,
		defaultValue: null,
	},
	argTypes: {
		defaultValue: {
			control: "select",
			options: [null, "share", "appearance", "notifications"],
		},
		items: { control: false },
		value: { control: false },
		onValueChange: { control: false },
	},
	decorators: [
		(Story) => (
			<div className="flex h-96 w-full items-end justify-center pb-6">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof BottomMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Panels: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex items-end gap-16">
			<BottomMenu items={items} value="share" />
			<BottomMenu items={items} value="appearance" />
			<BottomMenu items={items} value={null} />
		</div>
	),
}
