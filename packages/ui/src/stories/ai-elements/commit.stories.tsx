import {
	Commit,
	CommitActions,
	CommitAuthor,
	CommitAuthorAvatar,
	CommitContent,
	CommitCopyButton,
	CommitFile,
	CommitFileAdditions,
	CommitFileChanges,
	CommitFileDeletions,
	CommitFileIcon,
	CommitFileInfo,
	CommitFilePath,
	CommitFileStatus,
	CommitFiles,
	CommitHash,
	CommitHeader,
	CommitInfo,
	CommitMessage,
	CommitMetadata,
	CommitSeparator,
	CommitTimestamp,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const commitDate = new Date("2026-06-14T00:33:22Z")

const meta = {
	title: "AI Elements/Workflow/Commit",
	component: Commit,
	render: () => (
		<div className="w-[760px] p-8">
			<Commit defaultOpen>
				<CommitHeader>
					<CommitAuthor>
						<CommitAuthorAvatar initials="CH" />
					</CommitAuthor>
					<CommitInfo>
						<CommitMessage>feat(storybook): cover ai diagnostics batch</CommitMessage>
						<CommitMetadata>
							<CommitHash>661fea41</CommitHash>
							<CommitSeparator />
							<CommitTimestamp date={commitDate}>12 minutes ago</CommitTimestamp>
						</CommitMetadata>
					</CommitInfo>
					<CommitActions>
						<CommitCopyButton hash="661fea41" />
					</CommitActions>
				</CommitHeader>
				<CommitContent>
					<CommitFiles>
						<CommitFile>
							<CommitFileInfo>
								<CommitFileStatus status="added" />
								<CommitFileIcon />
								<CommitFilePath>
									packages/storybook/src/stories/ai-elements/task.stories.tsx
								</CommitFilePath>
							</CommitFileInfo>
							<CommitFileChanges>
								<CommitFileAdditions count={54} />
								<CommitFileDeletions count={0} />
							</CommitFileChanges>
						</CommitFile>
						<CommitFile>
							<CommitFileInfo>
								<CommitFileStatus status="modified" />
								<CommitFileIcon />
								<CommitFilePath>docs/storybook-missing-ui-elements.md</CommitFilePath>
							</CommitFileInfo>
							<CommitFileChanges>
								<CommitFileAdditions count={8} />
								<CommitFileDeletions count={8} />
							</CommitFileChanges>
						</CommitFile>
					</CommitFiles>
				</CommitContent>
			</Commit>
		</div>
	),
} satisfies Meta<typeof Commit>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
	},
}
