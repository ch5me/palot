import {
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { InboxIcon } from "lucide-react"

const meta = {
	title: "Foundations/Feedback/Empty",
	component: Empty,
	render: () => (
		<Empty className="min-h-[280px] max-w-xl border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<InboxIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>No active sessions</EmptyTitle>
				<EmptyDescription>
					Start a Palot session to see live runs, files, browser lanes, and tool output here.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>New session</Button>
			</EmptyContent>
		</Empty>
	),
} satisfies Meta<typeof Empty>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Compact: Story = {
	render: () => (
		<Empty className="min-h-[180px] max-w-md border p-8">
			<EmptyHeader>
				<EmptyTitle>No artifacts selected</EmptyTitle>
				<EmptyDescription>Select a generated artifact to preview revisions.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	),
}
