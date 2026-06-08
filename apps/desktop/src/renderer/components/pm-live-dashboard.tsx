import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"
import { useMemo } from "react"
import type {
	Ch5PmLiveBackgroundAgent,
	Ch5PmLiveBox,
	Ch5PmLiveLane,
	Ch5PmLiveReadyFrontierTicket,
	Ch5PmLiveSession,
	Ch5PmLiveState,
	Ch5PmNeedsChrisItem,
	Ch5PmFollowUp,
} from "../ch5pm-dashboard/types"
import { createLogger } from "../lib/logger"
import { fetchCh5PmState, openExternalUrl } from "../services/backend"

const log = createLogger("pm-live-dashboard")

const POLL_MS = 15_000

const BOX_COLS = "52px minmax(0,0.8fr) minmax(0,1.2fr) 20px"
const NEEDS_COLS = "72px minmax(0,1fr) 48px 52px"
const FOLLOWUP_COLS = "64px minmax(0,1fr) 68px 82px"
const FRONTIER_COLS = "72px minmax(0,1fr) 68px 52px"
const AGENT_COLS = "minmax(0,1fr) 72px minmax(0,0.9fr)"
const COMPLETE_COLS = "18px minmax(0,1fr)"

const SESSION_COLS = "52px minmax(0,1.8fr) minmax(0,1fr) 54px 68px minmax(0,1.2fr)"

const GLYPH: Record<string, string> = {
	working: "\u25B6",
	done: "\u25FC",
	nudged: "\u2192",
	idle: "\u25C7",
	"needs-chris": "\u2717",
}

type LaneStatus = keyof typeof GLYPH

function normalizeLaneStatus(status?: string): LaneStatus {
	const s = status?.trim().toLowerCase() ?? "idle"
	if (s.includes("need") || s.includes("human")) return "needs-chris"
	if (s.includes("nudge")) return "nudged"
	if (s.includes("done") || s.includes("claim")) return "done"
	if (s.includes("work") || s.includes("busy") || s.includes("run")) return "working"
	return "idle"
}

function fmtAge(value?: string): string {
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

function openUrl(url?: string) {
	if (!url) return
	void openExternalUrl(url).catch((err) => log.warn("open url failed", { url, err }))
}

function H({ children, className }: { children?: React.ReactNode; className?: string }) {
	return (
		<div
			className={`truncate px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 ${className ?? ""}`}
		>
			{children}
		</div>
	)
}

function C({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={`truncate px-1.5 py-0.5 text-[10px] leading-3 ${className ?? ""}`}>{children}</div>
	)
}

function SecRow({ label, meta }: { label: string; meta?: string }) {
	return (
		<div className="flex h-5 items-center justify-between border-b border-neutral-300 bg-neutral-100 px-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
			<span>{label}</span>
			{meta && <span className="truncate font-normal tracking-[0.1em]">{meta}</span>}
		</div>
	)
}

function StatPill({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
	return (
		<div className="flex items-center gap-1 border-l border-neutral-300 px-2 py-0.5 text-[10px] dark:border-neutral-700 first:border-l-0">
			<span className="text-[9px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">{label}</span>
			<span className={`font-medium ${tone ?? "text-neutral-900 dark:text-neutral-100"}`}>{value}</span>
		</div>
	)
}

function BoxRow({ box }: { box: Ch5PmLiveBox }) {
	const healthy = box.daemon.health === "healthy"
	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: BOX_COLS }}
		>
			<C className={healthy ? "text-emerald-400" : "text-red-400"}>{box.id}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{box.role ?? "box"}</C>
			<C className="truncate text-neutral-400 dark:text-neutral-500">{box.opencodeServe ?? box.daemon.url ?? ""}</C>
			<C className="px-0 text-center">
				<button
					type="button"
					onClick={() => openUrl(box.daemon.url)}
					className="text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
				>
					→
				</button>
			</C>
		</div>
	)
}

