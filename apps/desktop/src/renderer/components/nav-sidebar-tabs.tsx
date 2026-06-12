import { DiscreteTab, DiscreteTabs } from "@ch5me/ch5-ui-web/animate/discrete-tabs"
import { AnimatePresence } from "motion/react"
import { Button } from "@ch5me/elf-ui/components/button"
import { SidebarFooter } from "@ch5me/elf-ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue, useSetAtom } from "jotai"
import {
	BlocksIcon,
	CommandIcon,
	CopyIcon,
	PlusIcon,
	SearchIcon,
	SettingsIcon,
	XIcon,
} from "lucide-react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { activeServerConfigAtom, serverConnectedAtom } from "../atoms/connection"
import { agentFamily, projectSessionIdsFamily, sandboxMappingsAtom } from "../atoms/derived/agents"
import { automationsEnabledAtom } from "../atoms/feature-flags"
import { pinnedSessionsAtom } from "../atoms/preferences"
import {
	isTaggedProjectManagerSession,
	projectManagerSessionTagsAtom,
} from "../atoms/project-manager"
import { projectPaginationFamily } from "../atoms/sessions"
import {
	navSidebarActiveTabAtom,
	setAvailableNavSidebarTabsAtom,
	setNavSidebarActiveTabAtom,
	sidebarSectionOpenAtom,
	type SidebarSectionId,
} from "../atoms/ui"
import { appStore } from "../atoms/store"
import type { Agent, AgentStatus, SidebarProject } from "../lib/types"
import { loadMoreProjectSessions, loadProjectSessions } from "../services/connection-manager"
import { ServerIndicator } from "./server-indicator"
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
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@ch5me/elf-ui/components/sidebar"
import { useAtom, useAtomValue as useJotaiValue } from "jotai"

const RECENT_COUNT = 5

const STATUS_ICON: Record<AgentStatus, typeof BlocksIcon> = {
	running: BlocksIcon,
	waiting: BlocksIcon,
	paused: BlocksIcon,
	completed: BlocksIcon,
	failed: BlocksIcon,
	idle: BlocksIcon,
}

const STATUS_COLOR: Record<AgentStatus, string> = {
	running: "text-green-500",
	waiting: "text-yellow-500",
	paused: "text-yellow-500",
	completed: "text-green-500",
	failed: "text-red-500",
	idle: "text-muted-foreground",
}

function isActiveSurfaceAgent(agent: Agent): boolean {
	return agent.status !== "idle" && agent.status !== "completed" && agent.status !== "failed"
}

function renderAgentMeta(agent: Agent): string | undefined {
	const parts = [agent.agentType, agent.modelID].filter(Boolean)
	return parts.length > 0 ? parts.join(" · ") : undefined
}

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

interface NavSidebarTabDefinition {
	id: "built-in" | "built-in-duplicate"
	label: string
	icon: typeof BlocksIcon
	render: (props: AppSidebarContentProps) => React.ReactNode
}

const NAV_SIDEBAR_TAB_DEFINITIONS: NavSidebarTabDefinition[] = [
	{
		id: "built-in",
		label: "Palot",
		icon: BlocksIcon,
		render: (props) => <BuiltInSidebarBody {...props} />,
	},
	{
		id: "built-in-duplicate",
		label: "Folio",
		icon: CopyIcon,
		render: (props) => <BuiltInSidebarBody {...props} />,
	},
]

export function NavSidebarTabs(props: AppSidebarContentProps) {
	const activeTab = useAtomValue(navSidebarActiveTabAtom)
	const setActiveTab = useSetAtom(setNavSidebarActiveTabAtom)
	const setAvailableTabs = useSetAtom(setAvailableNavSidebarTabsAtom)
	const tabs = useMemo(() => NAV_SIDEBAR_TAB_DEFINITIONS, [])
	const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

	useEffect(() => {
		setAvailableTabs(tabs.map((tab) => tab.id))
	}, [setAvailableTabs, tabs])

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="shrink-0 border-b border-sidebar-border/10 px-2 pb-2 pt-1">
				<DiscreteTabs
					value={currentTab.id}
					onValueChange={(value) => setActiveTab(value as typeof currentTab.id)}
					size="sm"
				>
					{tabs.map((tab) => {
						const Icon = tab.icon
						return (
							<DiscreteTab
								key={tab.id}
								value={tab.id}
								icon={<Icon className="size-3.5 shrink-0" />}
							>
								{tab.label}
							</DiscreteTab>
						)
					})}
				</DiscreteTabs>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<AnimatePresence initial={false} mode="wait">
					<div key={currentTab.id} className="flex h-full min-h-0 flex-col overflow-hidden">
						{currentTab.render(props)}
					</div>
				</AnimatePresence>
			</div>
		</div>
	)
}

