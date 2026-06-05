import { Badge } from "@ch5me/elf-ui/components/badge"
import { Button } from "@ch5me/elf-ui/components/button"
import {
	PromptInput,
	PromptInputFooter,
	PromptInputProvider,
	PromptInputTextarea,
	PromptInputTools,
	usePromptInputController,
} from "@ch5me/elf-ui/components/ai-elements/prompt-input"
import { Popover, PopoverContent, PopoverTrigger } from "@ch5me/elf-ui/components/popover"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { useQuery } from "@tanstack/react-query"
import {
	ArrowRightIcon,
	BlocksIcon,
	ChevronDownIcon,
	FileTextIcon,
	GitPullRequestIcon,
	Loader2Icon,
	Rows4Icon,
	TicketIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { projectModelsAtom, setProjectModelAtom } from "../atoms/preferences"
import { agentFamily } from "../atoms/derived/agents"
import { appStore } from "../atoms/store"
import { useAgents, useProjectList } from "../hooks/use-agents"
import { useDraftActions, useDraftSnapshot } from "../hooks/use-draft"
import type { ModelRef } from "../hooks/use-opencode-data"
import {
	getModelInputCapabilities,
	getModelVariants,
	resolveEffectiveModel,
	useConfig,
	useModelState,
	useOpenCodeAgents,
	useProviders,
	useVcs,
} from "../hooks/use-opencode-data"
import { useServerConnection, useAgentActions } from "../hooks/use-server"
import type { FileAttachment } from "../lib/types"
import { BranchPicker } from "./branch-picker"
import { type MentionOption, MentionPopover, type MentionPopoverHandle } from "./chat/mention-popover"
import { PromptAttachmentPreview } from "./chat/prompt-attachments"
import {
	createAgentMention,
	createFileMention,
	insertMentionIntoText,
} from "./chat/prompt-mentions"
import { PromptToolbar, StatusBar } from "./chat/prompt-toolbar"
import { ElfWordmark } from "./elf-wordmark"
import { fetchCh5PmDashboard } from "../ch5pm-dashboard/client"
import { MOCK_CH5PM_DASHBOARD_STATE } from "../ch5pm-dashboard/fixtures"
import { getPmSnapshotBundle, mapSnapshotBundleToCards } from "../project-manager-cards"
import {
	launchProjectManagerSession,
	markPendingAssignment,
	markPendingFailure,
} from "../project-manager-launcher"
import {
	createPendingSubmission,
	toPendingCard,
	toSessionCard,
	type PmAssignment,
	type PmCard,
	type PmOverviewStats,
	type PmPendingSubmission,
} from "../project-manager-types"

function MentionBridge({
	controllerRef,
}: {
	controllerRef: React.RefObject<{ setText: (text: string) => void; getText: () => string } | null>
}) {
	const controller = usePromptInputController()
	useEffect(() => {
		if (controllerRef && "current" in controllerRef) {
			;(controllerRef as React.MutableRefObject<typeof controllerRef.current>).current = {
				setText: (text: string) => controller.textInput.setInput(text),
				getText: () => controller.textInput.value,
			}
		}
		return () => {
			if (controllerRef && "current" in controllerRef) {
				;(controllerRef as React.MutableRefObject<typeof controllerRef.current>).current = null
			}
		}
	}, [controller, controllerRef])
	return null
}

function MentionTrigger({
	onMentionChange,
}: {
	onMentionChange: (open: boolean, query: string) => void
}) {
	const controller = usePromptInputController()
	const inputText = controller.textInput.value
	useEffect(() => {
		const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-prompt-input]")
		const cursorPos = textarea?.selectionStart ?? inputText.length
		const textBeforeCursor = inputText.slice(0, cursorPos)
		const atMatch = textBeforeCursor.match(/@(\S*)$/)
		if (atMatch) {
			onMentionChange(true, atMatch[1])
			return
		}
		onMentionChange(false, "")
	}, [inputText, onMentionChange])
	return null
}

const PROJECT_MANAGER_DRAFT_KEY = "__project_manager__"
const CH5PM_BASE_URL = "http://127.0.0.1:43130"

const SUGGESTIONS = [
	{
		icon: Rows4Icon,
		text: "Map current tickets, active agents, and blockers for this project.",
	},
	{
		icon: FileTextIcon,
		text: "Summarize PM state and highlight what needs attention next.",
	},
	{
		icon: GitPullRequestIcon,
		text: "Review in-progress work and suggest next PM actions.",
	},
]

