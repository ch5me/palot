import { MultiStepForm, type MultiStepFormStep } from "@ch5me/elf-ui/components/animate/multi-step-form"
import { Input } from "@ch5me/elf-ui/components/input"
import { Label } from "@ch5me/elf-ui/components/label"
import { Textarea } from "@ch5me/elf-ui/components/textarea"
import type { Meta, StoryObj } from "@storybook/react-vite"

const steps: MultiStepFormStep[] = [
	{
		title: "Story target",
		description: "Name component and coverage lane.",
		content: (
			<div className="grid gap-4">
				<div className="grid gap-2">
					<Label htmlFor="component">Component</Label>
					<Input id="component" defaultValue="NavSidebarShell" />
				</div>
				<div className="grid gap-2">
					<Label htmlFor="lane">Lane</Label>
					<Input id="lane" defaultValue="Foundations / Navigation" />
				</div>
			</div>
		),
	},
	{
		title: "States",
		description: "Capture expected visual states.",
		content: (
			<div className="grid gap-2">
				<Label htmlFor="states">State notes</Label>
				<Textarea
					id="states"
					defaultValue="Expanded sections, selected session, server summary, project grouping."
					className="min-h-28"
				/>
			</div>
		),
	},
	{
		title: "Proof",
		description: "Confirm local render and CH5 coverage.",
		content: (
			<div className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
				Storybook render captures desktop and mobile screenshots before the tracker checkbox moves.
			</div>
		),
	},
]

const meta = {
	title: "Animate/Forms/MultiStepForm",
	component: MultiStepForm,
	render: () => (
		<div className="w-[520px] p-6">
			<MultiStepForm steps={steps} defaultStep={1} />
		</div>
	),
} satisfies Meta<typeof MultiStepForm>

export default meta

type Story = StoryObj

export const Default: Story = {}
