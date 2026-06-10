import { Book3D } from "@ch5me/elf-ui/components/marketing/3d-book"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Marketing/Book3D",
	component: Book3D,
	args: {
		title: "Field Notes",
		insideContent: "Chapter One",
		pageCount: 15,
		className: "h-96",
	},
	argTypes: {
		title: { control: "text" },
		insideContent: { control: "text" },
		pageCount: { control: { type: "number", min: 0, max: 30, step: 1 } },
		accentClassName: {
			control: "select",
			options: [undefined, "bg-primary", "bg-secondary", "bg-destructive", "bg-muted"],
		},
		className: { control: false },
	},
} satisfies Meta<typeof Book3D>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-start gap-8">
			<Book3D className="h-80 w-72" title="Field Notes" insideContent="Chapter One" />
			<Book3D
				className="h-80 w-72"
				title="Sketchbook"
				insideContent="Open me"
				pageCount={5}
				accentClassName="bg-destructive"
			/>
			<Book3D className="h-80 w-72" title="Ledger" pageCount={25} accentClassName="bg-secondary" />
		</div>
	),
}
