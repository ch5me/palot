import { Button } from "@ch5me/elf-ui/components/button"
import { SidebarProvider } from "@ch5me/elf-ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { SplitPane } from "@ch5me/workspace"
import { Outlet, useNavigate } from "@tanstack/react-router"
import { useAtom, useAtomValue } from "jotai"
import { PanelLeftIcon, PlusIcon } from "lucide-react"
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

const isMac =
	typeof window !== "undefined" && "elf" in window && window.elf.platform === "darwin"
const isElectronEnv = typeof window !== "undefined" && "elf" in window

const WINDOW_CONTROLS_LEFT = isMac && isElectronEnv ? 93 : 8
const WINDOW_CONTROLS_INSET = isMac && isElectronEnv ? 160 : 72
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

function WindowControls() {
	const [, setLeftPanelOpen] = useAtom(leftPanelOpenAtom)
	const navigate = useNavigate()

	const handleToggleSidebar = useCallback(() => {
		setLeftPanelOpen((prev) => !prev)
	}, [setLeftPanelOpen])

	return (
		<div
			className="absolute z-50 flex items-center gap-0.5"
			style={{
				top: 8,
				left: WINDOW_CONTROLS_LEFT,
				// @ts-expect-error -- vendor-prefixed CSS property
				WebkitAppRegion: "no-drag",
			}}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="size-7 shrink-0"
							onClick={handleToggleSidebar}
						/>
					}
				>
					<PanelLeftIcon className="size-3.5" />
				</TooltipTrigger>
				<TooltipContent>Toggle sidebar (&#8984;B)</TooltipContent>
			</Tooltip>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							className="size-7 shrink-0"
							onClick={() => navigate({ to: "/" })}
						/>
					}
				>
					<PlusIcon className="size-3.5" />
				</TooltipTrigger>
				<TooltipContent>New session (&#8984;N)</TooltipContent>
			</Tooltip>
		</div>
	)
}

export function SidebarLayout() {
	const navigate = useNavigate()
	const [leftPanelOpen, setLeftPanelOpen] = useAtom(leftPanelOpenAtom)
	const { content: slotContent, footer: slotFooter } = useSidebarSlot()
	const agents = useAgents()
	const projects = useProjectList()
	const setCommandPaletteOpen = useSetCommandPaletteOpen()
	const { renameSession, deleteSession, forkSession } = useAgentActions()
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
			onForkSession={handleForkSession}
			serverConnected={serverConnected}
		/>
	)

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
			<div
				className="relative"
				style={
					{
						"--window-controls-inset": `${WINDOW_CONTROLS_INSET}px`,
					} as React.CSSProperties
				}
			>
				<UpdateBanner />
				<AppBar />
				<WindowControls />
			</div>

			<div style={{ minWidth: 0, overflow: "hidden" }}>

					<SplitPane
						side="left"
						open={leftPanelOpen}
						onOpenChange={setLeftPanelOpen}
						defaultPanelWidth={320}
						minPanelWidth={200}
						maxPanelWidth={480}
					panel={
						<SidebarProvider
							embedded
							defaultOpen={leftPanelOpen}
							open={leftPanelOpen}
							onOpenChange={setLeftPanelOpen}
						>
							<div
								className="flex h-full flex-col overflow-y-auto"
								style={{ background: "hsl(var(--sidebar, var(--card)))" }}
							>
								<div
									className="flex shrink-0 items-center gap-1"
									style={{
										height: APP_BAR_HEIGHT,
										// @ts-expect-error -- vendor-prefixed CSS property
										WebkitAppRegion: "drag",
									}}
								/>
								{sidebarContent}
								{slotFooter !== false && slotFooter}
							</div>
						</SidebarProvider>
					}
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
