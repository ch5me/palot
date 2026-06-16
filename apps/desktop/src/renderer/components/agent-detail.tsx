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
import { SplitPane } from "@ch5me/workspace"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	ArrowLeftIcon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	FileTextIcon,
	PanelRightCloseIcon,
	PanelRightOpenIcon,
	PencilIcon,
	TerminalIcon,
} from "lucide-react"
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createHtmlPortalNode, InPortal, OutPortal, type HtmlPortalNode } from "react-reverse-portal"
import type { OpenInTarget } from "../../preload/api"
import {
	browserPanelEnabledAtom,
	bridgesSurfaceEnabledAtom,
	ch5pmSurfaceEnabledAtom,
	claudeSurfaceEnabledAtom,
	crmSurfaceEnabledAtom,
	editorSurfaceEnabledAtom,
	filesSurfaceEnabledAtom,
	memorySurfaceEnabledAtom,
	oracleSurfaceEnabledAtom,
	pluginsSurfaceEnabledAtom,
	pdfReviewSurfaceEnabledAtom,
	pulseSurfaceEnabledAtom,
	studioSurfaceEnabledAtom,
	terminalSurfaceEnabledAtom,
	voiceSurfaceEnabledAtom,
	workspaceDockEnabledAtom,
} from "../atoms/feature-flags"
import { useColorScheme } from "../hooks/use-theme"
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
import { SessionSidePanel } from "./side-panel/session-side-panel"
import type { SidePanelTabDef } from "./side-panel/side-panel-tabs"
import { SessionMetricsBar } from "./session-metrics-bar"
import { WorktreeActions } from "./worktree-actions"

const DEFAULT_SIDE_PANEL_WIDTH = 392
const EXPANDED_SIDE_PANEL_WIDTH = 760
const MIN_SIDE_PANEL_WIDTH = 280
const MAX_SIDE_PANEL_WIDTH = 760
const MAX_EXPANDED_SIDE_PANEL_WIDTH = 1120
const DEFAULT_DOC_PANEL_WIDTH = 520
const MIN_DOC_PANEL_WIDTH = 360
const MAX_DOC_PANEL_WIDTH = 960

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

function DocumentPaneShell({
	agent,
	tab,
	portalNode,
}: {
	agent: Agent
	tab: SidePanelTabDef
	portalNode: HtmlPortalNode
}) {
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<FileTextIcon className="size-4 text-muted-foreground" aria-hidden="true" />
					<span>{tab.title}</span>
				</div>
				<div className="mt-1 text-xs text-muted-foreground">Document lane for {agent.project}</div>
			</div>
			<div className="min-h-0 min-w-0 flex-1 overflow-hidden">
				<OutPortal node={portalNode} />
			</div>
		</div>
	)
}

