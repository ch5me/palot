import type { Meta, StoryObj } from "@storybook/react-vite"
import { AppSidebarShellFrame, NavSidebarShell, type NavSidebarAgent, type NavSidebarProject, type NavSidebarSectionId } from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { SidebarProvider } from "@ch5me/elf-ui/components/sidebar"
import { SplitPane } from "@ch5me/workspace"
import { BlocksIcon, CopyIcon } from "lucide-react"
import { useMemo, useState } from "react"

const tabs = [
	{ id: "built-in" as const, label: "Palot", icon: BlocksIcon },
	{ id: "built-in-duplicate" as const, label: "Folio", icon: CopyIcon },
]

const agents: NavSidebarAgent[] = [
	{
		id: "ses-layout-base",
		name: "Layout base",
		status: "running",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-layout-base",
		agentType: "build",
		modelID: "gpt-5",
	},
	{
		id: "ses-sidebar-pass",
		name: "Sidebar pass",
		status: "waiting",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-sidebar-pass",
		agentType: "explore",
		modelID: "gemini-2.5-pro",
	},
]

const projects: NavSidebarProject[] = [
	{
		id: "proj-palot",
		name: "Palot",
		slug: "palot",
		directory: "/Users/hassoncs/src/ch5/palot",
		agents,
		hasMore: false,
	},
]

const baseSections: Record<NavSidebarSectionId, boolean> = {
	active: true,
	pinned: true,
	recent: true,
	pm: false,
	projects: true,
}

function SidebarPreview({
	compact = false,
	activeTab,
	onTabChange,
}: {
	compact?: boolean
	activeTab: "built-in" | "built-in-duplicate"
	onTabChange: (tab: "built-in" | "built-in-duplicate") => void
}) {
	const [sectionsOpen, setSectionsOpen] = useState(baseSections)
	const activeSessions = useMemo(() => agents.filter((agent) => agent.status !== "idle"), [])

	const palotBody = (
		<NavSidebarShell
			tabs={tabs}
			activeTab={activeTab}
			onTabChange={onTabChange}
			serverConnected
			hasContent
			activeSessions={activeSessions}
			pinnedSessions={compact ? [] : [agents[1]]}
			recentSessions={compact ? [agents[1]] : activeSessions}
			pmSessions={[]}
			projects={projects}
			sectionsOpen={sectionsOpen}
			onSectionOpenChange={(section, open) =>
				setSectionsOpen((current) => ({
					...current,
					[section]: open,
				}))}
			onNewSession={() => {}}
			onProjectManager={() => {}}
			onAutomations={() => {}}
			onOpenCommandPalette={() => {}}
			onAddProject={() => {}}
			onSessionSelect={() => {}}
			onSessionRename={() => {}}
			onSessionDelete={() => {}}
			onTogglePinnedSession={() => {}}
			onForkSession={() => {}}
			onProjectSelect={() => {}}
			onProjectLoadMore={() => {}}
			onSettings={() => {}}
			serverSummary={{ label: "This Mac", connected: true }}
		/>
	)

	const folioBody = (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<NavSidebarShell
				tabs={tabs}
				activeTab={activeTab}
				onTabChange={onTabChange}
				serverConnected
				hasContent
				activeSessions={[]}
				pinnedSessions={[]}
				recentSessions={[]}
				pmSessions={[]}
				projects={[]}
				sectionsOpen={baseSections}
				onSectionOpenChange={() => {}}
				onSettings={() => {}}
				serverSummary={{ label: "This Mac", connected: true }}
				rightPane={
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-sidebar-border/10 bg-sidebar/60">
						<div className="border-b border-sidebar-border/10 px-4 py-3">
							<p className="text-xs font-medium uppercase tracking-[0.16em] text-sidebar-foreground/55">Folio</p>
							<p className="mt-2 text-sm font-medium text-sidebar-foreground">Projected workspace list</p>
						</div>
						<div className="space-y-2 p-3">
							<div className="rounded-xl border border-sidebar-border/20 bg-sidebar-accent/40 px-3 py-2 text-sm text-sidebar-foreground">Workspace overview</div>
							<div className="rounded-xl border border-sidebar-border/20 bg-sidebar-accent/20 px-3 py-2 text-sm text-sidebar-foreground/85">Pending assets</div>
							<div className="rounded-xl border border-sidebar-border/20 bg-sidebar-accent/20 px-3 py-2 text-sm text-sidebar-foreground/85">Publishing queue</div>
						</div>
					</div>
				}
			/>
		</div>
	)

	return activeTab === "built-in" ? palotBody : folioBody
}

function BareContentPane() {
	return (
		<main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
			<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
				<div className="flex min-h-full w-full min-w-0 items-center justify-center rounded-none border border-dashed border-border/60 bg-card/40 text-sm text-muted-foreground">
					Main content
				</div>
			</div>
		</main>
	)
}

function MinimalSplitPaneLayout({
	leftOpen = true,
	showSidebarFrame = false,
}: {
	leftOpen?: boolean
	showSidebarFrame?: boolean
}) {
	const [activeTab, setActiveTab] = useState<"built-in" | "built-in-duplicate">("built-in")

	const sidebar = showSidebarFrame ? (
		<SidebarPreview compact activeTab={activeTab} onTabChange={setActiveTab} />
	) : (
		<div className="h-full min-h-0 overflow-hidden border-r border-sidebar-border/20 bg-sidebar/80">
			<SidebarPreview compact activeTab={activeTab} onTabChange={setActiveTab} />
		</div>
	)

	return (
		<div className="h-screen w-full overflow-hidden bg-background text-foreground">
			<SidebarProvider defaultOpen={leftOpen} embedded>
				<SplitPane
					side="left"
					open={leftOpen}
					onOpenChange={() => {}}
					defaultPanelWidth={320}
					minPanelWidth={200}
					maxPanelWidth={480}
					panel={sidebar}
				>
					<BareContentPane />
				</SplitPane>
			</SidebarProvider>
		</div>
	)
}

function MinimalShellFrame() {
	const [activeTab, setActiveTab] = useState<"built-in" | "built-in-duplicate">("built-in")

	return (
		<div className="h-screen w-full overflow-hidden bg-[var(--ws-bg,hsl(var(--background)))] text-[var(--ws-text-primary,hsl(var(--foreground)))]">
			<AppSidebarShellFrame
				appBar={null}
				sidebar={<SidebarPreview activeTab={activeTab} onTabChange={setActiveTab} />}
				sidebarHeader={
					<div className="flex h-[46px] shrink-0 items-center border-b border-sidebar-border/20 px-4">
						<p className="text-sm font-medium text-sidebar-foreground/90">Palot</p>
					</div>
				}
				content={<BareContentPane />}
				sidebarStyle={{ width: 320, minWidth: 200, maxWidth: 480 }}
				height="100%"
				className="h-full"
				contentClassName="bg-transparent"
			/>
		</div>
	)
}

const meta = {
	title: "Foundations/Layout/Base",
	component: MinimalSplitPaneLayout,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof MinimalSplitPaneLayout>

export default meta

type Story = StoryObj<typeof meta>

export const Step1SplitPaneOnly: Story = {
	render: () => <MinimalSplitPaneLayout showSidebarFrame={false} />,
}

export const Step2SplitPaneCollapsed: Story = {
	render: () => <MinimalSplitPaneLayout leftOpen={false} showSidebarFrame={false} />,
}

export const Step3ShellFrameNoTopNav: Story = {
	render: () => <MinimalShellFrame />,
}

export const Step4ShellFrameWithRealSidebar: Story = {
	render: () => <MinimalShellFrame />,
}
