import { Checkbox, Input, Label } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Label",
	component: Label,
	render: () => (
		<div className="grid w-[360px] gap-5">
			<div className="grid gap-2">
				<Label htmlFor="model-name">Model name</Label>
				<Input id="model-name" defaultValue="gpt-5" />
			</div>
			<Label className="gap-3">
				<Checkbox defaultChecked />
				<span>Attach browser lane by default</span>
			</Label>
		</div>
	),
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
