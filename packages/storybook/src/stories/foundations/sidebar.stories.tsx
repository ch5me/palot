import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "@ch5me/elf-ui/components/button"
import { Sidebar, SidebarProvider, SidebarRail } from "@ch5me/elf-ui/components/sidebar"
import {
	NavSidebarShell,
	type NavSidebarAgent,
	type NavSidebarProject,
	type NavSidebarSectionId,
	STATUS_COLOR,
} from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { BlocksIcon, CopyIcon, PanelLeftIcon, PanelRightIcon, PlusIcon, SparklesIcon } from "lucide-react"
import { useMemo, useState } from "react"

const APP_BAR_HEIGHT = 46

const tabs = [
	{ id: "built-in" as const, label: "Palot", icon: BlocksIcon },
	{ id: "built-in-duplicate" as const, label: "Folio", icon: CopyIcon },
]

const agents: NavSidebarAgent[] = [
	{
		id: "ses-palot-shell",
		name: "Palot shell",
		status: "running",
		agentType: "build",
		modelID: "gpt-5",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-palot-shell",
	},
	{
		id: "ses-folio-proof",
		name: "Folio integration",
		status: "waiting",
		agentType: "deep",
		modelID: "claude-sonnet-4",
		project: "Folio",
		projectSlug: "folio-db",
		sessionId: "ses-folio-proof",
	},
	{
		id: "ses-plugin-runtime",
		name: "Plugin runtime",
		status: "degraded",
		agentType: "explore",
		modelID: "gemini-2.5-pro",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-plugin-runtime",
	},
	{
		id: "ses-release-review",
		name: "Release review",
		status: "idle",
		agentType: "oracle",
		modelID: "o3",
		project: "Firefly Cloud",
		projectSlug: "firefly-cloud",
		sessionId: "ses-release-review",
	},
	{
		id: "ses-sidepanel-target",
		name: "Plugin boundary review",
		status: "running",
		agentType: "build",
		modelID: "gpt-5",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-sidepanel-target",
	},
]

const projects: NavSidebarProject[] = [
	{
		id: "proj-palot",
		name: "Palot",
		slug: "palot",
		directory: "/Users/hassoncs/src/ch5/palot",
		agents: [agents[0], agents[2], agents[4]],
		hasMore: true,
	},
	{
		id: "proj-folio",
		name: "Folio",
		slug: "folio-db",
		directory: "/Users/hassoncs/src/ch5/folio-db",
		agents: [agents[1]],
	},
	{
		id: "proj-firefly-cloud",
		name: "Firefly Cloud",
		slug: "firefly-cloud",
		directory: "/Users/hassoncs/src/ch5/firefly-cloud",
		agents: [agents[3]],
	},
]

const baseSections: Record<NavSidebarSectionId, boolean> = {
	active: true,
	pinned: true,
	recent: true,
	pm: true,
	projects: true,
}

function MockWordmark() {
	return (
		<div className="mr-2 flex items-center gap-2">
			<div className="flex h-[16px] items-center gap-[3px]">
				<div className="h-[14px] w-[7px] rounded-full bg-foreground/85" />
				<div className="h-[14px] w-[7px] rounded-full bg-foreground/75" />
				<div className="h-[14px] w-[7px] rounded-full bg-foreground/65" />
			</div>
			<span className="text-[14px] font-medium tracking-tight text-muted-foreground/85">Palot</span>
		</div>
	)
}

