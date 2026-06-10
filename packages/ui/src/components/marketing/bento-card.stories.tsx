import {
	BentoCard,
	BentoCardPreview,
	BentoCardWorkspace,
	type BentoCardWorkspaceTab,
} from "@ch5me/elf-ui/components/marketing/bento-card"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { LayoutDashboard, MessageSquare, Settings } from "lucide-react"

function DashboardMock() {
	return (
		<div className="grid grid-cols-3 gap-2">
			{[
				["Active", "1,284"],
				["Pending", "37"],
				["Done", "412"],
			].map(([label, count]) => (
				<div key={label} className="rounded-lg border border-border/40 bg-muted/30 p-2">
					<p className="text-[10px] text-muted-foreground">{label}</p>
					<p className="text-sm font-semibold tabular-nums">{count}</p>
				</div>
			))}
			<div className="col-span-3 flex items-end gap-1 rounded-lg border border-border/40 bg-muted/30 p-2">
				{[40, 65, 30, 80, 55, 70, 45, 90].map((height) => (
					<div
						key={height}
						className="flex-1 rounded-sm bg-primary/30"
						style={{ height: `${height * 0.4}px` }}
					/>
				))}
			</div>
		</div>
	)
}

function ThreadsMock() {
	return (
		<div className="flex flex-col gap-2">
			{["Design review", "Weekly sync", "Release checklist", "Bug triage"].map((title) => (
				<div key={title} className="flex items-center gap-2 rounded-lg border border-border/40 p-2">
					<span className="size-5 shrink-0 rounded-full bg-muted" />
					<div className="min-w-0 flex-1">
						<p className="truncate text-xs font-medium">{title}</p>
						<p className="h-2 w-2/3 rounded-sm bg-muted" />
					</div>
				</div>
			))}
		</div>
	)
}

function SettingsMock() {
	return (
		<div className="flex flex-col gap-2">
			{[
				["Notifications", true],
				["Auto-archive", false],
				["Weekly digest", true],
			].map(([label, on]) => (
				<div
					key={String(label)}
					className="flex items-center justify-between rounded-lg border border-border/40 p-2"
				>
					<span className="text-xs">{label}</span>
					<span className={`h-3.5 w-6 rounded-full ${on ? "bg-primary/60" : "bg-muted"}`} />
				</div>
			))}
		</div>
	)
}

const tabs: BentoCardWorkspaceTab[] = [
	{
		value: "dashboard",
		label: "Dashboard",
		icon: <LayoutDashboard />,
		header: "Overview",
		description: "Daily summary of activity.",
		content: <DashboardMock />,
	},
	{
		value: "threads",
		label: "Threads",
		icon: <MessageSquare />,
		badge: "12",
		header: "Threads",
		description: "Recent conversations.",
		content: <ThreadsMock />,
	},
	{
		value: "settings",
		label: "Settings",
		icon: <Settings />,
		header: "Preferences",
		description: "Workspace configuration.",
		content: <SettingsMock />,
	},
]

const meta = {
	title: "Marketing/BentoCard",
	component: BentoCard,
	args: {
		eyebrow: "Project dashboard",
		heading: "Analytics and collaboration in one place.",
	},
	argTypes: {
		eyebrow: { control: "text" },
		heading: { control: "text" },
		children: { control: false },
	},
	render: (args) => (
		<BentoCard {...args}>
			<BentoCardPreview windowTitle="Workspace">
				<BentoCardWorkspace defaultValue="dashboard" tabs={tabs} />
			</BentoCardPreview>
		</BentoCard>
	),
} satisfies Meta<typeof BentoCard>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ActivePanes: Story = {
	parameters: { controls: { disable: true } },
	render: () => (
		<div className="flex min-w-[76rem] flex-wrap gap-4 rounded-[2rem] border border-border/50 bg-background/80 p-4 shadow-[var(--ff-shadow-sm)]">
			{tabs.map((tab) => (
				<div key={tab.value} className="flex flex-col gap-1.5">
					<span className="text-xs text-muted-foreground">{tab.value}</span>
					<div className="flex h-56 w-96 overflow-hidden rounded-xl border bg-background">
						<BentoCardWorkspace value={tab.value} tabs={tabs} />
					</div>
				</div>
			))}
		</div>
	),
}
