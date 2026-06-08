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
	CheckIcon,
	CloudIcon,
	ContainerIcon,
	EyeIcon,
	EyeOffIcon,
	FilmIcon,
	GitBranchIcon,
	GitForkIcon,
	MonitorIcon,
	MoonIcon,
	PaletteIcon,
	PanelRightCloseIcon,
	PanelRightOpenIcon,
	PlugIcon,
	PlusIcon,
	Redo2Icon,
	RefreshCwIcon,
	ScanEyeIcon,
	SparklesIcon,
	SunIcon,
	SunMoonIcon,
	Undo2Icon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { sessionMetricsFamily } from "../atoms/derived/session-metrics"
import { invokePluginCommand } from "../hooks/use-firefly-plugins"
import {
	automationsEnabledAtom,
	fireflySurfaceFlagAtoms,
	fireflySurfaceLabels,
	toggleAutomationsAtom,
} from "../atoms/feature-flags"
import {
	FIREFLY_SURFACE_REGISTRY,
	getFireflySurfaceTabs,
	type FireflySurfaceContext,
} from "../firefly-surface-registry"
import { isMockModeAtom, toggleMockModeAtom } from "../atoms/mock-mode"
import { opaqueWindowsAtom } from "../atoms/preferences"
import { isReactScanAtom, toggleReactScanAtom } from "../atoms/react-scan"
import { openSidePanelTabAtom, sidePanelOpenAtom } from "../atoms/ui"
import { useSessionRevert } from "../hooks/use-commands"
import { useFireflySurfaceContext } from "../hooks/use-firefly-surface-context"
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
	const automationsEnabled = useAtomValue(automationsEnabledAtom)
	const toggleAutomations = useSetAtom(toggleAutomationsAtom)
	const { flags } = useFireflySurfaceContext()
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
						.filter((a) => a.visibilityReason === "visible" && a.status !== "idle")
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
				review: flags.review,
				browserPanelEnabled: flags.browserPanelEnabled,
				notes: flags.notes,
				pulse: flags.pulse,
				artifacts: flags.artifacts,
				memory: flags.memory,
				files: flags.files,
				terminal: flags.terminal,
				editor: flags.editor,
				plugins: flags.plugins,
				bridges: flags.bridges,
				crm: flags.crm,
				studio: flags.studio,
				voice: flags.voice,
				oracle: flags.oracle,
				claude: flags.claude,
				ch5pm: flags.ch5pm,
				pdfReview: flags.pdfReview,
			},
			chatTurnCount: 1,
		}
	}, [
		activeAgent,
		flags.review,
		flags.browserPanelEnabled,
		flags.notes,
		flags.pulse,
		flags.artifacts,
		flags.memory,
		flags.files,
		flags.terminal,
		flags.editor,
		flags.plugins,
		flags.bridges,
		flags.crm,
		flags.studio,
		flags.voice,
		flags.oracle,
		flags.claude,
		flags.ch5pm,
		flags.pdfReview,
	])

	const toggleReviewSurface = useSetAtom(fireflySurfaceFlagAtoms.review)
	const toggleBrowserSurface = useSetAtom(fireflySurfaceFlagAtoms.browser)
	const toggleNotesSurface = useSetAtom(fireflySurfaceFlagAtoms.notes)
	const togglePulseSurface = useSetAtom(fireflySurfaceFlagAtoms.pulse)
	const toggleArtifactsSurface = useSetAtom(fireflySurfaceFlagAtoms.artifacts)
	const toggleMemorySurface = useSetAtom(fireflySurfaceFlagAtoms.memory)
	const toggleFilesSurface = useSetAtom(fireflySurfaceFlagAtoms.files)
	const toggleTerminalSurface = useSetAtom(fireflySurfaceFlagAtoms.terminal)
	const toggleEditorSurface = useSetAtom(fireflySurfaceFlagAtoms.editor)
	const togglePluginsSurface = useSetAtom(fireflySurfaceFlagAtoms.plugins)
	const toggleBridgesSurface = useSetAtom(fireflySurfaceFlagAtoms.bridges)
	const toggleCrmSurface = useSetAtom(fireflySurfaceFlagAtoms.crm)
	const toggleStudioSurface = useSetAtom(fireflySurfaceFlagAtoms.studio)
	const toggleVoiceSurface = useSetAtom(fireflySurfaceFlagAtoms.voice)
	const toggleOracleSurface = useSetAtom(fireflySurfaceFlagAtoms.oracle)
	const toggleClaudeSurface = useSetAtom(fireflySurfaceFlagAtoms.claude)
	const toggleCh5pmSurface = useSetAtom(fireflySurfaceFlagAtoms.ch5pm)
	const togglePdfReviewSurface = useSetAtom(fireflySurfaceFlagAtoms["pdf-review"])

	const surfaceToggles: Record<
		typeof FIREFLY_SURFACE_REGISTRY[number]["id"],
		(update: boolean | ((prev: boolean) => boolean)) => void
	> = {
		review: toggleReviewSurface,
		browser: toggleBrowserSurface,
		notes: toggleNotesSurface,
		pulse: togglePulseSurface,
		artifacts: toggleArtifactsSurface,
		memory: toggleMemorySurface,
		files: toggleFilesSurface,
		terminal: toggleTerminalSurface,
		editor: toggleEditorSurface,
		plugins: togglePluginsSurface,
		bridges: toggleBridgesSurface,
		crm: toggleCrmSurface,
		studio: toggleStudioSurface,
		voice: toggleVoiceSurface,
		oracle: toggleOracleSurface,
		claude: toggleClaudeSurface,
		ch5pm: toggleCh5pmSurface,
		"pdf-review": togglePdfReviewSurface,
	}

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
					{FIREFLY_SURFACE_REGISTRY.map((surface) => {
						const Icon = surface.icon
						const enabled =
							surface.id === "browser"
								? flags.browserPanelEnabled
								: surface.id === "pdf-review"
									? flags.pdfReview
									: flags[surface.id]
						const label = fireflySurfaceLabels[surface.id]
						const toggleSurface = surfaceToggles[surface.id]
						return (
							<CommandItem
								key={surface.id}
								keywords={surface.commandIds.concat(label.toLowerCase(), surface.id, surface.title.toLowerCase())}
								onSelect={() => {
									toggleSurface((prev) => !prev)
									onOpenChange(false)
								}}
							>
								<Icon />
								<span>{enabled ? `Disable ${label}` : `Enable ${label}`}</span>
								{enabled && <CheckIcon className="ml-auto h-4 w-4" />}
							</CommandItem>
						)
					})}
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