const BuiltInSidebarBody = memo(function BuiltInSidebarBody({
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
	const automationsEnabled = useJotaiValue(automationsEnabledAtom)
	const [sidebarSectionsOpen, setSidebarSectionsOpen] = useAtom(sidebarSectionOpenAtom)
	const pinnedSessions = useJotaiValue(pinnedSessionsAtom)
	const pmSessionTags = useJotaiValue(projectManagerSessionTagsAtom)
	const activeServer = useJotaiValue(activeServerConfigAtom)
	const isLocalServer = activeServer.type === "local"
	const [projectSearch, setProjectSearch] = useState("")
	const [projectSearchActive, setProjectSearchActive] = useState(false)
	const projectSearchRef = useRef<HTMLInputElement>(null)

	const filteredProjects = useMemo(() => {
		if (!projectSearch.trim()) return projects
		const q = projectSearch.toLowerCase()
		return projects.filter(
			(project) =>
				project.name.toLowerCase().includes(q) || project.directory.toLowerCase().includes(q),
		)
	}, [projects, projectSearch])

	useEffect(() => {
		if (projectSearchActive && projectSearchRef.current) {
			projectSearchRef.current.focus()
		}
	}, [projectSearchActive])

	const isProjectManagerSession = useMemo(
		() => (agent: Agent) => isTaggedProjectManagerSession(pmSessionTags, agent.id),
		[pmSessionTags],
	)

	const activeSessions = useMemo(
		() =>
			agents
				.filter((agent) => !agent.parentId && !isProjectManagerSession(agent) && isActiveSurfaceAgent(agent))
				.sort((a, b) => b.lastActiveAt - a.lastActiveAt),
		[agents, isProjectManagerSession],
	)

	const pinnedIds = useMemo(() => new Set(Object.keys(pinnedSessions)), [pinnedSessions])
	const pinnedSidebarSessions = useMemo(
		() =>
			agents
				.filter((agent) => !agent.parentId && !isProjectManagerSession(agent) && pinnedIds.has(agent.sessionId))
				.sort((a, b) => (pinnedSessions[b.sessionId] ?? 0) - (pinnedSessions[a.sessionId] ?? 0)),
		[agents, isProjectManagerSession, pinnedIds, pinnedSessions],
	)
	const activeIds = useMemo(() => new Set(activeSessions.map((agent) => agent.id)), [activeSessions])
	const recentSessions = useMemo(
		() =>
			agents
				.filter(
					(agent) =>
						!agent.parentId &&
						!activeIds.has(agent.id) &&
						!pinnedIds.has(agent.sessionId) &&
						!isProjectManagerSession(agent),
				)
				.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
				.slice(0, RECENT_COUNT),
		[agents, activeIds, pinnedIds, isProjectManagerSession],
	)
	const pmSessions = useMemo(
		() =>
			agents
				.filter((agent) => !agent.parentId && isProjectManagerSession(agent))
				.sort((a, b) => b.lastActiveAt - a.lastActiveAt),
		[agents, isProjectManagerSession],
	)

	const hasContent = agents.length > 0 || projects.length > 0

	const setSectionOpen = (section: SidebarSectionId, open: boolean) => {
		setSidebarSectionsOpen((current) => ({
			...current,
			[section]: open,
		}))
	}

	return (
		<>
			<SidebarContent>
				{!hasContent && (
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
				)}

				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton tooltip="New Session" onClick={() => navigate({ to: "/" })} className="text-muted-foreground">
									<PlusIcon className="size-4" />
									<span>New Session</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton tooltip="Project Manager" onClick={() => navigate({ to: "/project-manager" })} className="text-muted-foreground">
									<BlocksIcon className="size-4" />
									<span>Project Manager</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							{automationsEnabled && isLocalServer ? (
								<SidebarMenuItem>
									<SidebarMenuButton tooltip="Automations" onClick={() => navigate({ to: "/automations" })} className="text-muted-foreground">
										<BlocksIcon className="size-4" />
										<span>Automations</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{activeSessions.length > 0 ? (
					<SessionSection id="active" label="Active Now" open={sidebarSectionsOpen.active} onOpenChange={setSectionOpen}>
						<SidebarMenu>
							{activeSessions.map((agent) => (
								<SessionItem key={agent.id} agent={agent} onRename={onRenameSession} onDelete={onDeleteSession} onTogglePinned={onTogglePinnedSession} onFork={onForkSession} showProject />
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{pinnedSidebarSessions.length > 0 ? (
					<SessionSection id="pinned" label="Pinned" open={sidebarSectionsOpen.pinned} onOpenChange={setSectionOpen}>
						<SidebarMenu>
							{pinnedSidebarSessions.map((agent) => (
								<SessionItem key={agent.id} agent={agent} onRename={onRenameSession} onDelete={onDeleteSession} onTogglePinned={onTogglePinnedSession} onFork={onForkSession} showProject />
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{recentSessions.length > 0 ? (
					<SessionSection id="recent" label="Recent" open={sidebarSectionsOpen.recent} onOpenChange={setSectionOpen}>
						<SidebarMenu>
							{recentSessions.map((agent) => (
								<SessionItem key={agent.id} agent={agent} onRename={onRenameSession} onDelete={onDeleteSession} onTogglePinned={onTogglePinnedSession} onFork={onForkSession} showProject />
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{pmSessions.length > 0 ? (
					<SessionSection id="pm" label="PM Sessions" open={sidebarSectionsOpen.pm} onOpenChange={setSectionOpen}>
						<SidebarMenu>
							{pmSessions.map((agent) => (
								<SessionItem key={agent.id} agent={agent} onRename={onRenameSession} onDelete={onDeleteSession} onTogglePinned={onTogglePinnedSession} onFork={onForkSession} showProject />
							))}
						</SidebarMenu>
					</SessionSection>
				) : null}

				{hasContent && (activeSessions.length > 0 || pinnedSidebarSessions.length > 0 || recentSessions.length > 0 || pmSessions.length > 0) ? <SidebarSeparator className="bg-sidebar-border/5" /> : null}
				{hasContent ? (
					<SidebarGroup>
						<Collapsible open={sidebarSectionsOpen.projects} onOpenChange={(open) => setSectionOpen("projects", open)}>
							<div className="flex items-center justify-between gap-2 px-2 pb-1">
								<CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-hidden">
									<SearchIcon className="size-3 shrink-0 text-muted-foreground" />
									<SidebarGroupLabel className="h-auto min-w-0 p-0">Projects</SidebarGroupLabel>
								</CollapsibleTrigger>
								<div className="flex shrink-0 items-center gap-0.5">
									<Tooltip>
										<TooltipTrigger render={<button type="button" onClick={(event) => { event.stopPropagation(); setProjectSearchActive((prev) => { if (prev) { setProjectSearch("") } return !prev }) }} className={`text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-colors ${projectSearchActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`} />}>
											{projectSearchActive ? <XIcon className="size-4 shrink-0" /> : <SearchIcon className="size-4 shrink-0" />}
										</TooltipTrigger>
										<TooltipContent side="bottom">{projectSearchActive ? "Close search" : "Search projects"}</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger render={<button type="button" onClick={(event) => { event.stopPropagation(); onOpenCommandPalette() }} className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 shrink-0 items-center justify-center rounded-md p-0 transition-colors" />}>
											<CommandIcon className="size-4 shrink-0" />
										</TooltipTrigger>
										<TooltipContent side="bottom">Command palette (⌘K)</TooltipContent>
									</Tooltip>
									{onAddProject ? (
										<Tooltip>
											<TooltipTrigger render={<button type="button" onClick={(event) => { event.stopPropagation(); onAddProject() }} className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex aspect-square w-5 shrink-0 items-center justify-center rounded-md p-0 transition-colors" />}>
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
										<Input ref={projectSearchRef} value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Filter projects..." className="h-7 text-xs" />
									</div>
								) : null}
								<SidebarGroupContent>
									<SidebarMenu>
										{filteredProjects.map((project) => (
											<ProjectFolder key={project.id} project={project} onRename={onRenameSession} onDelete={onDeleteSession} onTogglePinned={onTogglePinnedSession} onFork={onForkSession} />
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
				<ServerIndicator />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Settings" onClick={() => navigate({ to: "/settings" })} className="text-muted-foreground">
							<SettingsIcon className="size-4" />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</>
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
})

const ProjectFolder = memo(function ProjectFolder({
	project,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
}: {
	project: SidebarProject
	onRename?: (agent: Agent, title: string) => Promise<void>
	onDelete?: (agent: Agent) => Promise<void>
	onTogglePinned?: (agent: Agent, pinned: boolean) => Promise<void>
	onFork?: (agent: Agent) => Promise<void>
}) {
	const navigate = useNavigate()
	const [expanded, setExpanded] = useState(false)
	const sessionIds = useAtomValue(projectSessionIdsFamily(project.directory))
	const pagination = useAtomValue(projectPaginationFamily(project.directory))

	useEffect(() => {
		if (!expanded || pagination.loaded || pagination.loading) return
		const { parentToSandboxes } = appStore.get(sandboxMappingsAtom)
		const sandboxDirs = parentToSandboxes.get(project.directory)
		loadProjectSessions(project.directory, sandboxDirs?.size ? sandboxDirs : undefined, {
			limit: 5,
			roots: true,
		})
	}, [expanded, pagination.loaded, pagination.loading, project.directory])

	const projectSessions = useMemo(() => {
		const agents: Agent[] = []
		for (const id of sessionIds) {
			const agent = appStore.get(agentFamily(id))
			if (agent) agents.push(agent)
		}
		return agents.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
	}, [sessionIds])

	return (
		<SidebarMenuItem>
			<Collapsible open={expanded} onOpenChange={setExpanded}>
				<SidebarMenuButton tooltip={project.name} onClick={() => {
					setExpanded(!expanded)
					navigate({ to: "/project/$projectSlug", params: { projectSlug: project.slug } })
				}}>
					<SearchIcon className="size-3 shrink-0 text-muted-foreground" />
					<span className="truncate font-medium">{project.name}</span>
				</SidebarMenuButton>
				<CollapsibleContent keepMounted className="flex h-[var(--collapsible-panel-height)] flex-col overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
					<div className="ml-3 border-l border-sidebar-border/5 pl-1">
						<SidebarMenu>
							{projectSessions.map((agent) => (
								<SessionItem key={agent.id} agent={agent} onRename={onRename} onDelete={onDelete} onTogglePinned={onTogglePinned} onFork={onFork} compact />
							))}
							{pagination.loaded && pagination.hasMore ? (
								<button type="button" onClick={() => loadMoreProjectSessions(project.directory, pagination.currentLimit)} className="w-full cursor-pointer px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground">
									Load more sessions
								</button>
							) : null}
						</SidebarMenu>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SidebarMenuItem>
	)
})

const SessionItem = memo(function SessionItem({
	agent,
	onRename,
	onDelete,
	onTogglePinned,
	onFork,
	showProject = false,
	compact = false,
}: {
	agent: Agent
	onRename?: (agent: Agent, title: string) => Promise<void>
	onDelete?: (agent: Agent) => Promise<void>
	onTogglePinned?: (agent: Agent, pinned: boolean) => Promise<void>
	onFork?: (agent: Agent) => Promise<void>
	showProject?: boolean
	compact?: boolean
}) {
	const navigate = useNavigate()
	const pinnedSessions = useJotaiValue(pinnedSessionsAtom)
	const isPinned = agent.sessionId in pinnedSessions
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
						<SidebarMenuButton tooltip={tooltipLabel} size={compact ? "sm" : "default"} onClick={() => navigate({ to: "/project/$projectSlug/session/$sessionId", params: { projectSlug: agent.projectSlug, sessionId: agent.id } })}>
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
				{onRename ? <ContextMenuItem onClick={() => void onRename(agent, agent.name)}>{"Rename"}</ContextMenuItem> : null}
				{onTogglePinned ? <ContextMenuItem onClick={() => onTogglePinned(agent, !isPinned)}>{isPinned ? "Unpin" : "Pin"}</ContextMenuItem> : null}
				{onFork ? <ContextMenuItem onClick={() => onFork(agent)}>{"Fork"}</ContextMenuItem> : null}
				{(onRename || onTogglePinned || onFork) && onDelete ? <ContextMenuSeparator /> : null}
				{onDelete ? <ContextMenuItem variant="destructive" onClick={() => onDelete(agent)}>{"Delete"}</ContextMenuItem> : null}
			</ContextMenuContent>
		</ContextMenu>
	)
})
