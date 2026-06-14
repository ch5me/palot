import {
	Snippet,
	SnippetAddon,
	SnippetCopyButton,
	SnippetInput,
	SnippetText,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const command =
	"bun run verify:storybook-render -- --out .sisyphus/evidence/storybook-coverage/batch-08"

const meta = {
	title: "AI Elements/Code/Snippet",
	component: Snippet,
	render: () => (
		<div className="w-[720px] p-8">
			<Snippet code={command}>
				<SnippetAddon>
					<SnippetText>$</SnippetText>
				</SnippetAddon>
				<SnippetInput aria-label="Verification command" />
				<SnippetAddon align="inline-end">
					<SnippetCopyButton />
				</SnippetAddon>
			</Snippet>
		</div>
	),
} satisfies Meta<typeof Snippet>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		code: command,
	},
}
