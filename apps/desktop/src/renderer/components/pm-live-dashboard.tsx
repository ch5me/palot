import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"
import { useMemo } from "react"
import type {
	Ch5PmLiveBackgroundAgent,
	Ch5PmLiveBox,
	Ch5PmLiveLane,
	Ch5PmLivePlaneSummary,
	Ch5PmLiveSession,
	Ch5PmLiveState,
	Ch5PmNeedsChrisItem,
} from "../ch5pm-dashboard/types"
import { createLogger } from "../lib/logger"
import { fetchCh5PmState, openExternalUrl } from "../services/backend"

const log = createLogger("pm-live-dashboard")

const POLL_MS = 15_000
const SESSION_COLUMNS = "72px minmax(0,1.9fr) minmax(0,1.2fr) 68px 86px minmax(0,1.3fr)"
const BOX_COLUMNS = "72px minmax(0,0.9fr) minmax(0,1.1fr) 28px"
const NEEDS_COLUMNS = "92px minmax(0,1fr) 62px 74px"
const FRONTIER_COLUMNS = "86px minmax(0,1fr) 82px 76px"
const AGENT_COLUMNS = "minmax(0,1.15fr) 90px minmax(0,1fr)"
const COMPLETION_COLUMNS = "28px minmax(0,1fr)"

const STATUS_STYLES: Record<string, string> = {
	working: "bg-emerald-500/18 text-emerald-300",
	done: "bg-sky-500/18 text-sky-300",
	idle: "bg-muted text-muted-foreground",
	nudged: "bg-blue-500/18 text-blue-300",
	"needs-chris": "bg-rose-500/18 text-rose-300",
}

function normalizeLaneStatus(status?: string): keyof typeof STATUS_STYLES {
	const normalized = status?.trim().toLowerCase() ?? "idle"
	if (normalized.includes("need") || normalized.includes("human")) return "needs-chris"
	if (normalized.includes("nudge")) return "nudged"
	if (normalized.includes("done") || normalized.includes("claim")) return "done"
	if (normalized.includes("work") || normalized.includes("busy") || normalized.includes("run")) return "working"
	return "idle"
}

function formatTimeAgo(value?: string): string {
	if (!value) return "--"
	const timestamp = Date.parse(value)
	if (Number.isNaN(timestamp)) return value
	const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
	if (deltaSeconds < 60) return `${deltaSeconds}s`
	const deltaMinutes = Math.floor(deltaSeconds / 60)
	if (deltaMinutes < 60) return `${deltaMinutes}m`
	const deltaHours = Math.floor(deltaMinutes / 60)
	if (deltaHours < 48) return `${deltaHours}h`
	const deltaDays = Math.floor(deltaHours / 24)
	return `${deltaDays}d`
}

function formatCompact(value?: string): string {
	if (!value) return "--"
	return value.replace(/^https?:\/\//, "")
}

function openUrl(url?: string) {
	if (!url) return
	void openExternalUrl(url).catch((error) => {
		log.warn("failed to open external url", { url, error })
	})
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={`truncate px-2 py-1 font-medium uppercase tracking-[0.18em] text-muted-foreground ${className ?? ""}`}>{children}</div>
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={`truncate px-2 py-1 ${className ?? ""}`}>{children}</div>
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
	return (
		<div className="flex h-7 items-center justify-between border-b border-border bg-background px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
			<span>{title}</span>
			{meta ? <span className="truncate">{meta}</span> : null}
		</div>
	)
}

function StripStat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
	return (
		<div className="flex min-w-0 items-center gap-2 border-l border-border px-2 first:border-l-0">
			<div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
			<div className={`truncate text-[12px] font-semibold ${tone ?? "text-foreground"}`}>{value}</div>
		</div>
	)
}

