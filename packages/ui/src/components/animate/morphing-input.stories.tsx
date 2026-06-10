import {
	MorphingInput,
	type MorphingInputMode,
} from "@ch5me/elf-ui/components/animate/morphing-input"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MicIcon, SearchIcon, SparklesIcon } from "lucide-react"

const modes: readonly MorphingInputMode[] = [
	{ id: "search", placeholder: "Search anything...", icon: SearchIcon },
	{ id: "ask", placeholder: "Ask a question...", icon: SparklesIcon },
	{ id: "dictate", placeholder: "Start dictating...", icon: MicIcon },
]

const singleMode: readonly MorphingInputMode[] = [
	{ id: "search", placeholder: "Search anything...", icon: SearchIcon },
]

const meta = {
	title: "Animate/MorphingInput",
	component: MorphingInput,
	args: {
		modes,
		defaultValue: "",
		disabled: false,
	},
	argTypes: {
		defaultValue: { control: "text" },
		modes: { control: false },
		value: { control: false },
		onValueChange: { control: false },
		onModeChange: { control: false },
		onSubmit: { control: false },
	},
	decorators: [
		(Story) => (
			<div className="w-80">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof MorphingInput>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<span className="text-muted-foreground text-xs">multi-mode</span>
				<MorphingInput modes={modes} />
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-muted-foreground text-xs">single mode</span>
				<MorphingInput modes={singleMode} />
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-muted-foreground text-xs">prefilled</span>
				<MorphingInput defaultValue="quarterly report" modes={modes} />
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-muted-foreground text-xs">disabled</span>
				<MorphingInput disabled modes={modes} />
			</div>
		</div>
	),
}
