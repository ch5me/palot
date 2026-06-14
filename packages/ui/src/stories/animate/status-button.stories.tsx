import { StatusButton } from "@ch5me/elf-ui/components/animate/status-button"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Animate/Controls/StatusButton",
	component: StatusButton,
	render: () => (
		<div className="flex w-[620px] items-center gap-5 p-8">
			<StatusButton idleLabel="Save" status="idle" />
			<StatusButton idleLabel="Save" loadingLabel="Saving" status="loading" />
			<StatusButton idleLabel="Save" successLabel="Saved" status="success" />
		</div>
	),
} satisfies Meta<typeof StatusButton>

export default meta

type Story = StoryObj

export const Default: Story = {}
