import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"
import { memo, type ReactNode } from "react"
import { composePmSideAgentsModel, type Ch5PmSideAgentsViewModel } from "../pm-side-agents/composition"
import { getSideAgentDocsPath, getSideAgentsByProvenance, type SideAgentProvenance } from "../pm-side-agents/registry"
import type {
	Ch5PmSideAgentAction,
	Ch5PmSideAgentAttentionRow,
	Ch5PmSideAgentBoxDigest,
	Ch5PmSideAgentHealthPayload,
	Ch5PmSideAgentPayload,
	Ch5PmSideAgentQueuePayload,
	Ch5PmSideAgentSessionReport,
} from "../pm-side-agents/types"
import {
	fetchCh5PmSideAgentFeed,
	fetchCh5PmSideAgentHealth,
	fetchCh5PmSideAgentQueue,
	fetchCh5PmState,
	openExternalUrl,
} from "../services/backend"

const POLL_MS = 15_000

type SideAgentsPanelModel = Ch5PmSideAgentsViewModel

type SideAgentsQueryResult = {
	pmState: Awaited<ReturnType<typeof fetchCh5PmState>>
	feedPayload?: Ch5PmSideAgentPayload
	queuePayload?: Ch5PmSideAgentQueuePayload
	healthPayload?: Ch5PmSideAgentHealthPayload
}

function normalizeFeedPayload(
	value: SideAgentsQueryResult["feedPayload"] | SideAgentsPanelModel["feed"] | undefined,
): SideAgentsQueryResult["feedPayload"] {
	if (!value) return undefined
	if ("ok" in value) return value
	return {
		ok: true,
		health: undefined,
		helper: undefined,
		hubBoxId: value.hubBoxId,
		generatedAt: value.generatedAt,
		boxes: value.boxes,
		recentActions: value.recentActions,
		attention: value.attention,
		babysitterLoop: null,
		degradedReasons: [],
		dataAges: null,
	}
}

function toneClass(severity: SideAgentsPanelModel["degraded"]["severity"]): string {
	if (severity === "healthy") return "border-emerald-500/40 text-emerald-500"
	if (severity === "offline") return "border-red-500/40 text-red-400"
	return "border-amber-500/40 text-amber-400"
}

