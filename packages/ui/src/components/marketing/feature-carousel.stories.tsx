import {
	FeatureCarousel,
	type FeatureCarouselItem,
} from "@ch5me/elf-ui/components/marketing/feature-carousel"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BellIcon, ChartSplineIcon, LayersIcon, ShieldCheckIcon, UsersIcon } from "lucide-react"

const items: FeatureCarouselItem[] = [
	{
		id: "analytics",
		label: "Analytics",
		description: "Insights at your fingertips, updated in real time.",
		image: "https://picsum.photos/seed/feature-analytics/840/1050",
		icon: ChartSplineIcon,
	},
	{
		id: "collaboration",
		label: "Collaboration",
		description: "Work together with your team, wherever they are.",
		image: "https://picsum.photos/seed/feature-collab/840/1050",
		icon: UsersIcon,
	},
	{
		id: "notifications",
		label: "Notifications",
		description: "Stay on top of what matters with smart alerts.",
		image: "https://picsum.photos/seed/feature-notify/840/1050",
		icon: BellIcon,
	},
	{
		id: "integrations",
		label: "Integrations",
		description: "Connect the tools you already use in one click.",
		image: "https://picsum.photos/seed/feature-integrate/840/1050",
		icon: LayersIcon,
	},
	{
		id: "security",
		label: "Security",
		description: "Enterprise-grade protection, on by default.",
		image: "https://picsum.photos/seed/feature-secure/840/1050",
		icon: ShieldCheckIcon,
	},
]

const meta = {
	title: "Marketing/FeatureCarousel",
	component: FeatureCarousel,
	parameters: {
		layout: "padded",
	},
	args: {
		items,
		defaultIndex: 0,
		autoPlayInterval: 3000,
		statusLabel: "Live session",
	},
	argTypes: {
		items: { control: false },
		index: { control: false },
		onIndexChange: { control: false },
		defaultIndex: {
			control: { type: "number", min: 0, max: items.length - 1, step: 1 },
		},
		autoPlayInterval: {
			control: { type: "number", min: 0, max: 10000, step: 500 },
		},
		statusLabel: { control: "text" },
		railClassName: { control: false },
		stageClassName: { control: false },
	},
} satisfies Meta<typeof FeatureCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ManualSelection: Story = {
	args: {
		autoPlayInterval: 0,
		statusLabel: undefined,
	},
}
