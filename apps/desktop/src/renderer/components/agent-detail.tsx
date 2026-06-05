import { Button } from "@ch5me/elf-ui/components/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ch5me/elf-ui/components/dropdown-menu"
import { Input } from "@ch5me/elf-ui/components/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { SplitPane } from "@ch5me/workspace"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
	ArrowLeftIcon,
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	PanelRightCloseIcon,
	PanelRightOpenIcon,
	PencilIcon,
	TerminalIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
	notesSurfaceEnabledAtom,
	oracleSurfaceEnabledAtom,
	pluginsSurfaceEnabledAtom,
	pulseSurfaceEnabledAtom,
	reviewSurfaceEnabledAtom,
	studioSurfaceEnabledAtom,
	terminalSurfaceEnabledAtom,
	voiceSurfaceEnabledAtom,
} from "../atoms/feature-flags"
import {
	getFireflySurfaceTabs,
	type FireflySurfaceContext,
} from "../firefly-surface-registry"
import {
	reviewPanelSettingsAtom,
	sessionDiffStatsFamily,
	setAvailableSidePanelTabsAtom,
	sidePanelActiveTabAtom,
	sidePanelOpenAtom,
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
import { fetchOpenInTargets, isElectron, openInTarget } from "../services/backend"
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
	const [sidePanelActiveTab] = useAtom(sidePanelActiveTabAtom)
	const setAvailableSidePanelTabs = useSetAtom(setAvailableSidePanelTabsAtom)
	const [reviewSettings, setReviewSettings] = useAtom(reviewPanelSettingsAtom)

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
				if (e.key === "d" || e.key === "D") {
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
	}, [setSidePanelOpen, setReviewSettings])

	const prevSessionIdRef = useRef(agent.sessionId)
	const diffStats = useAtomValue(sessionDiffStatsFamily(agent.sessionId))
	useEffect(() => {
		if (prevSessionIdRef.current !== agent.sessionId) {
			prevSessionIdRef.current = agent.sessionId
			if (diffStats.fileCount === 0 && sidePanelActiveTab === "review") {
				setSidePanelOpen(false)
			}
		}
	}, [agent.sessionId, diffStats.fileCount, setSidePanelOpen, sidePanelActiveTab])

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
	const oracleSurfaceEnabled = useAtomValue(oracleSurfaceEnabledAtom)
	const claudeSurfaceEnabled = useAtomValue(claudeSurfaceEnabledAtom)
	const ch5pmSurfaceEnabled = useAtomValue(ch5pmSurfaceEnabledAtom)

	const sidePanelTabs: SidePanelTabDef[] = useMemo(() => {
		const ctx: FireflySurfaceContext = {
			agent,
			diffStats,
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
				oracle: oracleSurfaceEnabled,
				claude: claudeSurfaceEnabled,
				ch5pm: ch5pmSurfaceEnabled,
			},
			chatTurnCount: chatTurns.length,
		}
		return getFireflySurfaceTabs(ctx)
	}, [
		agent,
		diffStats,
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
		oracleSurfaceEnabled,
		claudeSurfaceEnabled,
		ch5pmSurfaceEnabled,
		chatTurns.length,
	])
	const availableSidePanelTabs = useMemo(
		() => sidePanelTabs.filter((tab) => tab.availability.available),
		[sidePanelTabs],
	)

	useEffect(() => {
		setAvailableSidePanelTabs(availableSidePanelTabs.map((tab) => tab.id))
	}, [availableSidePanelTabs, setAvailableSidePanelTabs])

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
				hasAvailableSidePanel={availableSidePanelTabs.length > 0}
				onToggleSidePanel={() => setSidePanelOpen((prev) => !prev)}
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
		availableSidePanelTabs,
	])

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
				<ChatView
					turns={chatTurns}
					loading={chatLoading ?? false}
					loadingEarlier={chatLoadingEarlier ?? false}
					hasEarlierMessages={chatHasEarlier ?? false}
					onLoadEarlier={onLoadEarlier}
					agent={agent}
					isConnected={isConnected ?? false}
					onSendMessage={onSendMessage}
					onStop={onStop}
					providers={providers}
					config={config}
					vcs={vcs}
					openCodeAgents={openCodeAgents}
					onApprove={onApprove}
					onDeny={onDeny}
					onReplyQuestion={onReplyQuestion}
					onRejectQuestion={onRejectQuestion}
					canUndo={canUndo}
					canRedo={canRedo}
					onUndo={onUndo}
					onRedo={onRedo}
					isReverted={isReverted}
					onRevertToMessage={onRevertToMessage}
					onForkFromTurn={onForkFromTurn}
					onDeletePart={onDeletePart}
					sidePanelOpen={sidePanelOpen}
				/>
			</div>
		</>
	)

	return (
		<SplitPane
			key={reviewSettings.expanded ? "side-panel-expanded" : "side-panel-default"}
			side="right"
			open={sidePanelOpen}
			onOpenChange={setSidePanelOpen}
			defaultPanelWidth={
				reviewSettings.expanded ? EXPANDED_SIDE_PANEL_WIDTH : DEFAULT_SIDE_PANEL_WIDTH
			}
			minPanelWidth={MIN_SIDE_PANEL_WIDTH}
			maxPanelWidth={
				reviewSettings.expanded ? MAX_EXPANDED_SIDE_PANEL_WIDTH : MAX_SIDE_PANEL_WIDTH
			}
			handleAriaLabel="Resize side panel"
			panel={
				<div className="min-h-0 min-w-0 h-full overflow-hidden">
					<SessionSidePanel agent={agent} tabs={sidePanelTabs} />
				</div>
			}
		>
			<div className="min-h-0 min-w-0 h-full overflow-hidden flex flex-col">{chatContent}</div>
		</SplitPane>
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
							<>{sidePanelOpen ? "Close" : "Open"} side panel (&#8679;&#8984;D)</>
						) : (
							"No side-panel surfaces available"
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
					{sidePanelOpen ? `Surface · ${sidePanelActiveTab}` : "Surface closed"}
				</div>
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<TerminalIcon className="size-3.5" />
					<span>{agent.branch}</span>
				</div>
			</div>
		</div>
	)
}
