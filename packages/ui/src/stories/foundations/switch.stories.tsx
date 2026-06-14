import { Label, Switch } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Switch",
	component: Switch,
	args: {
		defaultChecked: true,
		size: "default",
	},
	render: (args) => (
		<Label className="gap-3">
			<Switch {...args} />
			<span>Enable browser lane</span>
		</Label>
	),
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
	render: () => (
		<div className="grid gap-3">
			<Label className="gap-3">
				<Switch size="sm" defaultChecked />
				<span>Small</span>
			</Label>
			<Label className="gap-3">
				<Switch defaultChecked />
				<span>Default</span>
			</Label>
		</div>
	),
}