// ============================================================
// Workspace dock surfaces (gated behind workspaceDockEnabledAtom)
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
	parentSessionName,
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
	const navigate = useNavigate()
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
	const [reviewSettings, setReviewSettings] = useAtom(reviewPanelSettingsAtom)

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

	const browserPanelEnabled = useAtomValue(browserPanelEnabledAtom)
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
	const oracleSurfaceEnabled = useAtomValue(oracleSurfaceEnabledAtom)
	const claudeSurfaceEnabled = useAtomValue(claudeSurfaceEnabledAtom)
	const ch5pmSurfaceEnabled = useAtomValue(ch5pmSurfaceEnabledAtom)
	const pdfReviewSurfaceEnabled = useAtomValue(pdfReviewSurfaceEnabledAtom)

	const catalogSurfaceTabs = useCatalogSurfaceTabs(agent)
	const surfaceTabs: SidePanelTabDef[] = useMemo(() => {
		const ctx: FireflySurfaceContext = {
			agent,
			diffStats,
			flags: {
				browserPanelEnabled,
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
				oracle: oracleSurfaceEnabled,
				claude: claudeSurfaceEnabled,
				ch5pm: ch5pmSurfaceEnabled,
				pdfReview: pdfReviewSurfaceEnabled,
			},
			chatTurnCount: chatTurns.length,
		}
		return mergeSurfaceTabs(getFireflySurfaceTabs(ctx), catalogSurfaceTabs)
	}, [
		agent,
		catalogSurfaceTabs,
		diffStats,
		browserPanelEnabled,
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
		oracleSurfaceEnabled,
		claudeSurfaceEnabled,
		ch5pmSurfaceEnabled,
		pdfReviewSurfaceEnabled,
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

	const docPortalNodesRef = useRef<Partial<Record<SidePanelTabDef["id"], HtmlPortalNode>>>({})
	for (const tab of docTabs) {
		if (!docPortalNodesRef.current[tab.id]) {
			docPortalNodesRef.current[tab.id] = createHtmlPortalNode()
		}
	}
	const docPanelNode = activeDocTab ? docPortalNodesRef.current[activeDocTab.id] ?? null : null

	useEffect(() => {
		setAvailableSidePanelTabs(utilityTabs.map((tab) => tab.id))
	}, [setAvailableSidePanelTabs, utilityTabs])

	useEffect(() => {
		setAvailableDocumentPanelTabs(docTabs.map((tab) => tab.id))
	}, [docTabs, setAvailableDocumentPanelTabs])

	useEffect(() => {
		if (documentPanelOpen && docTabs.length === 0) {
			closeDocumentPanel()
		}
	}, [closeDocumentPanel, docTabs.length, documentPanelOpen])

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
				sidePanelActiveTab={sidePanelActiveTab}
				hasAvailableSidePanel={utilityTabs.length > 0}
				onToggleSidePanel={() => {
					if (utilityTabs.length === 0) return
					setSidePanelOpen((prev) => !prev)
				}}
				documentPanelOpen={docPanelVisible}
				documentTab={activeDocTab}
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
		sidePanelActiveTab,
		utilityTabs,
		docPanelVisible,
		activeDocTab,
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

	const chatContent = (
		<>
			{agent.parentId ? (
				<button
					type="button"
					onClick={() =>
						navigate({
							to: "/project/$projectSlug/session/$sessionId",
							params: {
								projectSlug: projectSlug ?? agent.projectSlug,
								sessionId: agent.parentId!,
							},
						})
					}
					className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
				>
					<ArrowLeftIcon className="size-3" />
					<span>
						Back to <span className="font-medium text-foreground">{parentSessionName || "parent session"}</span>
					</span>
				</button>
			) : null}

			<div className="min-h-0 flex-1">
				<ChatView {...chatViewProps} />
			</div>
		</>
	)

	// ========== Workspace dock (gated; legacy SplitPane stays default) ==========
	const workspaceDockEnabled = useAtomValue(workspaceDockEnabledAtom)
	const isDarkMode = useIsDarkMode()
	const registry = useSurfaceRegistry()
	const chatInstanceId = `chat:${agent.sessionId}:view-main`

	// Register chat surface once per session identity (idempotent).
	useEffect(() => {
		if (!workspaceDockEnabled) return
		registry.getOrCreate(chatInstanceId, {
			type: "chat",
			title: "Chat",
			render: () => <ChatSurface instanceId={chatInstanceId} />,
		})
	}, [workspaceDockEnabled, registry, chatInstanceId])

	// Register each utility/document tab surface once per session+tab identity.
	// `getOrCreate` is idempotent — safe to call every render when the set changes.
	useEffect(() => {
		if (!workspaceDockEnabled) return
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
	}, [workspaceDockEnabled, registry, agent.sessionId, utilityTabs, docTabs])

	// Publish live props every render so once-mounted hosts stay current.
	// Chat: full ChatView props object. Tabs: the freshly-bound render() closure
	// (produced by the surfaceTabs useMemo; captures latest agent/flags/ctx).
	useEffect(() => {
		if (!workspaceDockEnabled) return
		surfacePropBridge.publish(chatInstanceId, chatViewProps)
		for (const tab of utilityTabs) {
			surfacePropBridge.publish(`${tab.id}:${agent.sessionId}`, tab.render)
		}
		for (const tab of docTabs) {
			surfacePropBridge.publish(`${tab.id}:${agent.sessionId}`, tab.render)
		}
	})

	const dockSeedPanels = useMemo<DockSeedPanel[]>(() => {
		const panels: DockSeedPanel[] = [
			{ instanceId: chatInstanceId, surfaceType: "chat", title: "Chat", zone: "main" },
		]
		for (const tab of utilityTabs) {
			panels.push({
				instanceId: `${tab.id}:${agent.sessionId}`,
				surfaceType: tab.id,
				title: tab.title,
				zone: "right",
			})
		}
		for (const tab of docTabs) {
			panels.push({
				instanceId: `${tab.id}:${agent.sessionId}`,
				surfaceType: tab.id,
				title: tab.title,
				zone: "bottom",
			})
		}
		return panels
	}, [chatInstanceId, agent.sessionId, utilityTabs, docTabs])

	if (workspaceDockEnabled) {
		return <DockShell seedPanels={dockSeedPanels} isDarkMode={isDarkMode} />
	}

	return (
		<>
			{docTabs.map((tab) => {
				const portalNode = docPortalNodesRef.current[tab.id]
				if (!portalNode) return null
				return (
					<InPortal key={tab.id} node={portalNode}>
						{tab.render()}
					</InPortal>
				)
			})}
			<SplitPane
				key={reviewSettings.expanded ? "side-panel-expanded" : "side-panel-default"}
				side="right"
				open={sidePanelOpen}
				onOpenChange={setSidePanelOpen}
				defaultPanelWidth={reviewSettings.expanded ? EXPANDED_SIDE_PANEL_WIDTH : DEFAULT_SIDE_PANEL_WIDTH}
				minPanelWidth={MIN_SIDE_PANEL_WIDTH}
				maxPanelWidth={reviewSettings.expanded ? MAX_EXPANDED_SIDE_PANEL_WIDTH : MAX_SIDE_PANEL_WIDTH}
				handleAriaLabel="Resize utility panel"
				panel={
					<div className="min-h-0 h-full min-w-0 overflow-hidden">
						<SessionSidePanel agent={agent} tabs={utilityTabs} />
					</div>
				}
			>
				<SplitPane
					side="right"
					open={docPanelVisible}
					onOpenChange={setDocumentPanelOpen}
					defaultPanelWidth={DEFAULT_DOC_PANEL_WIDTH}
					minPanelWidth={MIN_DOC_PANEL_WIDTH}
					maxPanelWidth={MAX_DOC_PANEL_WIDTH}
					handleAriaLabel="Resize document pane"
					panel={
						activeDocTab && docPanelNode ? (
							<DocumentPaneShell agent={agent} tab={activeDocTab} portalNode={docPanelNode} />
						) : (
							<div className="flex h-full items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
								Open Studio or PDF Review to use document lane.
							</div>
						)
					}
				>
					<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{chatContent}</div>
				</SplitPane>
			</SplitPane>
		</>
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
	sidePanelActiveTab,
	hasAvailableSidePanel,
	onToggleSidePanel,
	documentPanelOpen,
	documentTab,
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
	sidePanelActiveTab: string
	hasAvailableSidePanel: boolean
	onToggleSidePanel: () => void
	documentPanelOpen: boolean
	documentTab: SidePanelTabDef | null
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
		<div className="flex min-w-0 items-center gap-3 px-3">
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
						<div className="flex items-center gap-2">
							<span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
							{onRename ? (
								<Button
									variant="ghost"
									size="icon"
									className="size-6"
									onClick={onStartEditing}
									style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
								>
									<PencilIcon className="size-3.5" />
								</Button>
							) : null}
						</div>
					)}
					<div className="truncate text-xs text-muted-foreground">{agent.project}</div>
				</div>
			</div>
			<div
				className="ml-auto flex items-center gap-2"
				style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={onToggleSidePanel}
								disabled={!hasAvailableSidePanel}
								aria-label={sidePanelOpen ? "Close side panel" : "Open side panel"}
								title={sidePanelOpen ? "Close side panel" : "Open side panel"}
							/>
						}
					>
						{sidePanelOpen ? (
							<PanelRightCloseIcon className="size-3.5" />
						) : (
							<PanelRightOpenIcon className="size-3.5" />
						)}
					</TooltipTrigger>
					<TooltipContent>
						{hasAvailableSidePanel ? (
							<>{sidePanelOpen ? "Close" : "Open"} utility panel (&#8679;&#8984;D)</>
						) : (
							"No utility surfaces available"
						)}
					</TooltipContent>
				</Tooltip>
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
				<SessionMetricsBar sessionId={agent.sessionId} />
				<div className="rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground">
					{documentPanelOpen && documentTab ? `Doc · ${documentTab.id}` : "Doc closed"}
				</div>
				<div className="rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground">
					{sidePanelOpen ? `Utility · ${sidePanelActiveTab}` : "Utility closed"}
				</div>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<TerminalIcon className="size-3.5" />
					<span>{agent.branch}</span>
				</div>
			</div>
		</div>
	)
}
