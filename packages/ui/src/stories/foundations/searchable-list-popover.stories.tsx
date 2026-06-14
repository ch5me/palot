import {
	Button,
	SearchableListPopover,
	SearchableListPopoverContent,
	SearchableListPopoverGroup,
	SearchableListPopoverItem,
	SearchableListPopoverList,
	SearchableListPopoverSearch,
	SearchableListPopoverTrigger,
} from "@ch5me/ch5-ui-web"
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
