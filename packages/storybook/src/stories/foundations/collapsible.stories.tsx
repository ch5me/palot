import { Button } from "@ch5me/elf-ui/components/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@ch5me/elf-ui/components/collapsible"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ChevronsUpDownIcon } from "lucide-react"

const meta = {
	title: "Foundations/Disclosure/Collapsible",
	component: Collapsible,
	args: {
		defaultOpen: true,
	},
	render: (args) => (
		<Collapsible {...args} className="w-[420px] rounded-lg border bg-card p-4 text-card-foreground">
			<div className="flex items-center justify-between gap-4">
				<div>
					<div className="text-sm font-medium">Render proof</div>
					<div className="text-xs text-muted-foreground">24 screenshots captured</div>
				</div>
				<CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" />}>
					<ChevronsUpDownIcon aria-hidden="true" />
					<span className="sr-only">Toggle proof details</span>
				</CollapsibleTrigger>
			</div>
			<CollapsibleContent className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
				Desktop and mobile iframe captures passed for every story in the current batch.
			</CollapsibleContent>
		</Collapsible>
	),
} satisfies Meta<typeof Collapsible>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
