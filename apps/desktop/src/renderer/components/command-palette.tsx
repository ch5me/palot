import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@ch5me/elf-ui/components/command"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	BotIcon,
	BookTextIcon,
	CheckIcon,
	CloudIcon,
	ContainerIcon,
	DatabaseIcon,
	EyeIcon,
	EyeOffIcon,
	FileDiffIcon,
	FilesIcon,
	FilmIcon,
	GitBranchIcon,
	GitForkIcon,
	MicIcon,
	MonitorIcon,
	MonitorPlayIcon,
	PanelRightCloseIcon,
	FileTextIcon,
	PanelRightOpenIcon,
	PlugIcon,
	RectangleEllipsisIcon,
	Share2Icon,
	TerminalSquareIcon,
	UsersIcon,
	MoonIcon,
	PaletteIcon,
	PlusIcon,
	Redo2Icon,
	RefreshCwIcon,
	ScanEyeIcon,
	SparklesIcon,
	SunIcon,
	SunMoonIcon,
	Undo2Icon,
	WrenchIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { sessionMetricsFamily } from "../atoms/derived/session-metrics"
import { invokePluginCommand } from "../hooks/use-firefly-plugins"
import {
	automationsEnabledAtom,
	browserPanelEnabledAtom,
	bridgesSurfaceEnabledAtom,
	ch5pmSurfaceEnabledAtom,
	claudeSurfaceEnabledAtom,
	crmSurfaceEnabledAtom,
	editorSurfaceEnabledAtom,
	filesSurfaceEnabledAtom,
	memorySurfaceEnabledAtom,
	notesSurfaceEnabledAtom,
	pluginsSurfaceEnabledAtom,
	pdfReviewSurfaceEnabledAtom,
	pulseSurfaceEnabledAtom,
	reviewSurfaceEnabledAtom,
	studioSurfaceEnabledAtom,
	terminalSurfaceEnabledAtom,
	voiceSurfaceEnabledAtom,
	toggleAutomationsAtom,
	toggleBridgesSurfaceAtom,
	toggleBrowserPanelAtom,
	toggleCh5PmSurfaceAtom,
	toggleClaudeSurfaceAtom,
	toggleCrmSurfaceAtom,
	toggleFilesSurfaceAtom,
	toggleMemorySurfaceAtom,
	toggleNotesSurfaceAtom,
	togglePdfReviewSurfaceAtom,
	togglePluginsSurfaceAtom,
	togglePulseSurfaceAtom,
	toggleReviewSurfaceAtom,
	toggleStudioSurfaceAtom,
	toggleTerminalSurfaceAtom,
	toggleVoiceSurfaceAtom,
} from "../atoms/feature-flags"
import { getFireflySurfaceTabs, type FireflySurfaceContext } from "../firefly-surface-registry"
import { isMockModeAtom, toggleMockModeAtom } from "../atoms/mock-mode"
import { opaqueWindowsAtom } from "../atoms/preferences"
import { isReactScanAtom, toggleReactScanAtom } from "../atoms/react-scan"
import { isDevSurfaceAtom, toggleDevSurfaceAtom } from "../atoms/dev-surface"
import { navSidebarActiveTabAtom, openSidePanelTabAtom, sidePanelOpenAtom } from "../atoms/ui"
import { useSessionRevert } from "../hooks/use-commands"
import {
	useAvailableThemes,
	useColorScheme,
	useCurrentTheme,
	useSetColorScheme,
	useSetTheme,
} from "../hooks/use-theme"
import { createLogger } from "../lib/logger"
import type { ColorScheme } from "../lib/themes"
import type { Agent } from "../lib/types"
import { reloadConfig } from "../services/connection-manager"

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	agents: Agent[]
	onForkSession?: () => Promise<void>
}

const log = createLogger("command-palette")

