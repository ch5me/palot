import { AppSidebarShellFrame } from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { SplitPane } from "@ch5me/workspace"
import { Outlet, useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { activeServerConfigAtom, serverConnectedAtom } from "../atoms/connection"
import { leftPanelOpenAtom } from "../atoms/ui"
import { useAgents, useProjectList, useSetCommandPaletteOpen } from "../hooks/use-agents"
import { useAgentActions } from "../hooks/use-server"
import type { Agent } from "../lib/types"
import { pickDirectory } from "../services/backend"
import { loadProjectSessions } from "../services/connection-manager"
import { AddProjectDialog } from "./add-project-dialog"
import { APP_BAR_HEIGHT, AppBar } from "./app-bar"
import { AppSidebarContent } from "./sidebar"
import { useSidebarSlot } from "./sidebar-slot-context"
import { UpdateBanner } from "./update-banner"

const COLLAPSE_THRESHOLD = 600

function NarrowWindowCollapser() {
	const [, setLeftPanelOpen] = useAtom(leftPanelOpenAtom)
	const collapsedByUsRef = useRef(false)

	useEffect(() => {
		const check = () => {
			const narrow = window.innerWidth < COLLAPSE_THRESHOLD
			if (narrow) {
				collapsedByUsRef.current = true
				setLeftPanelOpen(false)
			} else if (!narrow && collapsedByUsRef.current) {
				collapsedByUsRef.current = false
				setLeftPanelOpen(true)
			}
		}

		check()
		window.addEventListener("resize", check)
		return () => window.removeEventListener("resize", check)
	}, [setLeftPanelOpen])

	return null
}

export function SidebarLayout() {
	const navigate = useNavigate()
	const [leftPanelOpen, setLeftPanelOpen] = useAtom(leftPanelOpenAtom)
	const { content: slotContent, footer: slotFooter } = useSidebarSlot()
	const agents = useAgents()
	const projects = useProjectList()
	const setCommandPaletteOpen = useSetCommandPaletteOpen()
	const { renameSession, deleteSession, togglePinnedSession, forkSession } = useAgentActions()
	const serverConnected = useAtomValue(serverConnectedAtom)
	const visibleAgents = agents
	const activeServer = useAtomValue(activeServerConfigAtom)
	const [addProjectOpen, setAddProjectOpen] = useState(false)

	const handleRenameSession = useCallback(
		async (agent: Agent, title: string) => {
			await renameSession(agent.directory, agent.sessionId, title)
		},
		[renameSession],
	)

	const handleDeleteSession = useCallback(
		async (agent: Agent) => {
			await deleteSession(agent.directory, agent.sessionId)
		},
		[deleteSession],
	)

	const handleTogglePinnedSession = useCallback(
		async (agent: Agent, pinned: boolean) => {
			togglePinnedSession(agent.sessionId, pinned)
		},
		[togglePinnedSession],
	)

	const handleForkSession = useCallback(
		async (agent: Agent) => {
			const forked = await forkSession(agent.directory, agent.sessionId)
			if (forked) {
				navigate({
					to: "/project/$projectSlug/session/$sessionId",
					params: { projectSlug: agent.projectSlug, sessionId: forked.id },
				})
			}
		},
		[forkSession, navigate],
	)

	const handleOpenCommandPalette = useCallback(() => {
		setCommandPaletteOpen(true)
	}, [setCommandPaletteOpen])

	const handleAddProject = useCallback(async () => {
		if (activeServer.type === "local") {
			const directory = await pickDirectory()
			if (!directory) return
			await loadProjectSessions(directory)
			navigate({ to: "/" })
			return
		}

		setAddProjectOpen(true)
	}, [activeServer.type, navigate])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
				return
			}

			if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "b") {
				e.preventDefault()
				setLeftPanelOpen((prev) => !prev)
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [setLeftPanelOpen])

	const handleProjectAdded = useCallback(
		(_directory: string) => {
			navigate({ to: "/" })
		},
		[navigate],
	)

	const sidebarContent = slotContent ?? (
		<AppSidebarContent
			agents={visibleAgents}
			projects={projects}
			onOpenCommandPalette={handleOpenCommandPalette}
			onAddProject={handleAddProject}
			onRenameSession={handleRenameSession}
			onDeleteSession={handleDeleteSession}
			onTogglePinnedSession={handleTogglePinnedSession}
			onForkSession={handleForkSession}
			serverConnected={serverConnected}
		/>
	)

	const dragRegionStyle = { WebkitAppRegion: "drag" } as const

	return (
		<>
			<NarrowWindowCollapser />
			<div
				style={{
					background: "var(--ws-bg, hsl(var(--background)))",
					color: "var(--ws-text-primary, hsl(var(--foreground)))",
					display: "grid",
					gridTemplateRows: `${APP_BAR_HEIGHT}px 1fr`,
					height: "100vh",
					overflow: "hidden",
					width: "100%",
				}}
			>
			<div style={{ minWidth: 0, overflow: "hidden" }}>
				<AppSidebarShellFrame
					appBar={
						<div className="relative">
							<UpdateBanner />
							<AppBar />
						</div>
					}
					sidebar={sidebarContent}
					sidebarFooter={slotFooter !== false ? slotFooter : undefined}
					sidebarHeader={<div className="flex shrink-0 items-center gap-1" style={{ height: APP_BAR_HEIGHT, ...dragRegionStyle }} />}
					sidebarStyle={{ width: 320, minWidth: 200, maxWidth: 480 }}
					content={
						<SplitPane
							side="left"
							open={leftPanelOpen}
							onOpenChange={setLeftPanelOpen}
							defaultPanelWidth={320}
							minPanelWidth={200}
							maxPanelWidth={480}
							panel={<div className="hidden" />}
						>
							<main
								className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
								style={{ background: "hsl(var(--background))" }}
							>
								<div data-slot="content-area" className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
									<Outlet />
								</div>
							</main>
						</SplitPane>
					}
					height="100%"
					className="h-full"
					contentClassName="bg-transparent"
				/>
			</div>
			</div>
			<AddProjectDialog
				open={addProjectOpen}
				onOpenChange={setAddProjectOpen}
				onAdded={handleProjectAdded}
			/>
		</>
	)
}
