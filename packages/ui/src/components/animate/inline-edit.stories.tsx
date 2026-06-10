import { InlineEdit } from "@ch5me/elf-ui/components/animate/inline-edit"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

const meta = {
	title: "Animate/InlineEdit",
	component: InlineEdit,
	args: {
		value: "Weekly status report",
		placeholder: "Add a title…",
		disabled: false,
		editLabel: "Edit",
		saveLabel: "Save",
	},
	argTypes: {
		onValueChange: { control: false },
		onSave: { control: false },
		onCancel: { control: false },
		onEditStart: { control: false },
		className: { control: false },
		inputClassName: { control: false },
	},
} satisfies Meta<typeof InlineEdit>

export default meta
type Story = StoryObj<typeof meta>

function StatefulInlineEdit(props: React.ComponentProps<typeof InlineEdit>) {
	const [value, setValue] = useState(props.value)
	return <InlineEdit {...props} value={value} onValueChange={setValue} />
}

export const Playground: Story = {
	render: (args) => (
		<div className="w-80 rounded-full border border-border/50 bg-background/80 p-2 shadow-[var(--ff-shadow-sm)]">
			<StatefulInlineEdit key={args.value} {...args} />
		</div>
	),
}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex w-80 flex-col gap-6 rounded-[2rem] border border-border/50 bg-background/80 p-4 py-2 shadow-[var(--ff-shadow-sm)]">
			<div className="flex flex-col gap-1.5">
				<span className="text-muted-foreground text-xs">Filled</span>
				<StatefulInlineEdit value="Team standup notes" />
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-muted-foreground text-xs">Empty</span>
				<StatefulInlineEdit value="" placeholder="Add a title…" />
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-muted-foreground text-xs">Disabled</span>
				<StatefulInlineEdit value="Archived item" disabled />
			</div>
		</div>
	),
}