function SessionRow({ session, lane }: { session: Ch5PmLiveSession; lane?: Ch5PmLiveLane }) {
	const router = useRouter()
	const status = normalizeLaneStatus(lane?.status ?? session.state)
	const clickable = Boolean(session.projectSlug)

	function navigate() {
		if (!session.projectSlug) return
		void router.navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug: session.projectSlug, sessionId: session.id },
		})
	}

	const colorClass =
		status === "working" ? "text-emerald-400" :
		status === "needs-chris" ? "text-red-400" :
		status === "done" ? "text-sky-400" :
		"text-neutral-600 dark:text-neutral-400"

	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: SESSION_COLS }}
		>
			<C className={`font-medium ${colorClass}`}>{GLYPH[status]}</C>
			<C>
				<button
					type="button"
					onClick={navigate}
					disabled={!clickable}
					className={`block w-full truncate text-left ${clickable ? "text-neutral-900 dark:text-neutral-100 hover:text-amber-500" : "cursor-default text-neutral-500 dark:text-neutral-500"}`}
				>
					{session.title}
				</button>
			</C>
			<C className="truncate text-neutral-500 dark:text-neutral-400">{session.repo ?? "--"}</C>
			<C className="truncate text-neutral-500 dark:text-neutral-400">{session.box ?? "--"}</C>
			<C className="truncate text-neutral-500 dark:text-neutral-400">{lane?.status ?? session.state ?? "--"}</C>
			<C className="truncate text-neutral-400 dark:text-neutral-500">{lane?.goal ?? session.lane ?? ""}</C>
		</div>
	)
}

function NeedsRow({ item }: { item: Ch5PmNeedsChrisItem }) {
	return (
		<div
			className="grid border-b border-red-900/30 last:border-b-0"
			style={{ gridTemplateColumns: NEEDS_COLS }}
		>
			<C className="text-red-400">{item.ticket ?? "manual"}</C>
			<C className="truncate text-neutral-900 dark:text-neutral-100">{item.title ?? item.note ?? "attention"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{item.priority ?? "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{item.source ?? "--"}</C>
		</div>
	)
}

function FollowUpRow({ item }: { item: Ch5PmFollowUp }) {
	const status = item.status ?? "open"
	const statusColor =
		status === "done" ? "text-emerald-400" :
		status === "dispatched" ? "text-amber-400" :
		"text-red-400"
	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: FOLLOWUP_COLS }}
		>
			<C className="truncate text-neutral-500 dark:text-neutral-400">{item.source ?? "--"}</C>
			<C className="truncate text-neutral-900 dark:text-neutral-100">{item.item}</C>
			<C className={`font-medium ${statusColor}`}>{status}</C>
			<C className="truncate text-neutral-400 dark:text-neutral-500">{item.resolution ?? ""}</C>
		</div>
	)
}

function FrontierRow({ ticket }: { ticket: Ch5PmLiveReadyFrontierTicket }) {
	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: FRONTIER_COLS }}
		>
			<C className="text-sky-400">{ticket.ticket}</C>
			<C className="truncate text-neutral-900 dark:text-neutral-100">{ticket.title}</C>
			<C className="truncate text-neutral-500 dark:text-neutral-400">{ticket.repo ?? "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{ticket.priority ?? "--"}</C>
		</div>
	)
}

function AgentRow({ agent }: { agent: Ch5PmLiveBackgroundAgent }) {
	const ms = Object.entries(agent.milestones ?? {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(" ")
	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: AGENT_COLS }}
		>
			<C className="text-neutral-900 dark:text-neutral-100">{agent.task}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{agent.status ?? "--"}</C>
			<C className="truncate text-neutral-400 dark:text-neutral-500">{ms || "--"}</C>
		</div>
	)
}

function CompleteRow({ item }: { item: string }) {
	return (
		<div
			className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700"
			style={{ gridTemplateColumns: COMPLETE_COLS }}
		>
			<C className="px-1.5 text-center text-emerald-500">\u2713</C>
			<C className="truncate text-neutral-600 dark:text-neutral-400">{item}</C>
		</div>
	)
}

function Empty({ label }: { label: string }) {
	return <div className="px-1.5 py-1 text-[10px] text-neutral-400 dark:text-neutral-500">{label}</div>
}

