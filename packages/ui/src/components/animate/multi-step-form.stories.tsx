import type { MultiStepFormStep } from "@ch5me/elf-ui/components/animate/multi-step-form"
import { MultiStepForm } from "@ch5me/elf-ui/components/animate/multi-step-form"
import { Input } from "@ch5me/elf-ui/components/input"
import { Label } from "@ch5me/elf-ui/components/label"
import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"

const steps: MultiStepFormStep[] = [
	{
		title: "Your details",
		description: "Tell us who you are.",
		content: (
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="msf-name">Full name</Label>
					<Input id="msf-name" placeholder="Jane Doe" />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="msf-email">Email</Label>
					<Input id="msf-email" type="email" placeholder="jane@example.com" />
				</div>
			</div>
		),
	},
	{
		title: "Workspace",
		description: "Name your new workspace.",
		content: (
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="msf-workspace">Workspace name</Label>
					<Input id="msf-workspace" placeholder="Acme Inc." />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="msf-url">URL slug</Label>
					<Input id="msf-url" placeholder="acme" />
				</div>
			</div>
		),
	},
	{
		title: "Review",
		description: "Confirm everything looks right.",
		content: (
			<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
				<dt className="text-muted-foreground">Name</dt>
				<dd>Jane Doe</dd>
				<dt className="text-muted-foreground">Email</dt>
				<dd>jane@example.com</dd>
				<dt className="text-muted-foreground">Workspace</dt>
				<dd>Acme Inc.</dd>
			</dl>
		),
	},
]

const meta = {
	title: "Animate/MultiStepForm",
	component: MultiStepForm,
	args: {
		steps,
		className: "max-w-md",
		defaultStep: 0,
		backLabel: "Back",
		nextLabel: "Continue",
		completeLabel: "Finish",
	},
	argTypes: {
		backLabel: { control: "text" },
		nextLabel: { control: "text" },
		completeLabel: { control: "text" },
		defaultStep: { control: { type: "number", min: 0, max: steps.length - 1 } },
		steps: { control: false },
		step: { control: false },
		onStepChange: { control: false },
		onComplete: { control: false },
	},
} satisfies Meta<typeof MultiStepForm>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const ValidationGateDemo = () => {
	const inputRef = React.useRef<HTMLInputElement>(null)
	const [error, setError] = React.useState(false)
	const gatedSteps: MultiStepFormStep[] = [
		{
			title: "Required field",
			description: "Continue is gated until the field is filled.",
			content: (
				<div className="flex flex-col gap-2">
					<Label htmlFor="msf-gated">Project name</Label>
					<Input id="msf-gated" ref={inputRef} placeholder="My project" aria-invalid={error} />
					{error && <p className="text-destructive text-sm">Project name is required.</p>}
				</div>
			),
			validate: () => {
				const valid = (inputRef.current?.value.trim().length ?? 0) > 0
				setError(!valid)
				return valid
			},
		},
		{
			title: "All set",
			description: "Validation passed.",
			content: <p className="text-muted-foreground text-sm">You made it past the gate.</p>,
		},
	]
	return <MultiStepForm steps={gatedSteps} className="max-w-md" />
}

export const ValidationGate: Story = {
	parameters: { controls: { disable: true } },
	render: () => <ValidationGateDemo />,
}

export const StepStates: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-start gap-4">
			{steps.map((_, index) => (
				<MultiStepForm key={index} steps={steps} step={index} className="w-80" />
			))}
		</div>
	),
}
