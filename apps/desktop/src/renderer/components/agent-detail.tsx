import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@ch5me/ch5-ui-web"
import { useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	PanelBottomIcon,
	PanelRightIcon,
} from "lucide-react"
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import type { DockviewApi } from "dockview-react"
import type { OpenInTarget } from "../../preload/api"
import {
	// ch5pmSurfaceEnabledAtom removed — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
	// claudeSurfaceEnabledAtom removed — claude is catalog-served (firefly.built-in.surface.claude).
	// crmSurfaceEnabledAtom removed — crm is catalog-served (firefly.built-in.surface.crm).
	// oracleSurfaceEnabledAtom removed — oracle is catalog-served (firefly.built-in.surface.oracle).
	// voiceSurfaceEnabledAtom removed — voice is catalog-served (firefly.built-in.surface.voice).
	// browserPanelEnabledAtom removed — browser is catalog-served (firefly.built-in.surface.browser).
	// studioSurfaceEnabledAtom removed — studio is catalog-served (firefly.built-in.surface.studio).
	pluginsSurfaceEnabledAtom,
	// pdfReviewSurfaceEnabledAtom removed — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).
	// workspaceDockEnabledAtom removed — dock is now the sole session UI (Cleanup phase).
} from "../atoms/feature-flags"
import { useColorScheme } from "../hooks/use-theme"
import { loadDockLayout, saveDockLayout } from "../surface-host/persistence"
import { useSurfaceRegistry } from "../surface-host/surface-host-provider"
import { DockShell, type DockSeedPanel } from "../workspace/dock-shell"
import { surfacePropBridge, useSurfaceProps } from "../workspace/surface-prop-bridge"
import {
	getFireflySurfaceTabs,
	type FireflySurfaceContext,
} from "../firefly-surface-registry"
import { mergeSurfaceTabs } from "../firefly-plugin-surface-merge"
import { useCatalogSurfaceTabs } from "../firefly-plugin-surfaces"
import {
	closeDocumentPanelAtom,
	type DocumentPanelTabId,
	documentPanelActiveTabAtom,
	documentPanelOpenAtom,
	isDocumentPanelTab,
	paneRoutingStateAtom,
	reviewPanelSettingsAtom,
	setAvailableDocumentPanelTabsAtom,
	sessionDiffStatsFamily,
	setAvailableSidePanelTabsAtom,
	setDocumentPanelActiveTabAtom,
	setDocumentPanelOpenAtom,
	setSidePanelActiveTabAtom,
	sidePanelActiveTabAtom,
	sidePanelOpenAtom,
	type UtilitySidePanelTabId,
} from "../atoms/ui"
import type {
	ConfigData,
	ModelRef,
	ProvidersData,
	SdkAgent,
	VcsData,
} from "../hooks/use-opencode-data"
import { useServerConnection } from "../hooks/use-server"
import type { ChatTurn } from "../hooks/use-session-chat"
import type { Agent, FileAttachment, QuestionAnswer } from "../lib/types"
import {
	fetchOpenInTargets,
	fetchPalotUiStateSnapshot,
	isElectron,
	openInTarget,
	subscribeToPalotOpenSidePanel,
	syncPalotUiStateSnapshot,
} from "../services/backend"
import { useSetAppBarContent } from "./app-bar-context"
import { ChatView } from "./chat"
import type { SidePanelTabDef } from "./side-panel/side-panel-tabs"
import { WorktreeActions } from "./worktree-actions"


interface AgentDetailProps {
	agent: Agent
	chatTurns: ChatTurn[]
	chatLoading?: boolean
	chatLoadingEarlier?: boolean
	chatHasEarlier?: boolean
	onLoadEarlier?: () => void
	onStop?: (agent: Agent) => Promise<void>
	onApprove?: (
		agent: Agent,
		permissionSessionId: string,
		permissionId: string,
		response?: "once" | "always",
	) => Promise<void>
	onDeny?: (agent: Agent, permissionSessionId: string, permissionId: string) => Promise<void>
	onReplyQuestion?: (agent: Agent, requestId: string, answers: QuestionAnswer[]) => Promise<void>
	onRejectQuestion?: (agent: Agent, requestId: string) => Promise<void>
	onSendMessage?: (
		agent: Agent,
		message: string,
		options?: { model?: ModelRef; agentName?: string; variant?: string; files?: FileAttachment[] },
	) => Promise<void>
	onRename?: (agent: Agent, title: string) => Promise<void>
	parentSessionName?: string
	isConnected?: boolean
	providers?: ProvidersData | null
	config?: ConfigData | null
	vcs?: VcsData | null
	openCodeAgents?: SdkAgent[]
	canUndo?: boolean
	canRedo?: boolean
	onUndo?: () => Promise<string | undefined>
	onRedo?: () => Promise<void>
	isReverted?: boolean
	onRevertToMessage?: (messageId: string) => Promise<void>
	onForkFromTurn?: (messageId?: string) => Promise<void>
	onDeletePart?: (sessionId: string, messageId: string, partId: string) => Promise<void>
}

