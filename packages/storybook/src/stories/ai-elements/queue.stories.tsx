import {
	Queue,
	QueueItem,
	QueueItemAction,
	QueueItemActions,
	QueueItemAttachment,
	QueueItemContent,
	QueueItemDescription,
	QueueItemFile,
	QueueItemIndicator,
	QueueList,
	QueueSection,
	QueueSectionContent,
	QueueSectionLabel,
	QueueSectionTrigger,
} from "@ch5me/elf-ui/components/ai-elements/queue"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckIcon, ListChecksIcon, XIcon } from "lucide-react"

const meta = {
	title: "AI Elements/Workflow/Queue",
	component: Queue,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[620px] p-8">
			<Queue>
				<QueueSection defaultOpen>
					<QueueSectionTrigger>
						<QueueSectionLabel
							count={3}
							icon={<ListChecksIcon className="size-4" />}
							label="queued tasks"
						/>
					</QueueSectionTrigger>
					<QueueSectionContent>
						<QueueList>
							<QueueItem>
								<div className="flex items-start gap-2">
									<QueueItemIndicator completed />
									<QueueItemContent completed>Inspect component exports</QueueItemContent>
									<QueueItemActions>
										<QueueItemAction aria-label="Complete">
											<CheckIcon className="size-3" />
										</QueueItemAction>
									</QueueItemActions>
								</div>
							</QueueItem>
							<QueueItem>
								<div className="flex items-start gap-2">
									<QueueItemIndicator />
									<div className="min-w-0 flex-1">
										<QueueItemContent>Create render proof story</QueueItemContent>
										<QueueItemDescription>
											Use realistic state and visible desktop/mobile layout.
										</QueueItemDescription>
										<QueueItemAttachment>
											<QueueItemFile>render-proof.json</QueueItemFile>
										</QueueItemAttachment>
									</div>
									<QueueItemActions>
										<QueueItemAction aria-label="Remove">
											<XIcon className="size-3" />
										</QueueItemAction>
									</QueueItemActions>
								</div>
							</QueueItem>
						</QueueList>
					</QueueSectionContent>
				</QueueSection>
			</Queue>
		</div>
	),
} satisfies Meta<typeof Queue>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
