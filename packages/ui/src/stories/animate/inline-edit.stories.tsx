import { InlineEdit } from "@ch5me/ch5-ui-web"
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
