import {
	Diff,
	DiffActions,
	DiffContent,
	DiffCopyButton,
	DiffHeader,
	DiffStats,
	DiffTitle,
	type FileContents,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const oldFile: FileContents = {
	name: "coverage.ts",
	content: `const actionableGaps = 44
const localScope = "packages/ui/src/components"

export const shouldCreateStory = (component: string) => true`,
}

const newFile: FileContents = {
	name: "coverage.ts",
	content: `const actionableGaps = 39
const localScope = "packages/ui/src/components"
const importedPackagesTrusted = true

export const shouldCreateStory = (component: string) =>
	component.startsWith(localScope)`,
}

const patch = `--- a/docs/storybook-missing-ui-elements.md
+++ b/docs/storybook-missing-ui-elements.md
@@ -7,3 +7,3 @@
-Covered by Storybook/route coverage: 79
+Covered by Storybook/route coverage: 84
-Actionable missing local stories after documented exceptions: 44
+Actionable missing local stories after documented exceptions: 39`

const meta = {
	title: "AI Elements/Code/Diff",
	component: Diff,
	render: () => (
		<div className="flex w-[760px] flex-col gap-6 p-8">
			<Diff mode="files" newFile={newFile} oldFile={oldFile}>
				<DiffHeader>
					<div className="min-w-0">
						<DiffTitle />
						<DiffStats />
					</div>
					<DiffActions>
						<DiffCopyButton copyTarget="patch" />
					</DiffActions>
				</DiffHeader>
				<DiffContent hideFileHeader maxHeight={280} />
			</Diff>
			<Diff mode="patch" patch={patch}>
				<DiffHeader>
					<DiffTitle>docs/storybook-missing-ui-elements.md</DiffTitle>
					<DiffStats />
				</DiffHeader>
				<DiffContent hideFileHeader maxHeight={180} showLineNumbers={false} />
			</Diff>
		</div>
	),
} satisfies Meta<typeof Diff>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		mode: "files",
		newFile,
		oldFile,
	},
}
