import { Button } from "@ch5me/elf-ui/components/button"
import {
	SearchableListPopover,
	SearchableListPopoverContent,
	SearchableListPopoverGroup,
	SearchableListPopoverItem,
	SearchableListPopoverList,
	SearchableListPopoverSearch,
	SearchableListPopoverTrigger,
} from "@ch5me/elf-ui/components/searchable-list-popover"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { SearchIcon } from "lucide-react"

const meta = {
	title: "Foundations/Overlays/SearchableListPopover",
	component: SearchableListPopover,
	render: () => (
		<div className="min-h-[320px] w-[420px] p-10">
			<SearchableListPopover open>
				<SearchableListPopoverTrigger render={<Button variant="outline" />}>
					Choose component
				</SearchableListPopoverTrigger>
				<SearchableListPopoverContent>
					<SearchableListPopoverSearch placeholder="Search components..." icon={<SearchIcon />} />
					<SearchableListPopoverList>
						<SearchableListPopoverGroup label="Primitives">
							<SearchableListPopoverItem isActive onSelect={() => {}}>
								select
							</SearchableListPopoverItem>
							<SearchableListPopoverItem onSelect={() => {}}>sheet</SearchableListPopoverItem>
							<SearchableListPopoverItem onSelect={() => {}}>combobox</SearchableListPopoverItem>
						</SearchableListPopoverGroup>
					</SearchableListPopoverList>
				</SearchableListPopoverContent>
			</SearchableListPopover>
		</div>
	),
} satisfies Meta<typeof SearchableListPopover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		children: null,
	},
}
