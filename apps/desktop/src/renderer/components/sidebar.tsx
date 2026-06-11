import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@ch5me/elf-ui/components/collapsible"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@ch5me/elf-ui/components/context-menu"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@ch5me/elf-ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import {
	AlertCircleIcon,
	BotIcon,
	BlocksIcon,
	ChevronDownIcon,

	ChevronRightIcon,
	CircleDotIcon,
	CommandIcon,
	GitForkIcon,
	Loader2Icon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	TimerIcon,
	TrashIcon,
	XIcon,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { activeServerConfigAtom } from "../atoms/connection"
import { agentFamily, projectSessionIdsFamily, sandboxMappingsAtom } from "../atoms/derived/agents"
import { automationsEnabledAtom } from "../atoms/feature-flags"
import { pinnedSessionsAtom } from "../atoms/preferences"
import {
	isTaggedProjectManagerSession,
	projectManagerSessionTagsAtom,
} from "../atoms/project-manager"
import { projectPaginationFamily } from "../atoms/sessions"
import { sidebarSectionOpenAtom, type SidebarSectionId } from "../atoms/ui"
import { appStore } from "../atoms/store"
import type { Agent, AgentStatus, SidebarProject } from "../lib/types"
import { loadMoreProjectSessions, loadProjectSessions } from "../services/connection-manager"
import { ServerIndicator } from "./server-indicator"

// ============================================================
// Constants
// ============================================================

/** How many recent sessions to show in the top-level "Recent" section */
const RECENT_COUNT = 5

const STATUS_ICON: Record<AgentStatus, typeof Loader2Icon> = {
	running: Loader2Icon,
	waiting: TimerIcon,
	degraded: AlertCircleIcon,
	idle: CircleDotIcon,
}

const STATUS_COLOR: Record<AgentStatus, string> = {
	running: "text-green-500",
	waiting: "text-yellow-500",
	degraded: "text-red-500",
	idle: "text-muted-foreground",
}

function isActiveSurfaceAgent(agent: Agent): boolean {
	return (
		agent.visibilityReason === "visible" &&
		(agent.status !== "idle" || agent.presenceSource !== "none")
	)
}

function getActiveSurfaceRank(agent: Agent): number {
	if (agent.status === "running" || agent.status === "waiting") return 0
	if (agent.status === "degraded") return 1
	if (agent.presenceSource !== "none") return 2
	return 3
}

function renderAgentMeta(agent: Agent): string | undefined {
	const presence =
		agent.presenceSource === "attach"
			? "attached"
			: agent.presenceSource === "inferred"
				? "inferred live"
				: undefined
	const parts = [agent.agentType, agent.modelID, presence].filter(Boolean)
	return parts.length > 0 ? parts.join(" · ") : undefined
}

// ============================================================
// Props
// ============================================================

interface AppSidebarContentProps {
	agents: Agent[]
	projects: SidebarProject[]
	onOpenCommandPalette: () => void
	onAddProject?: () => void
	onRenameSession?: (agent: Agent, title: string) => Promise<void>
	onDeleteSession?: (agent: Agent) => Promise<void>
	onTogglePinnedSession?: (agent: Agent, pinned: boolean) => Promise<void>
	onForkSession?: (agent: Agent) => Promise<void>
	serverConnected: boolean
}

// ============================================================
// Main component
// ============================================================

/**
 * Default sidebar content: Active Now, Recent, Projects groups + Settings footer.
 * Rendered inside the `<Sidebar>` shell provided by `SidebarLayout`.
 */
export function AppSidebarContent({
	agents,
	projects,
	onOpenCommandPalette,
	onAddProject,
	onRenameSession,
	onDeleteSession,
	onTogglePinnedSession,
	onForkSession,
	serverConnected,
}: AppSidebarContentProps) {
	const navigate = useNavigate()
	const routeParams = useParams({ strict: false }) as { sessionId?: string }
	const selectedSessionId = routeParams.sessionId ?? null
	const automationsEnabled = useAtomValue(automationsEnabledAtom)
	const [sidebarSectionsOpen, setSidebarSectionsOpen] = useAtom(sidebarSectionOpenAtom)
	const pinnedSessions = useAtomValue(pinnedSessionsAtom)
	const pmSessionTags = useAtomValue(projectManagerSessionTagsAtom)
	const activeServer = useAtomValue(activeServerConfigAtom)
	const isLocalServer = activeServer.type === "local"

	// --- Project search state ---
	const [projectSearch, setProjectSearch] = useState("")
	const [projectSearchActive, setProjectSearchActive] = useState(false)
	const projectSearchRef = useRef<HTMLInputElement>(null)

	// Filter projects by search query (client-side, case-insensitive)
	const filteredProjects = useMemo(() => {
		if (!projectSearch.trim()) return projects
		const q = projectSearch.toLowerCase()
		return projects.filter(
			(p) => p.name.toLowerCase().includes(q) || p.directory.toLowerCase().includes(q),
		)
	}, [projects, projectSearch])

	const toggleProjectSearch = useCallback(() => {
		setProjectSearchActive((prev) => {
			if (prev) {
				setProjectSearch("")
				return false
			}
			return true
		})
	}, [])

	const isProjectManagerSession = useCallback(
		(agent: Agent) => isTaggedProjectManagerSession(pmSessionTags, agent.id),
		[pmSessionTags],
	)

	// Auto-focus search input when activated
	useEffect(() => {
		if (projectSearchActive && projectSearchRef.current) {
			projectSearchRef.current.focus()
		}
	}, [projectSearchActive])

	// Derive sections — filter out sub-agents (parentId) from sidebar display
	const activeSessions = useMemo(
		() =>
			agents
				.filter((a) => !a.parentId && !isProjectManagerSession(a) && isActiveSurfaceAgent(a))
				.sort((a, b) => {
					const rankDelta = getActiveSurfaceRank(a) - getActiveSurfaceRank(b)
					if (rankDelta !== 0) return rankDelta
					return b.lastActiveAt - a.lastActiveAt
				}),
		[agents, isProjectManagerSession],
	)

	const pinnedIds = useMemo(() => new Set(Object.keys(pinnedSessions)), [pinnedSessions])

	const pinnedSidebarSessions = useMemo(
		() =>
			agents
				.filter((a) => !a.parentId && !isProjectManagerSession(a) && pinnedIds.has(a.sessionId))
				.sort((a, b) => (pinnedSessions[b.sessionId] ?? 0) - (pinnedSessions[a.sessionId] ?? 0)),
		[agents, isProjectManagerSession, pinnedIds, pinnedSessions],
	)

	const activeIds = useMemo(() => new Set(activeSessions.map((a) => a.id)), [activeSessions])

	const recentSessions = useMemo(
		() =>
			agents
				.filter(
					(a) =>
						!a.parentId &&
						!activeIds.has(a.id) &&
						!pinnedIds.has(a.sessionId) &&
						!isProjectManagerSession(a),
				)
				.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
				.slice(0, RECENT_COUNT),
		[agents, activeIds, pinnedIds, isProjectManagerSession],
	)

	const pmSessions = useMemo(
		() =>
			agents
				.filter((a) => !a.parentId && isProjectManagerSession(a))
				.sort((a, b) => b.lastActiveAt - a.lastActiveAt),
		[agents, isProjectManagerSession],
	)

	const hasContent = agents.length > 0 || projects.length > 0
	const showEmptyState = !hasContent

	const setSectionOpen = useCallback(
		(section: SidebarSectionId, open: boolean) => {
			setSidebarSectionsOpen((current) => ({
				...current,
				[section]: open,
			}))
		},
		[setSidebarSectionsOpen],
	)

	return (
		<>
			{/* Scrollable content */}
			<SidebarContent>
				{/* Empty state */}
				{showEmptyState && (
					<div className="flex flex-1 items-center justify-center p-4">
						<div className="space-y-2 text-center">
							{!serverConnected ? (
								<>
									<p className="text-sm text-muted-foreground">Server offline</p>
									<p className="text-xs text-muted-foreground/60">
										Check your connection in Settings
									</p>
								</>
							) : (
								<>
									<p className="text-sm text-muted-foreground">No projects yet</p>
									<p className="text-xs text-muted-foreground/60">Add a project to get started</p>
								</>
							)}
						</div>
					</div>
				)}

			{/* New Session + Automations */}
			<SidebarGroup>
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="New Session"
								onClick={() => navigate({ to: "/" })}
								className="text-muted-foreground"
							>
								<PlusIcon className="size-4" />
								<span>New Session</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Project Manager"
									onClick={() => navigate({ to: "/project-manager" })}
									className="text-muted-foreground"
								>
									<BlocksIcon className="size-4" />
									<span>Project Manager</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						{automationsEnabled && isLocalServer && (
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip="Automations"
									onClick={() => navigate({ to: "/automations" })}
									className="text-muted-foreground"
								>
									<BotIcon className="size-4" />
									<span>Automations</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

					{/* Active Now */}
				{activeSessions.length > 0 && (
					<SessionSection
						id="active"
						label={`Active Now (${activeSessions.length})`}
						open={sidebarSectionsOpen.active}
						onOpenChange={setSectionOpen}
					>
						<SidebarMenu>
							{activeSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isSelected={agent.id === selectedSessionId}
									onRename={onRenameSession}
									onDelete={onDeleteSession}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				)}

				{pinnedSidebarSessions.length > 0 && (
					<SessionSection
						id="pinned"
						label="Pinned"
						open={sidebarSectionsOpen.pinned}
						onOpenChange={setSectionOpen}
					>
						<SidebarMenu>
							{pinnedSidebarSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isSelected={agent.id === selectedSessionId}
									onRename={onRenameSession}
									onDelete={onDeleteSession}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				)}

				{/* Recent */}
				{recentSessions.length > 0 && (
					<SessionSection
						id="recent"
						label="Recent"
						open={sidebarSectionsOpen.recent}
						onOpenChange={setSectionOpen}
					>
						<SidebarMenu>
							{recentSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isSelected={agent.id === selectedSessionId}
									onRename={onRenameSession}
									onDelete={onDeleteSession}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				)}

				{pmSessions.length > 0 && (
					<SessionSection
						id="pm"
						label="PM Sessions"
						open={sidebarSectionsOpen.pm}
						onOpenChange={setSectionOpen}
					>
						<SidebarMenu>
							{pmSessions.map((agent) => (
								<SessionItem
									key={agent.id}
									agent={agent}
									isSelected={agent.id === selectedSessionId}
									onRename={onRenameSession}
									onDelete={onDeleteSession}
									onTogglePinned={onTogglePinnedSession}
									onFork={onForkSession}
									showProject
								/>
							))}
						</SidebarMenu>
					</SessionSection>
				)}

				{/* Projects */}
				{hasContent &&
					(activeSessions.length > 0 ||
						pinnedSidebarSessions.length > 0 ||
						recentSessions.length > 0 ||
						pmSessions.length > 0) && <SidebarSeparator className="bg-sidebar-border/5" />}
				{hasContent && (
					<SidebarGroup>
						<Collapsible
							open={sidebarSectionsOpen.projects}
							onOpenChange={(open) => setSectionOpen("projects", open)}
						>
							<div className="flex w-full items-center justify-between gap-2 px-2 pb-1">
								<CollapsibleTrigger className="group flex w-full min-w-0 flex-1 items-center gap-2 text-left outline-hidden">
									<SidebarGroupLabel className="h-auto min-w-0 flex-1 p-0">Projects</SidebarGroupLabel>
									<ChevronRightIcon
										className="size-3 shrink-0 text-muted-foreground opacity-0 transition-[transform,opacity] duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
										style={{
											transform: sidebarSectionsOpen.projects ? "rotate(90deg)" : "rotate(0deg)",
										}}
									/>
								</CollapsibleTrigger>
								<div className="flex shrink-0 items-center gap-0.5">
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														toggleProjectSearch()
													}}
													className={`text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-colors ${
														projectSearchActive
															? "bg-sidebar-accent text-sidebar-accent-foreground"
															: ""
													}`}
												/>
										}
										>
											{projectSearchActive ? (
												<XIcon className="size-4 shrink-0" />
											) : (
												<SearchIcon className="size-4 shrink-0" />
											)}
											<span className="sr-only">Search projects</span>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											{projectSearchActive ? "Close search" : "Search projects"}
										</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger
											render={
												<button
													type="button"
													onClick={(event) => {
														event.stopPropagation()
														onOpenCommandPalette()
													}}
													className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 shrink-0 items-center justify-center rounded-md p-0 transition-colors"
												/>
										}
										>
											<CommandIcon className="size-4 shrink-0" />
											<span className="sr-only">Command palette</span>
										</TooltipTrigger>
										<TooltipContent side="bottom">Command palette (&#8984;K)</TooltipContent>
									</Tooltip>
									{onAddProject && (
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
												<span className="sr-only">Add Project</span>
											</TooltipTrigger>
											<TooltipContent side="bottom">Add project</TooltipContent>
										</Tooltip>
									)}
								</div>
							</div>

							<CollapsibleContent
								keepMounted
								className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
							>
								{projectSearchActive && (
									<div className="px-2 pb-1">
										<Input
											ref={projectSearchRef}
											value={projectSearch}
											onChange={(e) => setProjectSearch(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Escape") {
													toggleProjectSearch()
												}
											}}
											placeholder="Filter projects..."
											className="h-7 text-xs"
										/>
									</div>
								)}

								<SidebarGroupContent>
									<SidebarMenu>
										{filteredProjects.map((project) => (
											<ProjectFolder
												key={project.id}
												project={project}
												selectedSessionId={selectedSessionId}
												onRename={onRenameSession}
												onDelete={onDeleteSession}
												onTogglePinned={onTogglePinnedSession}
												onFork={onForkSession}
											/>
										))}
										{projectSearch && filteredProjects.length === 0 && (
											<p className="px-2 py-1.5 text-xs text-muted-foreground/60">
												No projects match &ldquo;{projectSearch}&rdquo;
											</p>
										)}
									</SidebarMenu>
								</SidebarGroupContent>
							</CollapsibleContent>
						</Collapsible>
					</SidebarGroup>

				)}
			</SidebarContent>
			<SidebarFooter className="space-y-0 border-t border-sidebar-border/10 bg-sidebar/95 p-2 shadow-[0_-10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-sidebar/85">
				<ServerIndicator />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip="Settings"
							onClick={() => navigate({ to: "/settings" })}
							className="text-muted-foreground"
						>
							<SettingsIcon className="size-4" />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</>
	)
}

// ============================================================
// Sub-components
// ============================================================

/**
 * Wrapper that subscribes to a single agent via agentFamily and renders
 * a SessionItem. Used by ProjectFolder so each item only re-renders
 * when its own agent changes, not when any agent in the project changes.
 */
const ProjectSessionItem = memo(function ProjectSessionItem({
	sessionId,
	selectedSessionId,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
}: {
	sessionId: string
	selectedSessionId: string | null
	onRename?: (agent: Agent, title: string) => Promise<void>
	onDelete?: (agent: Agent) => Promise<void>
	onTogglePinned?: (agent: Agent, pinned: boolean) => Promise<void>
	onFork?: (agent: Agent) => Promise<void>
}) {
	const agent = useAtomValue(agentFamily(sessionId))
	if (!agent) return null
	return (
		<SessionItem
			agent={agent}
			isSelected={agent.id === selectedSessionId}
			onRename={onRename}
			onDelete={onDelete}
			onTogglePinned={onTogglePinned}
			onFork={onFork}
			compact
		/>
	)
})

const SessionSection = memo(function SessionSection({
	id,
	label,
	open,
	onOpenChange,
	children,
}: {
	id: SidebarSectionId
	label: string
	open: boolean
	onOpenChange: (section: SidebarSectionId, open: boolean) => void
	children: React.ReactNode
}) {
	return (
		<SidebarGroup>
			<Collapsible open={open} onOpenChange={(nextOpen) => onOpenChange(id, nextOpen)}>
				<CollapsibleTrigger className="group flex w-full items-center gap-2 px-2 text-left outline-hidden">
					<SidebarGroupLabel className="h-8 min-w-0 flex-1 p-0">{label}</SidebarGroupLabel>
					<ChevronRightIcon
						className="size-3 shrink-0 text-muted-foreground opacity-0 transition-[transform,opacity] duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
						style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent
					keepMounted
					className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
				>
					<SidebarGroupContent>{children}</SidebarGroupContent>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	)
})

/**
 * A project folder in the sidebar that lists its sessions as a flat list.
 * Sessions are loaded lazily on first expand from the server.
 * Shows a "Load more" button that fetches additional sessions.
 */
const ProjectFolder = memo(function ProjectFolder({
	project,
	selectedSessionId,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
}: {
	project: SidebarProject
	selectedSessionId: string | null
	onRename?: (agent: Agent, title: string) => Promise<void>
	onDelete?: (agent: Agent) => Promise<void>
	onTogglePinned?: (agent: Agent, pinned: boolean) => Promise<void>
	onFork?: (agent: Agent) => Promise<void>
}) {
	const navigate = useNavigate()
	const [expanded, setExpanded] = useState(false)

	// Subscribe to just this project's session IDs
	const sessionIds = useAtomValue(projectSessionIdsFamily(project.directory))

	// Per-project pagination state from the server
	const pagination = useAtomValue(projectPaginationFamily(project.directory))

	// Load sessions on first expand
	useEffect(() => {
		if (!expanded || pagination.loaded || pagination.loading) return

		// Look up sandbox dirs for this project from the discovery data
		const { parentToSandboxes } = appStore.get(sandboxMappingsAtom)
		const sandboxDirs = parentToSandboxes.get(project.directory)

		loadProjectSessions(project.directory, sandboxDirs?.size ? sandboxDirs : undefined, {
			limit: 5,
			roots: true,
		})
	}, [expanded, pagination.loaded, pagination.loading, project.directory])

	// Read agents non-reactively (via appStore.get) for sorting.
	// Individual items render reactively via ProjectSessionItem -> agentFamily.
	const projectSessions = useMemo(() => {
		const agents: Agent[] = []
		for (const id of sessionIds) {
			const agent = appStore.get(agentFamily(id))
			if (agent) agents.push(agent)
		}
		return agents.sort((a, b) => {
			const aActive = isActiveSurfaceAgent(a)
			const bActive = isActiveSurfaceAgent(b)
			if (aActive !== bActive) return aActive ? -1 : 1
			const rankDelta = getActiveSurfaceRank(a) - getActiveSurfaceRank(b)
			if (rankDelta !== 0) return rankDelta
			// Within same group, sort by lastActiveAt (matches server's time_updated DESC)
			return b.lastActiveAt - a.lastActiveAt
		})
	}, [sessionIds])

	const handleLoadMore = useCallback(() => {
		loadMoreProjectSessions(project.directory, pagination.currentLimit)
	}, [project.directory, pagination.currentLimit])

	// Show loading state when initial fetch or load-more is in progress
	const isInitialLoading = expanded && !pagination.loaded && !pagination.loading
	const isLoading = pagination.loading || isInitialLoading

	return (
		<SidebarMenuItem>
			<Collapsible open={expanded} onOpenChange={setExpanded}>
				<SidebarMenuButton
					tooltip={project.name}
					onClick={() => {
						setExpanded(!expanded)
						navigate({
							to: "/project/$projectSlug",
							params: { projectSlug: project.slug },
						})
					}}
				>
					<ChevronRightIcon
						className="size-3 shrink-0 text-muted-foreground transition-transform duration-150 ease-out"
						style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
					/>
					<span className="truncate font-medium">{project.name}</span>
				</SidebarMenuButton>

				<CollapsibleContent
					keepMounted
					className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden"
				>
					<div className="ml-3 border-l border-sidebar-border/5 pl-1">
						{isLoading && projectSessions.length === 0 ? (
							<p className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground/60">
								<Loader2Icon className="size-3 animate-spin" />
								Loading sessions...
							</p>
						) : pagination.loaded && projectSessions.length === 0 ? (
							<p className="px-2 py-1.5 text-xs text-muted-foreground/60">No sessions yet</p>
						) : (
							<SidebarMenu>
							{projectSessions.map((agent) => (
								<ProjectSessionItem
									key={agent.id}
									sessionId={agent.id}
									selectedSessionId={selectedSessionId}
									onRename={onRename}
									onDelete={onDelete}
									onTogglePinned={onTogglePinned}
									onFork={onFork}
								/>
							))}
								{pagination.loaded && pagination.hasMore && (
									<button
										type="button"
										onClick={handleLoadMore}
										disabled={pagination.loading}
										className="w-full cursor-pointer px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-50"
									>
										{pagination.loading ? (
											<span className="flex items-center gap-1">
												<Loader2Icon className="size-3 animate-spin" />
												Loading...
											</span>
										) : (
											<span className="flex items-center gap-1">
												<ChevronDownIcon className="size-3" />
												Load more sessions
											</span>
										)}
									</button>
								)}
							</SidebarMenu>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	)
})

// ============================================================
// Session item
// ============================================================

/**
 * Hook that returns a live-updating relative "last active" time string.
 * For active (running/waiting) sessions, ticks every minute.
 * For idle/completed sessions, returns the static duration from the agent atom.
 */
function useLiveLastActive(agent: Agent): string {
	const isActive = agent.status === "running" || agent.status === "waiting"

	const [display, setDisplay] = useState(agent.duration)

	useEffect(() => {
		if (!isActive) {
			setDisplay(agent.duration)
			return
		}

		// Active sessions: show "now" and tick every 60s to stay fresh
		setDisplay("now")
		const id = setInterval(() => setDisplay("now"), 60_000)
		return () => clearInterval(id)
	}, [isActive, agent.duration])

	return display
}

const SessionItem = memo(function SessionItem({
	agent,
	isSelected,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
	showProject = false,
	compact = false,
}: {
	agent: Agent
	isSelected: boolean
	onRename?: (agent: Agent, title: string) => Promise<void>
	onDelete?: (agent: Agent) => Promise<void>
	onTogglePinned?: (agent: Agent, pinned: boolean) => Promise<void>
	onFork?: (agent: Agent) => Promise<void>
	showProject?: boolean
	compact?: boolean
}) {
	const navigate = useNavigate()
	const [, startTransition] = useTransition()
	const StatusIcon = STATUS_ICON[agent.status]
	const statusColor = STATUS_COLOR[agent.status]
	const isWorktree = !!agent.worktreePath
	const lastActive = useLiveLastActive(agent)
	const showSpinner = agent.status === "running"
	const showLivePresencePulse = agent.presenceSource !== "none" && agent.status === "idle"
	const livePresenceColor = agent.presenceSource === "inferred" ? "text-cyan-500" : "text-green-500"
	const pinnedSessions = useAtomValue(pinnedSessionsAtom)
	const meta = renderAgentMeta(agent)
	const isPinned = agent.sessionId in pinnedSessions

	const [isEditing, setIsEditing] = useState(false)
	const [editValue, setEditValue] = useState(agent.name)
	const inputRef = useRef<HTMLInputElement>(null)

	const onSelect = useCallback(() => {
		startTransition(() => {
			navigate({
				to: "/project/$projectSlug/session/$sessionId",
				params: { projectSlug: agent.projectSlug, sessionId: agent.id },
			})
		})
	}, [navigate, agent.projectSlug, agent.id])

	const startEditing = useCallback(() => {
		setEditValue(agent.name)
		setIsEditing(true)
	}, [agent.name])

	const confirmRename = useCallback(async () => {
		const trimmed = editValue.trim()
		setIsEditing(false)
		if (trimmed && trimmed !== agent.name && onRename) {
			await onRename(agent, trimmed)
		}
	}, [editValue, agent, onRename])

	const cancelEditing = useCallback(() => {
		setIsEditing(false)
		setEditValue(agent.name)
	}, [agent.name])

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const tooltipLabel = showProject ? agent.project : agent.name
	const title = isPinned ? `${agent.name} (Pinned)` : agent.name
	const showDebug = import.meta.env.DEV
	const visibilityReason = agent.visibilityReason ?? "visible"
	const driftFlags = Array.isArray(agent.driftFlags) ? agent.driftFlags : []
	const debugLabel =
		visibilityReason === "visible" && driftFlags.length === 0
			? undefined
			: [visibilityReason, ...driftFlags].join(" · ")

	const btn = (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={isSelected}
				tooltip={tooltipLabel}
				size={compact ? "sm" : "default"}
				onClick={isEditing ? undefined : onSelect}
			>
					{isWorktree ? (
							<GitForkIcon
								className={`shrink-0 ${showLivePresencePulse ? livePresenceColor : statusColor} ${showSpinner ? "animate-spin" : showLivePresencePulse ? "animate-pulse" : ""}`}
							/>
						) : (
						<StatusIcon
							className={`shrink-0 ${showLivePresencePulse ? livePresenceColor : statusColor} ${showSpinner ? "animate-spin" : showLivePresencePulse ? "animate-pulse" : ""}`}
						/>
					)}

				{isEditing ? (
					<Input
						ref={inputRef}
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={(e) => {
							e.stopPropagation()
							if (e.key === "Enter") confirmRename()
							if (e.key === "Escape") cancelEditing()
						}}
						onBlur={confirmRename}
						onClick={(e) => e.stopPropagation()}
						className={`h-auto min-w-0 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 ${compact ? "text-xs" : "text-[13px]"}`}
					/>
				) : (
					<div className="min-w-0 flex-1">
						<span className={`block truncate leading-tight ${compact ? "text-xs" : "text-[13px]"}`}>
							{title}
						</span>

				{agent.status === "waiting" && agent.currentActivity ? (
					<span className="block truncate text-[11px] leading-tight text-yellow-500">
						{agent.currentActivity}
					</span>
				) : meta ? (
					<span className="block truncate text-[11px] leading-tight text-muted-foreground/70">
						{meta}
					</span>
				) : null}
				{showDebug && debugLabel ? (
					<span className="block truncate text-[10px] leading-tight text-red-400/80">
						{debugLabel}
					</span>
				) : null}

					</div>
				)}

				{!isEditing && (
					<span className="shrink-0 text-xs tabular-nums text-muted-foreground">{lastActive}</span>
				)}
			</SidebarMenuButton>
		</SidebarMenuItem>
	)

	return (
		<ContextMenu>
			<ContextMenuTrigger render={btn} />
			<ContextMenuContent>
				{onRename && (
					<ContextMenuItem onClick={startEditing}>
						<PencilIcon className="size-4" />
						Rename
					</ContextMenuItem>
				)}
				{onTogglePinned && (
					<ContextMenuItem onClick={() => onTogglePinned(agent, !isPinned)}>
						{isPinned ? <PinOffIcon className="size-4" /> : <PinIcon className="size-4" />}
						{isPinned ? "Unpin" : "Pin"}
					</ContextMenuItem>
				)}
				{onFork && (
					<ContextMenuItem onClick={() => onFork(agent)}>
						<GitForkIcon className="size-4" />
						Fork
					</ContextMenuItem>
				)}
				{(onRename || onTogglePinned || onFork) && onDelete && <ContextMenuSeparator />}
				{onDelete && (
					<ContextMenuItem variant="destructive" onClick={() => onDelete(agent)}>
						<TrashIcon className="size-4" />
						Delete
					</ContextMenuItem>
				)}
			</ContextMenuContent>
		</ContextMenu>
	)
})
