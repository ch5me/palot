import { Badge } from "@ch5me/elf-ui/components/badge"
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@ch5me/elf-ui/components/table"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Data Display/Table",
	component: Table,
	tags: ["autodocs"],
	render: () => (
		<div className="w-[620px] rounded-lg border bg-card p-4 text-card-foreground">
			<Table>
				<TableCaption>Storybook coverage batches</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>Batch</TableHead>
						<TableHead>Scope</TableHead>
						<TableHead>Status</TableHead>
						<TableHead className="text-right">Covered</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>01</TableCell>
						<TableCell>Display primitives</TableCell>
						<TableCell>
							<Badge variant="secondary">Verified</Badge>
						</TableCell>
						<TableCell className="text-right">10</TableCell>
					</TableRow>
					<TableRow data-state="selected">
						<TableCell>02</TableCell>
						<TableCell>Form primitives</TableCell>
						<TableCell>
							<Badge variant="secondary">Verified</Badge>
						</TableCell>
						<TableCell className="text-right">12</TableCell>
					</TableRow>
					<TableRow>
						<TableCell>03</TableCell>
						<TableCell>Overlay primitives</TableCell>
						<TableCell>
							<Badge>Current</Badge>
						</TableCell>
						<TableCell className="text-right">10</TableCell>
					</TableRow>
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableCell colSpan={3}>Total local components covered</TableCell>
						<TableCell className="text-right">35</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</div>
	),
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
