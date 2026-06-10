import {
	DynamicToolbar,
	DynamicToolbarButton,
	DynamicToolbarPrimary,
	DynamicToolbarSecondary,
	DynamicToolbarTrigger,
} from "@ch5me/elf-ui/components/animate/dynamic-toolbar"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
	AlignCenterIcon,
	AlignLeftIcon,
	AlignRightIcon,
	BoldIcon,
	ItalicIcon,
	LinkIcon,
	UnderlineIcon,
} from "lucide-react"

const meta = {
	title: "Animate/DynamicToolbar",
	component: DynamicToolbar,
	args: {
		defaultExpanded: false,
	},
	argTypes: {
		defaultExpanded: { control: "boolean" },
		expanded: { control: false },
		onExpandedChange: { control: false },
	},
} satisfies Meta<typeof DynamicToolbar>

export default meta
type Story = StoryObj<typeof meta>

function ToolbarContents() {
	return (
		<>
			<DynamicToolbarPrimary>
				<DynamicToolbarButton aria-label="Bold" blurWhenInactive>
					<BoldIcon />
				</DynamicToolbarButton>
				<DynamicToolbarButton aria-label="Italic" blurWhenInactive>
					<ItalicIcon />
				</DynamicToolbarButton>
				<DynamicToolbarButton aria-label="Underline" blurWhenInactive>
					<UnderlineIcon />
				</DynamicToolbarButton>
				<DynamicToolbarTrigger aria-label="Show alignment options" />
			</DynamicToolbarPrimary>
			<DynamicToolbarSecondary>
				<DynamicToolbarTrigger aria-label="Back to formatting" />
				<DynamicToolbarButton aria-label="Align left" blurWhenInactive>
					<AlignLeftIcon />
				</DynamicToolbarButton>
				<DynamicToolbarButton aria-label="Align center" blurWhenInactive>
					<AlignCenterIcon />
				</DynamicToolbarButton>
				<DynamicToolbarButton aria-label="Align right" blurWhenInactive>
					<AlignRightIcon />
				</DynamicToolbarButton>
				<DynamicToolbarButton aria-label="Insert link" blurWhenInactive>
					<LinkIcon />
				</DynamicToolbarButton>
			</DynamicToolbarSecondary>
		</>
	)
}

export const Playground: Story = {
	render: (args) => (
		// Re-mount when defaultExpanded changes so the uncontrolled state resets.
		<DynamicToolbar key={String(args.defaultExpanded)} {...args}>
			<ToolbarContents />
		</DynamicToolbar>
	),
}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex min-w-[22rem] flex-col items-start gap-3 rounded-[2rem] border border-border/50 bg-background/80 p-4 py-2 shadow-[var(--ff-shadow-sm)]">
			<span className="text-muted-foreground text-xs">collapsed</span>
			<DynamicToolbar>
				<ToolbarContents />
			</DynamicToolbar>
			<span className="text-muted-foreground text-xs">expanded</span>
			<DynamicToolbar defaultExpanded>
				<ToolbarContents />
			</DynamicToolbar>
		</div>
	),
}
