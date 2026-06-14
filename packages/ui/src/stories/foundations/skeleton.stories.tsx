import { Skeleton } from "@ch5me/elf-ui/components/skeleton"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Feedback/Skeleton",
	component: Skeleton,
	render: () => (
		<div className="w-[360px] space-y-4 rounded-lg border bg-card p-4">
			<div className="flex items-center gap-3">
				<Skeleton className="size-10 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-48" />
				</div>
			</div>
			<Skeleton className="h-24 w-full" />
		</div>
	),
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const CardLoading: Story = {}
