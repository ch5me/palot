import {
	StackedList,
	StackedListBody,
	StackedListGroup,
	StackedListItem,
	StackedListOverlay,
	StackedListOverlayBar,
	StackedListOverlayClose,
	StackedListOverlayContent,
	StackedListOverlayReveal,
	StackedListSearchInput,
	StackedListStatusDot,
	StackedListTag,
	useStackedList,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckCircle2Icon, Clock3Icon } from "lucide-react"

const rows = [
	{ title: "Nav shell story", detail: "direct CH5 mapping", tone: "success" as const },
	{ title: "Animated forms", detail: "wizard, pricing, tabs", tone: "primary" as const },
	{ title: "Final scan", detail: "remaining actionable gaps", tone: "warm" as const },
]

function OverlayRows() {
	const { expanded } = useStackedList()

	return (
		<StackedListGroup open={expanded} className="px-4">
			{rows.map((row) => (
				<StackedListItem key={row.title} className="gap-3">
					<StackedListStatusDot tone={row.tone === "warm" ? "warm" : "success"} />
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium">{row.title}</div>
						<div className="text-muted-foreground truncate text-xs">{row.detail}</div>
					</div>
					<StackedListTag tone={row.tone}>{row.tone}</StackedListTag>
				</StackedListItem>
			))}
		</StackedListGroup>
	)
}

const meta = {
	title: "Animate/Layouts/StackedList",
	component: StackedList,
	render: () => (
		<div className="w-[520px] p-6">
			<StackedList className="h-[540px]" defaultExpanded>
				<StackedListBody className="gap-4 p-5">
					<div>
						<div className="text-lg font-semibold">Storybook queue</div>
						<div className="text-muted-foreground text-sm">Local component coverage worklist</div>
					</div>
					<StackedListSearchInput placeholder="Filter coverage tasks..." />
					<StackedListGroup>
						{rows.map((row) => (
							<StackedListItem key={row.title} className="gap-3">
								<CheckCircle2Icon className="text-primary size-4" />
								<div>
									<div className="text-sm font-medium">{row.title}</div>
									<div className="text-muted-foreground text-xs">{row.detail}</div>
								</div>
							</StackedListItem>
						))}
					</StackedListGroup>
				</StackedListBody>
				<StackedListOverlay>
					<StackedListOverlayBar>
						<div className="flex items-center gap-3">
							<Clock3Icon className="text-muted-foreground size-4" />
							<div>
								<div className="text-sm font-medium">Coverage details</div>
								<div className="text-muted-foreground text-xs">3 active proof steps</div>
							</div>
						</div>
						<StackedListOverlayClose />
					</StackedListOverlayBar>
					<StackedListOverlayContent>
						<StackedListOverlayReveal className="p-4">
							<StackedListSearchInput placeholder="Search proofs..." />
						</StackedListOverlayReveal>
						<OverlayRows />
					</StackedListOverlayContent>
				</StackedListOverlay>
			</StackedList>
		</div>
	),
} satisfies Meta<typeof StackedList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
