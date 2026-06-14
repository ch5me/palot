import {
	Attachment,
	type AttachmentData,
	AttachmentEmpty,
	AttachmentHoverCard,
	AttachmentHoverCardContent,
	AttachmentHoverCardTrigger,
	AttachmentInfo,
	AttachmentPreview,
	AttachmentRemove,
	Attachments,
} from "@ch5me/elf-ui/components/ai-elements/attachments"
import type { Meta, StoryObj } from "@storybook/react-vite"

const imageAttachment: AttachmentData = {
	id: "att-image",
	type: "file",
	filename: "story-render.png",
	mediaType: "image/png",
	url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120'%3E%3Crect width='160' height='120' fill='%2327272a'/%3E%3Ctext x='18' y='66' fill='white' font-family='monospace' font-size='16'%3EStory%3C/text%3E%3C/svg%3E",
}

const documentAttachment: AttachmentData = {
	id: "att-doc",
	type: "file",
	filename: "storybook-missing-ui-elements.md",
	mediaType: "text/markdown",
	url: "file:///docs/storybook-missing-ui-elements.md",
}

const sourceAttachment: AttachmentData = {
	id: "att-source",
	type: "source-document",
	title: "CH5 coverage source scope",
	filename: "coverage-rule.md",
	mediaType: "text/markdown",
	sourceId: "ch5-coverage-scope",
}

const meta = {
	title: "AI Elements/Input/Attachments",
	component: Attachments,
	render: () => (
		<div className="flex w-[760px] flex-col gap-8 p-8">
			<Attachments variant="grid">
				<Attachment data={imageAttachment} onRemove={() => undefined}>
					<AttachmentHoverCard defaultOpen>
						<AttachmentHoverCardTrigger render={<div className="size-full" />}>
							<AttachmentPreview />
						</AttachmentHoverCardTrigger>
						<AttachmentHoverCardContent>
							<AttachmentPreview className="size-40 rounded-md" />
						</AttachmentHoverCardContent>
					</AttachmentHoverCard>
					<AttachmentRemove />
				</Attachment>
			</Attachments>
			<Attachments variant="list">
				<Attachment data={documentAttachment} onRemove={() => undefined}>
					<AttachmentPreview />
					<AttachmentInfo showMediaType />
					<AttachmentRemove />
				</Attachment>
				<Attachment data={sourceAttachment}>
					<AttachmentPreview />
					<AttachmentInfo showMediaType />
				</Attachment>
			</Attachments>
			<AttachmentEmpty />
		</div>
	),
} satisfies Meta<typeof Attachments>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
