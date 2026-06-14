import { Suggestion, Suggestions } from "@ch5me/elf-ui/components/ai-elements/suggestion"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Input/Suggestion",
	component: Suggestions,
	render: () => (
		<div className="w-[560px] p-8">
			<Suggestions>
				<Suggestion suggestion="Create stories for remaining AI elements" />
				<Suggestion suggestion="Run CH5 coverage" />
				<Suggestion suggestion="Open latest proof folder" />
			</Suggestions>
		</div>
	),
} satisfies Meta<typeof Suggestions>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
