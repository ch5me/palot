import {
	OpenIn,
	OpenInChatGPT,
	OpenInClaude,
	OpenInContent,
	OpenInCursor,
	OpenInSeparator,
	OpenInT3,
	OpenInTrigger,
	OpenInv0,
} from "@ch5me/elf-ui/components/ai-elements/open-in-chat"
import type { Meta, StoryObj } from "@storybook/react-vite"

const query =
	"Create Storybook stories for unchecked local Palot components and skip pure imported pass-through wrappers."

const meta = {
	title: "AI Elements/Actions/OpenInChat",
	component: OpenIn,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[420px] p-8">
			<OpenIn defaultOpen query={query}>
				<OpenInTrigger />
				<OpenInContent>
					<OpenInChatGPT />
					<OpenInClaude />
					<OpenInT3 />
					<OpenInSeparator />
					<OpenInCursor />
					<OpenInv0 />
				</OpenInContent>
			</OpenIn>
		</div>
	),
} satisfies Meta<typeof OpenIn>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
		query,
	},
}
