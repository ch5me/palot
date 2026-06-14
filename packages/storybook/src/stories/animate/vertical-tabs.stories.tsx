import { VerticalTabs } from "@ch5me/elf-ui/components/animate/vertical-tabs"
import type { Meta, StoryObj } from "@storybook/react-vite"

const Panel = ({ title, detail }: { title: string; detail: string }) => (
	<div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,.24),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.96),rgba(30,41,59,.9))] p-8 text-white">
		<div>
			<div className="text-sm font-medium uppercase tracking-[0.18em] text-white/55">
				Coverage lane
			</div>
			<div className="mt-3 text-3xl font-semibold">{title}</div>
			<div className="mt-3 max-w-sm text-sm leading-6 text-white/70">{detail}</div>
		</div>
		<div className="grid grid-cols-3 gap-3 text-xs text-white/65">
			<div className="rounded-2xl bg-white/10 p-3">typecheck</div>
			<div className="rounded-2xl bg-white/10 p-3">render</div>
			<div className="rounded-2xl bg-white/10 p-3">coverage</div>
		</div>
	</div>
)

const items = [
	{
		value: "discover",
		label: "Discover",
		description: "Read local component API and decide story scope.",
		content: (
			<Panel title="Discover" detail="Start from local source, not imported package assumptions." />
		),
	},
	{
		value: "compose",
		label: "Compose",
		description: "Build a realistic state with controls and dense UI rhythm.",
		content: (
			<Panel
				title="Compose"
				detail="Use representative Palot data and expose meaningful interactive states."
			/>
		),
	},
	{
		value: "prove",
		label: "Prove",
		description: "Render screenshot targets and verify CH5 mapping.",
		content: (
			<Panel
				title="Prove"
				detail="Only check tracker boxes after Storybook and CH5 both see the story."
			/>
		),
	},
]

const meta = {
	title: "Animate/Navigation/VerticalTabs",
	component: VerticalTabs,
	render: () => (
		<div className="w-[860px] p-6">
			<VerticalTabs items={items} defaultValue="compose" size="default" />
		</div>
	),
} satisfies Meta<typeof VerticalTabs>

export default meta

type Story = StoryObj

export const Default: Story = {}
