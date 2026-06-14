import { StatusButton } from "@ch5me/ch5-ui-web"
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
