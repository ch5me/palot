import {
	Checkpoint,
	CheckpointIcon,
	CheckpointTrigger,
} from "@ch5me/elf-ui/components/ai-elements/checkpoint"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Workflow/Checkpoint",
	component: Checkpoint,
	render: () => (
		<div className="w-[620px] p-8">
			<Checkpoint>
				<CheckpointTrigger tooltip="Restore batch 08 checkpoint">
					<CheckpointIcon />
					<span>Batch 08 proof captured</span>
				</CheckpointTrigger>
				<CheckpointTrigger variant="outline">
					<CheckpointIcon />
					<span>Coverage scan saved</span>
				</CheckpointTrigger>
			</Checkpoint>
		</div>
	),
} satisfies Meta<typeof Checkpoint>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
