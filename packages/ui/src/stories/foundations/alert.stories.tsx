import { Alert, AlertAction, AlertDescription, AlertTitle } from "@ch5me/elf-ui/components/alert"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"

const meta = {
	title: "Foundations/Feedback/Alert",
	component: Alert,
	args: {
		variant: "default",
	},
	render: (args) => (
		<Alert {...args} className="max-w-xl">
			<CheckCircle2Icon aria-hidden="true" />
			<AlertTitle>Runtime ready</AlertTitle>
			<AlertDescription>
				OpenCode host is reachable and Palot can attach browser lanes for this session.
			</AlertDescription>
		</Alert>
	),
} satisfies Meta<typeof Alert>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = {
	args: {
		variant: "destructive",
	},
	render: (args) => (
		<Alert {...args} className="max-w-xl">
			<AlertTriangleIcon aria-hidden="true" />
			<AlertTitle>Lane disconnected</AlertTitle>
			<AlertDescription>
				The browser lane stopped responding. Restart the managed lane before replaying actions.
			</AlertDescription>
			<AlertAction>
				<button
					type="button"
					className="rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium"
				>
					Retry
				</button>
			</AlertAction>
		</Alert>
	),
}
