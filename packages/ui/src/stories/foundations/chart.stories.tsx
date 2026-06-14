import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@ch5me/ch5-ui-web"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

const chartData = [
	{ batch: "01", covered: 13 },
	{ batch: "02", covered: 25 },
	{ batch: "03", covered: 35 },
	{ batch: "04", covered: 43 },
]

const chartConfig = {
	covered: {
		label: "Covered",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig

function ChartPreview() {
	return (
		<ChartContainer config={chartConfig} className="h-[260px] w-[520px]">
			<BarChart accessibilityLayer data={chartData}>
				<CartesianGrid vertical={false} />
				<XAxis dataKey="batch" tickLine={false} tickMargin={10} axisLine={false} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<ChartLegend content={<ChartLegendContent />} />
				<Bar dataKey="covered" fill="var(--color-covered)" radius={4} />
			</BarChart>
		</ChartContainer>
	)
}

const meta = {
	title: "Foundations/Data Display/Chart",
	component: ChartPreview,
} satisfies Meta<typeof ChartPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
