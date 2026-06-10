import { MagnifiedBento } from "@ch5me/elf-ui/components/marketing/magnified-bento"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	BellIcon,
	CalendarIcon,
	FileTextIcon,
	GaugeIcon,
	GlobeIcon,
	InboxIcon,
	LayersIcon,
	MapPinIcon,
	MicIcon,
	PaletteIcon,
} from "lucide-react"

const meta = {
	title: "Marketing/MagnifiedBento",
	component: MagnifiedBento,
	args: {
		title: "Explore every capability",
		description:
			"Drag the lens across the moving wall of features to bring any capability into focus.",
		lensSize: 92,
		marqueeDuration: 25,
	},
	argTypes: {
		title: { control: "text" },
		description: { control: "text" },
		lensSize: { control: { type: "range", min: 56, max: 160, step: 4 } },
		marqueeDuration: { control: { type: "number", min: 5, step: 5 } },
		rows: { control: false },
		lensPalette: { control: false },
	},
} satisfies Meta<typeof MagnifiedBento>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const CustomRowsAndPalette: Story = {
	args: {
		title: "Everything in one workspace",
		description: "A tinted lens and custom chip rows, all prop-driven.",
		rows: [
			[
				{ id: "inbox", icon: InboxIcon, label: "Unified Inbox" },
				{ id: "calendar", icon: CalendarIcon, label: "Calendar" },
				{ id: "notes", icon: FileTextIcon, label: "Notes" },
				{ id: "reminders", icon: BellIcon, label: "Reminders" },
			],
			[
				{ id: "voice", icon: MicIcon, label: "Voice Capture" },
				{ id: "themes", icon: PaletteIcon, label: "Themes" },
				{ id: "layers", icon: LayersIcon, label: "Layers" },
				{ id: "speed", icon: GaugeIcon, label: "Performance" },
			],
			[
				{ id: "global", icon: GlobeIcon, label: "Localization" },
				{ id: "places", icon: MapPinIcon, label: "Places" },
				{ id: "plain", label: "No Icon Chip" },
			],
		],
		lensSize: 120,
		lensPalette: {
			rim: "var(--color-primary)",
			rimShade: "color-mix(in srgb, var(--color-primary) 70%, var(--color-background))",
			rimStroke: "color-mix(in srgb, var(--color-primary) 45%, var(--color-foreground))",
			handle: "color-mix(in srgb, var(--color-primary) 30%, var(--color-foreground))",
			handleShade: "color-mix(in srgb, var(--color-primary) 55%, var(--color-background))",
			glare: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
		},
	},
}
