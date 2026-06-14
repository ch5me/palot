import {
	Button,
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
	Input,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckIcon, CopyIcon, PlayIcon } from "lucide-react"

const meta = {
	title: "Foundations/Actions/ButtonGroup",
	component: ButtonGroup,
	render: () => (
		<div className="flex flex-col gap-6">
			<ButtonGroup>
				<Button variant="outline">
					<PlayIcon aria-hidden="true" />
					Run
				</Button>
				<Button variant="outline">
					<CopyIcon aria-hidden="true" />
					Copy
				</Button>
				<Button variant="outline">
					<CheckIcon aria-hidden="true" />
					Mark done
				</Button>
			</ButtonGroup>
			<ButtonGroup className="w-[420px]">
				<ButtonGroupText>Branch</ButtonGroupText>
				<Input defaultValue="palot-browser-lane-model-alignment" />
				<ButtonGroupSeparator />
				<Button variant="outline">Copy</Button>
			</ButtonGroup>
		</div>
	),
} satisfies Meta<typeof ButtonGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Vertical: Story = {
	render: () => (
		<ButtonGroup orientation="vertical">
			<Button variant="outline">Queued</Button>
			<Button variant="outline">Running</Button>
			<Button variant="outline">Verified</Button>
		</ButtonGroup>
	),
}
