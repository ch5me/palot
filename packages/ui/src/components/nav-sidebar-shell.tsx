import { Button } from "@ch5me/elf-ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ch5me/elf-ui/components/collapsible"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@ch5me/elf-ui/components/context-menu"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
} from "@ch5me/elf-ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { DiscreteTab, DiscreteTabs } from "@ch5me/ch5-ui-web/animate/discrete-tabs"
import { cn } from "@ch5me/elf-ui/lib/utils"
import {
	BlocksIcon,
	CommandIcon,
	PanelLeftIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	XIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

export type NavSidebarTabId = "built-in" | "built-in-duplicate"
export type NavSidebarSectionId = "active" | "pinned" | "recent" | "pm" | "projects"
export type NavSidebarAgentStatus = "running" | "waiting" | "degraded" | "idle"

export interface NavSidebarAgent {
	id: string
	name: string
	status: NavSidebarAgentStatus
	project: string
	projectSlug: string
	sessionId: string
	agentType?: string
	modelID?: string
}

export interface NavSidebarProject {
	id: string
	name: string
	slug: string
	directory?: string
	agents: NavSidebarAgent[]
	hasMore?: boolean
}

export interface NavSidebarShellTab {
	id: NavSidebarTabId
	label: string
	icon: typeof BlocksIcon
}

export interface NavSidebarServerSummary {
	label: string
	connected: boolean
}

export interface AppShellChromeBadge {
	label: string
}

export interface AppShellChromeActionSlot {
	control: React.ReactNode
	tooltip?: React.ReactNode
}

export interface AppShellChromeProps {
	title?: React.ReactNode
	badges?: AppShellChromeBadge[]
	windowControlsInset?: number
	onToggleSidebar?: () => void
	onNewSession?: () => void
	leftAdornment?: React.ReactNode
	rightContent?: React.ReactNode
	backgroundMode?: "transparent" | "shell"
	showSidebarToggle?: boolean
	showNewSession?: boolean
	toggleSidebarAction?: AppShellChromeActionSlot
	newSessionAction?: AppShellChromeActionSlot
}

export interface AppSidebarShellFrameProps {
	appBar: React.ReactNode
	sidebar: React.ReactNode
	content: React.ReactNode
	sidebarHeader?: React.ReactNode
	sidebarFooter?: React.ReactNode
	height?: string | number
	className?: string
	contentClassName?: string
	shellClassName?: string
	showSidebarRail?: boolean
	sidebarClassName?: string
	sidebarStyle?: React.CSSProperties
	sidebarVisible?: boolean
}

export interface NavSidebarShellProps {
	tabs: NavSidebarShellTab[]
	activeTab: NavSidebarTabId
	onTabChange: (value: NavSidebarTabId) => void
	serverConnected: boolean
	hasContent: boolean
	newSessionLabel?: string
	projectManagerLabel?: string
	automationsLabel?: string
	showAutomations?: boolean
	activeSessions?: NavSidebarAgent[]
	pinnedSessions?: NavSidebarAgent[]
	recentSessions?: NavSidebarAgent[]
	pmSessions?: NavSidebarAgent[]
	projects?: NavSidebarProject[]
	sectionsOpen: Record<NavSidebarSectionId, boolean>
	onSectionOpenChange: (section: NavSidebarSectionId, open: boolean) => void
	onNewSession?: () => void
	onProjectManager?: () => void
	onAutomations?: () => void
	onOpenCommandPalette?: () => void
	onAddProject?: () => void
	onSessionSelect?: (agent: NavSidebarAgent) => void
	onSessionRename?: (agent: NavSidebarAgent) => void
	onSessionDelete?: (agent: NavSidebarAgent) => void
	onTogglePinnedSession?: (agent: NavSidebarAgent, pinned: boolean) => void
	onForkSession?: (agent: NavSidebarAgent) => void
	onProjectSelect?: (project: NavSidebarProject) => void
	onProjectLoadMore?: (project: NavSidebarProject) => void
	onSettings?: () => void
	projectSearchPlaceholder?: string
	selectedSessionId?: string | null
	serverSummary?: NavSidebarServerSummary
	rightPane?: React.ReactNode
	renderProjectSession?: (agent: NavSidebarAgent) => NavSidebarAgent
	emptyState?: React.ReactNode
}

const STATUS_ICON: Record<NavSidebarAgentStatus, typeof BlocksIcon> = {
	running: BlocksIcon,
	waiting: BlocksIcon,
	degraded: BlocksIcon,
	idle: BlocksIcon,
}

const STATUS_COLOR: Record<NavSidebarAgentStatus, string> = {
	running: "text-green-500",
	waiting: "text-yellow-500",
	degraded: "text-red-500",
	idle: "text-muted-foreground",
}

function DefaultWordmark() {
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

export function AppShellChrome({
	title,
	badges = [],
	windowControlsInset = 12,
	onToggleSidebar,
	onNewSession,
	leftAdornment,
	rightContent,
	backgroundMode = "shell",
	showSidebarToggle = true,
	showNewSession = true,
	toggleSidebarAction,
	newSessionAction,
}: AppShellChromeProps) {
	return (
		<div
			className="relative z-30 flex shrink-0 items-center border-b border-border/50 pl-4 pr-3"
			style={{
				height: 46,
				background:
					backgroundMode === "shell"
						? "color-mix(in srgb, var(--background) 88%, var(--card))"
						: "transparent",
			}}
		>
			<div className="mr-3 flex shrink-0 items-center gap-1.5" style={{ marginLeft: windowControlsInset }}>
				{leftAdornment ?? <DefaultWordmark />}
				{showSidebarToggle
					? (toggleSidebarAction?.control ?? (
						<Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onToggleSidebar}>
							<PanelLeftIcon className="size-3.5" />
						</Button>
					))
					: null}
				{showNewSession
					? (newSessionAction?.control ?? (
						<Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onNewSession}>
							<PlusIcon className="size-3.5" />
						</Button>
					))
					: null}
			</div>
			<div className="relative flex h-full min-w-0 flex-1 items-center justify-between gap-4">
				<div className="min-w-0">{typeof title === "string" ? <p className="truncate text-sm font-medium">{title}</p> : title}</div>
				{rightContent ?? (badges.length > 0 ? (
					<div className="hidden items-center gap-2 md:flex">
						{badges.map((badge) => (
							<div key={badge.label} className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
								{badge.label}
							</div>
						))}
					</div>
				) : null)}
			</div>
		</div>
	)
}

