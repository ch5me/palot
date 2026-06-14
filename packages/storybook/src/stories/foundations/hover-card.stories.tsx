import { Avatar, AvatarFallback } from "@ch5me/elf-ui/components/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ch5me/elf-ui/components/hover-card"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/HoverCard",
	component: HoverCard,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[220px] w-[420px] p-10">
			<HoverCard defaultOpen>
				<HoverCardTrigger className="text-sm font-medium underline underline-offset-4">
					@coverage-worker
				</HoverCardTrigger>
				<HoverCardContent>
					<div className="flex gap-3">
						<Avatar>
							<AvatarFallback>CW</AvatarFallback>
						</Avatar>
						<div>
							<div className="text-sm font-medium">Coverage worker</div>
							<div className="mt-1 text-sm text-muted-foreground">
								Adds stories, captures screenshots, and updates CH5 coverage.
							</div>
						</div>
					</div>
				</HoverCardContent>
			</HoverCard>
		</div>
	),
} satisfies Meta<typeof HoverCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