// ============================================================
// Workspace dock surfaces
//
// Each surface is mounted ONCE into the hidden host layer by stable identity.
// Live props flow through the surfacePropBridge (the host layer renders in a
// different React subtree than AgentDetail, so closure props would freeze).
// ============================================================

type ChatSurfaceProps = ComponentProps<typeof ChatView>

/** Live ChatView surface: reads the latest chat props published for its identity. */
function ChatSurface({ instanceId }: { instanceId: string }) {
	const props = useSurfaceProps<ChatSurfaceProps>(instanceId)
	if (!props) return null
	return <ChatView {...props} />
}

/**
 * Generic tab surface: re-renders when the published render closure changes.
 *
 * `SidePanelTabDef.render()` is a pre-bound closure that captures the latest
 * FireflySurfaceContext. AgentDetail republishes it via the surfacePropBridge
 * every render (whenever agent/flags change a new `render` fn is produced by
 * the `useMemo` that builds surfaceTabs). TabSurface calls it to render fresh
 * content without remounting the host.
 *
 * NOTE: Jotai store and React Query client are at app root (above the hidden
 * host layer) so atom reads and query hooks inside panels work normally.
 * The `agent` object and feature-flag booleans reach panels via this closure.
 */
function TabSurface({ instanceId }: { instanceId: string }) {
	const renderFn = useSurfaceProps<() => ReactNode>(instanceId)
	if (!renderFn) return null
	return <>{renderFn()}</>
}

/** Resolve the active dark/light mode for theming the dock. */
function useIsDarkMode(): boolean {
	const scheme = useColorScheme()
	if (scheme === "system") {
		return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
	}
	return scheme === "dark"
}

