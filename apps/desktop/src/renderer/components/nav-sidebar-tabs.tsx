import { AnimatePresence } from "motion/react"
import { useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	BlocksIcon,
	CopyIcon,
} from "lucide-react"
import { memo, useEffect, useMemo } from "react"
import { activeServerConfigAtom } from "../atoms/connection"
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
import { loadMoreProjectSessions } from "../services/connection-manager"
import {
	NavSidebarShell,
	type NavSidebarAgent,
	type NavSidebarProject,
	type NavSidebarSectionId,
	type NavSidebarShellTab,
} from "@ch5me/elf-ui/components/nav-sidebar-shell"

const RECENT_COUNT = 5

function isActiveSurfaceAgent(agent: Agent): boolean {
	return agent.status !== "idle"
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
	mode: "host" | "plugin-seam"
	render: (props: AppSidebarContentProps) => React.ReactNode
}

const NAV_SIDEBAR_TAB_DEFINITIONS: NavSidebarTabDefinition[] = [
	{
		id: "built-in",
		label: "Palot",
		icon: BlocksIcon,
		mode: "host",
		render: (props) => <BuiltInSidebarBody mode="host" {...props} />,
	},
	{
		id: "built-in-duplicate",
		label: "Folio",
		icon: CopyIcon,
		mode: "plugin-seam",
		render: (props) => <BuiltInSidebarBody mode="plugin-seam" {...props} />,
	},
]

function toNavSidebarAgent(agent: Agent): NavSidebarAgent {
	return {
		id: agent.id,
		name: agent.name,
		status: agent.status as AgentStatus,
		project: agent.project,
		projectSlug: agent.projectSlug,
		sessionId: agent.sessionId,
		agentType: agent.agentType,
		modelID: agent.modelID,
	}
}

function toNavSidebarProject(project: SidebarProject, agents: Agent[]): NavSidebarProject {
	return {
		id: project.id,
		name: project.name,
		slug: project.slug,
		directory: project.directory,
		agents: agents.map(toNavSidebarAgent),
		hasMore: false,
	}
}