export function CommandPalette({ open, onOpenChange, agents, onForkSession }: CommandPaletteProps) {
	const navigate = useNavigate()
	const params = useParams({ strict: false })
	const sessionId = (params as Record<string, string | undefined>).sessionId ?? null

	const activeAgent = useMemo(
		() => (sessionId ? (agents.find((a) => a.id === sessionId) ?? null) : null),
		[agents, sessionId],
	)
	const directory = activeAgent?.directory ?? null

	const { canUndo, canRedo, undo, redo } = useSessionRevert(
		directory,
		activeAgent?.sessionId ?? null,
	)

	const currentTheme = useCurrentTheme()
	const colorScheme = useColorScheme()
	const availableThemes = useAvailableThemes()
	const setTheme = useSetTheme()
	const setColorScheme = useSetColorScheme()
	const [opaqueWindows, setOpaqueWindows] = useAtom(opaqueWindowsAtom)
	const isMockMode = useAtomValue(isMockModeAtom)
	const toggleMockMode = useSetAtom(toggleMockModeAtom)
	const isReactScan = useAtomValue(isReactScanAtom)
	const toggleReactScan = useSetAtom(toggleReactScanAtom)
	const isDevSurface = useAtomValue(isDevSurfaceAtom)
	const toggleDevSurface = useSetAtom(toggleDevSurfaceAtom)
	const automationsEnabled = useAtomValue(automationsEnabledAtom)
	const toggleAutomations = useSetAtom(toggleAutomationsAtom)
	const browserPanelEnabled = useAtomValue(browserPanelEnabledAtom)
	const reviewSurfaceEnabled = useAtomValue(reviewSurfaceEnabledAtom)
	const notesSurfaceEnabled = useAtomValue(notesSurfaceEnabledAtom)
	const pulseSurfaceEnabled = useAtomValue(pulseSurfaceEnabledAtom)
	const memorySurfaceEnabled = useAtomValue(memorySurfaceEnabledAtom)
	const filesSurfaceEnabled = useAtomValue(filesSurfaceEnabledAtom)
	const terminalSurfaceEnabled = useAtomValue(terminalSurfaceEnabledAtom)
	const editorSurfaceEnabled = useAtomValue(editorSurfaceEnabledAtom)
	const pluginsSurfaceEnabled = useAtomValue(pluginsSurfaceEnabledAtom)
	const bridgesSurfaceEnabled = useAtomValue(bridgesSurfaceEnabledAtom)
	const crmSurfaceEnabled = useAtomValue(crmSurfaceEnabledAtom)
	const studioSurfaceEnabled = useAtomValue(studioSurfaceEnabledAtom)
	const voiceSurfaceEnabled = useAtomValue(voiceSurfaceEnabledAtom)
	const claudeSurfaceEnabled = useAtomValue(claudeSurfaceEnabledAtom)
	const ch5pmSurfaceEnabled = useAtomValue(ch5pmSurfaceEnabledAtom)
	const pdfReviewSurfaceEnabled = useAtomValue(pdfReviewSurfaceEnabledAtom)
	const toggleBrowserPanel = useSetAtom(toggleBrowserPanelAtom)
	const toggleReviewSurface = useSetAtom(toggleReviewSurfaceAtom)
	const toggleNotesSurface = useSetAtom(toggleNotesSurfaceAtom)
	const togglePulseSurface = useSetAtom(togglePulseSurfaceAtom)
	const toggleMemorySurface = useSetAtom(toggleMemorySurfaceAtom)
	const toggleFilesSurface = useSetAtom(toggleFilesSurfaceAtom)
	const togglePluginsSurface = useSetAtom(togglePluginsSurfaceAtom)
	const toggleBridgesSurface = useSetAtom(toggleBridgesSurfaceAtom)
	const toggleCrmSurface = useSetAtom(toggleCrmSurfaceAtom)
	const toggleStudioSurface = useSetAtom(toggleStudioSurfaceAtom)
	const toggleVoiceSurface = useSetAtom(toggleVoiceSurfaceAtom)
	const toggleClaudeSurface = useSetAtom(toggleClaudeSurfaceAtom)
	const toggleCh5PmSurface = useSetAtom(toggleCh5PmSurfaceAtom)
	const togglePdfReviewSurface = useSetAtom(togglePdfReviewSurfaceAtom)
	const toggleTerminalSurface = useSetAtom(toggleTerminalSurfaceAtom)
	const navSidebarActiveTab = useAtomValue(navSidebarActiveTabAtom)
	const openSidePanelTab = useSetAtom(openSidePanelTabAtom)
	const [sidePanelOpen, setSidePanelOpen] = useAtom(sidePanelOpenAtom)
	const [reloading, setReloading] = useState(false)

	const isElectron = typeof window !== "undefined" && "elf" in window

	const handleToggleTransparency = useCallback(async () => {
		const newValue = !opaqueWindows
		setOpaqueWindows(newValue)

		if (isElectron) {
			await window.elf.setOpaqueWindows(newValue)
			const shouldRestart = window.confirm(
				"Transparency changes take effect after restarting the app.\n\nRestart now?",
			)
			if (shouldRestart) {
				window.elf.relaunch()
			}
		}
	}, [opaqueWindows, setOpaqueWindows, isElectron])

	const handleReloadConfig = useCallback(async () => {
		setReloading(true)
		onOpenChange(false)
		try {
			await reloadConfig()
			log.info("Config reloaded successfully")
		} catch (err) {
			log.error("Failed to reload config", {}, err)
		} finally {
			setReloading(false)
		}
	}, [onOpenChange])

	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				onOpenChange(!open)
			}
		}
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [open, onOpenChange])

	const activeSessions = useMemo(
		() =>
			open
				? agents
						.filter((a) => a.status !== "idle")
						.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
				: [],
		[agents, open],
	)

	const surfaceContext = useMemo<FireflySurfaceContext | null>(() => {
		if (!activeAgent) return null
		return {
			agent: activeAgent,
			diffStats: {
				additions: 0,
				deletions: 0,
				fileCount: 1,
			},
			flags: {
				browserPanelEnabled,
				review: reviewSurfaceEnabled,
				notes: notesSurfaceEnabled,
				pulse: pulseSurfaceEnabled,
				memory: memorySurfaceEnabled,
				files: filesSurfaceEnabled,
				terminal: terminalSurfaceEnabled,
				editor: editorSurfaceEnabled,
				plugins: pluginsSurfaceEnabled,
				bridges: bridgesSurfaceEnabled,
				crm: crmSurfaceEnabled,
				studio: studioSurfaceEnabled,
				voice: voiceSurfaceEnabled,
				claude: claudeSurfaceEnabled,
				ch5pm: ch5pmSurfaceEnabled,
				pdfReview: pdfReviewSurfaceEnabled,
			},
			chatTurnCount: 1,
		}
	}, [
		activeAgent,
		browserPanelEnabled,
		reviewSurfaceEnabled,
		notesSurfaceEnabled,
		pulseSurfaceEnabled,
		memorySurfaceEnabled,
		filesSurfaceEnabled,
		terminalSurfaceEnabled,
		editorSurfaceEnabled,
		pluginsSurfaceEnabled,
		bridgesSurfaceEnabled,
		crmSurfaceEnabled,
		studioSurfaceEnabled,
			voiceSurfaceEnabled,
			claudeSurfaceEnabled,
			ch5pmSurfaceEnabled,
			pdfReviewSurfaceEnabled,
		])


	const availableSurfaceTabs = useMemo(
		() => (surfaceContext ? getFireflySurfaceTabs(surfaceContext) : []),
		[surfaceContext],
	)
	const hasAvailableSurfaceTab = availableSurfaceTabs.some((surface) => surface.availability.available)

	const hasSession = !!activeAgent

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				<CommandGroup heading="Actions">
					<CommandItem
						onSelect={() => {
							navigate({ to: "/" })
							onOpenChange(false)
						}}
					>
						<PlusIcon />
						<span>New Session</span>
						<CommandShortcut>&#8984;N</CommandShortcut>
					</CommandItem>
					{hasSession && canUndo && (
						<CommandItem
							onSelect={() => {
								undo()
								onOpenChange(false)
							}}
						>
							<Undo2Icon />
							<span>Undo Last Turn</span>
							<CommandShortcut>&#8984;Z</CommandShortcut>
						</CommandItem>
					)}
					{hasSession && canRedo && (
						<CommandItem
							onSelect={() => {
								redo()
								onOpenChange(false)
							}}
						>
							<Redo2Icon />
							<span>Redo</span>
							<CommandShortcut>&#8679;&#8984;Z</CommandShortcut>
						</CommandItem>
					)}
					{hasSession && (
						<CommandItem
							onSelect={() => {
								setSidePanelOpen((prev) => !prev)
								onOpenChange(false)
							}}
							disabled={!hasAvailableSurfaceTab}
						>
							{sidePanelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
							<span>{sidePanelOpen ? "Close Side Panel" : "Open Side Panel"}</span>
							<CommandShortcut>&#8679;&#8984;D</CommandShortcut>
						</CommandItem>
					)}
					{hasSession && (
						<CommandItem
							onSelect={() => {
								onOpenChange(false)
							}}
							disabled
						>
							<SparklesIcon />
							<span>Compact Conversation</span>
						</CommandItem>
					)}
					{hasSession && onForkSession && (
						<CommandItem
							onSelect={async () => {
								onOpenChange(false)
								await onForkSession()
							}}
						>
							<GitForkIcon />
							<span>Fork Session</span>
						</CommandItem>
					)}
				<CommandItem onSelect={handleReloadConfig} disabled={reloading}>
					<RefreshCwIcon />
					<span>{reloading ? "Reloading..." : "Reload Config"}</span>
				</CommandItem>
			</CommandGroup>

			<CommandSeparator />
			<CommandGroup heading="Plugins">
				<CommandItem
					keywords={["plugin", "palot", "ui", "refresh", "firefly"]}
					onSelect={async () => {
						onOpenChange(false)
						await invokePluginCommand({
							pluginId: "firefly.built-in.palot-bridge",
							commandId: "palot-refresh-ui-state",
							args: {},
						})
					}}
				>
					<PlugIcon />
					<span>Plugin: Refresh Palot UI State</span>
					<span className="ml-auto text-[10px] text-muted-foreground">palot-bridge</span>
				</CommandItem>
				<CommandItem
					keywords={["plugin", "acme", "notebook", "firefly"]}
					onSelect={async () => {
						onOpenChange(false)
						await invokePluginCommand({
							pluginId: "acme.acme-notebook",
							commandId: "acme-notebook-open",
							args: {},
						})
					}}
				>
					<PlugIcon />
					<span>Plugin: Open Acme Notebook</span>
					<span className="ml-auto text-[10px] text-muted-foreground">acme-notebook</span>
				</CommandItem>
			</CommandGroup>

				<CommandSeparator />
				<CommandGroup heading="Appearance">
					{availableThemes.map((t) => (
						<CommandItem
							key={t.id}
							onSelect={() => {
								setTheme(t.id)
								onOpenChange(false)
							}}
						>
							<PaletteIcon />
							<span>Theme: {t.name}</span>
							{t.description && (
								<span className="text-xs text-muted-foreground">{t.description}</span>
							)}
							{currentTheme.id === t.id && <CheckIcon className="ml-auto h-4 w-4" />}
						</CommandItem>
					))}
				</CommandGroup>

				<CommandSeparator />
				<CommandGroup heading="Window">
					<CommandItem
						onSelect={() => {
							onOpenChange(false)
							setTimeout(handleToggleTransparency, 100)
						}}
					>
						{opaqueWindows ? <EyeIcon /> : <EyeOffIcon />}
						<span>{opaqueWindows ? "Enable Transparency" : "Disable Transparency"}</span>
						{!opaqueWindows && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
				</CommandGroup>

				<CommandSeparator />
				<CommandGroup heading="Color Scheme">
					{(
						[
							{ scheme: "dark" as ColorScheme, label: "Dark", icon: MoonIcon },
							{ scheme: "light" as ColorScheme, label: "Light", icon: SunIcon },
							{ scheme: "system" as ColorScheme, label: "System", icon: SunMoonIcon },
						] as const
					).map(({ scheme, label, icon: Icon }) => (
						<CommandItem
							key={scheme}
							onSelect={() => {
								setColorScheme(scheme)
								onOpenChange(false)
							}}
						>
							<Icon />
							<span>{label}</span>
							{colorScheme === scheme && <CheckIcon className="ml-auto h-4 w-4" />}
						</CommandItem>
					))}
				</CommandGroup>

				<CommandSeparator />
				<CommandGroup heading="Features">
					<CommandItem
						keywords={["automation", "automations", "schedule", "cron", "recurring"]}
						onSelect={() => {
							toggleAutomations()
							onOpenChange(false)
						}}
					>
						<BotIcon />
						<span>{automationsEnabled ? "Disable Automations" : "Enable Automations"}</span>
						{automationsEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["review", "changes", "diff", "side panel"]}
						onSelect={() => {
							toggleReviewSurface()
							onOpenChange(false)
						}}
					>
						<FileDiffIcon />
						<span>{reviewSurfaceEnabled ? "Disable Changes Surface" : "Enable Changes Surface"}</span>
						{reviewSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
				<CommandItem
					keywords={["nav sidebar", "folio", "palot", "sidebar tabs"]}
					onSelect={() => {
						onOpenChange(false)
					}}
				>
					<BlocksIcon />
					<span>Nav Sidebar Tab: {navSidebarActiveTab === "built-in" ? "Palot" : "Folio"}</span>
				</CommandItem>
				<CommandItem
					keywords={["browser", "web", "webview", "inline browser", "panel"]}
					onSelect={() => {
						toggleBrowserPanel()
						onOpenChange(false)
					}}
				>

						{availableSurfaceTabs.find((surface) => surface.id === "browser")?.icon ?? <MonitorIcon />}
						<span>{browserPanelEnabled ? "Disable Browser Panel" : "Enable Browser Panel"}</span>
						{browserPanelEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["notes", "surface", "side panel"]}
						onSelect={() => {
							toggleNotesSurface()
							onOpenChange(false)
						}}
					>
						<BookTextIcon />
						<span>{notesSurfaceEnabled ? "Disable Notes Surface" : "Enable Notes Surface"}</span>
						{notesSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["pulse", "surface", "heartbeat", "telemetry"]}
						onSelect={() => {
							togglePulseSurface()
							onOpenChange(false)
						}}
					>
						<SparklesIcon />
						<span>{pulseSurfaceEnabled ? "Disable Pulse Surface" : "Enable Pulse Surface"}</span>
						{pulseSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["memory", "surface", "context"]}
						onSelect={() => {
							toggleMemorySurface()
							onOpenChange(false)
						}}
					>
						<DatabaseIcon />
						<span>{memorySurfaceEnabled ? "Disable Memory Surface" : "Enable Memory Surface"}</span>
						{memorySurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["files", "surface", "review", "project files"]}
						onSelect={() => {
							toggleFilesSurface()
							onOpenChange(false)
						}}
					>
						<FilesIcon />
						<span>{filesSurfaceEnabled ? "Disable Files Surface" : "Enable Files Surface"}</span>
						{filesSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["terminal", "shell", "pty", "attach"]}
						onSelect={() => {
							toggleTerminalSurface()
							onOpenChange(false)
						}}
					>
						<TerminalSquareIcon />
						<span>{terminalSurfaceEnabled ? "Disable Terminal Surface" : "Enable Terminal Surface"}</span>
						{terminalSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["plugins", "skills", "mcp", "integrations"]}
						onSelect={() => {
							togglePluginsSurface()
							onOpenChange(false)
						}}
					>
						<PlugIcon />
						<span>{pluginsSurfaceEnabled ? "Disable Plugins Surface" : "Enable Plugins Surface"}</span>
						{pluginsSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["bridges", "connectors", "integrations", "hub"]}
						onSelect={() => {
							toggleBridgesSurface()
							onOpenChange(false)
						}}
					>
						<Share2Icon />
						<span>{bridgesSurfaceEnabled ? "Disable Bridges Surface" : "Enable Bridges Surface"}</span>
						{bridgesSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["crm", "contacts", "people", "relationships"]}
						onSelect={() => {
							toggleCrmSurface()
							onOpenChange(false)
						}}
					>
						<UsersIcon />
						<span>{crmSurfaceEnabled ? "Disable Contacts / CRM Surface" : "Enable Contacts / CRM Surface"}</span>
						{crmSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["studio", "office", "documents", "preview"]}
						onSelect={() => {
							toggleStudioSurface()
							onOpenChange(false)
						}}
					>
						<MonitorPlayIcon />
						<span>{studioSurfaceEnabled ? "Disable Studio / Office Surface" : "Enable Studio / Office Surface"}</span>
						{studioSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["voice", "speech", "microphone", "audio"]}
						onSelect={() => {
							toggleVoiceSurface()
							onOpenChange(false)
						}}
					>
						<MicIcon />
						<span>{voiceSurfaceEnabled ? "Disable Voice Surface" : "Enable Voice Surface"}</span>
						{voiceSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["claude", "claude code", "migration", "compatibility"]}
						onSelect={() => {
							toggleClaudeSurface()
							onOpenChange(false)
						}}
					>
						<RectangleEllipsisIcon />
						<span>{claudeSurfaceEnabled ? "Disable Claude Code Surface" : "Enable Claude Code Surface"}</span>
						{claudeSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["ch5pm", "dashboard", "plane", "operator"]}
						onSelect={() => {
							toggleCh5PmSurface()
							onOpenChange(false)
						}}
					>
						<MonitorPlayIcon />
						<span>{ch5pmSurfaceEnabled ? "Disable CH5PM Dashboard" : "Enable CH5PM Dashboard"}</span>
						{ch5pmSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["pdf", "document", "reader", "annotations", "citations"]}
						onSelect={() => {
							togglePdfReviewSurface()
							onOpenChange(false)
						}}
					>
						<FileTextIcon />
						<span>{pdfReviewSurfaceEnabled ? "Disable PDF Review Surface" : "Enable PDF Review Surface"}</span>
						{pdfReviewSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["pdf", "pdf review", "document", "paper", "citation"]}
						onSelect={() => {
							togglePdfReviewSurface()
							onOpenChange(false)
						}}
					>
						<FileTextIcon />
						<span>{pdfReviewSurfaceEnabled ? "Disable PDF Review Surface" : "Enable PDF Review Surface"}</span>
						{pdfReviewSurfaceEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
				</CommandGroup>
				{hasSession && availableSurfaceTabs.length > 0 && (
					<>
						<CommandSeparator />
						<CommandGroup heading="Surfaces">
							{availableSurfaceTabs.map((surface) => (
								<CommandItem
									key={surface.id}
									onSelect={() => {
										openSidePanelTab(surface.target.tab)
										onOpenChange(false)
									}}
									disabled={!surface.availability.available}
								>
									{surface.icon}
									<span>{surface.title}</span>
									{!surface.availability.available && "reason" in surface.availability && (
										<span className="text-xs text-muted-foreground">{surface.availability.reason}</span>
									)}
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}

				<CommandSeparator />
				<CommandGroup heading="Developer">
					<CommandItem
						keywords={["demo", "mock", "screenshot", "marketing"]}
						onSelect={() => {
							toggleMockMode()
							onOpenChange(false)
						}}
					>
						<FilmIcon />
						<span>{isMockMode ? "Disable Demo Mode" : "Enable Demo Mode"}</span>
						{isMockMode && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					{import.meta.env.DEV && (
						<CommandItem
							keywords={["react", "scan", "render", "rerender", "performance", "debug"]}
							onSelect={() => {
								toggleReactScan()
								onOpenChange(false)
							}}
						>
							<ScanEyeIcon />
							<span>{isReactScan ? "Disable React Scan" : "Enable React Scan"}</span>
							{isReactScan && <CheckIcon className="ml-auto h-4 w-4" />}
						</CommandItem>
					)}
					{import.meta.env.DEV && (
						<CommandItem
							keywords={["dev", "surface", "inspect", "props", "toolbar", "debug"]}
							onSelect={() => {
								toggleDevSurface()
								onOpenChange(false)
							}}
						>
							<WrenchIcon />
							<span>{isDevSurface ? "Disable Dev Surface" : "Enable Dev Surface"}</span>
							{isDevSurface && <CheckIcon className="ml-auto h-4 w-4" />}
						</CommandItem>
					)}
				</CommandGroup>

				{activeSessions.length > 0 && (
					<>
						<CommandSeparator />
						<CommandGroup heading="Active Sessions">
							{activeSessions.map((agent) => (
								<CommandItem
									key={agent.id}
									onSelect={() => {
										navigate({
											to: "/project/$projectSlug/session/$sessionId",
											params: { projectSlug: agent.projectSlug, sessionId: agent.id },
										})
										onOpenChange(false)
									}}
								>
									{agent.environment === "cloud" ? (
										<CloudIcon />
									) : agent.environment === "vm" ? (
										<ContainerIcon />
									) : (
										<MonitorIcon />
									)}
									<span>{agent.name}</span>
									<span className="text-xs text-muted-foreground">{agent.project}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}

				{agents.length > 0 && (
					<>
						<CommandSeparator />
						<CommandGroup heading="All Sessions">
							{agents.map((agent) => (
								<CommandItem
									key={agent.id}
									onSelect={() => {
										navigate({
											to: "/project/$projectSlug/session/$sessionId",
											params: { projectSlug: agent.projectSlug, sessionId: agent.id },
										})
										onOpenChange(false)
									}}
								>
									<GitBranchIcon />
									<span>{agent.name}</span>
									<SessionMetricsLabel sessionId={agent.id} project={agent.project} />
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}
			</CommandList>
		</CommandDialog>
	)
}

function SessionMetricsLabel({ sessionId, project }: { sessionId: string; project: string }) {
	const metrics = useAtomValue(sessionMetricsFamily(sessionId))
	return (
		<span className="text-xs text-muted-foreground">
			{project} &middot; {metrics.workTime}
			{metrics.costRaw > 0 && ` · ${metrics.cost}`}
		</span>
	)
}