export function PmLiveDashboard() {
	const query = useQuery({
		queryKey: ["pm-live-dashboard"],
		queryFn: fetchCh5PmState,
		refetchInterval: POLL_MS,
		staleTime: 10_000,
	})

	const data = query.data

	const lanesBySession = useMemo(() => {
		const m = new Map<string, Ch5PmLiveLane>()
		for (const lane of data?.lanes ?? []) {
			if (lane.session) m.set(lane.session, lane)
		}
		return m
	}, [data?.lanes])

	const workingCount = (data?.lanes ?? []).filter((l) => normalizeLaneStatus(l.status) === "working").length
	const needsCount = (data?.needsChris.length ?? 0) || (data?.plane.humanGated?.count ?? 0)
	const readyCount = data?.plane.readyFrontier.length ?? 0
	const errMsg = query.error instanceof Error ? query.error.message : query.error ? "load failed" : null

	const empty: Ch5PmLiveState = {
		boxes: [], sessions: [], lanes: [], backgroundAgents: [],
		plane: { readyFrontier: [] }, recentCompletions: [], needsChris: [],
	}
	const s = data ?? empty

	const SESSION_ROWS = 14
	const BOX_ROWS = 6
	const AGENT_ROWS = 5
	const COMPLETE_ROWS = 5
	const NEEDS_ROWS = 7
	const FOLLOWUP_ROWS = 8
	const FRONTIER_ROWS = 7

	const sessions = s.sessions.slice(0, SESSION_ROWS)
	const boxes = s.boxes.slice(0, BOX_ROWS)
	const agents = s.backgroundAgents.slice(0, AGENT_ROWS)
	const completes = s.recentCompletions.slice(0, COMPLETE_ROWS)
	const needs = s.needsChris.slice(0, NEEDS_ROWS)
	const followups = (s.followUps ?? []).slice(0, FOLLOWUP_ROWS)
	const frontier = s.plane.readyFrontier.slice(0, FRONTIER_ROWS)

	return (
		<div className="flex h-[calc(100vh-7.5rem)] min-h-[680px] flex-col overflow-hidden bg-white font-mono text-[10px] dark:bg-neutral-950 dark:text-neutral-200">

				<div className="flex h-full items-center border-r border-neutral-300 px-2 text-[10px] font-bold tracking-widest text-neutral-900 dark:border-neutral-700 dark:text-neutral-100">
					CH5PM
				</div>

				{s.babysitter ? (
					<div className="flex h-full items-center border-r border-neutral-300 px-2 text-[9px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
						<span className={`mr-1.5 font-bold ${s.babysitter.running ? "text-emerald-500" : "text-red-400"}`}>
							{s.babysitter.running ? "\u25CF" : "\u25CB"}
						</span>
						<span className="truncate">{s.babysitter.surface}</span>
						<span className="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
						<span className="truncate">{s.babysitter.package}</span>
						<span className="ml-2 text-neutral-400">{s.babysitter.loopSeconds}s</span>
					</div>
				) : null}

				<StatPill label="updated" value={fmtAge(s.updatedAt)} />
				<StatPill label="host" value={s.host ?? "--"} />
				<StatPill label="boxes" value={s.boxes.length} />
				<StatPill label="sessions" value={s.sessions.length} />
				<StatPill label="work" value={workingCount} tone="text-emerald-400" />
				<StatPill label="ready" value={readyCount} tone="text-sky-400" />
				<StatPill label="needs" value={needsCount} tone={needsCount > 0 ? "text-red-400" : undefined} />
				<StatPill label="schema" value={s.schemaVersion ?? "?"} />
				<StatPill label="followups" value={followups.length} />

				<div className="ml-auto flex h-full items-center border-l border-neutral-300 px-1.5 dark:border-neutral-700">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
						className="h-5 rounded-none border-0 px-1.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
					>
						<RefreshCwIcon className={`mr-1 size-2.5 ${query.isFetching ? "animate-spin" : ""}`} />
						sync
					</Button>
				</div>

			{errMsg ? (
				<div className="flex h-5 items-center border-b border-amber-600/30 bg-amber-950/30 px-2 text-[9px] uppercase tracking-[0.16em] text-amber-400">
					&#x26A0; {errMsg}
				</div>
			) : null}

			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(280px,0.75fr)]">

				<div className="grid min-h-0 grid-rows-[1fr_128px] border-r border-neutral-300 dark:border-neutral-700">
					<div className="min-h-0">
						<SecRow label="sessions" meta={`${s.sessions.length} live`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: SESSION_COLS }}>
							<H>st</H><H>session</H><H>repo</H><H>box</H><H>lane</H><H>goal</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{sessions.length ? sessions.map((ss) => (
								<SessionRow key={ss.id} session={ss} lane={lanesBySession.get(ss.id)} />
							)) : <Empty label="no live sessions" />}
						</div>
					</div>
					<div className="grid min-h-0 grid-rows-[1fr_1fr] border-t border-neutral-300 dark:border-neutral-700">
						<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
							<SecRow label="agents" meta={`${s.backgroundAgents.length}`} />
							<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: AGENT_COLS }}>
								<H>task</H><H>status</H><H>milestones</H>
							</div>
							<div className="min-h-0 overflow-hidden">
								{agents.length ? agents.map((a, i) => <AgentRow key={`${a.task}-${i}`} agent={a} />) : <Empty label="no agents" />}
							</div>
						</div>
						<div className="min-h-0">
							<SecRow label="completions" meta={`${s.recentCompletions.length}`} />
							<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: COMPLETE_COLS }}>
								<H/><H>item</H>
							</div>
							<div className="min-h-0 overflow-hidden">
								{completes.length ? completes.map((c, i) => <CompleteRow key={`${c}-${i}`} item={c} />) : <Empty label="no completions" />}
							</div>
						</div>
					</div>
				</div>

				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] border-r border-neutral-300 dark:border-neutral-700">
					<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
						<SecRow label="needs chris" meta={needsCount > 0 ? `${needsCount}` : undefined} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: NEEDS_COLS }}>
							<H>ticket</H><H>title</H><H>prio</H><H>src</H>
						</div>
						<div className="min-h-0 overflow-hidden bg-red-950/10 dark:bg-red-950/20">
							{needs.length ? needs.map((n, i) => <NeedsRow key={`${n.ticket ?? n.title ?? "n"}-${i}`} item={n} />) : (
								<Empty label={needsCount > 0 ? `${needsCount} human-gated` : "clear"} />
							)}
						</div>
					</div>
					<div className="min-h-0">
						<SecRow label="ready frontier" meta={`${s.plane.projects ?? 0}p ${s.plane.epics ?? 0}e`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: FRONTIER_COLS }}>
							<H>ticket</H><H>title</H><H>repo</H><H>prio</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{frontier.length ? frontier.map((t) => <FrontierRow key={t.ticket} ticket={t} />) : <Empty label="no ready frontier" />}
						</div>
					</div>
				</div>

				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_144px]">
					<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
						<SecRow label="followups" meta={`${(s.followUps ?? []).length}`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: FOLLOWUP_COLS }}>
							<H>src</H><H>item</H><H>status</H><H>resolution</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{followups.length ? followups.map((f, i) => <FollowUpRow key={`${f.source ?? "f"}-${i}`} item={f} />) : <Empty label="no followups" />}
						</div>
					</div>
					<div className="min-h-0">
						<SecRow label="boxes" meta={`${s.boxes.length}`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: BOX_COLS }}>
							<H>id</H><H>role</H><H>serve</H><H/>
						</div>
						<div className="min-h-0 overflow-hidden">
							{boxes.length ? boxes.map((b) => <BoxRow key={b.id} box={b} />) : <Empty label="no boxes" />}
						</div>
					</div>
				</div>
			</div>

			<div className="flex h-4 items-center justify-between border-t border-neutral-300 bg-neutral-50 px-2 text-[9px] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
				<span className="truncate">pm-state.json via firefly</span>
				<span className="truncate">{s.generatedBy ?? "--"}</span>
			</div>
		</div>
	)
}