export function NavSidebarTabs(props: AppSidebarContentProps) {
	const activeTab = useAtomValue(navSidebarActiveTabAtom)
	const setActiveTab = useSetAtom(setNavSidebarActiveTabAtom)
	const setAvailableTabs = useSetAtom(setAvailableNavSidebarTabsAtom)
	const tabs = useMemo(() => NAV_SIDEBAR_TAB_DEFINITIONS, [])
	const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

	useEffect(() => {
		setAvailableTabs(tabs.map((tab) => tab.id))
	}, [setAvailableTabs, tabs])

	const shellTabs = useMemo<NavSidebarShellTab[]>(
		() => tabs.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon })),
		[tabs],
	)

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<NavSidebarShell
				tabs={shellTabs}
				activeTab={currentTab.id}
				onTabChange={(value) => setActiveTab(value)}
				serverConnected={props.serverConnected}
				hasContent={props.agents.length > 0 || props.projects.length > 0}
				sectionsOpen={{
					active: true,
					pinned: true,
					recent: true,
					pm: true,
					projects: true,
				}}
				onSectionOpenChange={() => {}}
				rightPane={
					<AnimatePresence initial={false} mode="wait">
						<div key={currentTab.id} className="flex h-full min-h-0 flex-col overflow-hidden">
							{currentTab.render(props)}
						</div>
					</AnimatePresence>
				}
			/>
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
	mode = "host",
}: AppSidebarContentProps & { mode?: "host" | "plugin-seam" }) {
	const navigate = useNavigate()
	const automationsEnabled = useAtomValue(automationsEnabledAtom)
	const [sidebarSectionsOpen, setSidebarSectionsOpen] = useAtom(sidebarSectionOpenAtom)
	const pinnedSessions = useAtomValue(pinnedSessionsAtom)
	const pmSessionTags = useAtomValue(projectManagerSessionTagsAtom)
	const activeServer = useAtomValue(activeServerConfigAtom)
	const isLocalServer = activeServer.type === "local"

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
	const sidebarTitle = mode === "plugin-seam" ? "Folio plugin seam" : "Palot host sidebar"
	const sidebarDescription =
		mode === "plugin-seam"
			? "This tab is reserved for the upcoming plugin-projected Folio family while still using the shared shell contract for spacing, sections, and side-panel behavior."
			: "This is the current host-owned Palot sidebar, rendered through the shared shell contract."

	const setSectionOpen = (section: SidebarSectionId | NavSidebarSectionId, open: boolean) => {
		setSidebarSectionsOpen((current) => ({
			...current,
			[section]: open,
		}))
	}

	const navProjects = useMemo(() => {
		return projects.map((project) => {
			const sandboxDirs = appStore.get(sandboxMappingsAtom).parentToSandboxes.get(project.directory)
			const sessionIds = appStore.get(projectSessionIdsFamily(project.directory))
			const pagination = appStore.get(projectPaginationFamily(project.directory))
			const projectAgents: Agent[] = []
			for (const id of sessionIds) {
				const agent = appStore.get(agentFamily(id))
				if (agent) projectAgents.push(agent)
			}
			projectAgents.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
			const navProject = toNavSidebarProject(project, projectAgents)
			navProject.hasMore = pagination.loaded && pagination.hasMore
			navProject.directory = sandboxDirs?.size ? project.directory : project.directory
			return navProject
		})
	}, [projects])

	const seamCopy =
		mode === "plugin-seam"
			? {
				projectManagerLabel: "Folio Queue",
				automationsLabel: "Projected Panels",
				projectSearchPlaceholder: "Filter Folio workspaces...",
				emptyTitle: "Plugin seam warming up",
				emptyBody: "This host-owned preview marks the projected Folio sidebar slot until the first plugin-projected family is wired in.",
				primaryBody: "This pane marks the future plugin-projected Folio navigation surface. Host actions stay intentionally disabled here until the first plugin family is wired in.",
				panelBody: "Reserved for Folio-specific panels, bridge controls, and plugin-owned detail views.",
			}
			: {
				projectManagerLabel: "Project Manager",
				automationsLabel: "Automations",
				projectSearchPlaceholder: "Filter projects...",
				emptyTitle: "No projects yet",
				emptyBody: "Add a project to get started",
				primaryBody: "Use this pane to evaluate today’s host-owned sidebar inside the same shell layout future plugin families will inherit.",
				panelBody: "Reserved for current host-owned notes, browser, and artifacts side panels.",
			}

	return (
		<NavSidebarShell
			tabs={NAV_SIDEBAR_TAB_DEFINITIONS.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
			activeTab={mode === "plugin-seam" ? "built-in-duplicate" : "built-in"}
			onTabChange={() => {}}

			serverConnected={serverConnected}
			hasContent={hasContent}
			newSessionLabel="New Session"
			projectManagerLabel={seamCopy.projectManagerLabel}
			automationsLabel={seamCopy.automationsLabel}
			showAutomations={mode === "plugin-seam" ? false : automationsEnabled && isLocalServer}
			emptyState={
				<div className="flex flex-1 items-center justify-center p-4">
					<div className="space-y-2 text-center">
						{!serverConnected ? (
							<>
								<p className="text-sm text-muted-foreground">Server offline</p>
								<p className="text-xs text-muted-foreground/60">Check your connection in Settings</p>
							</>
						) : (
							<>
								<p className="text-sm text-muted-foreground">{seamCopy.emptyTitle}</p>
								<p className="text-xs text-muted-foreground/60">{seamCopy.emptyBody}</p>
							</>
						)}
					</div>
				</div>
			}
			activeSessions={activeSessions.map(toNavSidebarAgent)}
			pinnedSessions={pinnedSidebarSessions.map(toNavSidebarAgent)}
			recentSessions={recentSessions.map(toNavSidebarAgent)}
			pmSessions={pmSessions.map(toNavSidebarAgent)}
			projects={navProjects}
			sectionsOpen={sidebarSectionsOpen}
			onSectionOpenChange={setSectionOpen}
			onNewSession={mode === "plugin-seam" ? undefined : () => navigate({ to: "/" })}
			onProjectManager={mode === "plugin-seam" ? undefined : () => navigate({ to: "/project-manager" })}
			onAutomations={mode === "plugin-seam" ? undefined : () => navigate({ to: "/automations" })}
			onOpenCommandPalette={mode === "plugin-seam" ? undefined : onOpenCommandPalette}
			onAddProject={mode === "plugin-seam" ? undefined : onAddProject}
			onSessionSelect={mode === "plugin-seam" ? undefined : (agent) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return
				navigate({
					to: "/project/$projectSlug/session/$sessionId",
					params: { projectSlug: original.projectSlug, sessionId: original.id },
				})
			}}
			onSessionRename={mode === "plugin-seam" ? undefined : onRenameSession ? (agent) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return
				void onRenameSession(original, original.name)
			} : undefined}
			onSessionDelete={mode === "plugin-seam" ? undefined : onDeleteSession ? (agent) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return
				void onDeleteSession(original)
			} : undefined}
			onTogglePinnedSession={mode === "plugin-seam" ? undefined : onTogglePinnedSession ? (agent, pinned) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return
				void onTogglePinnedSession(original, pinned)
			} : undefined}
			onForkSession={mode === "plugin-seam" ? undefined : onForkSession ? (agent) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return
				void onForkSession(original)
			} : undefined}
			onProjectSelect={mode === "plugin-seam" ? undefined : (project) => {
				navigate({ to: "/project/$projectSlug", params: { projectSlug: project.slug } })
			}}
			onProjectLoadMore={mode === "plugin-seam" ? undefined : (project) => {
				if (!project.directory) return
				const pagination = appStore.get(projectPaginationFamily(project.directory))
				loadMoreProjectSessions(project.directory, pagination.currentLimit)
			}}
			onSettings={mode === "plugin-seam" ? undefined : () => navigate({ to: "/settings" })}
			projectSearchPlaceholder={seamCopy.projectSearchPlaceholder}
			serverSummary={{ label: activeServer.name, connected: serverConnected }}
				rightPane={
					<div className="flex h-full min-h-0 flex-col border-l border-border/50 bg-background/70">
						<div className="border-b border-border/50 px-4 py-3">
							<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{mode === "plugin-seam" ? "Plugin seam preview" : "Host sidebar preview"}</p>
							<p className="mt-2 text-sm font-medium">{sidebarTitle}</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">{sidebarDescription}</p>
						</div>
						<div className="grid min-h-0 flex-1 gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
							<div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-4">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Primary surface</p>
								<p className="mt-3 text-sm leading-6 text-muted-foreground">{seamCopy.primaryBody}</p>
							</div>
							<div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
								<p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Side panel target</p>
								<p className="mt-3 text-sm leading-6 text-muted-foreground">{seamCopy.panelBody}</p>
							</div>
						</div>
					</div>
				}

			renderProjectSession={(agent) => {
				const original = agents.find((entry) => entry.id === agent.id)
				if (!original) return agent
				return {
					...agent,
					name: pinnedSessions[original.sessionId] ? `${original.name} (Pinned)` : original.name,
					project: original.project,
					projectSlug: original.projectSlug,
					agentType: original.agentType,
					modelID: original.modelID,
				}
			}}
		/>

	)
})

export type { AppSidebarContentProps, NavSidebarTabDefinition }
