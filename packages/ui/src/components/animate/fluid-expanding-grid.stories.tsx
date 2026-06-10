import type { FluidExpandingGridItem } from "@ch5me/elf-ui/components/animate/fluid-expanding-grid"
import { FluidExpandingGrid } from "@ch5me/elf-ui/components/animate/fluid-expanding-grid"
import type { Meta, StoryObj } from "@storybook/react-vite"

const sampleItems: FluidExpandingGridItem[] = [
	{
		id: "alpine-lake",
		title: "Alpine Lake",
		subtitle: "Glacial water at first light",
		src: "https://picsum.photos/seed/alpine-lake/1200/800",
	},
	{
		id: "desert-dunes",
		title: "Desert Dunes",
		subtitle: "Wind-carved ridgelines",
		src: "https://picsum.photos/seed/desert-dunes/1200/800",
	},
	{
		id: "forest-canopy",
		title: "Forest Canopy",
		subtitle: "Old growth from above",
		src: "https://picsum.photos/seed/forest-canopy/1200/800",
	},
	{
		id: "coastal-cliffs",
		title: "Coastal Cliffs",
		subtitle: "Basalt meeting the tide",
		src: "https://picsum.photos/seed/coastal-cliffs/1200/800",
	},
]

const meta = {
	title: "Animate/FluidExpandingGrid",
	component: FluidExpandingGrid,
	args: {
		items: sampleItems,
	},
	argTypes: {
		items: { control: "object" },
	},
	decorators: [
		(Story) => (
			<div className="w-[min(56rem,90vw)]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof FluidExpandingGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ThreeItems: Story = {
	args: {
		items: sampleItems.slice(0, 3),
	},
}
