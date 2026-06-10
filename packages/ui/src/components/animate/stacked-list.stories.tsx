import {
	StackedList,
	StackedListBody,
	StackedListGroup,
	StackedListItem,
	StackedListOverlay,
	StackedListOverlayBar,
	StackedListOverlayClose,
	StackedListOverlayContent,
	StackedListOverlayReveal,
	StackedListSearchInput,
	StackedListStatusDot,
	StackedListTag,
	useStackedList,
} from "@ch5me/elf-ui/components/animate/stacked-list"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodeIcon, MegaphoneIcon, PaletteIcon, ServerIcon, UsersIcon } from "lucide-react"

const messages = [
	{ name: "Avery Chen", preview: "Pushed the latest draft for review", time: "2m" },
	{ name: "Jordan Park", preview: "Can we sync on the rollout plan?", time: "14m" },
	{ name: "Sam Rivera", preview: "Metrics dashboard is live", time: "1h" },
] as const

const people = [
	{ name: "Avery Chen", role: "Engineering", icon: CodeIcon, tone: "primary", status: "success" },
	{ name: "Jordan Park", role: "Design", icon: PaletteIcon, tone: "violet", status: "success" },
	{ name: "Sam Rivera", role: "Platform", icon: ServerIcon, tone: "cyan", status: "warm" },
	{ name: "Riley Moss", role: "Marketing", icon: MegaphoneIcon, tone: "warm", status: "neutral" },
	{ name: "Casey Lin", role: "Engineering", icon: CodeIcon, tone: "primary", status: "danger" },
	{ name: "Quinn Adler", role: "Design", icon: PaletteIcon, tone: "violet", status: "success" },
] as const

function DirectoryGroup() {
	const { expanded } = useStackedList()

	return (
		<StackedListGroup open={expanded}>
			{people.map((person) => (
				<StackedListItem key={person.name} className="gap-3">
					<StackedListStatusDot tone={person.status} />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{person.name}</p>
					</div>
					<StackedListTag tone={person.tone}>
						<person.icon />
						{person.role}
					</StackedListTag>
				</StackedListItem>
			))}
		</StackedListGroup>
	)
}

type PlaygroundArgs = {
	defaultExpanded: boolean
	collapsedHeight: number
	collapsedInset: number
	expandedInset: number
}

const meta = {
	title: "Animate/StackedList",
	args: {
		defaultExpanded: false,
		collapsedHeight: 68,
		collapsedInset: 20,
		expandedInset: 10,
	},
	argTypes: {
		collapsedHeight: { control: { type: "range", min: 48, max: 120, step: 2 } },
		collapsedInset: { control: { type: "range", min: 0, max: 40, step: 2 } },
		expandedInset: { control: { type: "range", min: 0, max: 40, step: 2 } },
	},
	render: ({ defaultExpanded, collapsedHeight, collapsedInset, expandedInset }) => (
		<StackedList
			key={`${defaultExpanded}-${collapsedHeight}-${collapsedInset}-${expandedInset}`}
			defaultExpanded={defaultExpanded}
			className="h-[540px] w-[380px]"
		>
			<StackedListBody className="gap-4 p-5 pb-28">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold tracking-tight">Inbox</h2>
					<StackedListTag tone="primary">3 new</StackedListTag>
				</div>
				<StackedListGroup>
					{messages.map((message) => (
						<StackedListItem key={message.name} className="gap-3">
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">{message.name}</p>
								<p className="text-muted-foreground truncate text-xs">{message.preview}</p>
							</div>
							<span className="text-muted-foreground shrink-0 text-xs">{message.time}</span>
						</StackedListItem>
					))}
				</StackedListGroup>
			</StackedListBody>
			<StackedListOverlay
				collapsedHeight={collapsedHeight}
				collapsedInset={collapsedInset}
				expandedInset={expandedInset}
			>
				<StackedListOverlayBar>
					<div className="flex items-center gap-2 px-2">
						<UsersIcon className="text-muted-foreground size-4" />
						<span className="text-sm font-medium">Team directory</span>
						<span className="text-muted-foreground text-xs">{people.length}</span>
					</div>
					<StackedListOverlayClose />
				</StackedListOverlayBar>
				<StackedListOverlayContent className="gap-3 px-4 pb-4">
					<StackedListOverlayReveal className="pt-3">
						<StackedListSearchInput placeholder="Search people" />
					</StackedListOverlayReveal>
					<div className="min-h-0 flex-1 overflow-y-auto pt-1">
						<DirectoryGroup />
					</div>
				</StackedListOverlayContent>
			</StackedListOverlay>
		</StackedList>
	),
} satisfies Meta<PlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

const tagTones = [
	"neutral",
	"primary",
	"warm",
	"success",
	"cyan",
	"indigo",
	"violet",
	"danger",
] as const

const dotTones = ["neutral", "success", "warm", "danger"] as const

export const Tones: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				{tagTones.map((tone) => (
					<StackedListTag key={tone} tone={tone}>
						{tone}
					</StackedListTag>
				))}
			</div>
			<div className="flex items-center gap-4">
				{dotTones.map((tone) => (
					<span key={tone} className="text-muted-foreground flex items-center gap-1.5 text-xs">
						<StackedListStatusDot tone={tone} />
						{tone}
					</span>
				))}
			</div>
		</div>
	),
}
