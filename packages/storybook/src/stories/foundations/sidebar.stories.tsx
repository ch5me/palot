import {
	AppShellChrome,
	AppSidebarShellFrame,
	type NavSidebarAgent,
	type NavSidebarProject,
	type NavSidebarSectionId,
	NavSidebarShell,
	type NavSidebarShellProps,
	STATUS_COLOR,
} from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { SidebarProvider } from "@ch5me/elf-ui/components/sidebar"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BlocksIcon, CopyIcon, PanelRightIcon, SparklesIcon } from "lucide-react"
import { useMemo, useState } from "react"

function RuntimeNavSidebarShell(props: NavSidebarShellProps) {
	return <NavSidebarShell {...props} />
}

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
	{
		id: "ses-browser-lane",
		name: "Browser lane capture",
		status: "running",
		agentType: "build",
		modelID: "gpt-5",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-browser-lane",
	},
	{
		id: "ses-notes-panel",
		name: "Notes panel pass",
		status: "waiting",
		agentType: "writing",
		modelID: "claude-sonnet-4",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-notes-panel",
	},
	{
		id: "ses-artifacts-panel",
		name: "Artifacts inspection",
		status: "degraded",
		agentType: "explore",
		modelID: "gemini-2.5-pro",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-artifacts-panel",
	},
]

const projects: NavSidebarProject[] = [
	{
		id: "proj-palot",
		name: "Palot",
		slug: "palot",
		directory: "/Users/hassoncs/src/ch5/palot",
		agents: [agents[0], agents[2], agents[4], agents[5], agents[6], agents[7]],
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
		<AppShellChrome
			title={<p className="truncate text-sm font-medium">Folio shell evaluation</p>}
			badges={[{ label: "Desktop chrome" }, { label: "Shared shell" }]}
			windowControlsInset={windowControlsInset}
			leftAdornment={<MockWordmark />}
			backgroundMode={shellMode === "full-shell" ? "shell" : "transparent"}
			onToggleSidebar={() => {}}
			onNewSession={() => {}}
		/>
	)
}

type PreviewPanelKind = "session-detail" | "browser" | "notes" | "artifacts"
type PreviewShellSidebarState = "expanded" | "hidden"
type PreviewShellMode = "host" | "plugin-seam"

