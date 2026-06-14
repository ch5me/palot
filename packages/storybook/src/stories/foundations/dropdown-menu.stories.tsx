import { Button } from "@ch5me/elf-ui/components/button"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@ch5me/elf-ui/components/dropdown-menu"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MoreHorizontalIcon } from "lucide-react"

const meta = {
	title: "Foundations/Overlays/DropdownMenu",
	component: DropdownMenu,
	render: () => (
		<div className="min-h-[280px] w-[420px] p-12">
			<DropdownMenu defaultOpen modal={false}>
				<DropdownMenuTrigger render={<Button variant="outline" />}>
					<MoreHorizontalIcon aria-hidden="true" />
					Session actions
				</DropdownMenuTrigger>
				<DropdownMenuContent className="w-56">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Session</DropdownMenuLabel>
						<DropdownMenuItem>
							Rename
							<DropdownMenuShortcut>R</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuItem>
							Copy ID
							<DropdownMenuShortcut>C</DropdownMenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuCheckboxItem checked>Keep browser lane open</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive">Archive session</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	),
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
