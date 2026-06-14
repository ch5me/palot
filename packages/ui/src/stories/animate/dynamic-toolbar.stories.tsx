import {
	DynamicToolbar,
	DynamicToolbarButton,
	DynamicToolbarPrimary,
	DynamicToolbarSecondary,
	DynamicToolbarTrigger,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArchiveIcon, Code2Icon, SearchIcon, SettingsIcon, TerminalIcon } from "lucide-react"

const meta = {
	title: "Animate/Layouts/DynamicToolbar",
	component: DynamicToolbar,
	render: () => (
		<div className="flex w-[520px] items-center justify-center p-10">
			<DynamicToolbar defaultExpanded>
				<DynamicToolbarPrimary>
					<DynamicToolbarButton aria-label="Search">
						<SearchIcon />
					</DynamicToolbarButton>
					<DynamicToolbarButton aria-label="Code">
						<Code2Icon />
					</DynamicToolbarButton>
					<DynamicToolbarTrigger />
				</DynamicToolbarPrimary>
				<DynamicToolbarSecondary>
					<DynamicToolbarTrigger />
					<DynamicToolbarButton aria-label="Terminal" blurWhenInactive>
						<TerminalIcon />
					</DynamicToolbarButton>
					<DynamicToolbarButton aria-label="Archive" blurWhenInactive>
						<ArchiveIcon />
					</DynamicToolbarButton>
					<DynamicToolbarButton aria-label="Settings" blurWhenInactive>
						<SettingsIcon />
					</DynamicToolbarButton>
				</DynamicToolbarSecondary>
			</DynamicToolbar>
		</div>
	),
} satisfies Meta<typeof DynamicToolbar>

export default meta

type Story = StoryObj

export const Default: Story = {}