function ShellCanvas({
	selectedSessionId = null,
	showSelectionPanel = false,
	shellMode = "content",
	panelKind = "session-detail",
	sidebarState = "expanded",
	previewMode = "host",
}: {
	selectedSessionId?: string | null
	showSelectionPanel?: boolean
	shellMode?: "content" | "full-shell"
	panelKind?: PreviewPanelKind
	sidebarState?: PreviewShellSidebarState
	previewMode?: PreviewShellMode
}) {
	const [activeTab, setActiveTab] = useState<"built-in" | "built-in-duplicate">("built-in")
	const [sectionsOpen, setSectionsOpen] = useState(baseSections)
	const activeAgents = useMemo(() => agents.filter((agent) => agent.status !== "idle"), [])
	const pinnedAgents = useMemo(() => agents.filter((agent) => agent.id === "ses-folio-proof"), [])
	const recentAgents = useMemo(() => agents.filter((agent) => agent.id !== "ses-folio-proof"), [])
	const pmSessions = useMemo(() => agents.filter((agent) => agent.id === "ses-release-review"), [])
	const selectedAgent = agents.find((agent) => agent.id === selectedSessionId) ?? null
	const tabLabel = activeTab === "built-in" ? "Palot" : "Folio"
	const isSidebarHidden = sidebarState === "hidden"
	const isPluginSeam = previewMode === "plugin-seam"
	const panelTitle =
		panelKind === "browser"
			? "Browser panel target"
			: panelKind === "notes"
				? "Notes panel target"
				: panelKind === "artifacts"
					? "Artifacts panel target"
					: "Side panel target"

	const seamProjects = isPluginSeam
		? projects.map((project) => ({
				...project,
				agents: [],
				hasMore: false,
			}))
		: projects

	const shellSidebar = (
		<RuntimeNavSidebarShell
			tabs={tabs}
			activeTab={isPluginSeam ? "built-in-duplicate" : activeTab}
			onTabChange={setActiveTab}
			serverConnected
			hasContent={!isPluginSeam}
			showAutomations={!isPluginSeam}
			activeSessions={isPluginSeam ? [] : activeAgents}
			pinnedSessions={isPluginSeam ? [] : pinnedAgents}
			recentSessions={isPluginSeam ? [] : recentAgents}
			pmSessions={isPluginSeam ? [] : pmSessions}
			projects={
				isPluginSeam
					? projects.map((project) => ({ ...project, agents: [], hasMore: false }))
					: projects
			}
			sectionsOpen={sectionsOpen}
			onSectionOpenChange={(section, open) =>
				setSectionsOpen((current) => ({
					...current,
					[section]: open,
				}))
			}
			onNewSession={isPluginSeam ? undefined : () => undefined}
			onProjectManager={isPluginSeam ? undefined : () => undefined}
			onAutomations={isPluginSeam ? undefined : () => undefined}
			onOpenCommandPalette={isPluginSeam ? undefined : () => undefined}
			onAddProject={isPluginSeam ? undefined : () => undefined}
			onSessionSelect={isPluginSeam ? undefined : () => undefined}
			onSessionRename={isPluginSeam ? undefined : () => undefined}
			onSessionDelete={isPluginSeam ? undefined : () => undefined}
			onTogglePinnedSession={isPluginSeam ? undefined : () => undefined}
			onForkSession={isPluginSeam ? undefined : () => undefined}
			onProjectSelect={isPluginSeam ? undefined : () => undefined}
			onProjectLoadMore={isPluginSeam ? undefined : () => undefined}
			onSettings={isPluginSeam ? undefined : () => undefined}
			selectedSessionId={selectedSessionId}
			serverSummary={{ label: "This Mac", connected: true }}
			projectManagerLabel={isPluginSeam ? "Folio Queue" : "Project Manager"}
			automationsLabel={isPluginSeam ? "Projected Panels" : "Automations"}
			projectSearchPlaceholder={isPluginSeam ? "Filter Folio workspaces..." : "Filter projects..."}
			emptyState={
				<div className="flex flex-1 items-center justify-center p-4">
					<div className="space-y-2 text-center">
						<p className="text-sm text-muted-foreground">
							{isPluginSeam ? "Plugin seam warming up" : "No projects yet"}
						</p>
						<p className="text-xs text-muted-foreground/60">
							{isPluginSeam
								? "This shared-shell proof keeps host actions disabled until a projected Folio provider is wired in."
								: "Add a project to get started"}
						</p>
					</div>
				</div>
			}
		/>
	)

	const selectionPanelContent = selectedAgent ? (
		<div className="mt-5 space-y-5">
			<div>
				<p className="text-lg font-semibold">{selectedAgent.name}</p>
				<p className={`mt-1 text-sm ${STATUS_COLOR[selectedAgent.status]}`}>
					{selectedAgent.status}
				</p>
			</div>
			<div className="space-y-2 text-sm text-muted-foreground">
				<p>Project: {selectedAgent.project}</p>
				<p>Agent: {selectedAgent.agentType}</p>
				<p>Model: {selectedAgent.modelID}</p>
			</div>
			{panelKind === "browser" ? (
				<div className="space-y-4">
					<div className="rounded-2xl border border-border/60 bg-background/70 p-4">
						<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Viewport
						</p>
						<div className="mt-3 aspect-[16/10] rounded-xl border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_52%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.88))] p-3 text-white shadow-inner">
							<div className="flex items-center gap-1.5">
								<div className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
								<div className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
								<div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
								<div className="ml-3 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/70">
									storybook.elf.localhost
								</div>
							</div>
							<div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
								<p className="text-xs font-medium text-white/80">Live browser lane</p>
								<p className="mt-2 text-[11px] leading-5 text-white/60">
									Use this region to preview browser controls, tabs, and page-status overlays
									against the real shell spacing.
								</p>
							</div>
						</div>
					</div>
					<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
						Browser lane proof with realistic URL chrome, traffic-light window controls, and
						shell-aligned status overlays.
					</div>
				</div>
			) : panelKind === "notes" ? (
				<div className="space-y-4">
					<div className="rounded-2xl border border-border/60 bg-background/70 p-4">
						<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Pinned notes
						</p>
						<div className="mt-3 space-y-3">
							<div className="rounded-xl bg-card p-3 shadow-sm">
								<p className="text-sm font-medium">Plugin seam notes</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Right pane width feels stable at 420px. Keep browser/takeover panels aligned to
									shell chrome rather than transcript rhythm.
								</p>
							</div>
							<div className="rounded-xl bg-card p-3 shadow-sm">
								<p className="text-sm font-medium">Folio migration</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									Swap duplicate host sidebar with plugin-projected family once panel affordances
									are validated here.
								</p>
							</div>
						</div>
					</div>
					<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
						Notes surface proof with realistic density for PM snapshots, plugin seam reminders, and
						sticky sidecar content.
					</div>
				</div>
			) : panelKind === "artifacts" ? (
				<div className="space-y-4">
					<div className="rounded-2xl border border-border/60 bg-background/70 p-4">
						<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Artifacts
						</p>
						<div className="mt-3 space-y-3">
							<div className="rounded-xl border border-border/50 bg-card p-3 shadow-sm">
								<p className="text-sm font-medium">storyboard-static build</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Updated 2m ago • shared shell frame extraction
								</p>
							</div>
							<div className="rounded-xl border border-border/50 bg-card p-3 shadow-sm">
								<p className="text-sm font-medium">sidebar-proof.png</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Reference capture for Folio plugin seam review
								</p>
							</div>
						</div>
					</div>
					<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
						Artifact proof with metadata cards and selection-driven preview surfaces aligned to the
						shared shell.
					</div>
				</div>
			) : (
				<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
					Use this together with the actual shell chrome to design notes/browser/plugins/artifacts
					side panels without guessing at final spacing.
				</div>
			)}
		</div>
	) : null

	const fullShellContent = (
		<div className="flex min-w-0 flex-1 flex-col bg-background/80 p-8">
			<div className="space-y-3">
				<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Actual app shell shape
				</p>
				<h3 className="text-3xl font-semibold tracking-tight">Animated shell preview</h3>
				<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
					This is the closest Storybook approximation of the real Palot desktop shell: top title
					bar, drag-region spacer, left split rail, and the actual animated multi-sidebar navigation
					embedded into a content frame.
				</p>
			</div>
			<div className="mt-8 grid gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-border/60 bg-card p-4">
					<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Current tab
					</p>
					<p className="mt-2 text-lg font-semibold">{tabLabel}</p>
				</div>
				<div className="rounded-2xl border border-border/60 bg-card p-4">
					<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Shell layer
					</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						Story now uses the same shared app-bar chrome and sidebar frame structure as the desktop
						shell.
					</p>
				</div>
				<div className="rounded-2xl border border-border/60 bg-card p-4">
					<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Sidebar state
					</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{isSidebarHidden
							? "Sidebar hidden to validate content-first shell balance and chrome spacing."
							: "Sidebar visible for full nav rhythm and panel seam evaluation."}
					</p>
				</div>
				<div className="rounded-2xl border border-border/60 bg-card p-4">
					<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Plugin seam
					</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{isPluginSeam
							? "This Storybook seam mirrors the desktop Folio preview by disabling host actions and treating project/session data as projected placeholders."
							: "This preview stays at the shared-shell layer while the host-owned Palot path remains fully interactive in the desktop runtime."}
					</p>
				</div>
			</div>
			<div className="mt-8 flex min-h-0 flex-1 gap-6">
				<div className="flex min-w-0 flex-1 flex-col rounded-3xl border border-dashed border-border/60 bg-card/50 p-6">
					<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
						Workspace canvas
					</p>
					<div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
						<div className="rounded-2xl bg-background/70 p-5 shadow-sm">
							<p className="text-sm font-medium">Session transcript / canvas</p>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								This pane stands in for the active session surface while you evaluate rail motion,
								top chrome spacing, and shell proportions.
							</p>
						</div>
						<div className="rounded-2xl bg-background/70 p-5 shadow-sm">
							<p className="text-sm font-medium">Secondary shell zone</p>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								Useful for future browser lanes, shell widgets, or right-side proof surfaces that
								should feel attached to the actual desktop chrome.
							</p>
						</div>
					</div>
				</div>
				{showSelectionPanel ? (
					<div className="w-[420px] shrink-0 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
						<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
							<PanelRightIcon className="size-4" />
							{panelTitle}
						</div>
						{selectionPanelContent}
					</div>
				) : null}
			</div>
		</div>
	)

	return (
		<div className="flex h-[780px] w-[1320px] overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-[0_24px_90px_rgba(15,15,15,0.12)]">
			{shellMode === "full-shell" ? (
				<AppSidebarShellFrame
					className="h-full w-full"
					appBar={<MockAppBar shellMode={shellMode} />}
					sidebar={shellSidebar}
					content={fullShellContent}
					height="100%"
					sidebarVisible={!isSidebarHidden}
				/>
			) : (
				<SidebarProvider defaultOpen embedded>
					{shellSidebar}
					<div className="flex min-w-0 flex-1 flex-col bg-background/80 p-8">
						<div className="space-y-3">
							<p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								Actual app shell shape
							</p>
							<h3 className="text-3xl font-semibold tracking-tight">
								{showSelectionPanel ? "Selected session proof" : "Multi-sidebar nav proof"}
							</h3>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
								{showSelectionPanel
									? "This state is for side-panel work: a concrete session is selected in the left rail, so you can design adjacent detail, plugin, and bridge panes against a realistic navigation context."
									: "This story mirrors the real Palot nav concept: discrete tabs on top that swap between host-owned sidebars, plus the same grouped structure the desktop app is using right now."}
							</p>
						</div>
						<div className="mt-8 grid gap-4 md:grid-cols-3">
							<div className="rounded-2xl border border-border/60 bg-card p-4">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Current tab
								</p>
								<p className="mt-2 text-lg font-semibold">{tabLabel}</p>
							</div>
							<div className="rounded-2xl border border-border/60 bg-card p-4">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Plugin seam
								</p>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									Top rail is where host-owned and plugin-owned sidebar families will coexist.
								</p>
							</div>
							<div className="rounded-2xl border border-border/60 bg-card p-4">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
									Selection state
								</p>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{selectedAgent
										? `${selectedAgent.name} is highlighted in the rail.`
										: "No session selected."}
								</p>
							</div>
						</div>
						{showSelectionPanel ? (
							<div className="mt-8 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
								<div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-6">
									<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
										Primary workspace
									</p>
									<p className="mt-3 text-sm leading-6 text-muted-foreground">
										Use this larger pane for the active canvas or session transcript while the
										selected-session right rail stays stable.
									</p>
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
												<p className={`mt-1 text-sm ${STATUS_COLOR[selectedAgent.status]}`}>
													{selectedAgent.status}
												</p>
											</div>
											<div className="space-y-2 text-sm text-muted-foreground">
												<p>Project: {selectedAgent.project}</p>
												<p>Agent: {selectedAgent.agentType}</p>
												<p>Model: {selectedAgent.modelID}</p>
											</div>
											<div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
												Ideal for testing plugin panels, browser/notes/pulse side panels, and
												session-bound auxiliary UI without needing the full desktop runtime.
											</div>
										</div>
									) : null}
								</div>
							</div>
						) : null}
						{!showSelectionPanel ? (
							<div className="mt-auto flex items-center gap-2 pt-10 text-sm text-muted-foreground">
								<SparklesIcon className="size-4" />
								<span>
									Built for evaluating the real app sidebar direction, not the generic UI primitive.
								</span>
							</div>
						) : null}
					</div>
				</SidebarProvider>
			)}
		</div>
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
	render: () => <ShellCanvas previewMode="plugin-seam" />,
	parameters: {
		docs: {
			description: {
				story:
					"This keeps the shared shell but disables host actions and treats the Folio tab as a projected plugin seam instead of a duplicate live host sidebar.",
			},
		},
	},
}

