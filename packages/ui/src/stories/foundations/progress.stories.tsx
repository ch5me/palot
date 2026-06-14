import { Progress, ProgressLabel, ProgressValue } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Feedback/Progress",
	component: Progress,
	args: {
		value: 64,
	},
	render: (args) => (
		<Progress {...args} className="w-[360px]">
			<ProgressLabel>Syncing browser trace</ProgressLabel>
			<ProgressValue />
		</Progress>
	),
} satisfies Meta<typeof Progress>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const States: Story = {
	render: () => (
		<div className="grid w-[360px] gap-5">
			<Progress value={24}>
				<ProgressLabel>Queued</ProgressLabel>
				<ProgressValue />
			</Progress>
			<Progress value={72}>
				<ProgressLabel>Capturing</ProgressLabel>
				<ProgressValue />
			</Progress>
			<Progress value={100}>
				<ProgressLabel>Complete</ProgressLabel>
				<ProgressValue />
			</Progress>
		</div>
	),
}
