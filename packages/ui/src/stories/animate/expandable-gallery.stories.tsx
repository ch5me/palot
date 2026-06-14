import { ExpandableGallery } from "@ch5me/elf-ui/components/animate/expandable-gallery"
import type { Meta, StoryObj } from "@storybook/react-vite"

const image = (from: string, to: string, label: string) =>
	`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='${from.replace("#", "%23")}'/%3E%3Cstop offset='1' stop-color='${to.replace("#", "%23")}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='320' fill='url(%23g)'/%3E%3Ccircle cx='238' cy='78' r='58' fill='rgba(255,255,255,.22)'/%3E%3Ctext x='28' y='274' font-family='sans-serif' font-size='30' font-weight='700' fill='white'%3E${label}%3C/text%3E%3C/svg%3E`

const items = [
	{ id: "alpha", src: image("#0f766e", "#f59e0b", "Alpha"), alt: "Alpha artifact" },
	{ id: "beta", src: image("#1d4ed8", "#e11d48", "Beta"), alt: "Beta artifact" },
	{ id: "gamma", src: image("#7c3aed", "#16a34a", "Gamma"), alt: "Gamma artifact" },
	{ id: "delta", src: image("#be123c", "#0284c7", "Delta"), alt: "Delta artifact" },
	{ id: "omega", src: image("#334155", "#ca8a04", "Omega"), alt: "Omega artifact" },
]

const meta = {
	title: "Animate/Layouts/ExpandableGallery",
	component: ExpandableGallery,
	render: () => (
		<div className="w-[760px] p-6">
			<ExpandableGallery items={items}>
				<h3 className="font-semibold text-2xl">Artifact gallery</h3>
				<p className="mt-2 text-muted-foreground">
					Stacked preview expands into the full proof set.
				</p>
			</ExpandableGallery>
		</div>
	),
} satisfies Meta<typeof ExpandableGallery>

export default meta

type Story = StoryObj

export const Default: Story = {}
