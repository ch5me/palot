import { DeleteButton } from "@ch5me/elf-ui/components/animate/delete-button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"

const meta = {
	title: "Animate/DeleteButton",
	component: DeleteButton,
	args: {
		label: "Delete",
		cancelLabel: "Cancel",
		countdownSeconds: 10,
		disabled: false,
		onConfirm: fn(),
		onCancel: fn(),
	},
	argTypes: {
		countdownSeconds: {
			control: { type: "number", min: 1, max: 60, step: 1 },
		},
	},
} satisfies Meta<typeof DeleteButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-center gap-4">
			<DeleteButton onConfirm={fn()} onCancel={fn()} />
			<DeleteButton
				label="Remove item"
				cancelLabel="Keep it"
				countdownSeconds={3}
				onConfirm={fn()}
				onCancel={fn()}
			/>
			<DeleteButton disabled />
		</div>
	),
}
