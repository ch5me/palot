import { MessageResponse } from "@ch5me/elf-ui/components/ai-elements/message"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
	ArrowRightIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	Loader2Icon,
	MessageCircleQuestionIcon,
	ShieldAlertIcon,
	ZapIcon,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { messagesFamily } from "../../atoms/messages"
import { partsFamily } from "../../atoms/parts"
import { sessionFamily } from "../../atoms/sessions"
import { appStore } from "../../atoms/store"
import { getStreamingPartsForSession, streamingVersionFamily } from "../../atoms/streaming"
import { useToolElapsedTime } from "../../hooks/use-elapsed-time"
import type { ReasoningPart, ToolPart, ToolState } from "../../lib/types"
import { getToolDuration, getToolInfo, getToolSubtitle } from "./chat-tool-call"
import { getToolCategory, TOOL_CATEGORY_COLORS } from "./tool-card"

// ============================================================
// Collapse state for three-tier agent card
// ============================================================

type CollapseState = "closed" | "summary" | "expanded"

function extractFirstLine(md: string): string | undefined {
	const lines = md.split("\n")
	for (const raw of lines) {
		const line = raw
			.replace(/^#{1,6}\s+/, "")
			.replace(/^[-*_]{3,}\s*$/, "")
			.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
			.replace(/`([^`]+)`/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/^[-*+]\s+/, "")
			.replace(/^\d+\.\s+/, "")
			.trim()
		if (line.length > 0) return line
	}
	return undefined
}

// ============================================================
// SubAgentCard
// ============================================================

interface SubAgentCardProps {
	part: ToolPart
}

/**
 * Renders a sub-agent (task tool) as a three-state collapsible card.
 *
 * **Closed**: Header bar only — chevron, Zap icon, "Agent" label,
 * agent type, truncated task description, live status / duration, Open button.
 *
 * **Summary**: Header + first ~4 lines of the agent's final text as a
 * preview with a "Show more" affordance. No tool rows shown.
 *
 * **Expanded**: Header + task description + tool activity rows + full
 * markdown-rendered agent response.
 *
 * While running the card is fully expanded. On completion it auto-collapses
 * to the summary state (or closed if there's no text).
 */
export const SubAgentCard = memo(function SubAgentCard({ part: propPart }: SubAgentCardProps) {
	const navigate = useNavigate()
	const { projectSlug } = useParams({ strict: false }) as { projectSlug?: string }

	// Read the live tool part directly from the store so we always have the
	// latest state (status, metadata, output) even when the parent turn's
	// structural sharing keeps the prop stale.
	const messageParts = useAtomValue(partsFamily(propPart.messageID))
	const livePart = useMemo(
		() => messageParts?.find((p): p is ToolPart => p.id === propPart.id && p.type === "tool"),
		[messageParts, propPart.id],
	)
	const part = livePart ?? propPart

	// Count how many sibling task tools exist in the same message.
	// When there are parallel sub-agents, we start in "summary" instead of
	// "expanded" to avoid a noisy wall of live tool activity.
	const hasParallelSiblings = useMemo(
		() => (messageParts?.filter((p) => p.type === "tool" && p.tool === "task").length ?? 0) > 1,
		[messageParts],
	)

	// Derive sessionId from the live part's metadata so it becomes available
	// as soon as the server populates it, even if the parent doesn't re-render.
	const sessionId = useMemo(() => {
		if (part.tool !== "task") return undefined
		const state = part.state as ToolState & { metadata?: Record<string, unknown> }
		return (state.metadata?.sessionId as string | undefined) ?? undefined
	}, [part])

	const handleNavigate = useCallback(
		(e: React.MouseEvent) => {
			// Prevent the click from toggling the collapsible
			e.stopPropagation()
			if (sessionId) {
				navigate({
					to: "/project/$projectSlug/session/$sessionId",
					params: {
						projectSlug: projectSlug ?? "unknown",
						sessionId,
					},
				})
			}
		},
		[sessionId, navigate, projectSlug],
	)

	const taskTitle =
		(part.state.input?.description as string) ??
		("title" in part.state ? part.state.title : undefined) ??
		"Sub-agent"
	const agentType = (part.state.input?.subagent_type as string) ?? "general"

	// Determine if the sub-agent is still running
	const isRunning = part.state.status === "running" || part.state.status === "pending"
	const isError = part.state.status === "error"
	const isCompleted = part.state.status === "completed"

	// Detect pending interactive requests (permissions / questions) on the child session.
	// This lets the card header show a "waiting" indicator while the user hasn't
	// yet responded in the parent session's input area.
	const childSessionEntry = useAtomValue(sessionFamily(sessionId ?? ""))
	const childHasPendingPermission = (childSessionEntry?.permissions.length ?? 0) > 0
	const childHasPendingQuestion = (childSessionEntry?.questions.length ?? 0) > 0
	const childIsWaiting = isRunning && (childHasPendingPermission || childHasPendingQuestion)

	// ── Three-state collapse ───────────────────────────────────
	// "closed"   → header only
	// "summary"  → header + text preview (first ~4 lines)
	// "expanded" → header + tools + full markdown text
	const [collapseState, setCollapseState] = useState<CollapseState>(
		hasParallelSiblings ? "summary" : "expanded",
	)
	const wasRunningRef = useRef(isRunning)

	const handleHeaderToggle = useCallback(() => {
		setCollapseState((prev) => {
			if (prev === "closed") return isRunning ? "expanded" : "summary"
			return "closed"
		})
	}, [isRunning])

	const handleShowMore = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
		setCollapseState("expanded")
	}, [])

	const handleShowLess = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
		setCollapseState("summary")
	}, [])

	// ── Duration ───────────────────────────────────────────────
	const duration = getToolDuration(part)
	const elapsedTime = useToolElapsedTime(part)

	// Access child session data from the store.
	const childMessages = useAtomValue(messagesFamily(sessionId ?? ""))

	// Subscribe to the per-session streaming version so we only re-render
	// when this child session streams, not when any other session streams.
	const streamingVersion = useAtomValue(streamingVersionFamily(sessionId ?? ""))

	const {
		latestToolParts,
		latestText,
		latestReasoning,
		childStatus,
		hasAnyVisibleContent,
	} = useMemo(() => {
		if (!childMessages || childMessages.length === 0) {
			return {
				latestToolParts: [],
				latestText: undefined,
				latestReasoning: undefined,
				childStatus: undefined,
				hasAnyVisibleContent: false,
			}
		}

		void streamingVersion
		const streaming = getStreamingPartsForSession(sessionId ?? "")
		const toolParts: ToolPart[] = []
		let latestText: string | undefined
		let latestReasoning: ReasoningPart | undefined
		let lastStatus: string | undefined

		for (const msg of childMessages) {
			const baseParts = appStore.get(partsFamily(msg.id))
			if (!baseParts) continue
			const overrides = streaming[msg.id]

			for (const bp of baseParts) {
				const p = overrides?.[bp.id] ?? bp
				if (p.type === "tool" && p.tool !== "todoread") {
					toolParts.push(p)
				}
				if (p.type === "text" && !p.synthetic && p.text.trim()) {
					latestText = p.text.trim()
				}
				if (p.type === "reasoning" && p.text.replace("[REDACTED]", "").trim()) {
					latestReasoning = p
				}
				if (p.type === "tool") {
					switch (p.tool) {
						case "task":
							lastStatus = "Delegating..."
							break
						case "todowrite":
						case "todoread":
							lastStatus = "Planning..."
							break
						case "read":
							lastStatus = "Reading files..."
							break
						case "list":
						case "grep":
						case "glob":
							lastStatus = "Searching codebase..."
							break
						case "webfetch":
							lastStatus = "Fetching web content..."
							break
						case "edit":
						case "write":
						case "apply_patch":
							lastStatus = "Making edits..."
							break
						case "bash":
							lastStatus = "Running command..."
							break
						default:
							lastStatus = `Running ${p.tool}...`
							break
					}
				} else if (p.type === "reasoning") {
					lastStatus = "Thinking..."
				} else if (p.type === "text") {
					lastStatus = "Composing response..."
				}
			}
		}

		return {
			latestToolParts: toolParts.slice(-3),
			latestText,
			latestReasoning,
			childStatus: lastStatus ?? "Working...",
			hasAnyVisibleContent:
				toolParts.length > 0 || Boolean(latestText) || Boolean(latestReasoning),
		}
	}, [childMessages, streamingVersion, sessionId])

	useEffect(() => {
		if (wasRunningRef.current && !isRunning) {
			requestAnimationFrame(() => {
				setCollapseState((prev) => {
					if (prev !== "expanded") return prev
					return hasAnyVisibleContent ? "summary" : "closed"
				})
			})
		}
		wasRunningRef.current = isRunning
	}, [isRunning, hasAnyVisibleContent])

	const summarySource = latestText ?? latestReasoning?.text.replace("[REDACTED]", "").trim() ?? ""
	const firstLine = useMemo(() => extractFirstLine(summarySource), [summarySource])
	const hasMore = useMemo(() => {
		if (!summarySource || !firstLine) return false
		const rest = summarySource.slice(summarySource.indexOf(firstLine) + firstLine.length).trim()
		return rest.length > 0
	}, [summarySource, firstLine])

	useEffect(() => {
		if (collapseState === "summary" && !firstLine && !hasAnyVisibleContent) {
			setCollapseState("closed")
		}
	}, [collapseState, firstLine, hasAnyVisibleContent])

	const terminalMessage = useMemo(() => {
		if (isError) {
			return part.state.status === "error" ? part.state.error : "Sub-agent failed"
		}
		if (childSessionEntry?.error) {
			if ("message" in childSessionEntry.error.data && childSessionEntry.error.data.message) {
				const message = String(childSessionEntry.error.data.message)
				if (message.toLowerCase().includes("timed out")) {
					return `Sub-agent timed out — ${message}`
				}
				return message
			}
			return childSessionEntry.error.name
		}
		if (isCompleted && !hasAnyVisibleContent) return "Sub-agent completed with no visible output"
		if (!isRunning && !isCompleted && !hasAnyVisibleContent) return "Sub-agent stopped with no visible output"
		return undefined
	}, [isError, part.state, childSessionEntry?.error, isCompleted, hasAnyVisibleContent, isRunning])

	const shouldShowOpenButton = Boolean(sessionId)
	const showSummary = collapseState === "summary" || collapseState === "expanded"
	const showExpanded = collapseState === "expanded"

	return (
		<div
			className={cn(
				"overflow-hidden rounded-lg border",
				isRunning
					? "border-violet-500/30 bg-violet-500/[0.02]"
					: isError
						? "border-red-500/30 bg-red-500/[0.02]"
						: "border-border bg-card/50",
			)}
		>
			{/* Header — always visible */}
			<div className="flex items-center gap-2.5 px-3.5 py-2.5">
				{/* Clickable area toggles collapse */}
				<button
					type="button"
					onClick={handleHeaderToggle}
					className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
				>
					<ChevronRightIcon
						className={cn(
							"size-3 shrink-0 text-muted-foreground/50 transition-transform",
							collapseState !== "closed" && "rotate-90",
						)}
					/>
					<ZapIcon
						className={cn(
							"size-3.5 shrink-0",
							isRunning ? "text-violet-400 animate-pulse" : "text-muted-foreground",
						)}
					/>
					<span className="text-xs font-medium text-foreground/80">Agent</span>
					<span className="shrink-0 text-xs text-muted-foreground/60">({agentType})</span>
					{/* Truncated task title in header */}
					<span className="min-w-0 truncate text-xs text-muted-foreground/50">{taskTitle}</span>
				</button>
				{/* Right side: status / duration / open button — outside trigger */}
				<div className="flex shrink-0 items-center gap-2.5">
				{/* Waiting indicator: shown when sub-agent has a pending permission or question */}
				{childIsWaiting && childHasPendingPermission && (
					<span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
						<ShieldAlertIcon className="size-3 shrink-0" aria-hidden="true" />
						Needs approval
					</span>
				)}
				{childIsWaiting && childHasPendingQuestion && !childHasPendingPermission && (
					<span className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
						<MessageCircleQuestionIcon className="size-3 shrink-0" aria-hidden="true" />
						Asking a question
					</span>
				)}
				{isRunning && !childIsWaiting && childStatus && (
					<span className="text-[11px] text-muted-foreground/60">{childStatus}</span>
				)}
				{isRunning && elapsedTime && (
					<span className="text-[11px] tabular-nums text-muted-foreground/40">
						{elapsedTime}
					</span>
				)}
				{isRunning && !childIsWaiting && <Loader2Icon className="size-3 animate-spin text-muted-foreground/40" />}
				{childIsWaiting && <Loader2Icon className="size-3 animate-spin text-amber-400/60" />}
					{!isRunning && duration && (
						<span className="text-[11px] text-muted-foreground/40">{duration}</span>
					)}
					{shouldShowOpenButton && (
						<button
							type="button"
							onClick={handleNavigate}
							className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
						>
							Open
							<ArrowRightIcon className="size-3" />
						</button>
					)}
				</div>
			</div>

			{/* ── Summary state: single-line teaser ────────────────── */}
			{showSummary && !showExpanded && firstLine && (
				<div className="flex items-baseline gap-2 border-t border-border/30 px-3.5 py-2">
					<p className="min-w-0 flex-1 truncate text-[11px] leading-relaxed text-muted-foreground/70 italic">
						{firstLine}
					</p>
					{hasMore && (
						<button
							type="button"
							onClick={handleShowMore}
							className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary/70 transition-colors hover:text-primary"
						>
							Show more
							<ChevronDownIcon className="size-3" />
						</button>
					)}
				</div>
			)}

			{/* ── Expanded state: full content ────────────────────── */}
			{showExpanded && (
				<>
					{latestReasoning && (
						<div className="border-t border-border/30 px-3.5 py-2.5">
							<div className="max-h-72 overflow-y-auto rounded-md bg-muted/20 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground/80 whitespace-pre-wrap">
								{latestReasoning.text.replace("[REDACTED]", "").trim()}
							</div>
						</div>
					)}

					{/* Live activity: latest tool calls */}
					{latestToolParts.length > 0 && (
						<div className="border-t border-border/30 px-3.5 py-2">
							<div className="space-y-1">
								{latestToolParts.map((tp) => {
									const { icon: TpIcon, title } = getToolInfo(tp.tool)
									const tpSubtitle = getToolSubtitle(tp)
									const category = getToolCategory(tp.tool)
									const borderColor = TOOL_CATEGORY_COLORS[category]
									const tpRunning = tp.state.status === "running" || tp.state.status === "pending"
									const tpError = tp.state.status === "error"

									return (
										<div
											key={tp.id}
											className={cn(
												"flex items-center gap-2 rounded border-l-2 px-2.5 py-1 text-[11px]",
												borderColor,
											)}
										>
											<TpIcon
												className={cn(
													"size-3 shrink-0",
													tpError
														? "text-red-400"
														: tpRunning
															? "text-muted-foreground animate-pulse"
															: "text-muted-foreground/60",
												)}
											/>
											<span
												className={cn(
													"font-medium",
													tpError ? "text-red-400" : "text-foreground/70",
												)}
											>
												{title}
											</span>
											{tpSubtitle && (
												<span className="min-w-0 truncate text-muted-foreground/50">
													{tpSubtitle}
												</span>
											)}
										</div>
									)
								})}
							</div>
						</div>
					)}

					{/* Full agent response rendered as markdown */}
					{latestText && (
						<div className="border-t border-border/30 px-3.5 py-2.5">
							<div className="max-h-96 overflow-y-auto text-xs text-muted-foreground">
								<MessageResponse
									animated={isRunning}
									className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_p]:text-xs [&_p]:my-1 [&_pre]:max-h-40 [&_pre]:text-[11px]"
								>
									{latestText}
								</MessageResponse>
							</div>
							{hasMore && (
								<button
									type="button"
									onClick={handleShowLess}
									className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/70 transition-colors hover:text-primary"
								>
									Show less
									<ChevronUpIcon className="size-3" />
								</button>
							)}
						</div>
					)}

					{terminalMessage && (
						<div
							className={cn(
								"border-t px-3.5 py-2",
								isError || childSessionEntry?.error
									? "border-red-500/20 bg-red-500/5"
									: "border-border/30",
							)}
						>
							<span
								className={cn(
									"text-[11px]",
									isError || childSessionEntry?.error
										? "text-red-400"
										: "text-muted-foreground/50",
								)}
							>
								{terminalMessage}
							</span>
						</div>
					)}
				</>
			)}

			{showSummary && !showExpanded && terminalMessage && (
				<div
					className={cn(
						"border-t px-3.5 py-2",
						isError || childSessionEntry?.error
							? "border-red-500/20 bg-red-500/5"
							: "border-border/30",
					)}
				>
					<span
						className={cn(
							"text-[11px]",
							isError || childSessionEntry?.error ? "text-red-400" : "text-muted-foreground/50",
						)}
					>
						{terminalMessage}
					</span>
				</div>
			)}
		</div>
	)
})