export function AppSidebarShellFrame({
	appBar,
	sidebar,
	content,
	sidebarHeader,
	sidebarFooter,
	height = "100vh",
	className,
	contentClassName,
	shellClassName,
	showSidebarRail = true,
	sidebarClassName,
	sidebarStyle,
	sidebarVisible = true,
}: AppSidebarShellFrameProps) {

	return (
		<SidebarProvider defaultOpen embedded>
			<div
				className={cn("grid overflow-hidden", className)}
				style={{
					gridTemplateRows: "46px 1fr",
					height,
				}}
			>
				{appBar}
				<div className={cn("flex min-h-0 min-w-0 overflow-hidden", shellClassName)}>
					{sidebarVisible ? (
						<Sidebar
							className={cn("border-r border-sidebar-border/20 bg-sidebar/80 backdrop-blur-sm", sidebarClassName)}
							collapsible="icon"
							style={sidebarStyle}
						>
							{sidebarHeader ?? (
								<div
									className="flex shrink-0 items-center gap-1"
									style={{
										height: 46,
										background: "color-mix(in srgb, var(--sidebar) 82%, transparent)",
									}}
								/>
							)}
							<div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
							{sidebarFooter}
							{showSidebarRail ? <SidebarRail /> : null}
						</Sidebar>
					) : null}
					<div className={cn("flex min-w-0 flex-1 flex-col bg-background/80", contentClassName)}>{content}</div>
				</div>

			</div>
		</SidebarProvider>
	)
}

