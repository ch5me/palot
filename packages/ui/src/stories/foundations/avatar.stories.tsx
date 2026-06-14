import {
	Avatar,
	AvatarBadge,
	AvatarFallback,
	AvatarGroup,
	AvatarGroupCount,
	AvatarImage,
} from "@ch5me/elf-ui/components/avatar"
import type { Meta, StoryObj } from "@storybook/react-vite"

const avatarImage =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23232a31'/%3E%3Ccircle cx='40' cy='32' r='16' fill='%23f5c16c'/%3E%3Cpath d='M16 72c5-18 17-27 24-27s19 9 24 27' fill='%23f5c16c'/%3E%3C/svg%3E"

const meta = {
	title: "Foundations/Data Display/Avatar",
	component: Avatar,
	args: {
		size: "default",
	},
	render: (args) => (
		<Avatar {...args}>
			<AvatarImage src={avatarImage} alt="Palot operator avatar" />
			<AvatarFallback>CH</AvatarFallback>
			<AvatarBadge />
		</Avatar>
	),
} satisfies Meta<typeof Avatar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
	render: () => (
		<div className="flex items-end gap-4">
			<Avatar size="sm">
				<AvatarFallback>PM</AvatarFallback>
				<AvatarBadge />
			</Avatar>
			<Avatar>
				<AvatarFallback>CH</AvatarFallback>
				<AvatarBadge />
			</Avatar>
			<Avatar size="lg">
				<AvatarFallback>AI</AvatarFallback>
				<AvatarBadge />
			</Avatar>
		</div>
	),
}

export const Group: Story = {
	render: () => (
		<AvatarGroup>
			<Avatar>
				<AvatarFallback>CH</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>PM</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>UX</AvatarFallback>
			</Avatar>
			<AvatarGroupCount>+4</AvatarGroupCount>
		</AvatarGroup>
	),
}
