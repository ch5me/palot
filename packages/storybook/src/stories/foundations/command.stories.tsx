import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@ch5me/elf-ui/components/command"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { FileTextIcon, SearchIcon, SettingsIcon } from "lucide-react"

const meta = {
	title: "Foundations/Command/Command",
	component: Command,
	render: () => (
		<Command className="w-[460px] rounded-xl border shadow-sm">
			<CommandInput placeholder="Search commands..." />
			<CommandList>
				<CommandEmpty>No commands found.</CommandEmpty>
				<CommandGroup heading="Storybook">
					<CommandItem>
						<FileTextIcon aria-hidden="true" />
						Create missing story
						<CommandShortcut>⌘S</CommandShortcut>
					</CommandItem>
					<CommandItem data-checked="true">
						<SearchIcon aria-hidden="true" />
						Run CH5 coverage
					</CommandItem>
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup heading="Workspace">
					<CommandItem>
						<SettingsIcon aria-hidden="true" />
						Open settings
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	),
} satisfies Meta<typeof Command>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
