import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuTrigger,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/ContextMenu",
	component: ContextMenu,
	render: () => (
		<div className="min-h-[300px] w-[480px] p-10">
			<ContextMenu defaultOpen>
				<ContextMenuTrigger className="grid h-40 place-items-center rounded-lg border border-dashed bg-card text-sm text-muted-foreground">
					Right click session transcript
				</ContextMenuTrigger>
				<ContextMenuContent className="w-56">
					<ContextMenuGroup>
						<ContextMenuLabel>Transcript</ContextMenuLabel>
						<ContextMenuItem>
							Copy summary
							<ContextMenuShortcut>⌘C</ContextMenuShortcut>
						</ContextMenuItem>
						<ContextMenuItem>Open proof folder</ContextMenuItem>
						<ContextMenuCheckboxItem checked>Include screenshots</ContextMenuCheckboxItem>
					</ContextMenuGroup>
					<ContextMenuSeparator />
					<ContextMenuItem variant="destructive">Archive batch</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	),
} satisfies Meta<typeof ContextMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