function SideAgentsStatusBadge({ label, tone }: { label: string; tone?: string }) {
	return (
		<span
			className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${tone ?? "border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"}`}
		>
			{label}
		</span>
	)
}

function sourceLabel(provenance: SideAgentProvenance | "missing"): string {
	if (provenance === "live-fed") return "live"
	if (provenance === "detected") return "detected"
	if (provenance === "static") return "static"
	return "missing"
}

function sourceBadgeTone(provenance: SideAgentProvenance | "missing"): string {
	if (provenance === "live-fed") return "border-sky-500/40 text-sky-400"
	if (provenance === "detected") return "border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
	if (provenance === "static") return "border-violet-500/40 text-violet-400"
	return "border-red-500/40 text-red-400"
}

function freshnessBadgeTone(freshness: "fresh" | "stale" | "missing"): string {
	if (freshness === "fresh") return "border-emerald-500/40 text-emerald-500"
	if (freshness === "stale") return "border-amber-500/40 text-amber-400"
	return "border-red-500/40 text-red-400"
}

function countBadgeTone(count: number): string {
	return count > 0 ? "border-amber-500/40 text-amber-400" : "border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
}

function InlineLink({
	label,
	onClick,
	className,
}: {
	label: string
	onClick: () => void
	className?: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={className ?? "truncate text-left text-sky-500 hover:text-sky-400"}
		>
			{label}
		</button>
	)
}

function SourceBadgeRow({
	provenance,
	freshness,
	age,
	reasonCount,
}: {
	provenance: SideAgentProvenance | "missing"
	freshness?: "fresh" | "stale" | "missing"
	age?: string | null
	reasonCount?: number
}) {
	return (
		<div className="flex flex-wrap items-center gap-1">
			<SideAgentsStatusBadge label={`src:${sourceLabel(provenance)}`} tone={sourceBadgeTone(provenance)} />
			{freshness ? (
				<SideAgentsStatusBadge label={`fresh:${freshness}`} tone={freshnessBadgeTone(freshness)} />
			) : null}
			{age ? <SideAgentsStatusBadge label={`age:${age}`} /> : null}
			{typeof reasonCount === "number" ? (
				<SideAgentsStatusBadge label={`reasons:${reasonCount}`} tone={countBadgeTone(reasonCount)} />
			) : null}
		</div>
	)
}

function SideAgentsSection({
	title,
	meta,
	children,
}: {
	title: string
	meta?: string
	children: ReactNode
}) {
	return (
		<section className="flex min-h-0 flex-col border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
			<div className="flex h-6 items-center justify-between bg-neutral-100 px-2 text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
				<span>{title}</span>
				{meta ? <span className="truncate font-normal tracking-[0.1em]">{meta}</span> : null}
			</div>
			<div className="scrollbar-thin min-h-0 overflow-auto px-2 py-2">{children}</div>
		</section>
	)
}

function SideAgentsEmpty({
	label,
	detail,
	tone = "muted",
}: {
	label: string
	detail?: string
	tone?: "muted" | "degraded"
}) {
	const toneClassName = tone === "degraded"
		? "border-amber-600/30 bg-amber-950/10 text-amber-200"
		: "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400"
	return (
		<div className={`rounded border px-2 py-2 ${toneClassName}`}>
			<div className="text-[10px] uppercase tracking-[0.12em]">{label}</div>
			{detail ? <div className="mt-1 text-[10px] normal-case tracking-normal">{detail}</div> : null}
		</div>
	)
}

function KeyValueGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[10px]">
			{items.map((item) => (
				<div key={item.label} className="contents">
					<div className="text-neutral-500 dark:text-neutral-400">{item.label}</div>
					<div className="truncate">{item.value}</div>
				</div>
			))}
		</div>
	)
}

function DividerCard({ children }: { children: ReactNode }) {
	return <div className="rounded border border-neutral-200 px-2 py-1.5 dark:border-neutral-800">{children}</div>
}

function fmtAge(value?: string | null): string {
	if (!value) return "--"
	const ts = Date.parse(value)
	if (Number.isNaN(ts)) return value
	const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
	if (sec < 60) return `${sec}s`
	const min = Math.floor(sec / 60)
	if (min < 60) return `${min}m`
	const hr = Math.floor(min / 60)
	if (hr < 48) return `${hr}h`
	return `${Math.floor(hr / 24)}d`
}

function classificationTone(classification: string): string {
	if (classification === "decision-needed") return "border-red-500/40 text-red-400"
	if (classification === "wedged" || classification === "aborted") return "border-amber-500/40 text-amber-400"
	if (classification === "looping") return "border-sky-500/40 text-sky-400"
	if (classification === "healthy") return "border-emerald-500/40 text-emerald-500"
	return "border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
}

function summarizeBoxClassifications(sessions: Ch5PmSideAgentSessionReport[]): Array<{ label: string; count: number }> {
	const counts = new Map<string, number>()
	for (const session of sessions) {
		const key = session.classification ?? "unknown"
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label, count]) => ({ label, count }))
}

function sessionRouteCandidate(
	sessionId: string | null | undefined,
	dir: string | null | undefined,
	model: SideAgentsPanelModel,
): { projectSlug: string; sessionId: string } | null {
	if (!sessionId) return null
	const denseMatch = model.denseConsole.sessions.find((session) => session.id === sessionId)
	if (denseMatch?.projectSlug) {
		return { projectSlug: denseMatch.projectSlug, sessionId }
	}
	const normalizedDir = dir?.trim().toLowerCase()
	if (!normalizedDir) return null
	const dirMatch = model.denseConsole.sessions.find((session) => {
		const repo = session.repo?.trim().toLowerCase()
		const projectSlug = session.projectSlug?.trim().toLowerCase()
		return repo === normalizedDir || projectSlug === normalizedDir
	})
	if (!dirMatch?.projectSlug) return null
	return { projectSlug: dirMatch.projectSlug, sessionId }
}

function sourceDocPath(docsLink: string | null): string | null {
	return getSideAgentDocsPath(docsLink)
}

function SideAgentsPanelBody({
	model,
	onRefresh,
	isRefreshing,
}: {
	model: SideAgentsPanelModel
	onRefresh: () => void
	isRefreshing: boolean
}) {
	const router = useRouter()
	const feed = model.feed
	const queue = model.queue
	const loop = model.loop
	const feedBoxes: Ch5PmSideAgentBoxDigest[] = feed?.boxes ?? []
	const recentActions: Ch5PmSideAgentAction[] = feed?.recentActions ?? []
	const liveDecisions: Ch5PmSideAgentAttentionRow[] = model.attention.live
	const queueGroups: SideAgentsPanelModel["queue"]["groups"] = queue.groups
	const queueRows = queue.jobs.length + queue.claims.length
	const degraded = model.degraded.bannerReasons
	const liveRegistryEntries = getSideAgentsByProvenance("live-fed")
	const detectedRegistryEntries = getSideAgentsByProvenance("detected")
	const staticRegistryEntries = getSideAgentsByProvenance("static")
	type DecisionRow = {
		boxId: string
		sessionId: string
		title: string
		classification: string
		reason: string
		gist: string
		dir?: string
		source: "attention" | "box-digest" | "model-pass"
	}
	const boxDecisionRows: DecisionRow[] = feedBoxes.flatMap((box) =>
		box.sessions
			.filter((session) => session.classification === "decision-needed" || session.severity === "error")
			.map((session): DecisionRow => ({
				boxId: box.boxId,
				sessionId: session.sessionId,
				title: session.title,
				classification: session.classification,
				reason: session.reason,
				gist: session.gist,
				dir: session.dir as string | undefined,
				source: session.classification === "decision-needed" ? "box-digest" : "model-pass",
			})),
	)
	const decisionMap = new Map<string, DecisionRow>()
	for (const item of boxDecisionRows) {
		decisionMap.set(`${item.boxId}:${item.sessionId}:${item.classification}:${item.reason}`, item)
	}
	for (const item of liveDecisions) {
		decisionMap.set(`${item.boxId}:${item.sessionId}:${item.classification}:${item.reason}`, {
			boxId: item.boxId,
			sessionId: item.sessionId,
			title: item.title,
			classification: item.classification,
			reason: item.reason,
			gist: item.gist,
			dir: undefined,
			source: "attention",
		})
	}
	const decisionRows = [...decisionMap.values()]
	const hasAnyLiveData = Boolean(feed || queueRows > 0 || decisionRows.length > 0)
	const emptyState = !hasAnyLiveData && model.sources.feed.status === "missing" && model.sources.queue.status === "missing"
	const showDegradedOverlay = !emptyState && model.degraded.severity !== "healthy" && !hasAnyLiveData

	function navigateToSession(target: { projectSlug: string; sessionId: string } | null) {
		if (!target) return
		void router.navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug: target.projectSlug, sessionId: target.sessionId },
		})
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-mono text-[10px] dark:bg-neutral-950 dark:text-neutral-200">
			<div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-neutral-300 bg-neutral-100 px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
				<div className="flex flex-1 flex-wrap items-center gap-2">
					<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-900 dark:text-neutral-100">
						Side Agents
					</div>
					<SideAgentsStatusBadge label={model.status.live} tone={toneClass(model.degraded.severity)} />
					<SourceBadgeRow
						provenance={model.sources.feed.status === "missing" ? "missing" : "live-fed"}
						freshness={model.freshness.feed}
						age={model.sources.feed.updatedAt ? fmtAge(model.sources.feed.updatedAt) : null}
						reasonCount={model.sources.feed.reasons.length}
					/>
					<SourceBadgeRow
						provenance={model.sources.queue.status === "missing" ? "missing" : "detected"}
						freshness={model.freshness.queue}
						age={model.sources.queue.updatedAt ? fmtAge(model.sources.queue.updatedAt) : null}
						reasonCount={model.sources.queue.reasons.length}
					/>
					<SourceBadgeRow
						provenance={model.sources.health.status === "missing" ? "missing" : "detected"}
						freshness={model.freshness.health}
						age={model.sources.health.updatedAt ? fmtAge(model.sources.health.updatedAt) : null}
						reasonCount={model.sources.health.reasons.length}
					/>
					<SideAgentsStatusBadge
						label={`prov:${model.provenance.liveFed}/${model.provenance.detected}/${model.provenance.static}`}
					/>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="h-5 shrink-0 rounded-none border-0 px-1.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
				>
					<RefreshCwIcon className={`mr-1 size-2.5 ${isRefreshing ? "animate-spin" : ""}`} />
					sync
				</Button>
			</div>
			{degraded.length > 0 ? (
				<div className="border-b border-red-600/30 bg-red-950/30 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-red-300">
					{degraded.join(" · ")}
				</div>
			) : null}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{emptyState ? (
					<div className="px-2 py-2">
						<SideAgentsEmpty
							label="side-agent shell waiting for daemon sources"
							detail="loop, boxes, decisions, actions, queue containers live now. data lanes still missing."
							tone="degraded"
						/>
					</div>
				) : null}
				{showDegradedOverlay ? (
					<div className="px-2 py-2">
						<SideAgentsEmpty
							label="degraded source mix"
							detail="shared mapper returned partial/offline sources. shell stays mounted so live cards can backfill without layout jump."
							tone="degraded"
						/>
					</div>
				) : null}
				<div className="scrollbar-thin grid min-h-0 flex-1 auto-rows-min overflow-auto">
					<SideAgentsSection title="loop" meta={`${loop.status} / ${loop.source}`}>
						<DividerCard>
							<SourceBadgeRow
								provenance={loop.source === "feed" ? "live-fed" : loop.source === "health" ? "detected" : "missing"}
								freshness={loop.source === "feed" ? model.sources.feed.freshness : loop.source === "health" ? model.sources.health.freshness : "missing"}
								age={loop.updatedAt ? fmtAge(loop.updatedAt) : null}
								reasonCount={loop.reasons.length}
							/>
							<div className="mt-2 flex flex-wrap items-center gap-1.5">
								<SideAgentsStatusBadge label={loop.status} tone={toneClass(loop.severity)} />
								<SideAgentsStatusBadge label={`source:${loop.source}`} />
								{loop.updatedAt ? <SideAgentsStatusBadge label={`seen:${fmtAge(loop.updatedAt)}`} /> : null}
							</div>
							<div className="mt-2">
								<KeyValueGrid
									items={[
										{ label: "interval", value: loop.intervalSeconds != null ? `${loop.intervalSeconds}s` : "--" },
										{ label: "passes", value: loop.passes ?? "--" },
										{ label: "last run", value: loop.lastRunAt ? `${fmtAge(loop.lastRunAt)} · ${loop.lastRunAt}` : "--" },
										{ label: "last digest", value: loop.lastDigestAt ? `${fmtAge(loop.lastDigestAt)} · ${loop.lastDigestAt}` : "--" },
									]}
								/>
							</div>
							{loop.lastError ? (
								<div className="mt-2 rounded border border-red-600/30 bg-red-950/20 px-2 py-1 text-[10px] text-red-300">
									{loop.lastError}
								</div>
							) : null}
							{loop.reasons.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-1">
									{loop.reasons.map((reason: string) => (
										<SideAgentsStatusBadge key={reason} label={reason} tone={toneClass(loop.severity)} />
									))}
								</div>
							) : null}
						</DividerCard>
					</SideAgentsSection>
					<SideAgentsSection title="boxes" meta={`${feedBoxes.length} live`}>
						<div className="mb-2 flex flex-wrap items-center gap-1">
							<SourceBadgeRow
								provenance={feedBoxes.length > 0 ? "live-fed" : model.sources.feed.status === "missing" ? "missing" : "live-fed"}
								freshness={model.sources.feed.freshness}
								age={model.sources.feed.updatedAt ? fmtAge(model.sources.feed.updatedAt) : null}
								reasonCount={model.sources.feed.reasons.length}
							/>
							<SideAgentsStatusBadge label={`registry:${liveRegistryEntries.length}`} tone={sourceBadgeTone("live-fed")} />
						</div>
						{feedBoxes.length > 0 ? (
							<div className="grid gap-2">
								{feedBoxes.slice(0, 8).map((box) => {
									const classSummary = summarizeBoxClassifications(box.sessions)
									return (
										<DividerCard key={box.boxId}>
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div className="min-w-0">
													<div className="truncate text-neutral-900 dark:text-neutral-100">{box.boxId}</div>
													<div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
														gen {fmtAge(box.generatedAt)} · every {box.intervalSeconds}s
													</div>
												</div>
												<div className="flex flex-wrap justify-end gap-1">
													<SideAgentsStatusBadge label={`${box.sessions.length} sessions`} />
													<SideAgentsStatusBadge
														label={box.modelPassRan ? "model-pass:ran" : "model-pass:none"}
														tone={box.modelPassRan ? "border-sky-500/40 text-sky-400" : undefined}
													/>
												</div>
											</div>
											{classSummary.length > 0 ? (
												<div className="mt-2 flex flex-wrap gap-1">
													{classSummary.map((item) => (
														<SideAgentsStatusBadge
															key={`${box.boxId}-${item.label}`}
															label={`${item.label}:${item.count}`}
															tone={classificationTone(item.label)}
														/>
													))}
												</div>
											) : null}
											{box.notes.length > 0 ? (
												<div className="mt-2 grid gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
													{box.notes.slice(0, 3).map((note, index) => (
														<div key={`${box.boxId}-note-${index}`} className="truncate">
															{note}
														</div>
													))}
												</div>
											) : null}
										</DividerCard>
									)
								})}
							</div>
						) : (
							<SideAgentsEmpty
								label="no live box digests"
								detail="babysitter feed missing or clear. box boundaries stay reserved for live digest rows."
							/>
						)}
					</SideAgentsSection>
					<SideAgentsSection title="decisions" meta={`${decisionRows.length} live / ${model.attention.status}`}>
						<div className="mb-2 flex flex-wrap items-center gap-1">
							<SourceBadgeRow
								provenance={decisionRows.length > 0 ? "live-fed" : model.attention.status === "missing" ? "missing" : "detected"}
								freshness={model.attention.freshness}
								age={model.sources.feed.updatedAt ? fmtAge(model.sources.feed.updatedAt) : null}
								reasonCount={model.attention.reasons.length}
							/>
						</div>
						{decisionRows.length > 0 ? (
							<div className="grid gap-2">
								{decisionRows.slice(0, 8).map((item, index) => {
									const target = sessionRouteCandidate(item.sessionId, item.dir, model)
									const clickable = Boolean(target)
									return (
										<DividerCard key={`${item.boxId}-${item.sessionId}-${index}`}>
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div className="min-w-0">
													{clickable && target ? (
														<InlineLink
															label={item.title}
															onClick={() => navigateToSession(target)}
															className="block max-w-full truncate text-left text-neutral-900 hover:text-amber-500 dark:text-neutral-100"
														/>
													) : (
														<div className="truncate text-neutral-900 dark:text-neutral-100">{item.title}</div>
													)}
													<div className="mt-1 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
														{item.boxId} · {item.sessionId}
													</div>
												</div>
												<div className="flex flex-wrap justify-end gap-1">
													<SideAgentsStatusBadge label={item.classification} tone={classificationTone(item.classification)} />
													<SideAgentsStatusBadge label={`src:${item.source}`} tone={sourceBadgeTone(item.source === "attention" ? "live-fed" : "detected")} />
													{clickable ? <SideAgentsStatusBadge label="link:session" tone={sourceBadgeTone("detected")} /> : null}
												</div>
											</div>
											<div className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400">{item.reason}</div>
											{item.gist ? (
												<div className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">{item.gist}</div>
											) : null}
										</DividerCard>
									)
								})}
							</div>
						) : model.attention.humanQueue ? (
							<SideAgentsEmpty
								label="live babysitter decisions clear"
								detail="AskHuman queue separate. this section only renders mapper-fed babysitter attention or digest-derived session escalations."
							/>
						) : (
							<SideAgentsEmpty
								label="no live babysitter decisions"
								detail="waiting for feed attention or digest-level decision-needed/error rows."
							/>
						)}
					</SideAgentsSection>
					<SideAgentsSection title="actions" meta={`${recentActions.length} recent`}>
						<div className="mb-2 flex flex-wrap items-center gap-1">
							<SourceBadgeRow
								provenance={recentActions.length > 0 ? "live-fed" : model.sources.feed.status === "missing" ? "missing" : "live-fed"}
								freshness={model.sources.feed.freshness}
								age={model.sources.feed.updatedAt ? fmtAge(model.sources.feed.updatedAt) : null}
								reasonCount={model.sources.feed.reasons.length}
							/>
						</div>
						{recentActions.length > 0 ? (
							<div className="grid gap-2">
								{recentActions.slice(0, 8).map((action, index) => (
									<DividerCard key={`${action.sessionId}-${action.at}-${index}`}>
										<div className="flex items-center justify-between gap-2">
											<span className="truncate">{action.action}</span>
											<SideAgentsStatusBadge label={action.ok ? "ok" : "failed"} />
										</div>
										<div className="mt-1 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
											{action.boxId} · {action.sessionId}
										</div>
										<div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{action.reason}</div>
									</DividerCard>
								))}
							</div>
						) : (
							<SideAgentsEmpty
								label="no recent loop actions"
								detail="action stack shell live. mapper-fed resumes/unwedges/escalations plug in here."
							/>
						)}
					</SideAgentsSection>
					<SideAgentsSection title="queue" meta={`${queue.jobs.length} jobs / ${queue.claims.length} claims`}>
						<div className="mb-2 flex flex-wrap items-center gap-1">
							<SourceBadgeRow
								provenance={model.sources.queue.status === "missing" ? "missing" : "detected"}
								freshness={model.queue.freshness}
								age={model.queue.updatedAt ? fmtAge(model.queue.updatedAt) : null}
								reasonCount={model.queue.reasons.length}
							/>
							<SideAgentsStatusBadge label={`registry:${detectedRegistryEntries.length}`} tone={sourceBadgeTone("detected")} />
						</div>
						{queueGroups.length > 0 ? (
							<div className="grid gap-3">
								{queueGroups.map((group) => (
									<div key={group.key}>
										<div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
											{group.label}
										</div>
										<div className="grid gap-1">
											{group.jobs.slice(0, 4).map((job, index) => (
												<DividerCard key={`${group.key}-job-${job.jobId ?? index}`}>
													<div className="truncate">{job.ticketId ?? job.jobId ?? "job"}</div>
													<div className="text-[10px] text-neutral-500 dark:text-neutral-400">{job.state ?? "--"}</div>
												</DividerCard>
											))}
											{group.claims.slice(0, 3).map((claim, index) => (
												<DividerCard key={`${group.key}-claim-${claim.claimId ?? index}`}>
													<div className="truncate">{claim.jobId ?? claim.claimId ?? "claim"}</div>
													<div className="text-[10px] text-neutral-500 dark:text-neutral-400">{claim.state ?? "--"}</div>
												</DividerCard>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<SideAgentsEmpty
								label="queue containers ready"
								detail={queue.helper ?? "jobs/claims groups come from shared mapper outputs when queue rows arrive."}
							/>
						)}
					</SideAgentsSection>
					<SideAgentsSection title="registry" meta={`${liveRegistryEntries.length + detectedRegistryEntries.length + staticRegistryEntries.length} known`}>
						<div className="mb-2 flex flex-wrap items-center gap-1">
							<SideAgentsStatusBadge label={`live:${liveRegistryEntries.length}`} tone={sourceBadgeTone("live-fed")} />
							<SideAgentsStatusBadge label={`detected:${detectedRegistryEntries.length}`} tone={sourceBadgeTone("detected")} />
							<SideAgentsStatusBadge label={`static:${staticRegistryEntries.length}`} tone={sourceBadgeTone("static")} />
						</div>
						<div className="grid gap-2">
							{[...detectedRegistryEntries, ...staticRegistryEntries].map((entry) => {
								const docsPath = sourceDocPath(entry.docsLink)
								return (
									<DividerCard key={entry.id}>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="truncate text-neutral-900 dark:text-neutral-100">{entry.label}</div>
												<div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{entry.responsibilities}</div>
											</div>
											<div className="flex flex-wrap justify-end gap-1">
												<SideAgentsStatusBadge label={`src:${sourceLabel(entry.provenance)}`} tone={sourceBadgeTone(entry.provenance)} />
												<SideAgentsStatusBadge label={`charter:${entry.charterStatus}`} />
												{docsPath ? <SideAgentsStatusBadge label="link:doc" tone={sourceBadgeTone("detected")} /> : null}
											</div>
										</div>
										<div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
											<span>{entry.id}</span>
											{docsPath ? (
												<InlineLink
													label={docsPath}
													onClick={() => void openExternalUrl(docsPath)}
													className="truncate text-left text-sky-500 hover:text-sky-400"
												/>
											) : (
												<span>no doc authority</span>
											)}
										</div>
									</DividerCard>
								)
							})}
						</div>
					</SideAgentsSection>
				</div>
			</div>
		</div>
	)
}

const AgentsPanel = memo(function AgentsPanel() {
	const query = useQuery({
		queryKey: ["pm-side-agents-panel"],
		queryFn: async (): Promise<SideAgentsPanelModel> => {
			const pmState = await fetchCh5PmState()
			const feedPayload = await fetchCh5PmSideAgentFeed().catch<Ch5PmSideAgentPayload | undefined>(() => undefined)
			const queuePayload = await fetchCh5PmSideAgentQueue().catch<Ch5PmSideAgentQueuePayload | undefined>(() => undefined)
			const healthPayload = await fetchCh5PmSideAgentHealth().catch<Ch5PmSideAgentHealthPayload | undefined>(() => undefined)
			const payload: SideAgentsQueryResult = {
				pmState,
				feedPayload: normalizeFeedPayload(feedPayload),
				queuePayload,
				healthPayload,
			}
			return composePmSideAgentsModel(payload)
		},
		refetchInterval: POLL_MS,
		staleTime: 10_000,
	})

	const model = query.data
	const loading = query.isLoading && !model
	const errMsg = query.error instanceof Error ? query.error.message : query.error ? "load failed" : null

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
				Loading side-agent shell...
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			{errMsg && !model ? (
				<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-red-400 dark:bg-neutral-950">
					{errMsg}
				</div>
			) : model ? (
				<SideAgentsPanelBody
					model={model}
					onRefresh={() => void query.refetch()}
					isRefreshing={query.isFetching}
				/>
			) : (
				<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
					No side-agent data.
				</div>
			)}
		</div>
	)
})

export const PmSideAgentsPanel = AgentsPanel
