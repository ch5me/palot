import { DeleteButton } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Animate/Controls/DeleteButton",
	component: DeleteButton,
	render: () => (
		<div className="flex w-[360px] items-center gap-4 p-8">
			<DeleteButton countdownSeconds={6} label="Delete run" cancelLabel="Undo" />
			<DeleteButton disabled label="Locked" />
		</div>
	),
} satisfies Meta<typeof DeleteButton>

export default meta

type Story = StoryObj

export const Default: Story = {}
