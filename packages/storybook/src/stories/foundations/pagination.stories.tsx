import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@ch5me/elf-ui/components/pagination"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = {
	title: "Foundations/Navigation/Pagination",
	component: Pagination,
	render: () => (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href="#previous" />
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#batch-1">1</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="#batch-2" isActive>
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationEllipsis />
				</PaginationItem>
				<PaginationItem>
					<PaginationNext href="#next" />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	),
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