function DraftSync({ setDraft }: { setDraft: (text: string) => void }) {
	const controller = usePromptInputController()
	const value = controller.textInput.value
	const isFirstRender = useRef(true)

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false
			return
		}
		setDraft(value)
	}, [value, setDraft])

	return null
}

export function ProjectManager() {
	const navigate = useNavigate()
	const { projectSlug } = useParams({ strict: false })
	const projects = useProjectList()
	const { connected } = useServerConnection()
	const { createSession, sendPrompt } = useAgentActions()

	const [selectedDirectory, setSelectedDirectory] = useState<string>("")
	const [launching, setLaunching] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [pendingSubmissions, setPendingSubmissions] = useState<PmPendingSubmission[]>([])
	const [assignments, setAssignments] = useState<PmAssignment[]>([])
	const draft = useDraftSnapshot(PROJECT_MANAGER_DRAFT_KEY)
	const { setDraft, clearDraft } = useDraftActions(PROJECT_MANAGER_DRAFT_KEY)
	const [projectPickerOpen, setProjectPickerOpen] = useState(false)
	const allAgents = useAgents()
	const [selectedModel, setSelectedModel] = useState<ModelRef | null>(null)
	const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
	const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined)
	const [mentionOpen, setMentionOpen] = useState(false)
	const [mentionQuery, setMentionQuery] = useState("")
	const controllerRef = useRef<{ setText: (text: string) => void; getText: () => string } | null>(
		null,
	)
	const mentionPopoverRef = useRef<MentionPopoverHandle>(null)

	const projectModels = useAtomValue(projectModelsAtom)
	const prevDirectoryRef = useRef<string>("")
	useEffect(() => {
		if (!selectedDirectory || selectedDirectory === prevDirectoryRef.current) return
		prevDirectoryRef.current = selectedDirectory
		const stored = projectModels[selectedDirectory]
		if (stored?.providerID && stored?.modelID) {
			setSelectedModel(stored)
			setSelectedVariant(stored.variant)
		} else {
			setSelectedModel(null)
			setSelectedVariant(undefined)
		}
		setSelectedAgent(stored?.agent ?? null)
	}, [selectedDirectory, projectModels])

	const selectedProject = useMemo(
		() => projects.find((p) => p.directory === selectedDirectory),
		[projects, selectedDirectory],
	)

	const { data: providers } = useProviders(selectedDirectory || null)
	const { data: config } = useConfig(selectedDirectory || null)
	const { data: vcs, reload: reloadVcs } = useVcs(selectedDirectory || null)
	const { agents: openCodeAgents } = useOpenCodeAgents(selectedDirectory || null)
	const { recentModels, addRecent: addRecentModel } = useModelState()

	const pmSnapshotQuery = useQuery({
		queryKey: ["project-manager-ch5pm"],
		queryFn: () => fetchCh5PmDashboard(CH5PM_BASE_URL),
		initialData: MOCK_CH5PM_DASHBOARD_STATE,
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	const activeSessionCount = useMemo(() => {
		if (!selectedDirectory) return 0
		return allAgents.filter(
			(a) =>
				a.directory === selectedDirectory &&
				(a.status === "running" || a.status === "waiting" || (a.isAttached && a.status === "idle")),
		).length
	}, [allAgents, selectedDirectory])

	const handleModelSelect = useCallback(
		(model: ModelRef | null) => {
			setSelectedModel(model)
			setSelectedVariant(undefined)
			if (model) addRecentModel(model)
		},
		[addRecentModel],
	)

	const handleBranchChanged = useCallback(
		(_branch: string) => {
			reloadVcs()
		},
		[reloadVcs],
	)

	const handleMentionSelect = useCallback((option: MentionOption) => {
		setMentionOpen(false)
		const ctrl = controllerRef.current
		if (!ctrl) return
		const currentText = ctrl.getText()
		const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-prompt-input]")
		const cursorPos = textarea?.selectionStart ?? currentText.length
		const mention =
			option.type === "file" ? createFileMention(option.path) : createAgentMention(option.name)
		const { text: newText, cursorPosition: newCursor } = insertMentionIntoText(
			currentText,
			cursorPos,
			mention,
		)
		ctrl.setText(newText)
		requestAnimationFrame(() => {
			const ta = document.querySelector<HTMLTextAreaElement>("textarea[data-prompt-input]")
			if (ta) {
				ta.focus()
				ta.setSelectionRange(newCursor, newCursor)
			}
		})
	}, [])

	const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (mentionPopoverRef.current?.handleKeyDown(e)) return
	}, [])

	const activeOpenCodeAgent = useMemo(() => {
		const agentName = selectedAgent ?? config?.defaultAgent
		return openCodeAgents?.find((a) => a.name === agentName) ?? null
	}, [selectedAgent, config?.defaultAgent, openCodeAgents])

	const effectiveModel = useMemo(
		() =>
			resolveEffectiveModel(
				selectedModel,
				activeOpenCodeAgent,
				config?.model,
				providers?.defaults ?? {},
				providers?.providers ?? [],
				recentModels,
			),
		[selectedModel, activeOpenCodeAgent, config?.model, providers, recentModels],
	)

	useEffect(() => {
		if (!selectedVariant || !effectiveModel || !providers) return
		const available = getModelVariants(
			effectiveModel.providerID,
			effectiveModel.modelID,
			providers.providers,
		)
		if (!available.includes(selectedVariant)) {
			setSelectedVariant(undefined)
		}
	}, [selectedVariant, effectiveModel, providers])

	const modelCapabilities = useMemo(
		() => getModelInputCapabilities(effectiveModel, providers?.providers ?? []),
		[effectiveModel, providers],
	)

	useEffect(() => {
		if (projects.length === 0) return

		if (projectSlug) {
			const match = projects.find((p) => p.slug === projectSlug)
			if (match) {
				setSelectedDirectory(match.directory)
				return
			}
		}

		setSelectedDirectory(projects[0].directory)
	}, [projectSlug, projects])

	const persistProjectModel = useCallback(() => {
		if (!effectiveModel || !selectedDirectory) return
		appStore.set(setProjectModelAtom, {
			directory: selectedDirectory,
			model: {
				...effectiveModel,
				variant: selectedVariant,
				agent: selectedAgent ?? undefined,
			},
		})
	}, [effectiveModel, selectedDirectory, selectedVariant, selectedAgent])

	const handleProjectManagerLaunch = useCallback(
		async (promptText: string, files?: FileAttachment[]) => {
			if (!selectedDirectory || !selectedProject) return
			const submission = createPendingSubmission({
				projectDirectory: selectedDirectory,
				projectName: selectedProject.name,
				projectSlug: selectedProject.slug,
				prompt: promptText,
			})
			setPendingSubmissions((current) => [submission, ...current])

			try {
				const result = await launchProjectManagerSession({
					projectDirectory: selectedDirectory,
					projectName: selectedProject.name,
					projectSlug: selectedProject.slug,
					prompt: promptText,
					pendingId: submission.id,
					model: effectiveModel,
					agent: selectedAgent ?? undefined,
					variant: selectedVariant,
					files,
					createSession,
					sendPrompt,
					persistProjectModel,
				})
				setPendingSubmissions((current) =>
					current.map((item) =>
						item.id === submission.id ? markPendingAssignment(item, result.assignment) : item,
					),
				)
				setAssignments((current) => [result.assignment, ...current])
				clearDraft()
				navigate({
					to: "/project/$projectSlug/session/$sessionId",
					params: {
						projectSlug: result.assignment.projectSlug,
						sessionId: result.assignment.sessionId,
					},
				})
			} catch (err) {
				const message = err instanceof Error ? err.message : "Failed to open Project Manager"
				setPendingSubmissions((current) =>
					current.map((item) =>
						item.id === submission.id ? markPendingFailure(item, message) : item,
					),
				)
				throw err
			}
		},
		[
			clearDraft,
			createSession,
			effectiveModel,
			navigate,
			persistProjectModel,
			selectedAgent,
			selectedDirectory,
			selectedProject,
			selectedVariant,
			sendPrompt,
		],
	)

	const handleLaunch = useCallback(
		async (promptText: string, files?: FileAttachment[]) => {
			if (!selectedDirectory || !promptText) return
			setLaunching(true)
			setError(null)
			try {
				await handleProjectManagerLaunch(promptText, files)
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to open Project Manager")
			} finally {
				setLaunching(false)
			}
		},
		[handleProjectManagerLaunch, selectedDirectory],
	)

	const snapshotCards = useMemo(() => {
		const bundle = getPmSnapshotBundle(pmSnapshotQuery.data ?? MOCK_CH5PM_DASHBOARD_STATE)
		return mapSnapshotBundleToCards(bundle)
	}, [pmSnapshotQuery.data])

	const sessionCards = useMemo(() => {
		return assignments.map((assignment) => {
			const agent = appStore.get(agentFamily(assignment.sessionId))
			return toSessionCard(assignment, agent)
		})
	}, [assignments, allAgents])

	const pendingCards = useMemo(() => {
		return pendingSubmissions
			.filter((submission) => submission.status === "pending")
			.map((submission) => toPendingCard(submission))
	}, [pendingSubmissions])

	const cards = useMemo<PmCard[]>(() => {
		return [...pendingCards, ...sessionCards, ...snapshotCards]
	}, [pendingCards, sessionCards, snapshotCards])

	const overview = useMemo<PmOverviewStats>(() => {
		return {
			activeSessions: activeSessionCount,
			pendingIntakes: pendingCards.length,
			activeTickets: snapshotCards.filter((card) => card.status === "active").length,
			queuedTickets: snapshotCards.filter((card) => card.status === "queued").length,
			blockedTickets: snapshotCards.filter((card) => card.status === "blocked").length,
		}
	}, [activeSessionCount, pendingCards.length, snapshotCards])

	const hasToolbar = providers

	return (
		<div className="relative flex h-full flex-col">
			<div className="flex flex-1 flex-col px-0 pb-6 pt-8 sm:px-6">
				<div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8">
					<div className="flex justify-center">
						<ElfWordmark className="h-20 w-auto text-6xl text-foreground" />
					</div>

					<div className="text-center">
						<h1 className="text-2xl font-semibold text-foreground">Project manager</h1>
						{projects.length > 1 ? (
							<Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
								<PopoverTrigger
									render={
										<button
											type="button"
											className="mt-1 inline-flex items-center gap-1 text-xl text-muted-foreground transition-colors hover:text-foreground"
										/>
									}
								>
									{selectedProject?.name ?? "select project"}
									<ChevronDownIcon className="size-4" />
								</PopoverTrigger>
								<PopoverContent className="w-64 p-1" align="center">
									{projects.map((p) => (
										<button
											key={p.directory}
											type="button"
											onClick={() => {
												setSelectedDirectory(p.directory)
												setProjectPickerOpen(false)
											}}
											className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
												p.directory === selectedDirectory ? "bg-muted text-foreground" : "text-muted-foreground"
											}`}
										>
											<span className="truncate font-medium">{p.name}</span>
											<span className="ml-auto text-xs text-muted-foreground/60">{p.agentCount}</span>
										</button>
									))}
								</PopoverContent>
							</Popover>
						) : (
							<p className="mt-1 text-xl text-muted-foreground">{selectedProject?.name ?? ""}</p>
						)}
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
						<OverviewCard label="Active sessions" value={overview.activeSessions} icon={BlocksIcon} />
						<OverviewCard label="Pending" value={overview.pendingIntakes} icon={Loader2Icon} />
						<OverviewCard label="Active tickets" value={overview.activeTickets} icon={TicketIcon} />
						<OverviewCard label="Queued" value={overview.queuedTickets} icon={Rows4Icon} />
						<OverviewCard label="Blocked" value={overview.blockedTickets} icon={GitPullRequestIcon} />
					</div>

					<div className="rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm">
						<div className="flex items-start justify-between gap-4">
							<div>
								<div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
									PM lane
								</div>
								<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
									Fresh PM sessions spin up here, then settle into sparse cards linked back to the real sidebar session.
								</p>
							</div>
							<Badge variant={connected ? "secondary" : "outline"}>
								{connected ? "server ready" : "server offline"}
							</Badge>
						</div>

						<div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
							{SUGGESTIONS.map((suggestion) => {
								const Icon = suggestion.icon
								return (
									<button
										key={suggestion.text}
										type="button"
										onClick={() => void handleLaunch(suggestion.text)}
										disabled={launching || !selectedDirectory}
										className="group/card flex flex-col gap-3 rounded-2xl border border-border/50 bg-background/70 p-4 text-left transition-colors hover:border-foreground/20 hover:bg-background disabled:opacity-50"
									>
										<Icon className="size-5 text-muted-foreground transition-colors group-hover/card:text-foreground" />
										<p className="text-sm leading-snug text-muted-foreground transition-colors group-hover/card:text-foreground">
											{suggestion.text}
										</p>
									</button>
								)
							})}
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
						{cards.length > 0 ? (
							cards.map((card) => {
								const canOpenSession = card.kind === "session" || (card.kind === "ticket" && !!card.sessionId)
								return (
									<PmCardTile
										key={`${card.kind}-${card.id}`}
										card={card}
										onOpenSession={
											canOpenSession
												? () => {
													const targetSessionId = card.kind === "session" ? card.sessionId : card.sessionId
													if (!targetSessionId) return
													const targetProjectSlug =
														card.kind === "session" ? card.projectSlug : selectedProject?.slug ?? "unknown"
													navigate({
														to: "/project/$projectSlug/session/$sessionId",
														params: { projectSlug: targetProjectSlug, sessionId: targetSessionId },
													})
												}
												: undefined
										}
									/>
								)
							})
						) : (
							<div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground lg:col-span-2 xl:col-span-3">
								Submit a PM prompt to spawn a fresh session. Ticket cards will also hydrate here from CH5PM snapshots.
							</div>
						)}
					</div>
				</div>
			</div>

			<div className="shrink-0 px-0 pb-0 pt-0 sm:px-6 sm:pb-5 sm:pt-3">
				<div className="mx-auto w-full max-w-5xl">
					<PromptInputProvider key={PROJECT_MANAGER_DRAFT_KEY} initialInput={draft}>
						<DraftSync setDraft={setDraft} />
						<MentionBridge controllerRef={controllerRef} />
						<MentionTrigger
							onMentionChange={(open, query) => {
								setMentionOpen(open)
								setMentionQuery(query)
							}}
						/>
						<div className="relative">
							<MentionPopover
								ref={mentionPopoverRef}
								query={mentionQuery}
								open={mentionOpen}
								directory={selectedDirectory || null}
								agents={openCodeAgents ?? []}
								onSelect={handleMentionSelect}
								onClose={() => setMentionOpen(false)}
							/>
							<PromptInput
								className="rounded-xl"
								accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
								multiple
								maxFileSize={10 * 1024 * 1024}
								onSubmit={(message) => {
									if (message.text.trim()) {
										void handleLaunch(
											message.text.trim(),
											message.files.length > 0 ? message.files : undefined,
										)
									}
								}}
							>
								<PromptAttachmentPreview
									supportsImages={modelCapabilities?.image}
									supportsPdf={modelCapabilities?.pdf}
								/>
								<PromptInputTextarea
									placeholder="What should project manager coordinate?"
									autoFocus
									disabled={launching || !selectedDirectory || projects.length === 0}
									className="min-h-[80px]"
									onKeyDown={handleTextareaKeyDown}
								/>

								{hasToolbar && (
									<PromptInputFooter>
										<PromptInputTools>
											<PromptToolbar
												agents={openCodeAgents ?? []}
												selectedAgent={selectedAgent}
												defaultAgent={config?.defaultAgent}
												onSelectAgent={setSelectedAgent}
												providers={providers}
												effectiveModel={effectiveModel}
												hasModelOverride={!!selectedModel}
												onSelectModel={handleModelSelect}
												recentModels={recentModels}
												selectedVariant={selectedVariant}
												onSelectVariant={setSelectedVariant}
											/>
										</PromptInputTools>
									</PromptInputFooter>
								)}
							</PromptInput>
						</div>
					</PromptInputProvider>

					{providers && (
						<StatusBar
							vcs={vcs ?? null}
							isConnected={connected}
							branchSlot={
								selectedDirectory ? (
									<BranchPicker
										directory={selectedDirectory}
										currentBranch={vcs?.branch}
										onBranchChanged={handleBranchChanged}
										activeSessionCount={activeSessionCount}
									/>
								) : undefined
							}
							extraSlot={undefined}
						/>
					)}

					{error && (
						<div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
							{error}
						</div>
					)}

					{projects.length === 0 && (
						<p className="mt-2 text-center text-xs text-muted-foreground">
							No projects found. Check that projects exist in ~/.local/share/opencode/storage/.
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

function OverviewCard({
	label,
	value,
	icon: Icon,
}: {
	label: string
	value: number
	icon: typeof BlocksIcon
}) {
	return (
		<div className="rounded-2xl border border-border/60 bg-card/60 p-4">
			<div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
				<Icon className="size-3.5" />
				{label}
			</div>
			<div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
		</div>
	)
}

function PmCardTile({
	card,
	onOpenSession,
}: {
	card: PmCard
	onOpenSession?: () => void
}) {
	const statusVariant =
		card.status === "blocked" ? "destructive" : card.status === "pending" ? "outline" : "secondary"

	return (
		<div className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<div>
					<Badge variant={statusVariant}>{card.status}</Badge>
					<div className="mt-3 text-base font-medium text-foreground">{card.title}</div>
					<p className="mt-1 text-sm text-muted-foreground">{card.caption}</p>
				</div>
				{onOpenSession ? (
					<Button variant="ghost" size="icon-sm" onClick={onOpenSession}>
						<ArrowRightIcon className="size-4" />
					</Button>
				) : null}
			</div>
			{card.meta.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2">
					{card.meta.map((item) => (
						<Badge key={item} variant="outline">
							{item}
						</Badge>
					))}
				</div>
			) : null}
		</div>
	)
}
