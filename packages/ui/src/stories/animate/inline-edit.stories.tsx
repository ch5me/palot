import { InlineEdit } from "@ch5me/elf-ui/components/animate/inline-edit"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

function InlineEditExample() {
	const [value, setValue] = useState("Palette handoff")

	return (
		<div className="w-[360px] p-8">
			<InlineEdit value={value} onValueChange={setValue} />
		</div>
	)
}

const meta = {
	title: "Animate/Controls/InlineEdit",
	component: InlineEdit,
	render: () => <InlineEditExample />,
} satisfies Meta<typeof InlineEdit>

export default meta

type Story = StoryObj

export const Default: Story = {}
