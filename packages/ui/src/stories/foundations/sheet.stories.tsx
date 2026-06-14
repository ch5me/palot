import {
	Button,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Overlays/Sheet",
	component: Sheet,
	render: () => (
		<div className="min-h-[420px] w-[560px]">
			<Sheet defaultOpen modal={false}>
				<SheetTrigger render={<Button variant="outline" />}>Open side panel</SheetTrigger>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Coverage details</SheetTitle>
						<SheetDescription>Proof files and CH5 mapping for current batch.</SheetDescription>
					</SheetHeader>
					<div className="px-4 text-sm text-muted-foreground">
						Render proof contains desktop and mobile screenshots for each story ID.
					</div>
					<SheetFooter>
						<Button>Open evidence</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	),
} satisfies Meta<typeof Sheet>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
