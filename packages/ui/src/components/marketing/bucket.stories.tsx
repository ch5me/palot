import { Bucket } from "@ch5me/elf-ui/components/marketing/bucket"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Cloud, Globe, Lock, Rocket } from "lucide-react"

const meta = {
	title: "Marketing/Bucket",
	component: Bucket,
	args: {
		cycleInterval: 2000,
		paused: false,
	},
	argTypes: {
		cycleInterval: { control: { type: "number", min: 500, step: 250 } },
		paused: { control: "boolean" },
		chips: { control: false },
	},
} satisfies Meta<typeof Bucket>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ChipVariants: Story = {
	args: {
		chips: [
			{
				id: "deploy",
				title: "Deploys in seconds",
				description: "Push and it ships",
				icon: <Rocket />,
			},
			{ id: "global", title: "Global edge network", icon: <Globe /> },
			{ id: "private", title: "Private by design", description: "Your data stays yours" },
			{
				id: "sync",
				title: "Always in sync",
				description: "Realtime on every device",
				icon: <Cloud />,
			},
			{ id: "locked", title: "Locked down", icon: <Lock /> },
		],
	},
}
