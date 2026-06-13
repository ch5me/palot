import { Badge } from "@ch5me/elf-ui/components/badge"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CheckIcon, GitBranchIcon } from "lucide-react"

const meta = {
	title: "Foundations/Data Display/Badge",
	component: Badge,
	tags: ["autodocs"],
	args: {
		children: "Managed",
		variant: "default",
	},
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<Badge>Running</Badge>
			<Badge variant="secondary">Queued</Badge>
			<Badge variant="outline">Local</Badge>
			<Badge variant="destructive">Blocked</Badge>
			<Badge variant="ghost">Idle</Badge>
			<Badge variant="link">View logs</Badge>
		</div>
	),
}

export const WithIcons: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<Badge>
				<CheckIcon aria-hidden="true" data-icon="inline-start" />
				Verified
			</Badge>
			<Badge variant="outline">
				<GitBranchIcon aria-hidden="true" data-icon="inline-start" />
				palot
			</Badge>
		</div>
	),
}
