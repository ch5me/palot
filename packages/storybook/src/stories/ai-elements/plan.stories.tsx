import {
	Plan,
	PlanAction,
	PlanContent,
	PlanDescription,
	PlanFooter,
	PlanHeader,
	PlanTitle,
	PlanTrigger,
} from "@ch5me/elf-ui/components/ai-elements/plan"
import { Button } from "@ch5me/elf-ui/components/button"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "AI Elements/Workflow/Plan",
	component: Plan,
	render: () => (
		<div className="w-[620px] p-8">
			<Plan defaultOpen>
				<PlanHeader>
					<div>
						<PlanTitle>Storybook coverage batch</PlanTitle>
						<PlanDescription>
							Inspect local component, write realistic story, prove render, update CH5 coverage.
						</PlanDescription>
					</div>
					<PlanAction>
						<PlanTrigger />
					</PlanAction>
				</PlanHeader>
				<PlanContent>
					<ol className="list-decimal space-y-2 pl-5 text-muted-foreground text-sm">
						<li>Read component API and existing story conventions.</li>
						<li>Capture desktop and mobile screenshots through Storybook.</li>
						<li>Check tracker only after CH5 coverage maps the story.</li>
					</ol>
				</PlanContent>
				<PlanFooter>
					<Button size="sm" variant="outline">
						View proof
					</Button>
				</PlanFooter>
			</Plan>
		</div>
	),
} satisfies Meta<typeof Plan>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
	args: {
		defaultOpen: true,
	},
}
