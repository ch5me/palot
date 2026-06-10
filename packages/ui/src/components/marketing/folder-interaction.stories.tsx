import {
	FolderInteraction,
	type FolderInteractionPalette,
} from "@ch5me/elf-ui/components/marketing/folder-interaction"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Marketing/FolderInteraction",
	component: FolderInteraction,
	args: {
		defaultOpen: false,
		pageLineRows: 8,
	},
	argTypes: {
		pageLineRows: { control: { type: "number", min: 0, max: 16, step: 1 } },
		open: { control: false },
		onOpenChange: { control: false },
		pages: { control: false },
		palette: { control: false },
	},
} satisfies Meta<typeof FolderInteraction>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const slatePalette: Partial<FolderInteractionPalette> = {
	back: "#10161D",
	backGlow: "rgba(70, 90, 110, 0.30)",
	flapFrom: "#1F2C3A",
	flapTo: "#1A2230",
	flapStrokeFrom: "#3E4C5C",
	flapStrokeTo: "#1B232E",
	pageFrom: "#E4EBF2",
	pageTo: "#D5DEE9",
	pageLine: "#C3CFDC",
}

const emberPalette: Partial<FolderInteractionPalette> = {
	back: "#1B1410",
	backGlow: "rgba(110, 80, 60, 0.30)",
	flapFrom: "#36251C",
	flapTo: "#2A1F18",
	flapStrokeFrom: "#5C4636",
	flapStrokeTo: "#2E211A",
	pageFrom: "#F2EAE2",
	pageTo: "#E9DCCE",
	pageLine: "#DCC9B6",
}

export const Palettes: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-end gap-12">
			{(
				[
					["Default", undefined],
					["Slate", slatePalette],
					["Ember", emberPalette],
				] as const
			).map(([label, palette]) => (
				<div key={label} className="flex flex-col items-center gap-3">
					<FolderInteraction defaultOpen palette={palette} aria-label={`${label} folder`} />
					<span className="text-muted-foreground text-xs">{label}</span>
				</div>
			))}
		</div>
	),
}
