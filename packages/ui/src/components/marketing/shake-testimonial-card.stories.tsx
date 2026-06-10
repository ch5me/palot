import {
	ShakeTestimonialCard,
	type ShakeTestimonialItem,
	type ShakeTestimonialTone,
} from "@ch5me/elf-ui/components/marketing/shake-testimonial-card"
import type { Meta, StoryObj } from "@storybook/react-vite"

const items: ShakeTestimonialItem[] = [
	{
		id: 1,
		name: "Avery Collins",
		role: "Head of Product, Northwind",
		quote: "We shipped our redesign two weeks early. The whole team felt the difference.",
	},
	{
		id: 2,
		name: "Jordan Blake",
		role: "Engineering Lead, Acme Labs",
		quote: "Setup took minutes, not days. It just got out of our way.",
	},
	{
		id: 3,
		name: "Sam Rivera",
		role: "Founder, Brightside",
		quote: "The first tool my designers and engineers both actually enjoy using.",
	},
	{
		id: 4,
		name: "Morgan Lee",
		role: "Design Director, Atlas Co",
		quote: "Every release feels polished now. Our review cycles dropped by half.",
	},
	{
		id: 5,
		name: "Casey Nguyen",
		role: "CTO, Fieldnote",
		quote: "Reliable, fast, and the support team answers before we finish typing.",
	},
]

const meta = {
	title: "Marketing/ShakeTestimonialCard",
	component: ShakeTestimonialCard,
	args: {
		items,
		autoAdvanceMs: 5000,
		maxVisible: 4,
		nextLabel: "Show next testimonial",
	},
	argTypes: {
		autoAdvanceMs: { control: { type: "number", min: 0, step: 500 } },
		maxVisible: { control: { type: "number", min: 1, max: 5, step: 1 } },
		nextLabel: { control: "text" },
		items: { control: false },
	},
	decorators: [
		(Story) => (
			<div className="flex min-h-96 items-start justify-center pt-8">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ShakeTestimonialCard>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const tones: ShakeTestimonialTone[] = [
	"neutral",
	"primary",
	"indigo",
	"violet",
	"cyan",
	"warm",
	"success",
]

export const Tones: Story = {
	parameters: { controls: { disable: true } },
	decorators: [],
	render: () => (
		<div className="grid min-w-[72rem] grid-cols-1 gap-6 rounded-[2rem] border border-border/50 bg-background/80 p-4 shadow-[var(--ff-shadow-sm)] lg:grid-cols-2 xl:grid-cols-3">
			{tones.map((tone) => {
				const item = items[0]
				if (!item) return null
				return (
					<ShakeTestimonialCard
						key={tone}
						items={[{ ...item, id: tone, role: tone, tone }]}
						autoAdvanceMs={null}
					/>
				)
			})}
		</div>
	),
}
