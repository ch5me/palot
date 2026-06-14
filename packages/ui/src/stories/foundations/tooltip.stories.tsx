import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { InfoIcon } from "lucide-react"

const meta = {
	title: "Foundations/Overlays/Tooltip",
	component: Tooltip,
	render: () => (
		<TooltipProvider>
			<div className="grid min-h-[180px] w-[360px] place-items-center">
				<Tooltip defaultOpen>
					<TooltipTrigger render={<Button variant="outline" size="icon" />}>
						<InfoIcon aria-hidden="true" />
						<span className="sr-only">Coverage details</span>
					</TooltipTrigger>
					<TooltipContent>CH5 coverage maps this story after render proof passes.</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	),
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
