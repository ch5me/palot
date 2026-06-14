import {
	Message,
	MessageAction,
	MessageActions,
	MessageBranch,
	MessageBranchContent,
	MessageBranchNext,
	MessageBranchPage,
	MessageBranchPrevious,
	MessageBranchSelector,
	MessageContent,
	MessageResponse,
	MessageToolbar,
} from "@ch5me/elf-ui/components/ai-elements/message"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CopyIcon, RefreshCcwIcon, ThumbsUpIcon } from "lucide-react"

const assistantMarkdown = `Story coverage should stay local to Palot-owned components.

- Pure imported components become documented exceptions.
- Local wrappers need stories when they add behavior, styling, or composition.

\`\`\`ts
const scope = "packages/ui/src/components"
\`\`\``

const meta = {
	title: "AI Elements/Chat/Message",
	component: Message,
	render: () => (
		<div className="flex w-[720px] flex-col gap-6 p-8">
			<Message from="user">
				<MessageContent>Which AI elements still need local Storybook stories?</MessageContent>
			</Message>
			<Message from="assistant">
				<MessageContent>
					<MessageBranch defaultBranch={0}>
						<MessageBranchContent>
							<MessageResponse key="short">{assistantMarkdown}</MessageResponse>
							<MessageResponse key="detail">
								{`${assistantMarkdown}

Next batch should cover chat, artifacts, citations, and tool output before moving into canvas controls.`}
							</MessageResponse>
						</MessageBranchContent>
						<MessageToolbar>
							<MessageBranchSelector>
								<MessageBranchPrevious />
								<MessageBranchPage />
								<MessageBranchNext />
							</MessageBranchSelector>
							<MessageActions>
								<MessageAction label="Copy response" tooltip="Copy response">
									<CopyIcon className="size-4" />
								</MessageAction>
								<MessageAction label="Regenerate" tooltip="Regenerate">
									<RefreshCcwIcon className="size-4" />
								</MessageAction>
								<MessageAction label="Good response" tooltip="Good response">
									<ThumbsUpIcon className="size-4" />
								</MessageAction>
							</MessageActions>
						</MessageToolbar>
					</MessageBranch>
				</MessageContent>
			</Message>
		</div>
	),
} satisfies Meta<typeof Message>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		from: "assistant",
	},
}