function BoxRow({ box }: { box: Ch5PmLiveBox }) {
	const healthy = box.daemon.health === "healthy"
	return (
		<div className="grid border-b border-border text-[11px] leading-4 last:border-b-0" style={{ gridTemplateColumns: BOX_COLUMNS }}>
			<Cell className={healthy ? "text-emerald-300" : "text-rose-300"}>{box.id}</Cell>
			<Cell className="text-muted-foreground">{box.role ?? "box"}</Cell>
			<Cell className="text-muted-foreground">{formatCompact(box.opencodeServe ?? box.daemon.url)}</Cell>
			<Cell className="px-0 text-right">
				<button
					type="button"
					onClick={() => openUrl(box.daemon.url)}
					className="h-5 w-5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
				>
					&gt;
				</button>
			</Cell>
		</div>
	)
}

function SessionRow({ session, lane }: { session: Ch5PmLiveSession; lane?: Ch5PmLiveLane }) {
	const router = useRouter()
	const laneStatus = normalizeLaneStatus(lane?.status ?? session.state)
	const clickable = Boolean(session.projectSlug)

	function handleSessionClick() {
		if (!session.projectSlug) return
		void router.navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug: session.projectSlug, sessionId: session.id },
		})
	}

	return (
		<div className="grid border-b border-border text-[11px] leading-4 last:border-b-0" style={{ gridTemplateColumns: SESSION_COLUMNS }}>
			<Cell className={`uppercase tracking-[0.12em] ${laneStatus === "working" ? "text-emerald-300" : laneStatus === "needs-chris" ? "text-rose-300" : laneStatus === "done" ? "text-sky-300" : "text-muted-foreground"}`}>
				{lane?.symbol ?? ".."}
			</Cell>
			<Cell>
				<button
					type="button"
					onClick={handleSessionClick}
					disabled={!clickable}
					className={`block w-full truncate text-left ${clickable ? "text-foreground hover:text-primary" : "cursor-default text-foreground/65"}`}
				>
					{session.title}
				</button>
			</Cell>
			<Cell className="text-muted-foreground">{session.repo ?? "--"}</Cell>
			<Cell className="text-muted-foreground">{session.box ?? "--"}</Cell>
			<Cell>
				<span className={`inline-flex min-w-0 max-w-full truncate px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] ${STATUS_STYLES[laneStatus]}`}>
					{lane?.status ?? session.state ?? "--"}
				</span>
			</Cell>
			<Cell className="text-muted-foreground">{lane?.goal ?? session.lane ?? session.id}</Cell>
		</div>
	)
}

function NeedsChrisRow({ item }: { item: Ch5PmNeedsChrisItem }) {
	return (
		<div className="grid border-b border-border text-[11px] leading-4 text-rose-300 last:border-b-0" style={{ gridTemplateColumns: NEEDS_COLUMNS }}>
			<Cell>{item.ticket ?? "manual"}</Cell>
			<Cell className="text-foreground">{item.title ?? item.note ?? "attention"}</Cell>
			<Cell className="text-muted-foreground">{item.priority ?? "--"}</Cell>
			<Cell className="text-muted-foreground">{item.source ?? "--"}</Cell>
		</div>
	)
}

function FrontierRow({ ticket }: { ticket: Ch5PmLivePlaneSummary["readyFrontier"][number] }) {
	return (
		<div className="grid border-b border-border text-[11px] leading-4 last:border-b-0" style={{ gridTemplateColumns: FRONTIER_COLUMNS }}>
			<Cell className="text-sky-300">{ticket.ticket}</Cell>
			<Cell className="text-foreground">{ticket.title}</Cell>
			<Cell className="text-muted-foreground">{ticket.repo ?? "--"}</Cell>
			<Cell className="text-muted-foreground">{ticket.priority ?? "--"}</Cell>
		</div>
	)
}

function AgentRow({ agent }: { agent: Ch5PmLiveBackgroundAgent }) {
	const milestones = Object.entries(agent.milestones ?? {})
	const summary = milestones.slice(0, 2).map(([label, value]) => `${label}:${value}`).join(" | ")
	return (
		<div className="grid border-b border-border text-[11px] leading-4 last:border-b-0" style={{ gridTemplateColumns: AGENT_COLUMNS }}>
			<Cell className="text-foreground">{agent.task}</Cell>
			<Cell className="text-muted-foreground">{agent.status ?? "--"}</Cell>
			<Cell className="text-muted-foreground">{summary || "--"}</Cell>
		</div>
	)
}

