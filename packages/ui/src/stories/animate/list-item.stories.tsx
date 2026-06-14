import { AnimatedList, AnimatedListItem, AnimatedListItemIndicator } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

const rows = [
	{ id: "coverage", title: "Coverage scan", detail: "112 components mapped" },
	{ id: "render", title: "Render proof", detail: "desktop and mobile captured" },
	{ id: "build", title: "Static build", detail: "storybook bundle passed" },
]

function AnimatedListExample() {
	const [selected, setSelected] = useState("render")

	return (
		<div className="w-[420px] p-6">
			<AnimatedList aria-label="Storybook proof steps">
				{rows.map((row, index) => {
					const isSelected = row.id === selected
					return (
						<AnimatedListItem
							key={row.id}
							index={index}
							selected={isSelected}
							onClick={() => setSelected(row.id)}
						>
							<div>
								<div className="font-medium">{row.title}</div>
								<div className="text-muted-foreground text-sm">{row.detail}</div>
							</div>
							<AnimatedListItemIndicator selected={isSelected} />
						</AnimatedListItem>
					)
				})}
			</AnimatedList>
		</div>
	)
}

const meta = {
	title: "Animate/Layouts/AnimatedList",
	component: AnimatedList,
	render: () => <AnimatedListExample />,
} satisfies Meta<typeof AnimatedList>

export default meta

type Story = StoryObj

export const Default: Story = {}
