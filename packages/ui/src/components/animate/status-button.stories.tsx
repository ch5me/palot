import {
	StatusButton,
	type StatusButtonStatus,
} from "@ch5me/elf-ui/components/animate/status-button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef, useState } from "react"

const meta = {
	title: "Animate/StatusButton",
	component: StatusButton,
	args: {
		status: "idle",
		idleLabel: "Save changes",
		loadingLabel: "Saving",
		successLabel: "Saved",
		disabled: false,
	},
	argTypes: {
		status: {
			control: "radio",
			options: ["idle", "loading", "success"] satisfies StatusButtonStatus[],
		},
	},
} satisfies Meta<typeof StatusButton>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

function SimulatedSubmit(props: React.ComponentProps<typeof StatusButton>) {
	const [status, setStatus] = useState<StatusButtonStatus>("idle")
	const timers = useRef<ReturnType<typeof setTimeout>[]>([])

	const submit = () => {
		setStatus("loading")
		timers.current.push(setTimeout(() => setStatus("success"), 1500))
		timers.current.push(setTimeout(() => setStatus("idle"), 3500))
	}

	return <StatusButton {...props} status={status} onClick={submit} />
}

export const Submit: Story = {
	parameters: { controls: { disable: true } },
	render: (args) => <SimulatedSubmit {...args} />,
}

const statuses = ["idle", "loading", "success"] as const

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-center gap-6">
			{statuses.map((status) => (
				<StatusButton
					key={status}
					status={status}
					idleLabel="Save changes"
					loadingLabel="Saving"
					successLabel="Saved"
				/>
			))}
		</div>
	),
}