function MockAppBar({ shellMode }: { shellMode: "content" | "full-shell" }) {
	const windowControlsInset = shellMode === "full-shell" ? 90 : 12

	return (
		<div
			className="relative z-30 flex shrink-0 items-center border-b border-border/50 pl-4 pr-3"
			style={{
				height: APP_BAR_HEIGHT,
				background:
					shellMode === "full-shell"
						? "color-mix(in srgb, var(--background) 88%, var(--card))"
						: "transparent",
			}}
		>
			<div className="mr-3 flex shrink-0 items-center gap-1.5" style={{ marginLeft: windowControlsInset }}>
				<MockWordmark />
				<Button variant="ghost" size="icon" className="size-7 shrink-0">
					<PanelLeftIcon className="size-3.5" />
				</Button>
				<Button variant="ghost" size="icon" className="size-7 shrink-0">
					<PlusIcon className="size-3.5" />
				</Button>
			</div>
			<div className="relative flex h-full min-w-0 flex-1 items-center justify-between gap-4">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">Folio shell evaluation</p>
				</div>
				<div className="hidden items-center gap-2 md:flex">
					<div className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
						Desktop chrome
					</div>
					<div className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
						Shared shell
					</div>
				</div>
			</div>
		</div>
	)
}

function ShellCanvas({
	selectedSessionId = null,
	showSelectionPanel = false,
	shellMode = "content",
}: {
	selectedSessionId?: string | null
	showSelectionPanel?: boolean
	shellMode?: "content" | "full-shell"
}) {
	const [activeTab, setActiveTab] = useState<"built-in" | "built-in-duplicate">("built-in")
	const [sectionsOpen, setSectionsOpen] = useState(baseSections)
	const activeAgents = useMemo(() => agents.filter((agent) => agent.status !== "idle"), [])
	const pinnedAgents = useMemo(() => agents.filter((agent) => agent.id === "ses-folio-proof"), [])
	const recentAgents = useMemo(() => agents.filter((agent) => agent.id !== "ses-folio-proof"), [])
	const pmSessions = useMemo(() => agents.filter((agent) => agent.id === "ses-release-review"), [])
	const selectedAgent = agents.find((agent) => agent.id === selectedSessionId) ?? null
	const tabLabel = activeTab === "built-in" ? "Palot" : "Folio"

	return (
		<SidebarProvider defaultOpen embedded>
			<div className="flex h-[780px] w-[1320px] overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[0_24px_90px_rgba(15,15,15,0.12)]">
				{shellMode === "full-shell" ? (
					<div className="grid h-full w-full overflow-hidden" style={{ gridTemplateRows: `${APP_BAR_HEIGHT}px 1fr` }}>
						<MockAppBar shellMode={shellMode} />
						<div className="flex min-h-0 min-w-0 overflow-hidden">
							<Sidebar className="border-r border-sidebar-border/20 bg-sidebar/80 backdrop-blur-sm" collapsible="icon">
								<div
									className="flex shrink-0 items-center gap-1"
									style={{
										height: APP_BAR_HEIGHT,
										background: "color-mix(in srgb, var(--sidebar) 82%, transparent)",
									}}
								/>
								<div className="min-h-0 flex-1 overflow-hidden">
									<NavSidebarShell
										tabs={tabs}
										activeTab={activeTab}
										onTabChange={setActiveTab}
										serverConnected
										hasContent
										showAutomations
										activeSessions={activeAgents}
										pinnedSessions={pinnedAgents}
										recentSessions={recentAgents}
										pmSessions={pmSessions}
										projects={projects}
										sectionsOpen={sectionsOpen}
										onSectionOpenChange={(section, open) =>
											setSectionsOpen((current) => ({
												...current,
												[section]: open,
											}))
										}
										onNewSession={() => undefined}
										onProjectManager={() => undefined}
										onAutomations={() => undefined}
										onOpenCommandPalette={() => undefined}
										onAddProject={() => undefined}
										onSessionSelect={() => undefined}
										onSessionRename={() => undefined}
										onSessionDelete={() => undefined}
										onTogglePinnedSession={() => undefined}
										onForkSession={() => undefined}
										onProjectSelect={() => undefined}
										onProjectLoadMore={() => undefined}
										onSettings={() => undefined}
										selectedSessionId={selectedSessionId}
										serverSummary={{ label: "This Mac", connected: true }}
									/>
								</div>
								<SidebarRail />
							</Sidebar>
							<div className="flex min-w-0 flex-1 flex-col bg-background/80 p-8">
								<div className="space-y-3">
									<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Actual app shell shape</p>
									<h3 className="text-3xl font-semibold tracking-tight">Animated shell preview</h3>
									<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
										This is the closest Storybook approximation of the real Palot desktop shell: top title bar, drag-region spacer, left split rail, and the actual animated multi-sidebar navigation embedded into a content frame.
									</p>
								</div>
								<div className="mt-8 grid gap-4 md:grid-cols-3">
									<div className="rounded-2xl border border-border/60 bg-card p-4">
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Current tab</p>
										<p className="mt-2 text-lg font-semibold">{tabLabel}</p>
									</div>
									<div className="rounded-2xl border border-border/60 bg-card p-4">
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Shell layer</p>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">Story now includes app-bar chrome and the spacer band above the embedded sidebar used by the desktop shell.</p>
									</div>
									<div className="rounded-2xl border border-border/60 bg-card p-4">
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Plugin seam</p>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">Use this to evaluate animated host shell behavior before wiring plugin-projected Folio sidebars.</p>
									</div>
								</div>
								<div className="mt-8 flex min-h-0 flex-1 gap-6">
									<div className="flex min-w-0 flex-1 flex-col rounded-3xl border border-dashed border-border/60 bg-card/50 p-6">
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Workspace canvas</p>
										<div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
											<div className="rounded-2xl bg-background/70 p-5 shadow-sm">
												<p className="text-sm font-medium">Session transcript / canvas</p>
												<p className="mt-3 text-sm leading-6 text-muted-foreground">This pane stands in for the active session surface while you evaluate rail motion, top chrome spacing, and shell proportions.</p>
											</div>
											<div className="rounded-2xl bg-background/70 p-5 shadow-sm">
												<p className="text-sm font-medium">Secondary shell zone</p>
												<p className="mt-3 text-sm leading-6 text-muted-foreground">Useful for future browser lanes, shell widgets, or right-side proof surfaces that should feel attached to the actual desktop chrome.</p>
											</div>
										</div>
									</div>
									{showSelectionPanel ? (
										<div className="w-[420px] shrink-0 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
											<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
												<PanelRightIcon className="size-4" />
												Side panel target
											</div>
											{selectedAgent ? (
												<div className="mt-5 space-y-5">
													<div>
														<p className="text-lg font-semibold">{selectedAgent.name}</p>
														<p className={`mt-1 text-sm ${STATUS_COLOR[selectedAgent.status]}`}>{selectedAgent.status}</p>
													</div>
													<div className="space-y-2 text-sm text-muted-foreground">
														<p>Project: {selectedAgent.project}</p>
														<p>Agent: {selectedAgent.agentType}</p>
														<p>Model: {selectedAgent.modelID}</p>
													</div>
													<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
														Use this together with the actual shell chrome to design notes/browser/plugins/artifacts side panels without guessing at final spacing.
													</div>
												</div>
											) : null}
										</div>
									) : null}
								</div>
							</div>
						</div>
					</div>
				) : (
					<>
						<Sidebar className="border-r border-sidebar-border/20 bg-sidebar/80 backdrop-blur-sm" collapsible="icon">
							<NavSidebarShell
								tabs={tabs}
								activeTab={activeTab}
								onTabChange={setActiveTab}
								serverConnected
								hasContent
								showAutomations
								activeSessions={activeAgents}
								pinnedSessions={pinnedAgents}
								recentSessions={recentAgents}
								pmSessions={pmSessions}
								projects={projects}
								sectionsOpen={sectionsOpen}
								onSectionOpenChange={(section, open) =>
									setSectionsOpen((current) => ({
										...current,
										[section]: open,
									}))
								}
								onNewSession={() => undefined}
								onProjectManager={() => undefined}
								onAutomations={() => undefined}
								onOpenCommandPalette={() => undefined}
								onAddProject={() => undefined}
								onSessionSelect={() => undefined}
								onSessionRename={() => undefined}
								onSessionDelete={() => undefined}
								onTogglePinnedSession={() => undefined}
								onForkSession={() => undefined}
								onProjectSelect={() => undefined}
								onProjectLoadMore={() => undefined}
								onSettings={() => undefined}
								selectedSessionId={selectedSessionId}
								serverSummary={{ label: "This Mac", connected: true }}
							/>
							<SidebarRail />
						</Sidebar>
						<div className="flex min-w-0 flex-1 flex-col bg-background/80 p-8">
							<div className="space-y-3">
								<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Actual app shell shape</p>
								<h3 className="text-3xl font-semibold tracking-tight">{showSelectionPanel ? "Selected session proof" : "Multi-sidebar nav proof"}</h3>
								<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
									{showSelectionPanel
										? "This state is for side-panel work: a concrete session is selected in the left rail, so you can design adjacent detail, plugin, and bridge panes against a realistic navigation context."
										: "This story mirrors the real Palot nav concept: discrete tabs on top that swap between host-owned sidebars, plus the same grouped structure the desktop app is using right now."}
								</p>
							</div>
							<div className="mt-8 grid gap-4 md:grid-cols-3">
								<div className="rounded-2xl border border-border/60 bg-card p-4">
									<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Current tab</p>
									<p className="mt-2 text-lg font-semibold">{tabLabel}</p>
								</div>
								<div className="rounded-2xl border border-border/60 bg-card p-4">
									<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Plugin seam</p>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">Top rail is where host-owned and plugin-owned sidebar families will coexist.</p>
								</div>
								<div className="rounded-2xl border border-border/60 bg-card p-4">
									<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Selection state</p>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedAgent ? `${selectedAgent.name} is highlighted in the rail.` : "No session selected."}</p>
								</div>
							</div>
							{showSelectionPanel ? (
								<div className="mt-8 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
									<div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-6">
										<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Primary workspace</p>
										<p className="mt-3 text-sm leading-6 text-muted-foreground">Use this larger pane for the active canvas or session transcript while the selected-session right rail stays stable.</p>
									</div>
									<div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
										<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
											<PanelRightIcon className="size-4" />
											Side panel target
										</div>
										{selectedAgent ? (
											<div className="mt-5 space-y-5">
												<div>
													<p className="text-lg font-semibold">{selectedAgent.name}</p>
													<p className={`mt-1 text-sm ${STATUS_COLOR[selectedAgent.status]}`}>{selectedAgent.status}</p>
												</div>
												<div className="space-y-2 text-sm text-muted-foreground">
													<p>Project: {selectedAgent.project}</p>
													<p>Agent: {selectedAgent.agentType}</p>
													<p>Model: {selectedAgent.modelID}</p>
												</div>
												<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
													Ideal for testing plugin panels, browser/notes/pulse side panels, and session-bound auxiliary UI without needing the full desktop runtime.
												</div>
											</div>
										) : null}
									</div>
								</div>
							) : null}
							{!showSelectionPanel ? (
								<div className="mt-auto flex items-center gap-2 pt-10 text-sm text-muted-foreground">
									<SparklesIcon className="size-4" />
									<span>Built for evaluating the real app sidebar direction, not the generic UI primitive.</span>
								</div>
							) : null}
						</div>
					</>
				)}
			</div>
		</SidebarProvider>
	)
}

const meta = {
	title: "Foundations/Navigation/Sidebar",
	component: ShellCanvas,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof ShellCanvas>

export default meta

type Story = StoryObj<typeof meta>

export const CurrentRealImplementation: Story = {
	render: () => <ShellCanvas />,
}

export const IntendedPluginifiedVersion: Story = {
	render: () => <ShellCanvas />,
	parameters: {
		docs: {
			description: {
				story: "This uses the same shell but frames the second tab as the future plugin-projected sidebar seam rather than a permanent duplicate host body.",
			},
		},
	},
}

export const SelectedSessionForSidePanels: Story = {
	render: () => <ShellCanvas selectedSessionId="ses-sidepanel-target" showSelectionPanel />,
}

export const FullAppShellPreview: Story = {
	render: () => <ShellCanvas selectedSessionId="ses-sidepanel-target" showSelectionPanel shellMode="full-shell" />,
}
