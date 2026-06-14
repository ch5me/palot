import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@ch5me/agent-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Workflow/Task",
	component: Task,
	render: () => (
		<div className="w-[620px] p-8">
			<Task defaultOpen>
				<TaskTrigger title="Create Storybook coverage service order" />
				<TaskContent>
					<TaskItem>
						Inspect <TaskItemFile>packages/ui/src/components/ai-elements/task.tsx</TaskItemFile>
					</TaskItem>
					<TaskItem>
						Add focused story under <TaskItemFile>packages/storybook/src/stories</TaskItemFile>
					</TaskItem>
					<TaskItem>
						Verify Storybook render proof and CH5 coverage before updating tracker.
					</TaskItem>
				</TaskContent>
			</Task>
		</div>
	),
} satisfies Meta<typeof Task>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
	},
}
