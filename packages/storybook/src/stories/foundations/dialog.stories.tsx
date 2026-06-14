import { Button } from "@ch5me/elf-ui/components/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ch5me/elf-ui/components/dialog"
import { Input } from "@ch5me/elf-ui/components/input"
import { Label } from "@ch5me/elf-ui/components/label"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/Dialog",
	component: Dialog,
	render: () => (
		<div className="min-h-[360px] w-[520px]">
			<Dialog defaultOpen modal={false}>
				<DialogTrigger render={<Button variant="outline" />}>Rename session</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename session</DialogTitle>
						<DialogDescription>
							Use a short label that makes the active workspace easy to recognize.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2">
						<Label htmlFor="session-name">Session name</Label>
						<Input id="session-name" defaultValue="storybook-coverage" />
					</div>
					<DialogFooter showCloseButton>
						<Button>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	),
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
