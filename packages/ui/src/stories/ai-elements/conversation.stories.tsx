import {
	Conversation,
	ConversationContent,
	ConversationDownload,
	ConversationEmptyState,
	type ConversationMessage,
} from "@ch5me/elf-ui/components/ai-elements/conversation"
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@ch5me/elf-ui/components/ai-elements/message"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MessageSquareIcon } from "lucide-react"

const messages: ConversationMessage[] = [
	{
		role: "user",
		content: "Create stories only for local Palot UI components.",
	},
	{
		role: "assistant",
		content:
			"Confirmed. Imported package components are trusted upstream; pure pass-through wrappers become documented exceptions.",
	},
	{
		role: "user",
		content: "Show the proof path before checking tracker boxes.",
	},
]

const meta = {
	title: "AI Elements/Chat/Conversation",
	component: Conversation,
	render: () => (
		<div className="grid w-[760px] grid-cols-[1fr_260px] gap-6 p-8">
			<div className="relative h-[520px] overflow-hidden rounded-lg border bg-background">
				<Conversation className="h-full">
					<ConversationContent>
						<Message from="user">
							<MessageContent>{messages[0]?.content}</MessageContent>
						</Message>
						<Message from="assistant">
							<MessageContent>
								<MessageResponse>{messages[1]?.content}</MessageResponse>
							</MessageContent>
						</Message>
						<Message from="user">
							<MessageContent>{messages[2]?.content}</MessageContent>
						</Message>
						<Message from="assistant">
							<MessageContent>
								<MessageResponse>
									{`Proof path:

1. Storybook typecheck.
2. Local render screenshots.
3. CH5 coverage JSON.
4. Static Storybook build.`}
								</MessageResponse>
							</MessageContent>
						</Message>
					</ConversationContent>
				</Conversation>
				<ConversationDownload messages={messages} />
			</div>
			<div className="h-[520px] rounded-lg border bg-muted/20">
				<ConversationEmptyState
					description="Select an agent run to inspect its messages and coverage proof."
					icon={<MessageSquareIcon className="size-8" />}
					title="No run selected"
				/>
			</div>
		</div>
	),
} satisfies Meta<typeof Conversation>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		children: null,
	},
}
