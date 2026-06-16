import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@ch5me/ch5-ui-web"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	ActivityIcon,
	BlocksIcon,
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
	SquarePenIcon,
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
import { invokePluginCommand, useFireflyPlugins } from "../hooks/use-firefly-plugins"
import { useQueryClient } from "@tanstack/react-query"
import {
	automationsEnabledAtom,
	// browserPanelEnabledAtom removed — browser is catalog-served (firefly.built-in.surface.browser).
	// ch5pmSurfaceEnabledAtom removed — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
	// claudeSurfaceEnabledAtom removed — claude is catalog-served (firefly.built-in.surface.claude).
	crmSurfaceEnabledAtom,
	pluginsSurfaceEnabledAtom,
	// pdfReviewSurfaceEnabledAtom removed — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).
	// studioSurfaceEnabledAtom removed — studio is catalog-served (firefly.built-in.surface.studio).
	// voiceSurfaceEnabledAtom removed — voice is catalog-served (firefly.built-in.surface.voice).
	toggleAutomationsAtom,
	// toggleBrowserPanelAtom removed — browser is catalog-served; toggle via window.elf.plugins.setEnabled.
	// toggleCh5PmSurfaceAtom removed — ch5pm is catalog-served; toggle via window.elf.plugins.setEnabled.
	// toggleClaudeSurfaceAtom removed — claude is catalog-served; toggle via window.elf.plugins.setEnabled.
	toggleCrmSurfaceAtom,
	// togglePdfReviewSurfaceAtom removed — pdf-review is catalog-served; toggle via window.elf.plugins.setEnabled.
	togglePluginsSurfaceAtom,
	// toggleStudioSurfaceAtom removed — studio is catalog-served; toggle via window.elf.plugins.setEnabled.
	// toggleVoiceSurfaceAtom removed — voice is catalog-served; toggle via window.elf.plugins.setEnabled.
} from "../atoms/feature-flags"
import { getFireflySurfaceTabs, type FireflySurfaceContext } from "../firefly-surface-registry"
import { mergeSurfaceTabs } from "../firefly-plugin-surface-merge"
import { useCatalogSurfaceTabs } from "../firefly-plugin-surfaces"
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
	// browserPanelEnabled removed — browser is catalog-served (firefly.built-in.surface.browser).
	// terminalSurfaceEnabled removed — terminal is catalog-served (firefly.built-in.surface.terminal).
	// claudeSurfaceEnabled removed — claude is catalog-served (firefly.built-in.surface.claude).
	// voiceSurfaceEnabled removed — voice is catalog-served (firefly.built-in.surface.voice).
	// studioSurfaceEnabled removed — studio is catalog-served (firefly.built-in.surface.studio).
	// ch5pmSurfaceEnabled removed — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
	const pluginsSurfaceEnabled = useAtomValue(pluginsSurfaceEnabledAtom)
	const crmSurfaceEnabled = useAtomValue(crmSurfaceEnabledAtom)
	// pdfReviewSurfaceEnabled removed — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).
	// toggleBrowserPanel removed — browser is catalog-served; toggle via browserPluginEnabled + window.elf.plugins.setEnabled.
	const togglePluginsSurface = useSetAtom(togglePluginsSurfaceAtom)
	const toggleCrmSurface = useSetAtom(toggleCrmSurfaceAtom)
	// toggleStudioSurface removed — studio is catalog-served; toggle via studioPluginEnabled + window.elf.plugins.setEnabled.
	// toggleVoiceSurface removed — voice is catalog-served; toggle via voicePluginEnabled + window.elf.plugins.setEnabled.
	// toggleCh5PmSurface removed — ch5pm is catalog-served; toggle via ch5pmPluginEnabled + window.elf.plugins.setEnabled.
	// togglePdfReviewSurface removed — pdf-review is catalog-served; toggle via pdfReviewPluginEnabled + window.elf.plugins.setEnabled.
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
				plugins: pluginsSurfaceEnabled,
				crm: crmSurfaceEnabled,
				// ch5pm removed — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
				// pdfReview removed — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).
			},
			chatTurnCount: 1,
		}
	}, [
		activeAgent,
		pluginsSurfaceEnabled,
		crmSurfaceEnabled,
	])


	// Browser is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const queryClient = useQueryClient()
	const { data: pluginList } = useFireflyPlugins()
	const browserPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.browser",
	)
	const browserPluginEnabled = browserPluginEntry
		? browserPluginEntry.status !== "disabled" && browserPluginEntry.status !== "quarantined"
		: true
	const toggleBrowserPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.browser", !browserPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [browserPluginEnabled, queryClient])

	// Notes is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const notesPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.notes",
	)
	const notesPluginEnabled = notesPluginEntry
		? notesPluginEntry.status !== "disabled" && notesPluginEntry.status !== "quarantined"
		: true
	const toggleNotesPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.notes", !notesPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [notesPluginEnabled, queryClient])

	// Review is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const reviewPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.review",
	)
	const reviewPluginEnabled = reviewPluginEntry
		? reviewPluginEntry.status !== "disabled" && reviewPluginEntry.status !== "quarantined"
		: true
	const toggleReviewPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.review", !reviewPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [reviewPluginEnabled, queryClient])

	// Files is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const filesPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.files",
	)
	const filesPluginEnabled = filesPluginEntry
		? filesPluginEntry.status !== "disabled" && filesPluginEntry.status !== "quarantined"
		: true
	const toggleFilesPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.files", !filesPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [filesPluginEnabled, queryClient])

	// Bridges is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const bridgesPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.bridges",
	)
	const bridgesPluginEnabled = bridgesPluginEntry
		? bridgesPluginEntry.status !== "disabled" && bridgesPluginEntry.status !== "quarantined"
		: true
	const toggleBridgesPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.bridges", !bridgesPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [bridgesPluginEnabled, queryClient])

	// Pulse is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const pulsePluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.pulse",
	)
	const pulsePluginEnabled = pulsePluginEntry
		? pulsePluginEntry.status !== "disabled" && pulsePluginEntry.status !== "quarantined"
		: false
	const togglePulsePlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.pulse", !pulsePluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [pulsePluginEnabled, queryClient])

	// Memory is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const memoryPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.memory",
	)
	const memoryPluginEnabled = memoryPluginEntry
		? memoryPluginEntry.status !== "disabled" && memoryPluginEntry.status !== "quarantined"
		: false
	const toggleMemoryPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.memory", !memoryPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [memoryPluginEnabled, queryClient])

	// Editor is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const editorPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.editor",
	)
	const editorPluginEnabled = editorPluginEntry
		? editorPluginEntry.status !== "disabled" && editorPluginEntry.status !== "quarantined"
		: true
	const toggleEditorPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.editor", !editorPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [editorPluginEnabled, queryClient])

	// Terminal is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const terminalPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.terminal",
	)
	const terminalPluginEnabled = terminalPluginEntry
		? terminalPluginEntry.status !== "disabled" && terminalPluginEntry.status !== "quarantined"
		: true
	const toggleTerminalPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.terminal", !terminalPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [terminalPluginEnabled, queryClient])

	// Claude Code is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const claudePluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.claude",
	)
	const claudePluginEnabled = claudePluginEntry
		? claudePluginEntry.status !== "disabled" && claudePluginEntry.status !== "quarantined"
		: true
	const toggleClaudePlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.claude", !claudePluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [claudePluginEnabled, queryClient])

	// Voice is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const voicePluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.voice",
	)
	const voicePluginEnabled = voicePluginEntry
		? voicePluginEntry.status !== "disabled" && voicePluginEntry.status !== "quarantined"
		: true
	const toggleVoicePlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.voice", !voicePluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [voicePluginEnabled, queryClient])

	// CH5PM Dashboard is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const ch5pmPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.ch5pm",
	)
	const ch5pmPluginEnabled = ch5pmPluginEntry
		? ch5pmPluginEntry.status !== "disabled" && ch5pmPluginEntry.status !== "quarantined"
		: false
	const toggleCh5pmPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.ch5pm", !ch5pmPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [ch5pmPluginEnabled, queryClient])

	// Studio is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const studioPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.studio",
	)
	const studioPluginEnabled = studioPluginEntry
		? studioPluginEntry.status !== "disabled" && studioPluginEntry.status !== "quarantined"
		: true
	const toggleStudioPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.studio", !studioPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [studioPluginEnabled, queryClient])

	// PDF Review is a catalog-served plugin: its enable/disable flows through
	// the host plugin lifecycle, not a renderer feature-flag atom.
	const pdfReviewPluginEntry = pluginList?.plugins.find(
		(plugin) => plugin.pluginId === "firefly.built-in.surface.pdf-review",
	)
	const pdfReviewPluginEnabled = pdfReviewPluginEntry
		? pdfReviewPluginEntry.status !== "disabled" && pdfReviewPluginEntry.status !== "quarantined"
		: false
	const togglePdfReviewPlugin = useCallback(async () => {
		await window.elf?.plugins.setEnabled("firefly.built-in.surface.pdf-review", !pdfReviewPluginEnabled)
		await queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
	}, [pdfReviewPluginEnabled, queryClient])

	const catalogSurfaceTabs = useCatalogSurfaceTabs(activeAgent)
	const availableSurfaceTabs = useMemo(
		() =>
			surfaceContext
				? mergeSurfaceTabs(getFireflySurfaceTabs(surfaceContext), catalogSurfaceTabs)
				: [],
		[surfaceContext, catalogSurfaceTabs],
	)
	const availableUtilitySurfaceTabs = useMemo(
		() =>
			availableSurfaceTabs.filter(
				(surface) => surface.lane === "utility" && surface.availability.available,
			),
		[availableSurfaceTabs],
	)
	const hasAvailableUtilitySurfaceTab = availableUtilitySurfaceTabs.length > 0

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
								if (!hasAvailableUtilitySurfaceTab) return
								setSidePanelOpen((prev) => !prev)
								onOpenChange(false)
							}}
							disabled={!hasAvailableUtilitySurfaceTab}
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
						keywords={["review", "changes", "diff", "side panel", "plugin"]}
						onSelect={() => {
							void toggleReviewPlugin()
							onOpenChange(false)
						}}
					>
						<FileDiffIcon />
						<span>{reviewPluginEnabled ? "Disable Changes Surface" : "Enable Changes Surface"}</span>
						{reviewPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
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
						void toggleBrowserPlugin()
						onOpenChange(false)
					}}
				>
						{availableSurfaceTabs.find((surface) => surface.id === "browser")?.icon ?? <MonitorIcon />}
						<span>{browserPluginEnabled ? "Disable Browser Panel" : "Enable Browser Panel"}</span>
						{browserPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["notes", "surface", "side panel", "plugin"]}
						onSelect={() => {
							void toggleNotesPlugin()
							onOpenChange(false)
						}}
					>
						<BookTextIcon />
						<span>{notesPluginEnabled ? "Disable Notes Surface" : "Enable Notes Surface"}</span>
						{notesPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["pulse", "surface", "heartbeat", "telemetry"]}
						onSelect={() => {
							void togglePulsePlugin()
							onOpenChange(false)
						}}
					>
						<ActivityIcon />
						<span>{pulsePluginEnabled ? "Disable Pulse Surface" : "Enable Pulse Surface"}</span>
						{pulsePluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["memory", "surface", "context"]}
						onSelect={() => {
							void toggleMemoryPlugin()
							onOpenChange(false)
						}}
					>
						<DatabaseIcon />
						<span>{memoryPluginEnabled ? "Disable Memory Surface" : "Enable Memory Surface"}</span>
						{memoryPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["files", "surface", "review", "project files"]}
						onSelect={() => {
							void toggleFilesPlugin()
							onOpenChange(false)
						}}
					>
						<FilesIcon />
						<span>{filesPluginEnabled ? "Disable Files Surface" : "Enable Files Surface"}</span>
						{filesPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["terminal", "shell", "pty", "attach"]}
						onSelect={() => {
							void toggleTerminalPlugin()
							onOpenChange(false)
						}}
					>
						<TerminalSquareIcon />
						<span>{terminalPluginEnabled ? "Disable Terminal Surface" : "Enable Terminal Surface"}</span>
						{terminalPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["editor", "monaco", "code", "file", "text"]}
						onSelect={() => {
							void toggleEditorPlugin()
							onOpenChange(false)
						}}
					>
						<SquarePenIcon />
						<span>{editorPluginEnabled ? "Disable Editor Surface" : "Enable Editor Surface"}</span>
						{editorPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
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
							void toggleBridgesPlugin()
							onOpenChange(false)
						}}
					>
						<Share2Icon />
						<span>{bridgesPluginEnabled ? "Disable Bridges Surface" : "Enable Bridges Surface"}</span>
						{bridgesPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
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
						onSelect={async () => {
							await toggleStudioPlugin()
							onOpenChange(false)
						}}
					>
						<MonitorPlayIcon />
						<span>{studioPluginEnabled ? "Disable Studio / Office Surface" : "Enable Studio / Office Surface"}</span>
						{studioPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["voice", "speech", "microphone", "audio"]}
						onSelect={async () => {
							await toggleVoicePlugin()
							onOpenChange(false)
						}}
					>
						<MicIcon />
						<span>{voicePluginEnabled ? "Disable Voice Surface" : "Enable Voice Surface"}</span>
						{voicePluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["claude", "claude code", "migration", "compatibility"]}
						onSelect={async () => {
							await toggleClaudePlugin()
							onOpenChange(false)
						}}
					>
						<RectangleEllipsisIcon />
						<span>{claudePluginEnabled ? "Disable Claude Code Surface" : "Enable Claude Code Surface"}</span>
						{claudePluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["ch5pm", "dashboard", "plane", "operator"]}
						onSelect={async () => {
							await toggleCh5pmPlugin()
							onOpenChange(false)
						}}
					>
						<MonitorPlayIcon />
						<span>{ch5pmPluginEnabled ? "Disable CH5PM Dashboard" : "Enable CH5PM Dashboard"}</span>
						{ch5pmPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
					</CommandItem>
					<CommandItem
						keywords={["pdf", "document", "reader", "annotations", "citations"]}
						onSelect={async () => {
							await togglePdfReviewPlugin()
							onOpenChange(false)
						}}
					>
						<FileTextIcon />
						<span>{pdfReviewPluginEnabled ? "Disable PDF Review Surface" : "Enable PDF Review Surface"}</span>
						{pdfReviewPluginEnabled && <CheckIcon className="ml-auto h-4 w-4" />}
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
										openSidePanelTab(surface.id)
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
