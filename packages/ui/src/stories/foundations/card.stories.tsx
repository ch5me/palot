import {
	Badge,
	Button,
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	Progress,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Layout/Card",
	component: Card,
	args: {
		size: "default",
	},
	render: (args) => (
		<Card {...args} className="w-[360px]">
			<CardHeader>
				<CardTitle>Browser lane</CardTitle>
				<CardDescription>Managed lane health and replay state.</CardDescription>
				<CardAction>
					<Badge variant="secondary">Online</Badge>
				</CardAction>
			</CardHeader>
			<CardContent>
				<Progress value={72} />
			</CardContent>
			<CardFooter className="justify-between">
				<span className="text-sm text-muted-foreground">72% synced</span>
				<Button size="sm" variant="outline">
					Open
				</Button>
			</CardFooter>
		</Card>
	),
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
	args: {
		size: "sm",
	},
}
