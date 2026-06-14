import { Button } from "@ch5me/elf-ui/components/button"
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@ch5me/elf-ui/components/drawer"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/Drawer",
	component: Drawer,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[420px] w-[560px]">
			<Drawer defaultOpen direction="right" modal={false}>
				<DrawerTrigger asChild>
					<Button variant="outline">Open proof drawer</Button>
				</DrawerTrigger>
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle>Storybook proof</DrawerTitle>
						<DrawerDescription>
							Review render evidence before checking the tracker.
						</DrawerDescription>
					</DrawerHeader>
					<div className="px-4 text-sm text-muted-foreground">
						Desktop and mobile iframe screenshots are captured for each new story.
					</div>
					<DrawerFooter>
						<Button>Mark verified</Button>
						<DrawerClose asChild>
							<Button variant="outline">Close</Button>
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</Drawer>
		</div>
	),
} satisfies Meta<typeof Drawer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
