import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@ch5me/elf-ui/components/ai-elements/reasoning"
import type { Meta, StoryObj } from "@storybook/react-vite"

const reasoning = `Coverage closes only when both signals agree:

1. Storybook can render the story without console errors.
2. CH5 coverage maps the local component to that story.

Imported pass-through components stay out of scope because their owning package holds stories and tests.`

const meta = {
	title: "AI Elements/Workflow/Reasoning",
	component: Reasoning,
	render: () => (
		<div className="w-[680px] p-8">
			<Reasoning defaultOpen duration={7}>
				<ReasoningTrigger />
				<ReasoningContent>{reasoning}</ReasoningContent>
			</Reasoning>
		</div>
	),
} satisfies Meta<typeof Reasoning>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
		duration: 7,
	},
}
