import {
	ExpandableGallery,
	type ExpandableGalleryItem,
} from "@ch5me/elf-ui/components/animate/expandable-gallery"
import type { Meta, StoryObj } from "@storybook/react-vite"

const items: ExpandableGalleryItem[] = [
	{ id: "1", src: "https://picsum.photos/seed/gallery-1/600/600", alt: "Mountain lake at dawn" },
	{ id: "2", src: "https://picsum.photos/seed/gallery-2/600/600", alt: "Forest trail in fog" },
	{ id: "3", src: "https://picsum.photos/seed/gallery-3/600/600", alt: "Coastal cliffs at sunset" },
	{ id: "4", src: "https://picsum.photos/seed/gallery-4/600/600", alt: "Desert dunes" },
	{ id: "5", src: "https://picsum.photos/seed/gallery-5/600/600", alt: "City skyline at night" },
	{ id: "6", src: "https://picsum.photos/seed/gallery-6/600/600", alt: "Snowy ridge line" },
]

const meta = {
	title: "Animate/ExpandableGallery",
	component: ExpandableGallery,
	args: {
		items,
		stackCount: 3,
		defaultExpanded: false,
		collapseLabel: "Back",
	},
	argTypes: {
		items: { control: false },
		children: { control: false },
		expanded: { control: false },
		onExpandedChange: { control: false },
		stackCount: { control: { type: "number", min: 1, max: 6, step: 1 } },
		collapseLabel: { control: "text" },
	},
} satisfies Meta<typeof ExpandableGallery>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
	args: {
		children: <h2 className="font-semibold text-2xl tracking-tight">Weekend in the mountains</h2>,
	},
}

export const Expanded: Story = {
	args: {
		defaultExpanded: true,
	},
}

const posedItems: ExpandableGalleryItem[] = items.map((item, index) => {
	const poses = [
		{ rotation: -24, x: -130, y: 20, zIndex: 30 },
		{ rotation: 0, x: 0, y: -25, zIndex: 10 },
		{ rotation: 18, x: 120, y: 15, zIndex: 20 },
	]
	const pose = poses[index]
	return pose ? { ...item, ...pose } : item
})

export const CustomStackPoses: Story = {
	args: {
		items: posedItems,
	},
}
