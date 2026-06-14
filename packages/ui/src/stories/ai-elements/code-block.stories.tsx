import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockFilename,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const code = `export const verifyStory = async (storyId: string) => {
	const result = await renderStory(storyId)

	if (result.warnings > 0) {
		throw new Error("Story rendered with console warnings")
	}

	return result.screenshot
}`

const meta = {
	title: "AI Elements/Code/CodeBlock",
	component: CodeBlock,
	render: () => (
		<div className="w-[680px] p-8">
			<CodeBlock code={code} language="typescript" showLineNumbers>
				<CodeBlockHeader>
					<CodeBlockTitle>
						<CodeBlockFilename>verify-story.ts</CodeBlockFilename>
					</CodeBlockTitle>
					<CodeBlockActions>
						<CodeBlockCopyButton />
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent code={code} language="typescript" showLineNumbers startLine={42} />
			</CodeBlock>
		</div>
	),
} satisfies Meta<typeof CodeBlock>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		code,
		language: "typescript",
		showLineNumbers: true,
	},
}