function renderAgentMeta(agent: NavSidebarAgent): string | undefined {
	const parts = [agent.agentType, agent.modelID].filter(Boolean)
	return parts.length > 0 ? parts.join(" · ") : undefined
}

function SessionSection({
	id,
	label,
	open,
	onOpenChange,
	children,
}: {
	id: NavSidebarSectionId
	label: string
	open: boolean
	onOpenChange: (section: NavSidebarSectionId, open: boolean) => void
	children: React.ReactNode
}) {
	return (
		<SidebarGroup>
			<Collapsible open={open} onOpenChange={(nextOpen) => onOpenChange(id, nextOpen)}>
				<CollapsibleTrigger className="flex w-full items-center gap-1.5 px-2 text-left outline-hidden">
					<SearchIcon className="size-3 shrink-0 text-muted-foreground" />
					<SidebarGroupLabel className="h-8 min-w-0 p-0">{label}</SidebarGroupLabel>
				</CollapsibleTrigger>
				<CollapsibleContent keepMounted className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
					<SidebarGroupContent>{children}</SidebarGroupContent>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	)
}

function SessionItem({
	agent,
	isPinned,
	isSelected = false,
	onSelect,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
	showProject = false,
	compact = false,
}: {
	agent: NavSidebarAgent
	isPinned: boolean
	isSelected?: boolean
	onSelect?: (agent: NavSidebarAgent) => void
	onRename?: (agent: NavSidebarAgent) => void
	onDelete?: (agent: NavSidebarAgent) => void
	onTogglePinned?: (agent: NavSidebarAgent, pinned: boolean) => void
	onFork?: (agent: NavSidebarAgent) => void
	showProject?: boolean
	compact?: boolean
}) {
	const title = isPinned ? `${agent.name} (Pinned)` : agent.name
	const StatusIcon = STATUS_ICON[agent.status]
	const statusColor = STATUS_COLOR[agent.status]
	const meta = renderAgentMeta(agent)
	const tooltipLabel = showProject ? agent.project : agent.name

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip={tooltipLabel}
							size={compact ? "sm" : "default"}
							onClick={() => onSelect?.(agent)}
							className={cn(isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : undefined)}
						>
							<StatusIcon className={`shrink-0 ${statusColor}`} />
							<div className="min-w-0 flex-1">
								<span className={`block truncate leading-tight ${compact ? "text-xs" : "text-[13px]"}`}>{title}</span>
								{meta ? <span className="block truncate text-[11px] leading-tight text-muted-foreground/70">{meta}</span> : null}
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				}
			/>
			<ContextMenuContent>
				{onRename ? <ContextMenuItem onClick={() => onRename(agent)}>Rename</ContextMenuItem> : null}
				{onTogglePinned ? <ContextMenuItem onClick={() => onTogglePinned(agent, !isPinned)}>{isPinned ? "Unpin" : "Pin"}</ContextMenuItem> : null}
				{onFork ? <ContextMenuItem onClick={() => onFork(agent)}>Fork</ContextMenuItem> : null}
				{(onRename || onTogglePinned || onFork) && onDelete ? <ContextMenuSeparator /> : null}
				{onDelete ? <ContextMenuItem variant="destructive" onClick={() => onDelete(agent)}>Delete</ContextMenuItem> : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}

