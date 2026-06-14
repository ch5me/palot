import type { FileContents } from "@ch5me/elf-ui/components/ai-elements/diff"
import {
	FileChanges,
	FileChangesAcceptButton,
	FileChangesActions,
	FileChangesContent,
	FileChangesCopyButton,
	FileChangesExpandButton,
	FileChangesHeader,
	FileChangesIcon,
	FileChangesRejectButton,
	FileChangesStats,
	FileChangesTitle,
} from "@ch5me/elf-ui/components/ai-elements/file-changes"
import type { Meta, StoryObj } from "@storybook/react-vite"

const oldFile: FileContents = {
	name: "ai-elements.ts",
	content: `export const covered = [
	"artifact",
	"message",
]`,
}

const newFile: FileContents = {
	name: "ai-elements.ts",
	content: `export const covered = [
	"artifact",
	"message",
	"attachments",
	"file-changes",
]`,
}

const meta = {
	title: "AI Elements/Code/FileChanges",
	component: FileChanges,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[760px] p-8">
			<FileChanges defaultOpen newFile={newFile} oldFile={oldFile} status="pending">
				<FileChangesHeader>
					<div className="flex min-w-0 items-center gap-3">
						<FileChangesIcon />
						<div className="min-w-0">
							<FileChangesTitle />
							<FileChangesStats />
						</div>
					</div>
					<div className="flex items-center gap-2">
						<FileChangesActions>
							<FileChangesCopyButton />
							<FileChangesRejectButton />
							<FileChangesAcceptButton />
						</FileChangesActions>
						<FileChangesExpandButton />
					</div>
				</FileChangesHeader>
				<FileChangesContent maxHeight={320} />
			</FileChanges>
		</div>
	),
} satisfies Meta<typeof FileChanges>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
		newFile,
		oldFile,
		status: "pending",
	},
}
