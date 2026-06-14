import { FluidExpandingGrid } from "@ch5me/elf-ui/components/animate/fluid-expanding-grid"
import type { Meta, StoryObj } from "@storybook/react-vite"

const tile = (from: string, to: string, label: string) =>
	`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 480 320'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='${from.replace("#", "%23")}'/%3E%3Cstop offset='1' stop-color='${to.replace("#", "%23")}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='480' height='320' fill='url(%23g)'/%3E%3Cpath d='M0 250 C120 190 250 290 480 210 L480 320 L0 320 Z' fill='rgba(255,255,255,.18)'/%3E%3Ctext x='32' y='260' font-family='sans-serif' font-size='34' font-weight='700' fill='white'%3E${label}%3C/text%3E%3C/svg%3E`

const items = [
	{ id: "models", title: "Models", subtitle: "routing matrix", src: tile("#2563eb", "#14b8a6", "Models") },
	{ id: "agents", title: "Agents", subtitle: "active sessions", src: tile("#7c2d12", "#f97316", "Agents") },
	{ id: "proof", title: "Proof", subtitle: "render capture", src: tile("#4c1d95", "#ec4899", "Proof") },
	{ id: "build", title: "Build", subtitle: "static bundle", src: tile("#14532d", "#84cc16", "Build") },
]

const meta = {
	title: "Animate/Layouts/FluidExpandingGrid",
	component: FluidExpandingGrid,
	render: () => (
		<div className="w-[760px] p-6">
			<FluidExpandingGrid items={items} className="h-[420px]" />
		</div>
	),
} satisfies Meta<typeof FluidExpandingGrid>

export default meta

type Story = StoryObj

export const Default: Story = {}
