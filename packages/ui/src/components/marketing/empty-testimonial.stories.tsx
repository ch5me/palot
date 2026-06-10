import { EmptyTestimonial } from "@ch5me/elf-ui/components/marketing/empty-testimonial"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Marketing/EmptyTestimonial",
	component: EmptyTestimonial,
	args: {
		title: "Wall of",
		highlight: "Love",
		highlightAccent: "\u{1F496}",
		description: "No testimonials yet",
		hint: "Be the first one to add a testimonial",
		actionLabel: "Add Testimonial",
		defaultOpen: false,
	},
	argTypes: {
		title: { control: "text" },
		highlight: { control: "text" },
		highlightAccent: { control: "text" },
		description: { control: "text" },
		hint: { control: "text" },
		actionLabel: { control: "text" },
		actionHref: { control: "text" },
		defaultOpen: { control: "boolean" },
		open: { control: false },
		onOpenChange: { control: false },
		onAction: { control: false },
	},
} satisfies Meta<typeof EmptyTestimonial>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<EmptyTestimonial open={false} className="py-12" />
			<EmptyTestimonial open className="py-12" />
		</div>
	),
}
