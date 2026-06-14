import { Terminal } from "@ch5me/elf-ui/components/ai-elements/terminal"
import type { Meta, StoryObj } from "@storybook/react-vite"

const output = `$ bun run verify:storybook-render -- --out .sisyphus/evidence/storybook-coverage/batch-08
✓ ai-elements-code-codeblock--default desktop
✓ ai-elements-code-codeblock--default mobile
✓ ai-elements-data-filetree--default desktop
✓ ai-elements-data-filetree--default mobile

12 screenshots captured
0 console warnings`

const meta = {
	title: "AI Elements/Diagnostics/Terminal",
	component: Terminal,
	render: () => (
		<div className="w-[720px] p-8">
			<Terminal isStreaming output={output} />
		</div>
	),
} satisfies Meta<typeof Terminal>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		isStreaming: true,
		output,
	},
}