export function AgentDetail({
	agent,
	chatTurns,
	chatLoading,
	onStop,
	onApprove,
	onDeny,
	onReplyQuestion,
	onRejectQuestion,
	onSendMessage,
	onRename,
	// parentSessionName — accepted for API compatibility; not rendered (dock-native chat panel handles it internally).
	isConnected,
	providers,
	config,
	vcs,
	openCodeAgents,
	chatLoadingEarlier,
	chatHasEarlier,
	onLoadEarlier,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	isReverted,
	onRevertToMessage,
	onForkFromTurn,
	onDeletePart,
}: AgentDetailProps) {
	const { projectSlug } = useParams({ strict: false }) as { projectSlug?: string }
	const setAppBarContent = useSetAppBarContent()

	const [isEditingTitle, setIsEditingTitle] = useState(false)
	const [titleValue, setTitleValue] = useState(agent.name)
	const titleInputRef = useRef<HTMLInputElement>(null)

	const [sidePanelOpen, setSidePanelOpen] = useAtom(sidePanelOpenAtom)
	const sidePanelActiveTab = useAtomValue(sidePanelActiveTabAtom)
	const documentPanelOpen = useAtomValue(documentPanelOpenAtom)
	const documentPanelActiveTab = useAtomValue(documentPanelActiveTabAtom)
	const closeDocumentPanel = useSetAtom(closeDocumentPanelAtom)
	const setDocumentPanelActiveTab = useSetAtom(setDocumentPanelActiveTabAtom)
	const setDocumentPanelOpen = useSetAtom(setDocumentPanelOpenAtom)
	const setSidePanelActiveTab = useSetAtom(setSidePanelActiveTabAtom)
	const setAvailableSidePanelTabs = useSetAtom(setAvailableSidePanelTabsAtom)
	const setAvailableDocumentPanelTabs = useSetAtom(setAvailableDocumentPanelTabsAtom)
	const [, setReviewSettings] = useAtom(reviewPanelSettingsAtom)

	const prevSessionIdRef = useRef(agent.sessionId)
	const diffStats = useAtomValue(sessionDiffStatsFamily(agent.sessionId))
	useEffect(() => {
		if (prevSessionIdRef.current !== agent.sessionId) {
			prevSessionIdRef.current = agent.sessionId
			if (diffStats.fileCount === 0 && sidePanelActiveTab === "review") {
				setSidePanelOpen(false)
			}
			if (!documentPanelOpen) {
				closeDocumentPanel()
			}
		}
	}, [
		agent.sessionId,
		closeDocumentPanel,
		diffStats.fileCount,
		documentPanelOpen,
		setSidePanelOpen,
		sidePanelActiveTab,
	])

	const startEditingTitle = useCallback(() => {
		if (!onRename) return
		setTitleValue(agent.name)
		setIsEditingTitle(true)
	}, [agent.name, onRename])

	const confirmTitle = useCallback(async () => {
		const trimmed = titleValue.trim()
		setIsEditingTitle(false)
		if (trimmed && trimmed !== agent.name && onRename) {
			await onRename(agent, trimmed)
		}
	}, [titleValue, agent, onRename])

	const cancelEditingTitle = useCallback(() => {
		setIsEditingTitle(false)
		setTitleValue(agent.name)
	}, [agent.name])

	useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus()
			titleInputRef.current.select()
		}
	}, [isEditingTitle])

	// browserPanelEnabled removed — browser is catalog-served (firefly.built-in.surface.browser).
	// terminalSurfaceEnabled removed — terminal is catalog-served (firefly.built-in.surface.terminal).
	// claudeSurfaceEnabled removed — claude is catalog-served (firefly.built-in.surface.claude).
	// oracleSurfaceEnabled removed — oracle is catalog-served (firefly.built-in.surface.oracle).
	// voiceSurfaceEnabled removed — voice is catalog-served (firefly.built-in.surface.voice).
	// studioSurfaceEnabled removed — studio is catalog-served (firefly.built-in.surface.studio).
	const pluginsSurfaceEnabled = useAtomValue(pluginsSurfaceEnabledAtom)
	// crmSurfaceEnabled removed — crm is catalog-served (firefly.built-in.surface.crm).
	// ch5pmSurfaceEnabled removed — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
	// pdfReviewSurfaceEnabled removed — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).

	const catalogSurfaceTabs = useCatalogSurfaceTabs(agent)
	const surfaceTabs: SidePanelTabDef[] = useMemo(() => {
		const ctx: FireflySurfaceContext = {
			agent,
			diffStats,
			flags: {
				plugins: pluginsSurfaceEnabled,
			},
			chatTurnCount: chatTurns.length,
		}
		return mergeSurfaceTabs(getFireflySurfaceTabs(ctx), catalogSurfaceTabs)
	}, [
		agent,
		catalogSurfaceTabs,
		diffStats,
		pluginsSurfaceEnabled,
		chatTurns.length,
	])

	const availableSurfaceTabs = useMemo(
		() => surfaceTabs.filter((tab) => tab.availability.available),
		[surfaceTabs],
	)
	const findAvailableSurfaceTab = useCallback(
		(tabId: SidePanelTabDef["id"]): SidePanelTabDef | null =>
			availableSurfaceTabs.find((candidate) => candidate.id === tabId) ?? null,
		[availableSurfaceTabs],
	)
	const routeAvailableSurfaceTab = useCallback(
		(targetTab: SidePanelTabDef): void => {
			const targetTabId = targetTab.id
			if (targetTab.lane === "document" && isDocumentPanelTab(targetTabId)) {
				setDocumentPanelActiveTab(targetTabId)
				setDocumentPanelOpen(true)
				return
			}
			if (targetTab.lane === "utility" && !isDocumentPanelTab(targetTabId)) {
				setSidePanelActiveTab(targetTabId)
				setSidePanelOpen(true)
			}
		},
		[
			setDocumentPanelActiveTab,
			setDocumentPanelOpen,
			setSidePanelActiveTab,
			setSidePanelOpen,
		],
	)
	const docTabs = useMemo(
		() =>
			availableSurfaceTabs.filter(
				(tab): tab is SidePanelTabDef & { lane: "document"; id: DocumentPanelTabId } =>
					tab.lane === "document" && isDocumentPanelTab(tab.id),
			),
		[availableSurfaceTabs],
	)
	const utilityTabs = useMemo(
		() =>
			availableSurfaceTabs.filter(
				(tab): tab is SidePanelTabDef & { lane: "utility"; id: UtilitySidePanelTabId } =>
					tab.lane === "utility" && !isDocumentPanelTab(tab.id),
			),
		[availableSurfaceTabs],
	)

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
				if (e.key === "d" || e.key === "D") {
					if (utilityTabs.length === 0) return
					e.preventDefault()
					setSidePanelOpen((prev) => !prev)
				} else if (e.key === "f" || e.key === "F") {
					e.preventDefault()
					setReviewSettings((prev) => ({ ...prev, expanded: !prev.expanded }))
				}
			}
		}
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [setSidePanelOpen, setReviewSettings, utilityTabs.length])

	const activeDocTab = useMemo(
		() => docTabs.find((tab) => tab.id === documentPanelActiveTab) ?? docTabs[0] ?? null,
		[docTabs, documentPanelActiveTab],
	)
	// Doc lane restores from explicit snapshot state, then falls back to first
	// available doc surface when the remembered tab disappears.
	const docPanelVisible = documentPanelOpen && activeDocTab !== null

	useEffect(() => {
		setAvailableSidePanelTabs(utilityTabs.map((tab) => tab.id))
	}, [setAvailableSidePanelTabs, utilityTabs])

	useEffect(() => {
		setAvailableDocumentPanelTabs(docTabs.map((tab) => tab.id))
	}, [docTabs, setAvailableDocumentPanelTabs])

	useEffect(() => {
		void syncPalotUiStateSnapshot({
			sidePanel: {
				open: sidePanelOpen && utilityTabs.length > 0,
				activeTab: utilityTabs.length > 0 ? sidePanelActiveTab : null,
				availableTabs: utilityTabs.map((tab) => tab.id),
			},
			documentPanel: {
				open: docPanelVisible,
				activeTab: activeDocTab?.id ?? null,
				availableTabs: docTabs.map((tab) => tab.id),
			},
		}).catch(() => undefined)
	}, [activeDocTab?.id, docPanelVisible, docTabs, sidePanelActiveTab, sidePanelOpen, utilityTabs])

	useEffect(() => {
		const unsubscribe = subscribeToPalotOpenSidePanel(({ tab }) => {
			const targetTab = findAvailableSurfaceTab(tab)
			if (!targetTab) return
			routeAvailableSurfaceTab(targetTab)
		})
		return unsubscribe
	}, [findAvailableSurfaceTab, routeAvailableSurfaceTab])

	useEffect(() => {
		void fetchPalotUiStateSnapshot().then((snapshot) => {
			if (!snapshot) return
			const snapshotTabs = [
				snapshot.sidePanel.open ? snapshot.sidePanel.activeTab : null,
				snapshot.documentPanel.open ? snapshot.documentPanel.activeTab : null,
			].filter((tab): tab is SidePanelTabDef["id"] => tab !== null)
			for (const tab of snapshotTabs) {
				const targetTab = findAvailableSurfaceTab(tab)
				if (!targetTab) continue
				routeAvailableSurfaceTab(targetTab)
			}
		})
	}, [findAvailableSurfaceTab, routeAvailableSurfaceTab])

	useEffect(() => {
		setAppBarContent(
			<SessionAppBarContent
				agent={agent}
				isEditingTitle={isEditingTitle}
				titleValue={titleValue}
				titleInputRef={titleInputRef}
				onTitleValueChange={setTitleValue}
				onStartEditing={startEditingTitle}
				onConfirmTitle={confirmTitle}
				onCancelEditing={cancelEditingTitle}
				onRename={onRename}
				projectSlug={projectSlug}
				sidePanelOpen={sidePanelOpen}
				hasAvailableSidePanel={utilityTabs.length > 0}
				onToggleSidePanel={() => {
					if (utilityTabs.length === 0) return
					setSidePanelOpen((prev) => !prev)
				}}
				documentPanelOpen={documentPanelOpen}
				hasAvailableDocument={docTabs.length > 0}
				onToggleDocumentPanel={() => setDocumentPanelOpen(!documentPanelOpen)}
			/>,
		)

		return () => setAppBarContent(null)
	}, [
		agent,
		isEditingTitle,
		titleValue,
		startEditingTitle,
		confirmTitle,
		cancelEditingTitle,
		onRename,
		projectSlug,
		setAppBarContent,
		sidePanelOpen,
		setSidePanelOpen,
		utilityTabs,
		docTabs,
		documentPanelOpen,
		setDocumentPanelOpen,
	])

	const chatViewProps: ComponentProps<typeof ChatView> = {
		turns: chatTurns,
		loading: chatLoading ?? false,
		loadingEarlier: chatLoadingEarlier ?? false,
		hasEarlierMessages: chatHasEarlier ?? false,
		onLoadEarlier,
		agent,
		isConnected: isConnected ?? false,
		onSendMessage,
		onStop,
		providers,
		config,
		vcs,
		openCodeAgents,
		onApprove,
		onDeny,
		onReplyQuestion,
		onRejectQuestion,
		canUndo,
		canRedo,
		onUndo,
		onRedo,
		isReverted,
		onRevertToMessage,
		onForkFromTurn,
		onDeletePart,
		sidePanelOpen,
	}

	// ========== Workspace dock (sole session UI — legacy SplitPane removed in Cleanup) ==========
	const isDarkMode = useIsDarkMode()
	const registry = useSurfaceRegistry()
	const chatInstanceId = `chat:${agent.sessionId}:view-main`

	// Load persisted dock layout once (session-agnostic: keyed by surfaceType).
	// null on first load or parse failure → default zones unchanged.
	const persistedDockLayout = useMemo(() => loadDockLayout(), [])

	// Subscribe to registry dock panel changes so we can debounce-save on moves.
	const dockPanelRecords = useSyncExternalStore(
		(cb) => registry.subscribe(cb),
		() => registry.dockPanelRecords,
	)

	// Debounced save: 500 ms after the last dock panel change, persist to localStorage.
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
		saveTimerRef.current = setTimeout(() => {
			saveDockLayout(dockPanelRecords)
		}, 500)
		return () => {
			if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
		}
	}, [dockPanelRecords])

	// Capture each zone's DockviewApi so we can imperatively focus panels on routing changes.
	const zoneApisRef = useRef<Partial<Record<string, DockviewApi>>>({})
	const handleZoneApiReady = useCallback((zone: string, api: DockviewApi) => {
		zoneApisRef.current[zone] = api
	}, [])

	// Focus the correct dock panel whenever the routing atoms change (e.g. plugin→surface handoff).
	// Uses paneRoutingState (tab + focusToken) so re-requesting the same tab still triggers a focus.
	const paneRoutingState = useAtomValue(paneRoutingStateAtom)
	useEffect(() => {
		const { sidePanel, documentPanel } = paneRoutingState
		if (sidePanel) {
			const panelId = `${sidePanel.tab}:${agent.sessionId}`
			zoneApisRef.current["right"]?.getPanel(panelId)?.focus()
		}
		if (documentPanel) {
			const panelId = `${documentPanel.tab}:${agent.sessionId}`
			zoneApisRef.current["bottom"]?.getPanel(panelId)?.focus()
		}
	}, [paneRoutingState, agent.sessionId])

	// Register chat surface once per session identity (idempotent).
	useEffect(() => {
		registry.getOrCreate(chatInstanceId, {
			type: "chat",
			title: "Chat",
			render: () => <ChatSurface instanceId={chatInstanceId} />,
		})
	}, [registry, chatInstanceId])

	// Register each utility/document tab surface once per session+tab identity.
	// `getOrCreate` is idempotent — safe to call every render when the set changes.
	useEffect(() => {
		for (const tab of utilityTabs) {
			const instanceId = `${tab.id}:${agent.sessionId}`
			registry.getOrCreate(instanceId, {
				type: tab.id,
				title: tab.title,
				render: () => <TabSurface instanceId={instanceId} />,
			})
		}
		for (const tab of docTabs) {
			const instanceId = `${tab.id}:${agent.sessionId}`
			registry.getOrCreate(instanceId, {
				type: tab.id,
				title: tab.title,
				render: () => <TabSurface instanceId={instanceId} />,
			})
		}
	}, [registry, agent.sessionId, utilityTabs, docTabs])

	// Unmount-on-disable (Firefly plugin P0): when a catalog-served surface's
	// plugin becomes unavailable (disabled/quarantined → `availability.available`
	// flips false on the `firefly-plugin:changed` broadcast), its tab drops out of
	// the served set above but its surface instance keeps running in the hidden
	// host layer. DESTROY that instance so the surface actually stops; re-enable
	// re-creates it fresh via `getOrCreate` on the next open. Scoped to the current
	// session so other sessions' surfaces are untouched.
	const servedTabInstanceIdsRef = useRef<{ sessionId: string; ids: Set<string> }>({
		sessionId: agent.sessionId,
		ids: new Set(),
	})
	useEffect(() => {
		const currentIds = new Set<string>()
		for (const tab of utilityTabs) currentIds.add(`${tab.id}:${agent.sessionId}`)
		for (const tab of docTabs) currentIds.add(`${tab.id}:${agent.sessionId}`)

		const prev = servedTabInstanceIdsRef.current
		// Only diff within the same session; a session switch is not a disable.
		if (prev.sessionId === agent.sessionId) {
			for (const instanceId of prev.ids) {
				if (!currentIds.has(instanceId)) {
					// Surface's plugin is no longer served → tear it down.
					registry.evict(instanceId)
				}
			}
		}
		servedTabInstanceIdsRef.current = { sessionId: agent.sessionId, ids: currentIds }
	}, [registry, agent.sessionId, utilityTabs, docTabs])

	// Publish live props every render so once-mounted hosts stay current.
	// Chat: full ChatView props object. Tabs: the freshly-bound render() closure
	// (produced by the surfaceTabs useMemo; captures latest agent/flags/ctx).
	useEffect(() => {
		surfacePropBridge.publish(chatInstanceId, chatViewProps)
		for (const tab of utilityTabs) {
			surfacePropBridge.publish(`${tab.id}:${agent.sessionId}`, tab.render)
		}
		for (const tab of docTabs) {
			surfacePropBridge.publish(`${tab.id}:${agent.sessionId}`, tab.render)
		}
	})

	const dockSeedPanels = useMemo<DockSeedPanel[]>(() => {
		const byType = persistedDockLayout?.byType
		const panels: DockSeedPanel[] = [
			{
				instanceId: chatInstanceId,
				surfaceType: "chat",
				title: "Chat",
				zone: byType?.["chat"] ?? "main",
			},
		]
		for (const tab of utilityTabs) {
			panels.push({
				instanceId: `${tab.id}:${agent.sessionId}`,
				surfaceType: tab.id,
				title: tab.title,
				zone: byType?.[tab.id] ?? "right",
			})
		}
		for (const tab of docTabs) {
			panels.push({
				instanceId: `${tab.id}:${agent.sessionId}`,
				surfaceType: tab.id,
				title: tab.title,
				zone: byType?.[tab.id] ?? "bottom",
			})
		}
		return panels
	}, [chatInstanceId, agent.sessionId, utilityTabs, docTabs, persistedDockLayout])

	// Full-height flex wrapper so DockShell's `flex: 1` root actually fills the
	// pane. Without a flex parent with definite height the dock collapses and the
	// chat zone starves to 0px.
	return (
		<div className="flex h-full min-h-0 min-w-0 overflow-hidden">
			<DockShell
				seedPanels={dockSeedPanels}
				isDarkMode={isDarkMode}
				rightZoneOpen={sidePanelOpen && utilityTabs.length > 0}
				onRightZoneOpenChange={setSidePanelOpen}
				bottomZoneOpen={documentPanelOpen}
				onBottomZoneOpenChange={setDocumentPanelOpen}
				onZoneApiReady={handleZoneApiReady}
			/>
		</div>
	)
}

