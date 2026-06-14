import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"

const slides = [
	["Batch 01", "Display primitives"],
	["Batch 02", "Form controls"],
	["Batch 03", "Overlay primitives"],
]

const meta = {
	title: "Foundations/Media/Carousel",
	component: Carousel,
	render: () => (
		<Carousel className="w-[520px]">
			<CarouselContent>
				{slides.map(([title, detail]) => (
					<CarouselItem key={title}>
						<div className="grid aspect-video place-items-center rounded-lg border bg-card p-8 text-card-foreground">
							<div className="text-center">
								<div className="text-lg font-medium">{title}</div>
								<div className="mt-1 text-sm text-muted-foreground">{detail}</div>
							</div>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious />
			<CarouselNext />
		</Carousel>
	),
} satisfies Meta<typeof Carousel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
