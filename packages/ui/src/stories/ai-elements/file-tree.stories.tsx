import { FileTree, FileTreeFile, FileTreeFolder } from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const expanded = new Set(["packages", "packages/storybook", "packages/storybook/src"])

const meta = {
	title: "AI Elements/Data/FileTree",
	component: FileTree,
	render: () => (
		<div className="w-[520px] p-8">
			<FileTree defaultExpanded={expanded} selectedPath="packages/storybook/src/preview.ts">
				<FileTreeFolder name="packages" path="packages">
					<FileTreeFolder name="storybook" path="packages/storybook">
						<FileTreeFolder name="src" path="packages/storybook/src">
							<FileTreeFile name="preview.ts" path="packages/storybook/src/preview.ts" />
							<FileTreeFile name="manager.ts" path="packages/storybook/src/manager.ts" />
						</FileTreeFolder>
						<FileTreeFile name="package.json" path="packages/storybook/package.json" />
					</FileTreeFolder>
					<FileTreeFolder name="ui" path="packages/ui">
						<FileTreeFile name="index.ts" path="packages/ui/src/index.ts" />
					</FileTreeFolder>
				</FileTreeFolder>
			</FileTree>
		</div>
	),
} satisfies Meta<typeof FileTree>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultExpanded: expanded,
		selectedPath: "packages/storybook/src/preview.ts",
	},
}
