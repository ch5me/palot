import { Kbd, KbdGroup } from "@ch5me/elf-ui/components/kbd"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CommandIcon } from "lucide-react"

const meta = {
	title: "Foundations/Typography/Kbd",
	component: Kbd,
	tags: ["autodocs"],
	args: {
		children: "K",
	},
} satisfies Meta<typeof Kbd>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ShortcutGroup: Story = {
	render: () => (
		<KbdGroup>
			<Kbd>
				<CommandIcon aria-hidden="true" />
			</Kbd>
			<Kbd>K</Kbd>
		</KbdGroup>
	),
}
