import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@ch5me/elf-ui/components/resizable"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Layout/Resizable",
	component: ResizablePanelGroup,
	tags: ["autodocs"],
	render: () => (
		<div className="h-72 w-[560px] overflow-hidden rounded-lg border bg-card text-card-foreground">
			<ResizablePanelGroup orientation="horizontal">
				<ResizablePanel defaultSize={35} minSize={25}>
					<div className="flex h-full items-center justify-center p-4 text-sm font-medium">
						Sessions
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle />
				<ResizablePanel defaultSize={65}>
					<ResizablePanelGroup orientation="vertical">
						<ResizablePanel defaultSize={60}>
							<div className="flex h-full items-center justify-center p-4 text-sm">Transcript</div>
						</ResizablePanel>
						<ResizableHandle withHandle />
						<ResizablePanel defaultSize={40}>
							<div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
								Proof panel
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	),
} satisfies Meta<typeof ResizablePanelGroup>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
