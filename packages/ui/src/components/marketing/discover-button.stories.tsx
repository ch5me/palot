import {
	DiscoverButton,
	type DiscoverButtonTab,
} from "@ch5me/elf-ui/components/marketing/discover-button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ClockIcon, FlameIcon, HeartIcon } from "lucide-react"

const tabs: DiscoverButtonTab[] = [
	{ id: "popular", label: "Popular", icon: FlameIcon },
	{ id: "favorites", label: "Favorites", icon: HeartIcon },
]

const threeTabs: DiscoverButtonTab[] = [...tabs, { id: "recent", label: "Recent", icon: ClockIcon }]

const meta = {
	title: "Marketing/DiscoverButton",
	component: DiscoverButton,
	args: {
		tabs,
		defaultValue: "popular",
		defaultSearchExpanded: false,
		searchPlaceholder: "Search",
	},
	argTypes: {
		defaultValue: {
			control: "select",
			options: ["popular", "favorites"],
		},
		tabs: { control: false },
		value: { control: false },
		onValueChange: { control: false },
		searchExpanded: { control: false },
		onSearchExpandedChange: { control: false },
		searchValue: { control: false },
		defaultSearchValue: { control: false },
		onSearchValueChange: { control: false },
	},
	decorators: [
		(Story) => (
			<div className="flex w-[28rem] max-w-full justify-center py-6">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DiscoverButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex w-[28rem] max-w-full flex-col gap-6">
			<DiscoverButton tabs={tabs} value="popular" searchExpanded={false} />
			<DiscoverButton tabs={tabs} value="favorites" searchExpanded searchValue="mountain trails" />
			<DiscoverButton tabs={threeTabs} value="recent" searchExpanded={false} />
		</div>
	),
}
