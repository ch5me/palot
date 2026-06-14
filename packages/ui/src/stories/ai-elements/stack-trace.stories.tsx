import {
	StackTrace,
	StackTraceActions,
	StackTraceContent,
	StackTraceCopyButton,
	StackTraceError,
	StackTraceErrorMessage,
	StackTraceErrorType,
	StackTraceExpandButton,
	StackTraceFrames,
	StackTraceHeader,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const trace = `TypeError: Cannot read properties of undefined (reading 'storyId')
    at renderStory (/Users/chris/src/ch5/palot/packages/storybook/src/render-proof.ts:42:18)
    at verifyBatch (/Users/chris/src/ch5/palot/packages/storybook/src/render-proof.ts:88:9)
    at async main (/Users/chris/src/ch5/palot/scripts/verify-storybook-render.ts:121:3)
    at async node:internal/process/task_queues:95:5`

const meta = {
	title: "AI Elements/Diagnostics/StackTrace",
	component: StackTrace,
	render: () => (
		<div className="w-[760px] p-8">
			<StackTrace defaultOpen trace={trace}>
				<StackTraceHeader>
					<StackTraceError>
						<StackTraceErrorType />
						<StackTraceErrorMessage />
					</StackTraceError>
					<StackTraceActions>
						<StackTraceCopyButton />
						<StackTraceExpandButton />
					</StackTraceActions>
				</StackTraceHeader>
				<StackTraceContent>
					<StackTraceFrames showInternalFrames={false} />
				</StackTraceContent>
			</StackTrace>
		</div>
	),
} satisfies Meta<typeof StackTrace>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
		trace,
	},
}
