import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { DockviewReact, type DockviewReadyEvent } from "dockview"
import { RefreshCwIcon } from "lucide-react"
import { memo } from "react"
import type {
	Ch5PmSideAgentPayload,
	Ch5PmSideAgentHealthPayload,
	Ch5PmSideAgentQueuePayload,
} from "../pm-side-agents/types"
import { composePmSideAgentsModel } from "../pm-side-agents/composition"
import {
	fetchCh5PmSideAgentFeed,
	fetchCh5PmSideAgentHealth,
	fetchCh5PmSideAgentQueue,
	fetchCh5PmState,
} from "../services/backend"
import { PmLiveDashboard } from "./pm-live-dashboard"

const PANEL_DENSE = "pm-dense-console"
const PANEL_LINEAGE = "pm-lineage"
const PANEL_AGENTS = "pm-agents"

const POLL_MS = 15_000

const DenseConsolePanel = memo(function DenseConsolePanel() {
	return <PmLiveDashboard />
})

const LineagePanel = memo(function LineagePanel() {
	return (
		<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
			See the lineage strip at the top of the Dense Console panel. Individual pane splitting is a follow-up slice.
		</div>
	)
})

function SideAgentsStatusBadge({ label, tone }: { label: string; tone?: string }) {
	return (
		<span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${tone ?? "border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"}`}>
			{label}
		</span>
	)
}

function SideAgentsSection({
	title,
	meta,
	children,
}: {
	title: string
	meta?: string
	children: React.ReactNode
}) {
	return (
		<section className="flex min-h-0 flex-col border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
			<div className="flex h-6 items-center justify-between bg-neutral-100 px-2 text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
				<span>{title}</span>
				{meta ? <span className="truncate font-normal tracking-[0.1em]">{meta}</span> : null}
			</div>
			<div className="min-h-0 overflow-auto px-2 py-2">{children}</div>
		</section>
	)
}

function SideAgentsEmpty({ label }: { label: string }) {
	return <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{label}</div>
}

type SideAgentsPanelModel = ReturnType<typeof composePmSideAgentsModel>

function SideAgentsPanelBody({ model }: { model: SideAgentsPanelModel }) {
	const feed = model.feed
	const queue = model.queue
	const loop = model.loop
	const healthTone = model.degraded.severity === "healthy"
		? "border-emerald-500/40 text-emerald-500"
		: model.degraded.severity === "offline"
			? "border-red-500/40 text-red-400"
			: "border-amber-500/40 text-amber-400"

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-mono text-[10px] dark:bg-neutral-950 dark:text-neutral-200">
			<div className="flex h-8 items-center gap-2 border-b border-neutral-300 bg-neutral-100 px-2 dark:border-neutral-700 dark:bg-neutral-900">
				<div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-900 dark:text-neutral-100">Side Agents</div>
				<SideAgentsStatusBadge label={model.status.live} tone={healthTone} />
				<SideAgentsStatusBadge label={`feed:${model.freshness.feed}`} />
				<SideAgentsStatusBadge label={`queue:${model.freshness.queue}`} />
				<SideAgentsStatusBadge label={`health:${model.freshness.health}`} />
			</div>
			{model.degraded.bannerReasons.length > 0 ? (
				<div className="border-b border-red-600/30 bg-red-950/30 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-red-300">
					{model.degraded.bannerReasons.join(" · ")}
				</div>
			) : null}
			<div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
				<SideAgentsSection title="loop" meta={loop.status}>
					<div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
						<div className="text-neutral-500 dark:text-neutral-400">source</div><div>{loop.source}</div>
						<div className="text-neutral-500 dark:text-neutral-400">last run</div><div>{loop.lastRunAt ?? "--"}</div>
						<div className="text-neutral-500 dark:text-neutral-400">last digest</div><div>{loop.lastDigestAt ?? "--"}</div>
						<div className="text-neutral-500 dark:text-neutral-400">passes</div><div>{loop.passes ?? "--"}</div>
						<div className="text-neutral-500 dark:text-neutral-400">interval</div><div>{loop.intervalSeconds ?? "--"}</div>
					</div>
					{loop.lastError ? <div className="mt-2 text-[10px] text-red-400">{loop.lastError}</div> : null}
				</SideAgentsSection>
				<SideAgentsSection title="decisions" meta={`${model.attention.live.length}`}>
					{model.attention.live.length > 0 ? (
						<div className="grid gap-2">
							{model.attention.live.slice(0, 8).map((item: SideAgentsPanelModel["attention"]["live"][number], index: number) => (
								<div key={`${item.sessionId}-${index}`} className="rounded border border-neutral-200 px-2 py-1 dark:border-neutral-800">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-[10px] text-neutral-100 dark:text-neutral-100">{item.title}</span>
										<SideAgentsStatusBadge label={item.classification} />
									</div>
									<div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{item.reason}</div>
								</div>
							))}
						</div>
					) : (
						<SideAgentsEmpty label="no live babysitter decisions" />
					)}
				</SideAgentsSection>
				<SideAgentsSection title="boxes" meta={`${feed?.boxes.length ?? 0}`}>
					{feed?.boxes?.length ? (
						<div className="grid gap-2">
							{feed.boxes.slice(0, 8).map((box: typeof feed.boxes[number]) => (
								<div key={box.boxId} className="rounded border border-neutral-200 px-2 py-1 dark:border-neutral-800">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate">{box.boxId}</span>
										<SideAgentsStatusBadge label={`${box.sessions.length} sessions`} />
									</div>
									<div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
										interval {box.intervalSeconds}s · actions {box.actions.length} · notes {box.notes.length}
									</div>
								</div>
							))}
						</div>
					) : (
						<SideAgentsEmpty label="no live box digests" />
					)}
				</SideAgentsSection>
				<SideAgentsSection title="queue" meta={`${queue.jobs.length} jobs / ${queue.claims.length} claims`}>
					{queue.jobs.length || queue.claims.length ? (
						<div className="grid gap-3">
							<div>
								<div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">jobs</div>
								<div className="grid gap-1">
									{queue.jobs.slice(0, 6).map((job: typeof queue.jobs[number], index: number) => (
										<div key={`${job.jobId ?? index}`} className="rounded border border-neutral-200 px-2 py-1 dark:border-neutral-800">
											<div className="truncate">{job.ticketId ?? job.jobId ?? "job"}</div>
											<div className="text-[10px] text-neutral-500 dark:text-neutral-400">{job.state ?? "--"}</div>
										</div>
									))}
								</div>
							</div>
							<div>
								<div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">claims</div>
								<div className="grid gap-1">
									{queue.claims.slice(0, 6).map((claim: typeof queue.claims[number], index: number) => (
										<div key={`${claim.claimId ?? index}`} className="rounded border border-neutral-200 px-2 py-1 dark:border-neutral-800">
											<div className="truncate">{claim.jobId ?? claim.claimId ?? "claim"}</div>
											<div className="text-[10px] text-neutral-500 dark:text-neutral-400">{claim.state ?? "--"}</div>
										</div>
									))}
								</div>
							</div>
						</div>
					) : (
						<SideAgentsEmpty label="no queue rows" />
					)}
				</SideAgentsSection>
			</div>
		</div>
	)
}

const AgentsPanel = memo(function AgentsPanel() {
	const query = useQuery({
		queryKey: ["pm-side-agents-panel"],
		queryFn: async (): Promise<SideAgentsPanelModel> => {
			const pmState = await fetchCh5PmState()
			const feedPayloadResult = await fetchCh5PmSideAgentFeed().then<{ value: Ch5PmSideAgentPayload | undefined }>((value) => ({ value }), () => ({ value: undefined }))
			const queuePayloadResult = await fetchCh5PmSideAgentQueue().then<{ value: Ch5PmSideAgentQueuePayload | undefined }>((value) => ({ value }), () => ({ value: undefined }))
			const healthPayloadResult = await fetchCh5PmSideAgentHealth().then<{ value: Ch5PmSideAgentHealthPayload | undefined }>((value) => ({ value }), () => ({ value: undefined }))
			return composePmSideAgentsModel({
				pmState,
				feedPayload: feedPayloadResult.value,
				queuePayload: queuePayloadResult.value,
				healthPayload: healthPayloadResult.value,
			})
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
				Loading side-agent feed...
			</div>
		)
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			<div className="flex h-7 items-center justify-end border-b border-neutral-300 bg-neutral-100 px-2 dark:border-neutral-700 dark:bg-neutral-900">
				<Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="h-5 rounded-none border-0 px-1.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
					<RefreshCwIcon className={`mr-1 size-2.5 ${query.isFetching ? "animate-spin" : ""}`} />
					sync
				</Button>
			</div>
			{errMsg && !model ? (
				<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-red-400 dark:bg-neutral-950">
					{errMsg}
				</div>
			) : model ? (
				<SideAgentsPanelBody model={model} />
			) : (
				<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
					No side-agent data.
				</div>
			)}
		</div>
	)
})

function PmDockviewShellImpl({ onReady }: { onReady?: (event: DockviewReadyEvent) => void }) {
	function handleReady(event: DockviewReadyEvent) {
		if (event.api.panels.length === 0) {
			event.api.addPanel({
				id: PANEL_DENSE,
				title: "Dense Console",
				component: PANEL_DENSE,
			})
			event.api.addPanel({
				id: PANEL_AGENTS,
				title: "Side Agents",
				component: PANEL_AGENTS,
				position: { direction: "within", referencePanel: PANEL_DENSE },
				inactive: true,
			})
			event.api.addPanel({
				id: PANEL_LINEAGE,
				title: "Lineage",
				component: PANEL_LINEAGE,
				position: { direction: "within", referencePanel: PANEL_DENSE },
				inactive: true,
			})
		}
		onReady?.(event)
	}

	return (
		<div className="dockview-theme-light dark:dockview-theme-dark h-full w-full">
			<DockviewReact
				className="h-full w-full"
				components={{
					[PANEL_DENSE]: DenseConsolePanel,
					[PANEL_LINEAGE]: LineagePanel,
					[PANEL_AGENTS]: AgentsPanel,
				}}
				onReady={handleReady}
			/>
		</div>
	)
}

export const PmDockviewShell = memo(PmDockviewShellImpl)
