import { VerticalTabs, type VerticalTabsItem } from "@ch5me/elf-ui/components/animate/vertical-tabs"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	BellIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	PaletteIcon,
	ShieldIcon,
} from "lucide-react"
import type { ReactNode } from "react"

function Pane({ icon: Icon, label }: { icon: LucideIcon; label: string }): ReactNode {
	return (
		<div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
			<Icon className="size-10" strokeWidth={1.5} />
			<span className="text-sm font-medium">{label}</span>
		</div>
	)
}

const items: VerticalTabsItem[] = [
	{
		value: "overview",
		label: "Overview",
		description: "Activity summary and recent changes at a glance.",
		content: <Pane icon={LayoutDashboardIcon} label="Overview" />,
	},
	{
		value: "appearance",
		label: "Appearance",
		description: "Theme, density, and layout preferences.",
		content: <Pane icon={PaletteIcon} label="Appearance" />,
	},
	{
		value: "notifications",
		label: "Notifications",
		description: "Delivery channels and quiet hours.",
		content: <Pane icon={BellIcon} label="Notifications" />,
	},
	{
		value: "security",
		label: "Security",
		description: "Sessions, devices, and sign-in methods.",
		content: <Pane icon={ShieldIcon} label="Security" />,
	},
]

const meta = {
	title: "Animate/VerticalTabs",
	component: VerticalTabs,
	args: {
		items,
		defaultValue: "overview",
		size: "default",
		autoPlayInterval: 0,
		showControls: true,
		showIndex: true,
	},
	argTypes: {
		size: {
			control: "select",
			options: ["sm", "default", "lg"],
		},
		defaultValue: {
			control: "select",
			options: items.map((item) => item.value),
		},
		autoPlayInterval: {
			control: { type: "number", min: 0, step: 500 },
		},
		items: { control: false },
		value: { control: false },
		onValueChange: { control: false },
	},
	render: (args) => (
		<div className="w-full max-w-3xl rounded-[2rem] border border-border/50 bg-background/80 p-4 shadow-[var(--ff-shadow-sm)]">
			<VerticalTabs {...args} />
		</div>
	),
} satisfies Meta<typeof VerticalTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AutoPlay: Story = {
	args: {
		autoPlayInterval: 4000,
	},
}

const sizes = ["sm", "default", "lg"] as const

export const Sizes: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex w-full min-w-[52rem] max-w-5xl flex-col gap-12 rounded-[2rem] border border-border/50 bg-background/80 p-4 shadow-[var(--ff-shadow-sm)]">
			{sizes.map((size) => (
				<VerticalTabs
					key={size}
					size={size}
					items={items}
					defaultValue="overview"
					showControls={false}
				/>
			))}
		</div>
	),
}
