import {
	AnimatedCollection,
	AnimatedCollectionCaption,
	AnimatedCollectionItem,
	AnimatedCollectionItemContent,
	AnimatedCollectionItemMedia,
	AnimatedCollectionList,
	AnimatedCollectionViewToggle,
} from "@ch5me/elf-ui/components/animate/animated-collection"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { FileText, Image, Layers, LayoutGrid, List, Mic, Video } from "lucide-react"
import { useArgs } from "storybook/preview-api"

const items = [
	{
		id: "recap",
		title: "Quarterly recap",
		subtitle: "Edited 2h ago",
		icon: FileText,
		gradient: "from-sky-500 to-indigo-600",
	},
	{
		id: "photos",
		title: "Site photos",
		subtitle: "24 files",
		icon: Image,
		gradient: "from-amber-500 to-rose-600",
	},
	{
		id: "memo",
		title: "Voice memo",
		subtitle: "3m 12s",
		icon: Mic,
		gradient: "from-emerald-500 to-teal-700",
	},
	{
		id: "storyboard",
		title: "Storyboard",
		subtitle: "Draft v3",
		icon: Video,
		gradient: "from-violet-500 to-fuchsia-600",
	},
]

function CollectionItems() {
	return (
		<AnimatedCollectionList>
			{items.map((item, index) => (
				<AnimatedCollectionItem key={item.id} index={index}>
					<AnimatedCollectionItemMedia>
						<div
							className={`flex size-full items-center justify-center bg-gradient-to-br ${item.gradient}`}
						>
							<item.icon aria-hidden="true" className="size-8 text-white/90" />
						</div>
					</AnimatedCollectionItemMedia>
					<AnimatedCollectionItemContent>
						<div className="flex min-w-0 flex-col gap-0.5">
							<h3 className="truncate font-medium text-sm">{item.title}</h3>
							<span className="text-muted-foreground text-xs">{item.subtitle}</span>
						</div>
					</AnimatedCollectionItemContent>
				</AnimatedCollectionItem>
			))}
		</AnimatedCollectionList>
	)
}

const meta = {
	title: "Animate/AnimatedCollection",
	component: AnimatedCollection,
	args: {
		view: "list",
	},
	argTypes: {
		view: {
			control: "inline-radio",
			options: ["list", "card", "pack"],
		},
		packTransform: { control: false },
	},
	render: (args) => {
		const [, updateArgs] = useArgs()
		return (
			<AnimatedCollection {...args} className="w-80">
				<AnimatedCollectionViewToggle
					value={args.view ?? "list"}
					onValueChange={(view) => updateArgs({ view })}
					options={[
						{ value: "list", label: "List", icon: <List /> },
						{ value: "card", label: "Card", icon: <LayoutGrid /> },
						{ value: "pack", label: "Pack", icon: <Layers /> },
					]}
				/>
				<CollectionItems />
				<AnimatedCollectionCaption className="text-muted-foreground text-sm">
					{items.length} items packed
				</AnimatedCollectionCaption>
			</AnimatedCollection>
		)
	},
} satisfies Meta<typeof AnimatedCollection>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const views = ["list", "card", "pack"] as const

export const Views: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-wrap items-start gap-10">
			{views.map((view) => (
				<div key={view} className="flex w-72 flex-col gap-3">
					<span className="font-medium text-muted-foreground text-xs">{view}</span>
					<AnimatedCollection view={view}>
						<CollectionItems />
						<AnimatedCollectionCaption className="text-muted-foreground text-sm">
							{items.length} items packed
						</AnimatedCollectionCaption>
					</AnimatedCollection>
				</div>
			))}
		</div>
	),
}
