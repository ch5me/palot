import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@ch5me/elf-ui/components/ai-elements/tool"
import type { Meta, StoryObj } from "@storybook/react-vite"

const input = {
	command: "ch5 coverage elf --json",
	scope: "packages/ui/src/components",
	tracker: "docs/storybook-missing-ui-elements.md",
}

const output = {
	visualComponents: 134,
	covered: 79,
	rawGaps: 55,
	actionableLocalGaps: 44,
}

const meta = {
	title: "AI Elements/Tooling/Tool",
	component: Tool,
	render: () => (
		<div className="w-[720px] p-8">
			<Tool defaultOpen>
				<ToolHeader state="output-available" title="CH5 coverage scan" type="tool-bash" />
				<ToolContent>
					<ToolInput input={input} />
					<ToolOutput errorText={undefined} output={output} />
				</ToolContent>
			</Tool>
			<Tool className="mt-4" defaultOpen>
				<ToolHeader
					state="output-error"
					title="Story render proof"
					toolName="browser"
					type="dynamic-tool"
				/>
				<ToolContent>
					<ToolInput
						input={{
							storyId: "ai-elements-chat-message--default",
							viewport: "mobile",
						}}
					/>
					<ToolOutput
						errorText="Console warning found: nested native button in trigger."
						output={undefined}
					/>
				</ToolContent>
			</Tool>
		</div>
	),
} satisfies Meta<typeof Tool>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
