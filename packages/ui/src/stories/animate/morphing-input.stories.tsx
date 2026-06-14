import { MorphingInput } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Code2Icon, SearchIcon, SparklesIcon } from "lucide-react"

const modes = [
	{ id: "ask", placeholder: "Ask about the selected run...", icon: SparklesIcon },
	{ id: "search", placeholder: "Search project evidence...", icon: SearchIcon },
	{ id: "code", placeholder: "Generate a focused patch...", icon: Code2Icon },
]

const meta = {
	title: "Animate/Controls/MorphingInput",
	component: MorphingInput,
	render: () => (
		<div className="w-[560px] p-8">
			<MorphingInput modes={modes} defaultValue="" />
		</div>
	),
} satisfies Meta<typeof MorphingInput>

export default meta

type Story = StoryObj

export const Default: Story = {}