function ProjectFolder({
	project,
	onProjectSelect,
	onProjectLoadMore,
	onSessionSelect,
	onSessionRename,
	onSessionDelete,
	onTogglePinnedSession,
	onForkSession,
	pinnedSessionIds,
	selectedSessionId,
	renderProjectSession,
}: {
	project: NavSidebarProject
	onProjectSelect?: (project: NavSidebarProject) => void
	onProjectLoadMore?: (project: NavSidebarProject) => void
	onSessionSelect?: (agent: NavSidebarAgent) => void
	onSessionRename?: (agent: NavSidebarAgent) => void
	onSessionDelete?: (agent: NavSidebarAgent) => void
	onTogglePinnedSession?: (agent: NavSidebarAgent, pinned: boolean) => void
	onForkSession?: (agent: NavSidebarAgent) => void
	pinnedSessionIds: Set<string>
	selectedSessionId?: string | null
	renderProjectSession?: (agent: NavSidebarAgent) => NavSidebarAgent
}) {
	const [expanded, setExpanded] = useState(false)

	return (
		<SidebarMenuItem>
			<Collapsible open={expanded} onOpenChange={setExpanded}>
				<SidebarMenuButton
					tooltip={project.name}
					onClick={() => {
						setExpanded(!expanded)
						onProjectSelect?.(project)
					}}
				>
					<SearchIcon className="size-3 shrink-0 text-muted-foreground" />
					<span className="truncate font-medium">{project.name}</span>
				</SidebarMenuButton>
				<CollapsibleContent keepMounted className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
					<div className="ml-3 border-l border-sidebar-border/5 pl-1">
						<SidebarMenu>
							{project.agents.map((agent) => {
								const resolvedAgent = renderProjectSession?.(agent) ?? agent
								return (
									<SessionItem
										key={resolvedAgent.id}
										agent={resolvedAgent}
										isPinned={pinnedSessionIds.has(resolvedAgent.sessionId)}
										isSelected={selectedSessionId === resolvedAgent.id}
										onSelect={onSessionSelect}
										onRename={onSessionRename}
										onDelete={onSessionDelete}
										onTogglePinned={onTogglePinnedSession}
										onFork={onForkSession}
										compact
									/>
								)
							})}
							{project.hasMore ? (
								<button
									type="button"
									onClick={() => onProjectLoadMore?.(project)}
									className="w-full cursor-pointer px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
								>
									Load more sessions
								</button>
							) : null}
						</SidebarMenu>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	)
}

function ServerSummaryItem({ serverSummary }: { serverSummary: NavSidebarServerSummary }) {
	return (
		<SidebarMenuItem>
			<Tooltip>
				<TooltipTrigger render={<SidebarMenuButton />}>
					<div className="relative">
						<SettingsIcon aria-hidden="true" className="size-4" />
						<span
							className={`absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-sidebar-background ${
								serverSummary.connected ? "bg-green-500" : "bg-red-500"
							}`}
						/>
					</div>
					<span className="truncate">{serverSummary.label}</span>
				</TooltipTrigger>
				<TooltipContent side="top">{serverSummary.connected ? "Server online" : "Server offline"}</TooltipContent>
			</Tooltip>
		</SidebarMenuItem>
	)
}

