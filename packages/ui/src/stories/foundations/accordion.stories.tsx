import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@ch5me/elf-ui/components/accordion"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Disclosure/Accordion",
	component: Accordion,
	args: {
		defaultValue: ["runtime"],
	},
	render: (args) => (
		<Accordion {...args} className="w-[460px] rounded-lg border bg-card px-4 text-card-foreground">
			<AccordionItem value="runtime">
				<AccordionTrigger>Runtime readiness</AccordionTrigger>
				<AccordionContent>
					OpenCode host, browser lane supervisor, and Storybook render service are healthy.
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="coverage">
				<AccordionTrigger>Coverage proof</AccordionTrigger>
				<AccordionContent>
					Desktop and mobile screenshots are captured before each tracker checkbox is marked done.
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="handoff">
				<AccordionTrigger>Handoff state</AccordionTrigger>
				<AccordionContent>
					Goal doc keeps current counts, proof paths, and the next batch target.
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	),
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MultipleOpen: Story = {
	args: {
		defaultValue: ["runtime", "coverage"],
		multiple: true,
	},
}
