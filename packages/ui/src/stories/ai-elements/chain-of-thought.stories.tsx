import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtSearchResult,
	ChainOfThoughtSearchResults,
	ChainOfThoughtStep,
} from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckCircle2Icon, SearchIcon, SparklesIcon } from "lucide-react"

const meta = {
	title: "AI Elements/Workflow/ChainOfThought",
	component: ChainOfThought,
	render: () => (
		<div className="w-[640px] p-8">
			<ChainOfThought defaultOpen>
				<ChainOfThoughtHeader>Coverage reasoning</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						description="Read tracker, component API, and existing story conventions."
						icon={SearchIcon}
						label="Inspect local component"
					>
						<ChainOfThoughtSearchResults>
							<ChainOfThoughtSearchResult>packages/ui</ChainOfThoughtSearchResult>
							<ChainOfThoughtSearchResult>packages/storybook</ChainOfThoughtSearchResult>
						</ChainOfThoughtSearchResults>
					</ChainOfThoughtStep>
					<ChainOfThoughtStep
						description="Create realistic state coverage for the component surface."
						icon={SparklesIcon}
						label="Draft story"
						status="active"
					/>
					<ChainOfThoughtStep
						description="Storybook render proof and CH5 coverage must both pass."
						icon={CheckCircle2Icon}
						label="Verify before checking tracker"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</div>
	),
} satisfies Meta<typeof ChainOfThought>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
	},
}