function NavSidebarShellBody({
	serverConnected,
	hasContent,
	newSessionLabel = "New Session",
	projectManagerLabel = "Project Manager",
	automationsLabel = "Automations",
	showAutomations = false,
	activeSessions = [],
	pinnedSessions = [],
	recentSessions = [],
	pmSessions = [],
	projects = [],
	sectionsOpen,
	onSectionOpenChange,
	onNewSession,
	onProjectManager,
	onAutomations,
	onOpenCommandPalette,
	onAddProject,
	onSessionSelect,
	onSessionRename,
	onSessionDelete,
	onTogglePinnedSession,
	onForkSession,
	onProjectSelect,
	onProjectLoadMore,
	onSettings,
	projectSearchPlaceholder = "Filter projects...",
	selectedSessionId,
	serverSummary,
	renderProjectSession,
	emptyState,
}: Omit<NavSidebarShellProps, "tabs" | "activeTab" | "onTabChange" | "rightPane">) {
	const [projectSearch, setProjectSearch] = useState("")
	const [projectSearchActive, setProjectSearchActive] = useState(false)
	const projectSearchRef = useRef<HTMLInputElement>(null)

	const filteredProjects = useMemo(() => {
		if (!projectSearch.trim()) return projects
		const q = projectSearch.toLowerCase()
		return projects.filter(
			(project) =>
				project.name.toLowerCase().includes(q) || project.directory?.toLowerCase().includes(q),
		)
	}, [projectSearch, projects])

	const pinnedSessionIds = useMemo(
		() => new Set(pinnedSessions.map((agent) => agent.sessionId)),
		[pinnedSessions],
	)

	useEffect(() => {
		if (projectSearchActive && projectSearchRef.current) {
			projectSearchRef.current.focus()
		}
	}, [projectSearchActive])

	return (
		<>
			<SidebarContent>
				{!hasContent ? (
					emptyState ?? (
						<div className="flex flex-1 items-center justify-center p-4">
							<div className="space-y-2 text-center">
								{!serverConnected ? (
									<>
										<p className="text-sm text-muted-foreground">Server offline</p>
										<p className="text-xs text-muted-foreground/60">Check your connection in Settings</p>
									</>
								) : (
									<>
										<p className="text-sm text-muted-foreground">No projects yet</p>
										<p className="text-xs text-muted-foreground/60">Add a project to get started</p>
									</>
								)}
							</div>
						</div>
					)
				) : null}

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton tooltip={newSessionLabel} onClick={onNewSession} className="text-muted-foreground">
									<PlusIcon className="size-4" />
									<span>{newSessionLabel}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton tooltip={projectManagerLabel} onClick={onProjectManager} className="text-muted-foreground">
									<BlocksIcon className="size-4" />
									<span>{projectManagerLabel}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							{showAutomations ? (
								<SidebarMenuItem>
									<SidebarMenuButton tooltip={automationsLabel} onClick={onAutomations} className="text-muted-foreground">
										<BlocksIcon className="size-4" />
										<span>{automationsLabel}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{activeSessions.length > 0 ? (
					<SessionSection id="active" label="Active Now" open={sectionsOpen.active} onOpenChange={onSectionOpenChange}>
						<SidebarMenu>
							{activeSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isPinned={pinnedSessionIds.has(agent.sessionId)}
									isSelected={selectedSessionId === agent.id}
									onSelect={onSessionSelect}
									onRename={onSessionRename}
									onDelete={onSessionDelete}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{pinnedSessions.length > 0 ? (
					<SessionSection id="pinned" label="Pinned" open={sectionsOpen.pinned} onOpenChange={onSectionOpenChange}>
						<SidebarMenu>
							{pinnedSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isPinned
									isSelected={selectedSessionId === agent.id}
									onSelect={onSessionSelect}
									onRename={onSessionRename}
									onDelete={onSessionDelete}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{recentSessions.length > 0 ? (
					<SessionSection id="recent" label="Recent" open={sectionsOpen.recent} onOpenChange={onSectionOpenChange}>
						<SidebarMenu>
							{recentSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isPinned={pinnedSessionIds.has(agent.sessionId)}
									isSelected={selectedSessionId === agent.id}
									onSelect={onSessionSelect}
									onRename={onSessionRename}
									onDelete={onSessionDelete}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{pmSessions.length > 0 ? (
					<SessionSection id="pm" label="PM Sessions" open={sectionsOpen.pm} onOpenChange={onSectionOpenChange}>
						<SidebarMenu>
							{pmSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isPinned={pinnedSessionIds.has(agent.sessionId)}
									isSelected={selectedSessionId === agent.id}
									onSelect={onSessionSelect}
									onRename={onSessionRename}
									onDelete={onSessionDelete}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{hasContent && (activeSessions.length > 0 || pinnedSessions.length > 0 || recentSessions.length > 0 || pmSessions.length > 0) ? <SidebarSeparator className="bg-sidebar-border/5" /> : null}
				{hasContent ? (
					<SidebarGroup>
						<Collapsible open={sectionsOpen.projects} onOpenChange={(open) => onSectionOpenChange("projects", open)}>
							<div className="flex items-center justify-between gap-2 px-2 pb-1">
								<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-hidden">
									<SearchIcon className="size-3 shrink-0 text-muted-foreground" />
									<SidebarGroupLabel className="h-auto min-w-0 p-0">Projects</SidebarGroupLabel>
								</CollapsibleTrigger>
								<div className="flex shrink-0 items-center gap-0.5">
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														setProjectSearchActive((prev) => {
															if (prev) {
																setProjectSearch("")
															}
															return !prev
														})
													}}
													className={`text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-colors ${projectSearchActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
												/>
											}
										>
											{projectSearchActive ? <XIcon className="size-4 shrink-0" /> : <SearchIcon className="size-4 shrink-0" />}
										</TooltipTrigger>
										<TooltipContent side="bottom">{projectSearchActive ? "Close search" : "Search projects"}</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														onOpenCommandPalette?.()
													}}
													className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 shrink-0 items-center justify-center rounded-md p-0 transition-colors"
												/>
											}
										>
											<CommandIcon className="size-4 shrink-0" />
										</TooltipTrigger>
										<TooltipContent side="bottom">Command palette</TooltipContent>
									</Tooltip>
									{onAddProject ? (
										<Tooltip>
											<TooltipTrigger
												render={
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation()
															onAddProject()
														}}
														className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 shrink-0 items-center justify-center rounded-md p-0 transition-colors"
													/>
												}
											>
												<PlusIcon className="size-4 shrink-0" />
											</TooltipTrigger>
											<TooltipContent side="bottom">Add project</TooltipContent>
										</Tooltip>
									) : null}
								</div>
							</div>
							<CollapsibleContent keepMounted className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
								{projectSearchActive ? (
									<div className="px-2 pb-1">
										<Input ref={projectSearchRef} value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder={projectSearchPlaceholder} className="h-7 text-xs" />
									</div>
								) : null}
								<SidebarGroupContent>
									<SidebarMenu>
										{filteredProjects.map((project) => (
											<ProjectFolder
												key={project.id}
												project={project}
												onProjectSelect={onProjectSelect}
												onProjectLoadMore={onProjectLoadMore}
												onSessionSelect={onSessionSelect}
												onSessionRename={onSessionRename}
												onSessionDelete={onSessionDelete}
												onTogglePinnedSession={onTogglePinnedSession}
												onForkSession={onForkSession}
												pinnedSessionIds={pinnedSessionIds}
												selectedSessionId={selectedSessionId}
												renderProjectSession={renderProjectSession}
											/>
										))}
										{projectSearch && filteredProjects.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground/60">No projects match “{projectSearch}”</p> : null}
									</SidebarMenu>
								</SidebarGroupContent>
							</CollapsibleContent>
						</Collapsible>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarFooter className="space-y-0 p-2">
				{serverSummary ? <ServerSummaryItem serverSummary={serverSummary} /> : null}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Settings" onClick={onSettings} className="text-muted-foreground">
							<SettingsIcon className="size-4" />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</>
	)
}

function NavSidebarShell({
	tabs,
	activeTab,
	onTabChange,
	rightPane,
	...bodyProps
}: NavSidebarShellProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="shrink-0 border-b border-sidebar-border/10 px-2 pb-2 pt-1">
				<DiscreteTabs value={activeTab} onValueChange={(value) => onTabChange(value as NavSidebarTabId)} size="sm">
					{tabs.map((tab) => {
						const Icon = tab.icon
						return (
							<DiscreteTab key={tab.id} value={tab.id} icon={<Icon className="size-3.5 shrink-0" />}>
								{tab.label}
							</DiscreteTab>
						)
					})}
				</DiscreteTabs>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">{rightPane ?? <NavSidebarShellBody {...bodyProps} />}</div>
		</div>
	)
}

export {
	NavSidebarShell,
	NavSidebarShellBody,
	ProjectFolder,
	SessionItem,
	SessionSection,
	STATUS_COLOR,
	STATUS_ICON,
	renderAgentMeta,
}