export const SelectedSessionForSidePanels: Story = {
	render: () => <ShellCanvas selectedSessionId="ses-sidepanel-target" showSelectionPanel />,
}

export const FullAppShellPreview: Story = {
	render: () => (
		<ShellCanvas
			selectedSessionId="ses-sidepanel-target"
			showSelectionPanel
			shellMode="full-shell"
		/>
	),
}

export const FullAppShellBrowserPanel: Story = {
	render: () => (
		<ShellCanvas
			selectedSessionId="ses-browser-lane"
			showSelectionPanel
			shellMode="full-shell"
			panelKind="browser"
		/>
	),
}

export const FullAppShellNotesPanel: Story = {
	render: () => (
		<ShellCanvas
			selectedSessionId="ses-notes-panel"
			showSelectionPanel
			shellMode="full-shell"
			panelKind="notes"
		/>
	),
}

export const FullAppShellArtifactsPanel: Story = {
	render: () => (
		<ShellCanvas
			selectedSessionId="ses-artifacts-panel"
			showSelectionPanel
			shellMode="full-shell"
			panelKind="artifacts"
		/>
	),
}

export const FullAppShellNoSidebar: Story = {
	render: () => (
		<ShellCanvas
			selectedSessionId="ses-sidepanel-target"
			showSelectionPanel
			shellMode="full-shell"
			sidebarState="hidden"
		/>
	),
}

export const FullAppShellEmptyPanel: Story = {
	render: () => <ShellCanvas showSelectionPanel shellMode="full-shell" />,
}

export const FullAppShellOffline: Story = {
	render: () => <ShellCanvas shellMode="full-shell" />,
	parameters: {
		docs: {
			description: {
				story:
					"Shared-shell proof state for an empty/offline-adjacent canvas. Use alongside the desktop Folio seam tab for runtime wiring validation.",
			},
		},
	},
}

export const FullAppShellFolioSeam: Story = {
	render: () => <ShellCanvas shellMode="full-shell" previewMode="plugin-seam" />,
	parameters: {
		docs: {
			description: {
				story:
					"Desktop-faithful Folio seam proof: host actions are disabled, session/project data is placeholder-only, and the right pane frames projected plugin-owned surfaces rather than live host behavior.",
			},
		},
	},
}
