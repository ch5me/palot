import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@ch5me/elf-ui/components/select"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Forms/Select",
	component: Select,
	tags: ["autodocs"],
	render: () => (
		<div className="min-h-[300px] w-[420px] p-10">
			<Select defaultValue="batch-04" defaultOpen modal={false}>
				<SelectTrigger className="w-56">
					<SelectValue placeholder="Select batch" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Coverage batches</SelectLabel>
						<SelectItem value="batch-01">Batch 01</SelectItem>
						<SelectItem value="batch-02">Batch 02</SelectItem>
						<SelectItem value="batch-03">Batch 03</SelectItem>
						<SelectSeparator />
						<SelectItem value="batch-04">Batch 04</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	),
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