function CompletionRow({ item }: { item: string }) {
	return (
		<div className="grid border-b border-border text-[11px] leading-4 last:border-b-0" style={{ gridTemplateColumns: COMPLETION_COLUMNS }}>
			<Cell className="text-emerald-300">ok</Cell>
			<Cell className="text-foreground">{item}</Cell>
		</div>
	)
}

function EmptyRow({ label }: { label: string }) {
	return <div className="px-2 py-2 text-[11px] text-muted-foreground">{label}</div>
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
		const map = new Map<string, Ch5PmLiveLane>()
		for (const lane of data?.lanes ?? []) {
			if (lane.session) map.set(lane.session, lane)
		}
		return map
	}, [data?.lanes])

	const workingCount = (data?.lanes ?? []).filter((lane) => normalizeLaneStatus(lane.status) === "working").length
	const needsChrisCount = data?.needsChris.length ?? 0
	const readyCount = data?.plane.readyFrontier.length ?? 0
	const humanGatedCount = data?.plane.humanGated?.count ?? 0
	const errorMessage = query.error instanceof Error ? query.error.message : query.error ? "failed to load pm state" : null

	const emptyState: Ch5PmLiveState = {
		boxes: [],
		sessions: [],
		lanes: [],
		backgroundAgents: [],
		plane: { readyFrontier: [] },
		recentCompletions: [],
		needsChris: [],
	}

	const state = data ?? emptyState
	const sessions = state.sessions.slice(0, 14)
	const needsChris = state.needsChris.slice(0, 7)
	const frontier = state.plane.readyFrontier.slice(0, 7)
	const boxes = state.boxes.slice(0, 6)
	const agents = state.backgroundAgents.slice(0, 6)
	const completions = state.recentCompletions.slice(0, 6)

	return (
		<div className="flex h-[calc(100vh-7.5rem)] min-h-[720px] flex-col overflow-hidden border border-border bg-background text-[11px] text-foreground">
			<div className="flex h-8 items-center border-b border-border bg-muted/30">
				<div className="px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground">CH5PM</div>
				<StripStat label="updated" value={formatTimeAgo(state.updatedAt)} />
				<StripStat label="boxes" value={state.boxes.length} />
				<StripStat label="sessions" value={state.sessions.length} />
				<StripStat label="working" value={workingCount} tone="text-emerald-300" />
				<StripStat label="ready" value={readyCount} tone="text-sky-300" />
				<StripStat label="human" value={needsChrisCount || humanGatedCount} tone={(needsChrisCount || humanGatedCount) > 0 ? "text-rose-300" : undefined} />
				<StripStat label="schema" value={state.schemaVersion ?? "?"} />
				<div className="ml-auto flex h-full items-center border-l border-border px-1.5">
					<Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="h-6 rounded-none px-2 text-[10px] uppercase tracking-[0.16em]">
						<RefreshCwIcon className={`size-3 ${query.isFetching ? "animate-spin" : ""}`} />
						Sync
					</Button>
				</div>
			</div>

			{errorMessage ? (
				<div className="border-b border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-300">
					error {errorMessage}
				</div>
			) : null}

			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_168px] border-r border-border">
					<div className="grid min-h-0 grid-rows-[152px_minmax(0,1fr)]">
						<div className="min-h-0 border-b border-border">
							<SectionTitle title="boxes" meta={state.generatedBy ?? "feed"} />
							<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: BOX_COLUMNS }}>
								<HeaderCell>box</HeaderCell>
								<HeaderCell>role</HeaderCell>
								<HeaderCell>serve</HeaderCell>
								<HeaderCell className="text-right">go</HeaderCell>
							</div>
							<div className="min-h-0 overflow-hidden">
								{boxes.length > 0 ? boxes.map((box) => <BoxRow key={box.id} box={box} />) : <EmptyRow label="no boxes" />}
							</div>
						</div>

						<div className="min-h-0">
							<SectionTitle title="sessions" meta={`${state.sessions.length} live`} />
							<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: SESSION_COLUMNS }}>
								<HeaderCell>st</HeaderCell>
								<HeaderCell>session</HeaderCell>
								<HeaderCell>repo</HeaderCell>
								<HeaderCell>box</HeaderCell>
								<HeaderCell>lane</HeaderCell>
								<HeaderCell>goal</HeaderCell>
							</div>
							<div className="min-h-0 overflow-hidden">
								{sessions.length > 0 ? sessions.map((session) => <SessionRow key={session.id} session={session} lane={lanesBySession.get(session.id)} />) : <EmptyRow label="no live sessions" />}
							</div>
						</div>
					</div>

					<div className="grid min-h-0 grid-cols-[1fr_1fr]">
						<div className="min-h-0 border-r border-border">
							<SectionTitle title="background agents" meta={`${state.backgroundAgents.length}`} />
							<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: AGENT_COLUMNS }}>
								<HeaderCell>task</HeaderCell>
								<HeaderCell>status</HeaderCell>
								<HeaderCell>milestones</HeaderCell>
							</div>
							<div className="min-h-0 overflow-hidden">
								{agents.length > 0 ? agents.map((agent, index) => <AgentRow key={`${agent.task}-${index}`} agent={agent} />) : <EmptyRow label="no agents" />}
							</div>
						</div>

						<div className="min-h-0">
							<SectionTitle title="recent completions" meta={`${state.recentCompletions.length}`} />
							<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: COMPLETION_COLUMNS }}>
								<HeaderCell>ok</HeaderCell>
								<HeaderCell>item</HeaderCell>
							</div>
							<div className="min-h-0 overflow-hidden">
								{completions.length > 0 ? completions.map((item, index) => <CompletionRow key={`${item}-${index}`} item={item} />) : <EmptyRow label="no completions" />}
							</div>
						</div>
					</div>
				</div>

				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="min-h-0 border-b border-border">
						<SectionTitle title="needs chris" meta={humanGatedCount > 0 ? `human gated ${humanGatedCount}` : undefined} />
						<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: NEEDS_COLUMNS }}>
							<HeaderCell>ticket</HeaderCell>
							<HeaderCell>title</HeaderCell>
							<HeaderCell>prio</HeaderCell>
							<HeaderCell>src</HeaderCell>
						</div>
						<div className="min-h-0 overflow-hidden">
							{needsChris.length > 0 ? needsChris.map((item, index) => <NeedsChrisRow key={`${item.ticket ?? item.title ?? "need"}-${index}`} item={item} />) : <EmptyRow label={humanGatedCount > 0 ? `human gated ${humanGatedCount}` : "clear"} />}
						</div>
					</div>

					<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_72px]">
						<div className="min-h-0 border-b border-border">
							<SectionTitle title="ready frontier" meta={`${state.plane.projects ?? 0} proj | ${state.plane.epics ?? 0} epic`} />
							<div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: FRONTIER_COLUMNS }}>
								<HeaderCell>ticket</HeaderCell>
								<HeaderCell>title</HeaderCell>
								<HeaderCell>repo</HeaderCell>
								<HeaderCell>prio</HeaderCell>
							</div>
							<div className="min-h-0 overflow-hidden">
								{frontier.length > 0 ? frontier.map((ticket) => <FrontierRow key={ticket.ticket} ticket={ticket} />) : <EmptyRow label="no ready frontier" />}
							</div>
						</div>

						<div className="grid border-t border-border bg-muted/15 px-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
							<div className="flex items-center justify-between gap-2">
								<span className="truncate">adapter pm-state.json via firefly</span>
								<span className="truncate">{state.updatedAt ?? "--"}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
