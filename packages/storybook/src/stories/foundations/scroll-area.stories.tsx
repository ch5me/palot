import { ScrollArea } from "@ch5me/elf-ui/components/scroll-area"
import type { Meta, StoryObj } from "@storybook/react-vite"

const entries = [
	"alert",
	"avatar",
	"badge",
	"button",
	"checkbox",
	"dialog",
	"dropdown-menu",
	"input",
	"popover",
	"tooltip",
]

const meta = {
	title: "Foundations/Layout/ScrollArea",
	component: ScrollArea,
	tags: ["autodocs"],
	render: () => (
		<ScrollArea className="h-64 w-[320px] rounded-lg border bg-card text-card-foreground">
			<div className="p-4">
				<div className="text-sm font-medium">Covered primitives</div>
				<div className="mt-3 grid gap-2">
					{entries.map((entry) => (
						<div key={entry} className="rounded-md bg-muted px-3 py-2 text-sm">
							{entry}
						</div>
					))}
				</div>
			</div>
		</ScrollArea>
	),
} satisfies Meta<typeof ScrollArea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
