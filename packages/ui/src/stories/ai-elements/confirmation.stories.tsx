import {
	Confirmation,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@ch5me/elf-ui/components/ai-elements/confirmation"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Workflow/Confirmation",
	component: Confirmation,
	render: () => (
		<div className="w-[520px] p-8">
			<Confirmation approval={{ id: "tool-call-1" }} state="approval-requested">
				<ConfirmationTitle>Allow shell command?</ConfirmationTitle>
				<ConfirmationRequest>
					<div className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
						bun run verify:storybook-render
					</div>
				</ConfirmationRequest>
				<ConfirmationActions>
					<ConfirmationAction variant="outline">Deny</ConfirmationAction>
					<ConfirmationAction>Approve</ConfirmationAction>
				</ConfirmationActions>
			</Confirmation>
		</div>
	),
} satisfies Meta<typeof Confirmation>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		approval: { id: "tool-call-1" },
		state: "approval-requested",
	},
}
