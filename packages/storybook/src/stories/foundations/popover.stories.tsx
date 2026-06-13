import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import { Label } from "@ch5me/elf-ui/components/label"
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@ch5me/elf-ui/components/popover"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/Popover",
	component: Popover,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[300px] w-[460px] p-12">
			<Popover defaultOpen>
				<PopoverTrigger render={<Button variant="outline" />}>Edit lane</PopoverTrigger>
				<PopoverContent>
					<PopoverHeader>
						<PopoverTitle>Browser lane</PopoverTitle>
						<PopoverDescription>Adjust label and viewport before capture.</PopoverDescription>
					</PopoverHeader>
					<div className="grid gap-2">
						<Label htmlFor="lane-label">Label</Label>
						<Input id="lane-label" defaultValue="desktop proof" />
					</div>
					<Button size="sm">Save changes</Button>
				</PopoverContent>
			</Popover>
		</div>
	),
} satisfies Meta<typeof Popover>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
