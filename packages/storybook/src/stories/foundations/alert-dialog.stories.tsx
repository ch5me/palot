import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@ch5me/elf-ui/components/alert-dialog"
import { Button } from "@ch5me/elf-ui/components/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { TriangleAlertIcon } from "lucide-react"

const meta = {
	title: "Foundations/Overlays/AlertDialog",
	component: AlertDialog,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[360px] w-[520px]">
			<AlertDialog defaultOpen>
				<AlertDialogTrigger render={<Button variant="outline" />}>
					Archive session
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<TriangleAlertIcon aria-hidden="true" />
						</AlertDialogMedia>
						<AlertDialogTitle>Archive this session?</AlertDialogTitle>
						<AlertDialogDescription>
							The transcript stays searchable, but active browser lanes and pending tool prompts
							stop.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction>Archive</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	),
} satisfies Meta<typeof AlertDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
	render: () => (
		<div className="min-h-[300px] w-[420px]">
			<AlertDialog defaultOpen>
				<AlertDialogTrigger render={<Button variant="outline" />}>Delete lane</AlertDialogTrigger>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete lane?</AlertDialogTitle>
						<AlertDialogDescription>
							Running browser work in this lane will stop.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
						<AlertDialogAction size="sm">Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	),
}
