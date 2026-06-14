import { ToggleGroup, ToggleGroupItem } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Columns3Icon, PanelLeftIcon, PanelRightIcon } from "lucide-react"

const meta = {
	title: "Foundations/Actions/ToggleGroup",
	component: ToggleGroup,
	args: {
		defaultValue: ["chat"],
		variant: "outline",
	},
	render: (args) => (
		<ToggleGroup {...args}>
			<ToggleGroupItem value="left" aria-label="Left panel">
				<PanelLeftIcon aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="chat" aria-label="Main chat">
				<Columns3Icon aria-hidden="true" />
			</ToggleGroupItem>
			<ToggleGroupItem value="right" aria-label="Right panel">
				<PanelRightIcon aria-hidden="true" />
			</ToggleGroupItem>
		</ToggleGroup>
	),
} satisfies Meta<typeof ToggleGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Spaced: Story = {
	args: {
		spacing: 2,
	},
}