function SessionAppBarContent({
	agent,
	isEditingTitle,
	titleValue,
	titleInputRef,
	onTitleValueChange,
	onStartEditing,
	onConfirmTitle,
	onCancelEditing,
	onRename,
	projectSlug,
	sidePanelOpen,
	hasAvailableSidePanel,
	onToggleSidePanel,
	documentPanelOpen,
	hasAvailableDocument,
	onToggleDocumentPanel,
}: {
	agent: Agent
	isEditingTitle: boolean
	titleValue: string
	titleInputRef: React.RefObject<HTMLInputElement | null>
	onTitleValueChange: (value: string) => void
	onStartEditing: () => void
	onConfirmTitle: () => Promise<void>
	onCancelEditing: () => void
	onRename?: (agent: Agent, title: string) => Promise<void>
	projectSlug?: string
	sidePanelOpen: boolean
	hasAvailableSidePanel: boolean
	onToggleSidePanel: () => void
	documentPanelOpen: boolean
	hasAvailableDocument: boolean
	onToggleDocumentPanel: () => void
}) {
	const { url } = useServerConnection()
	const [copied, setCopied] = useState(false)
	const [openInTargets, setOpenInTargets] = useState<OpenInTarget[]>([])
	const [preferredOpenInTarget, setPreferredOpenInTarget] = useState<string | null>(null)

	useEffect(() => {
		if (!isElectron) return
		void fetchOpenInTargets().then((result) => {
			setOpenInTargets(result.targets)
			setPreferredOpenInTarget(result.preferredTarget)
		})
	}, [])

	const handleCopySessionLink = useCallback(async () => {
		const sessionUrl = `${window.location.origin}${window.location.pathname}#/project/${projectSlug ?? agent.projectSlug}/session/${agent.sessionId}`
		await navigator.clipboard.writeText(sessionUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}, [agent.projectSlug, agent.sessionId, projectSlug])

	return (
		<div className="flex w-full min-w-0 flex-1 items-center gap-3 px-3">
			<div className="flex min-w-0 items-center gap-3">
				<div className="min-w-0">
					{isEditingTitle ? (
						<Input
							ref={titleInputRef}
							value={titleValue}
							onChange={(event) => onTitleValueChange(event.target.value)}
							onBlur={() => void onConfirmTitle()}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									void onConfirmTitle()
								} else if (event.key === "Escape") {
									event.preventDefault()
									onCancelEditing()
								}
							}}
							className="h-8 min-w-[220px] max-w-[360px]"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						/>
					) : (
						<button
							type="button"
							onClick={onRename ? onStartEditing : undefined}
							disabled={!onRename}
							title={onRename ? "Click to rename" : undefined}
							className="-mx-1 max-w-full truncate rounded px-1 py-0.5 text-left text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
							style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
						>
							{agent.name}
						</button>
					)}
				</div>
			</div>
			<div
				className="ml-auto flex items-center gap-2"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button variant="ghost" size="icon" className="size-7" onClick={() => void handleCopySessionLink()} />
						}
					>
						{copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
					</TooltipTrigger>
					<TooltipContent>{copied ? "Copied" : "Copy session link"}</TooltipContent>
				</Tooltip>
				{openInTargets.length ? (
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
							<ExternalLinkIcon className="size-3.5" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{openInTargets.map((target) => (
								<DropdownMenuItem key={target.id} onSelect={() => void openInTarget(agent.directory, target.id)}>
									{target.label}
									{preferredOpenInTarget === target.id ? <CheckIcon className="ml-auto size-3.5" /> : null}
								</DropdownMenuItem>
							))}
							{url ? (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem onSelect={() => window.open(url, "_blank")}>OpenCode server</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				<WorktreeActions agent={agent} />
				<button
					type="button"
					onClick={onToggleSidePanel}
					disabled={!hasAvailableSidePanel}
					aria-pressed={sidePanelOpen}
					title={
						hasAvailableSidePanel
							? sidePanelOpen
								? "Hide right panel (⇧⌘D)"
								: "Show right panel (⇧⌘D)"
							: "No right-panel surfaces available"
					}
					className={`flex size-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
						sidePanelOpen
							? "border-primary/60 bg-primary/15 text-foreground"
							: "border-border/70 text-muted-foreground hover:text-foreground"
					}`}
				>
					<PanelRightIcon className="size-3.5" />
				</button>
				<button
					type="button"
					onClick={onToggleDocumentPanel}
					aria-pressed={documentPanelOpen}
					title={
						documentPanelOpen
							? "Hide bottom panel"
							: hasAvailableDocument
								? "Show bottom panel"
								: "Show bottom panel (empty — drag tabs here)"
					}
					className={`flex size-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
						documentPanelOpen
							? "border-primary/60 bg-primary/15 text-foreground"
							: "border-border/70 text-muted-foreground hover:text-foreground"
					}`}
				>
					<PanelBottomIcon className="size-3.5" />
				</button>
			</div>
		</div>
	)
}
